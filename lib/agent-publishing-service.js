import { pgQuery } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';
import { createPublishingJobs } from './publishing-repository.js';
import crypto from 'crypto';
import { normalizePublishingPolicy, resolveNextPublishAt } from './agent-automation-contract.js';

export async function evaluatePublishingIntent(runId, contentFlowItemId, accountId, policyInput) {
  const tenantId = getActiveTenantId();
  const id = `apub_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
  const policy = normalizePublishingPolicy(policyInput);
  if (policy.mode === 'draft_only') return null;
  const scheduledAt = resolveNextPublishAt({
    publishTime: policy.publish_time,
    timezone: policy.timezone,
    missedSlotPolicy: policy.missed_slot_policy
  });
  const payload = { contentFlowItemId, accountId, platform: policy.platform, scheduledAt: scheduledAt.toISOString() };
  const payloadSha256 = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const idempotencyKey = `intent:${runId}:${contentFlowItemId}:${accountId}:${payloadSha256}`;

  const res = await pgQuery(`
    INSERT INTO agent_publishing_intents (
      id, tenant_id, run_id, content_flow_item_id, account_id, platform, publishing_policy_json,
      payload_sha256, idempotency_key, scheduled_at, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
    ON CONFLICT (tenant_id, content_flow_item_id, account_id, payload_sha256) DO NOTHING
    RETURNING *
  `, [id, tenantId, runId, contentFlowItemId, accountId, policy.platform, JSON.stringify(policy), payloadSha256, idempotencyKey, scheduledAt]);
  if (res.rows[0]) return res.rows[0];
  return (await pgQuery(`SELECT * FROM agent_publishing_intents
    WHERE tenant_id=$1 AND content_flow_item_id=$2 AND account_id=$3 AND payload_sha256=$4`,
  [tenantId, contentFlowItemId, accountId, payloadSha256])).rows[0] || null;
}

export async function dispatchPublishingIntent(intentId) {
  const tenantId = getActiveTenantId();
  const intentRes = await pgQuery(
    'SELECT * FROM agent_publishing_intents WHERE id = $1 AND tenant_id = $2',
    [intentId, tenantId]
  );
  const intent = intentRes.rows[0];
  if (!intent || intent.status !== 'approved') {
    throw new Error('Publishing intent tidak ditemukan atau tidak layak di-dispatch.');
  }

  // Fetch media details from ContentFlow
  const cfRes = await pgQuery(
    'SELECT * FROM content_flow_items WHERE (video_id = $1 OR id = $1) AND tenant_id = $2 LIMIT 1',
    [intent.content_flow_item_id, tenantId]
  );
  const cfItem = cfRes.rows[0];
  if (!cfItem) throw new Error(`ContentFlow item ${intent.content_flow_item_id} tidak ditemukan.`);

  const policy = typeof intent.publishing_policy_json === 'string'
    ? JSON.parse(intent.publishing_policy_json) : intent.publishing_policy_json;
  if (policy?.mode === 'draft_only') throw new Error('Policy draft_only tidak boleh membuat publishing job.');
  if (!intent.scheduled_at) throw new Error('Publishing intent tidak memiliki scheduled_at.');
  const mediaUrl = cfItem.nextcloud_url || cfItem.url_asset || '';
  if (!mediaUrl || !/^https:\/\//i.test(mediaUrl)) throw new Error('Media final HTTPS belum siap untuk publishing.');
  const claimed = await pgQuery(`UPDATE agent_publishing_intents SET status='dispatching',updated_at=CURRENT_TIMESTAMP
    WHERE id=$1 AND tenant_id=$2 AND status='approved' RETURNING id`, [intentId, tenantId]);
  if (!claimed.rowCount) throw new Error('Publishing intent sedang atau sudah diproses.');
  const targets = [{
    accountId: intent.account_id,
    platform: intent.platform,
    publishMode: 'live',
    mediaType: cfItem.media_type || 'video',
    caption: cfItem.catatan || cfItem.hook || '',
    mediaUrl,
    scheduledAt: intent.scheduled_at,
    approvalStatus: 'approved',
    isAiGenerated: true
  }];

  try {
    const jobs = await createPublishingJobs({ tenantId, contentId: cfItem.video_id || cfItem.id, targets });
    await pgQuery(`UPDATE agent_publishing_intents SET status='dispatched',publishing_job_id=$1,updated_at=CURRENT_TIMESTAMP
      WHERE id=$2 AND tenant_id=$3`, [jobs[0]?.id || null, intentId, tenantId]);
    return jobs;
  } catch (error) {
    await pgQuery(`UPDATE agent_publishing_intents SET status='approved',updated_at=CURRENT_TIMESTAMP
      WHERE id=$1 AND tenant_id=$2 AND status='dispatching'`, [intentId, tenantId]).catch(() => null);
    throw error;
  }
}
