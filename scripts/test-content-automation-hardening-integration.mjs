import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { pgQuery } from '../lib/db-pg.js';
import { tenantContext } from '../lib/tenant-context.js';
import { transitionPillarReview } from '../lib/pillar-campaign-approval.js';
import { recoverStaleStartFrameAssets } from '../lib/pillar-start-frame-service.js';
import { getProductCampaignFlags, saveProductCampaignFlags } from '../lib/content-automation-feature-flags.js';
import { executeIdempotentStage } from '../lib/pillar-stage-execution-service.js';

const tenantId = process.env.HARDENING_TEST_TENANT || 'default_tenant';
const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
const campaignId = `hardening_test_${suffix}`;
let itemId;

try {
  const tenantRows = (await pgQuery('SELECT id FROM tenants ORDER BY id LIMIT 2')).rows;
  assert.equal(tenantRows.length >= 2, true, 'Minimal dua tenant diperlukan untuk isolation test.');
  const firstFlags = await getProductCampaignFlags(tenantRows[0].id);
  const secondFlags = await getProductCampaignFlags(tenantRows[1].id);
  try {
    await saveProductCampaignFlags({ enabled: !firstFlags.enabled }, { tenantId: tenantRows[0].id });
    assert.equal((await getProductCampaignFlags(tenantRows[0].id)).enabled, !firstFlags.enabled);
    assert.deepEqual(await getProductCampaignFlags(tenantRows[1].id), secondFlags);
  } finally {
    await saveProductCampaignFlags(firstFlags, { tenantId: tenantRows[0].id });
  }
  await pgQuery(`INSERT INTO pillar_campaigns(id,tenant_id,campaign_name,content_pillar,custom_hook,visual_action_guideline,
    approval_mode,execution_mode,status) VALUES($1,$2,$3,'test','test','test','start_frames','guided','paused')`,
  [campaignId, tenantId, `Hardening fixture ${suffix}`]);
  itemId = (await pgQuery(`INSERT INTO pillar_campaign_items(campaign_id,workflow_status,review_revision,review_state,
    start_frame_status,start_frame_revision,start_frame_expected_count,start_frame_completed_count)
    VALUES($1,'ready_for_review',$2,'ready','completed',1,1,1) RETURNING id`, [campaignId, `review-${suffix}`])).rows[0].id;

  await tenantContext.run(tenantId, async () => {
    await assert.rejects(
      transitionPillarReview({ itemId, action: 'hold', reviewRevision: 'stale-revision', reason: 'integration test', actorId: 'hardening-test', idempotencyKey: `stale-${suffix}` }),
      error => error.code === 'PILLAR_APPROVAL_STALE_REVISION'
    );
    const held = await transitionPillarReview({ itemId, action: 'hold', reviewRevision: `review-${suffix}`, reason: 'integration test', actorId: 'hardening-test', idempotencyKey: `hold-${suffix}` });
    assert.equal(held.reviewState, 'held');
    const duplicate = await transitionPillarReview({ itemId, action: 'hold', reviewRevision: `review-${suffix}`, reason: 'integration test', actorId: 'hardening-test', idempotencyKey: `hold-${suffix}` });
    assert.equal(duplicate.idempotent, true);
    const resumed = await transitionPillarReview({ itemId, action: 'resume', reviewRevision: `review-${suffix}`, actorId: 'hardening-test', idempotencyKey: `resume-${suffix}` });
    assert.equal(resumed.reviewState, 'resumed');
    const concurrent = await Promise.allSettled([
      transitionPillarReview({ itemId, action: 'hold', reviewRevision: `review-${suffix}`, reason: 'concurrency a', actorId: 'hardening-test', idempotencyKey: `concurrent-a-${suffix}` }),
      transitionPillarReview({ itemId, action: 'hold', reviewRevision: `review-${suffix}`, reason: 'concurrency b', actorId: 'hardening-test', idempotencyKey: `concurrent-b-${suffix}` })
    ]);
    assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(concurrent.filter(result => result.status === 'rejected' && result.reason.code === 'PILLAR_REVIEW_CONCURRENT_UPDATE').length, 1);
    await transitionPillarReview({ itemId, action: 'resume', reviewRevision: `review-${suffix}`, actorId: 'hardening-test', idempotencyKey: `resume-after-concurrency-${suffix}` });
    const rejected = await transitionPillarReview({ itemId, action: 'reject', reviewRevision: `review-${suffix}`, reason: 'integration cleanup', actorId: 'hardening-test', idempotencyKey: `reject-${suffix}` });
    assert.equal(rejected.reviewState, 'rejected');

    let executions = 0;
    const stageOptions = { itemId, stage: 'integration_stage', revision: 1 };
    assert.equal((await executeIdempotentStage(stageOptions, async () => ({ executions: ++executions }))).executions, 1);
    const duplicateStage = await executeIdempotentStage(stageOptions, async () => ({ executions: ++executions }));
    assert.equal(duplicateStage.idempotent, true);
    assert.equal(executions, 1);
    await assert.rejects(executeIdempotentStage({ itemId, stage: 'integration_failure', revision: 1 }, async () => {
      const error = new Error('expected integration failure');
      error.code = 'EXPECTED_FAILURE';
      throw error;
    }), /expected integration failure/);
    const failedStage = (await pgQuery(`SELECT status FROM pillar_campaign_stage_executions
      WHERE tenant_id=$1 AND campaign_item_id=$2 AND stage='integration_failure'`, [tenantId, String(itemId)])).rows[0];
    assert.equal(failedStage.status, 'retry_wait');

    await pgQuery(`INSERT INTO pillar_campaign_item_assets(id,tenant_id,campaign_id,campaign_item_id,clip_index,asset_type,revision,status,lease_owner,lease_expires_at)
      VALUES($1,$2,$3,$4,1,'start_frame',1,'processing','dead-worker',CURRENT_TIMESTAMP-INTERVAL '1 minute')`,
    [`asset_${suffix}`, tenantId, campaignId, String(itemId)]);
    assert.equal(await recoverStaleStartFrameAssets(), 1);
    const recovered = (await pgQuery('SELECT status FROM pillar_campaign_item_assets WHERE id=$1', [`asset_${suffix}`])).rows[0];
    assert.equal(recovered.status, 'retry_wait');
  });
  console.log('Content Automation hardening integration tests passed.');
} finally {
  if (itemId) {
    await pgQuery('DELETE FROM pillar_campaign_item_assets WHERE campaign_item_id=$1', [String(itemId)]).catch(() => {});
    await pgQuery('DELETE FROM pillar_campaign_review_actions WHERE campaign_item_id=$1', [String(itemId)]).catch(() => {});
    await pgQuery('DELETE FROM pillar_campaign_stage_executions WHERE campaign_item_id=$1', [String(itemId)]).catch(() => {});
    await pgQuery('DELETE FROM pillar_campaign_items WHERE id=$1', [itemId]).catch(() => {});
  }
  await pgQuery('DELETE FROM pillar_campaigns WHERE id=$1', [campaignId]).catch(() => {});
  const pool = (await import('../lib/db-pg.js')).getPgPool();
  await pool.end();
}
