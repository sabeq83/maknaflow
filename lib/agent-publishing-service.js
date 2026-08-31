import { pgQuery } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';
import { createPublishingJobs } from './publishing-repository.js';
import crypto from 'crypto';

export async function evaluatePublishingIntent(runId, contentFlowItemId, accountId, platform, mediaType, mediaUrl, caption) {
  const tenantId = getActiveTenantId();
  const id = `apub_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;

  const payload = { contentFlowItemId, accountId, platform, mediaType, mediaUrl, caption };
  const payloadSha256 = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const idempotencyKey = `intent:${runId}:${contentFlowItemId}:${accountId}:${payloadSha256}`;

  const res = await pgQuery(`
    INSERT INTO agent_publishing_intents (
      id, tenant_id, run_id, content_flow_item_id, account_id, platform, payload_sha256, idempotency_key, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
    ON CONFLICT (tenant_id, content_flow_item_id, account_id, payload_sha256) DO NOTHING
    RETURNING *
  `, [id, tenantId, runId, contentFlowItemId, accountId, platform, payloadSha256, idempotencyKey]);

  return res.rows[0] || null;
}

export async function dispatchPublishingIntent(intentId) {
  const tenantId = getActiveTenantId();
  const intentRes = await pgQuery(
    'SELECT * FROM agent_publishing_intents WHERE id = $1 AND tenant_id = $2',
    [intentId, tenantId]
  );
  const intent = intentRes.rows[0];
  if (!intent || !['approved', 'pending'].includes(intent.status)) {
    throw new Error('Publishing intent tidak ditemukan atau tidak layak di-dispatch.');
  }

  // Fetch media details from ContentFlow
  const cfRes = await pgQuery(
    'SELECT * FROM content_flow_items WHERE (video_id = $1 OR id = $1) AND tenant_id = $2 LIMIT 1',
    [intent.content_flow_item_id, tenantId]
  );
  const cfItem = cfRes.rows[0];
  if (!cfItem) throw new Error(`ContentFlow item ${intent.content_flow_item_id} tidak ditemukan.`);

  const targets = [{
    accountId: intent.account_id,
    platform: intent.platform,
    publishMode: 'live',
    mediaType: cfItem.media_type || 'video',
    caption: cfItem.catatan || cfItem.hook || '',
    mediaUrl: cfItem.nextcloud_url || cfItem.url_asset || '',
    scheduledAt: new Date(Date.now() + 60000) // Scheduled in 1 minute
  }];

  const jobs = await createPublishingJobs({
    tenantId,
    contentId: cfItem.id,
    targets
  });

  await pgQuery(
    "UPDATE agent_publishing_intents SET status = 'dispatched', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
    [intentId]
  );

  return jobs;
}
