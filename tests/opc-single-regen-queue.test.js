import test from 'node:test';
import assert from 'node:assert/strict';
import { queueSingleStartFrameRevision, activateCompletedStartFrame } from '../lib/pillar-start-frame-service.js';
import { getDb, updatePillarCampaignItem } from '../lib/db.js';
import { pgQuery } from '../lib/db-pg.js';

test('queueSingleStartFrameRevision enqueues durable asset and handles duplicate active requests', async () => {
  const db = getDb();
  const testCampaignId = `test_camp_${Date.now()}`;

  await db.prepare(`INSERT INTO pillar_campaigns (id, tenant_id, campaign_name, status, visual_mode, is_bridging_active, bridge_at_clip, bridge_duration_clips, target_product_id)
    VALUES (?, 'default_tenant', 'Test Campaign', 'ready', 'hybrid_lock', 1, 3, 1, 'prod_test_123')`).run(testCampaignId);

  const insertedItem = await pgQuery(
    `INSERT INTO pillar_campaign_items (campaign_id, t2i_images_json, start_frame_revision)
     VALUES ($1, '["/uploads/start_frames/dummy1.png"]', 1) RETURNING id`,
    [testCampaignId]
  );
  const testItemId = insertedItem.rows[0].id;

  // 1. Enqueue clip 3 (Product Bridge -> should be reference_critical: true)
  const q1 = await queueSingleStartFrameRevision(testItemId, {
    clip_index: 3,
    context: { campaignId: testCampaignId, itemId: testItemId, clipIndex: 3, prompt: 'test bridge prompt' },
    audit: { requires_product_reference: true, reference_count: 1, prompt_sha256: 'abc', request_fingerprint: 'def' }
  }, { idempotencyKey: 'idem_key_1' });

  assert.equal(q1.status, 'queued');
  assert.equal(q1.referenceCritical, true);
  assert.equal(q1.duplicate, false);
  assert.equal(q1.revision, 2);

  // 2. Immediate duplicate click on same item + clip -> returns existing asset
  const q2 = await queueSingleStartFrameRevision(testItemId, {
    clip_index: 3,
    context: { campaignId: testCampaignId, itemId: testItemId, clipIndex: 3, prompt: 'test bridge prompt' },
    audit: { requires_product_reference: true, reference_count: 1, prompt_sha256: 'abc', request_fingerprint: 'def' }
  }, { idempotencyKey: 'idem_key_1' });

  assert.equal(q2.duplicate, true);
  assert.equal(q2.assetId, q1.assetId);

  // 3. Activation: activate completed start frame
  const act = await activateCompletedStartFrame(q1.assetId, {
    localPath: `/uploads/start_frames/opc_start_frame_${testItemId}_clip_3_r2_task123.png`,
    checksum: 'dummy_checksum_123',
    revision: 2,
    clipIndex: 3,
    itemId: testItemId
  });

  assert.equal(act.success, true);
  assert.equal(act.activated, true);

  // Clean up
  await pgQuery('DELETE FROM pillar_campaign_item_assets WHERE campaign_item_id = $1', [String(testItemId)]);
  await pgQuery('DELETE FROM pillar_campaign_items WHERE id = $1', [testItemId]);
  await pgQuery('DELETE FROM pillar_campaigns WHERE id = $1', [testCampaignId]);
});
