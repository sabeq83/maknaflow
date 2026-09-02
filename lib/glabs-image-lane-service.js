import crypto from 'crypto';
import { getPgPool } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';
import { getSetting } from './db.js';

/**
 * Generate a deterministic, safe SHA-256 hash representing the G-Labs image endpoint lane.
 * Never includes credentials or API keys.
 */
export function buildGlabsImageLaneKey(webhookOverride) {
  const host = (webhookOverride?.host || getSetting('webhook_host') || process.env.WEBHOOK_HOST || '100.64.70.61').trim().toLowerCase();
  const port = String(webhookOverride?.port || getSetting('webhook_port') || process.env.WEBHOOK_PORT || '8765').trim();
  return crypto.createHash('sha256').update(`${host}:${port}:image`).digest('hex');
}

/**
 * Request an image lane lease (creates or updates lease record in PostgreSQL).
 */
export async function requestImageLane({
  tenantId = null,
  webhookOverride = null,
  laneKey = null,
  mode = 'shared',
  ownerKind = 'start_frame_asset',
  ownerId = null,
  campaignId = null,
  campaignItemId = null,
  assetId = null,
  leaseSeconds = 120
} = {}) {
  const effectiveTenantId = tenantId || getActiveTenantId();
  const effectiveLaneKey = laneKey || buildGlabsImageLaneKey(webhookOverride);
  const effectiveOwnerId = ownerId || `owner_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
  const normalizedMode = mode === 'exclusive' ? 'exclusive' : 'shared';
  const leaseId = `glease_${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`;

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `INSERT INTO glabs_image_lane_leases (
        id, tenant_id, lane_key, mode, owner_kind, owner_id,
        campaign_id, campaign_item_id, asset_id, status, requested_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'waiting', CURRENT_TIMESTAMP)
      ON CONFLICT (lane_key, owner_kind, owner_id) DO UPDATE SET
        mode = EXCLUDED.mode,
        campaign_id = COALESCE(EXCLUDED.campaign_id, glabs_image_lane_leases.campaign_id),
        campaign_item_id = COALESCE(EXCLUDED.campaign_item_id, glabs_image_lane_leases.campaign_item_id),
        asset_id = COALESCE(EXCLUDED.asset_id, glabs_image_lane_leases.asset_id),
        status = CASE
          WHEN glabs_image_lane_leases.status = 'active' AND glabs_image_lane_leases.lease_expires_at >= CURRENT_TIMESTAMP
            THEN 'active'
          ELSE 'waiting'
        END
      RETURNING *`,
      [leaseId, effectiveTenantId, effectiveLaneKey, normalizedMode, ownerKind, effectiveOwnerId, campaignId, campaignItemId, assetId]
    );
    const lease = res.rows[0];
    client.release();

    // Attempt initial acquire
    return await tryAcquireImageLane(lease.id, { leaseSeconds });
  } catch (err) {
    client.release();
    throw err;
  }
}

/**
 * Try to acquire an image lane lease within an atomic PostgreSQL transaction using advisory lock.
 */
export async function tryAcquireImageLane(leaseId, { leaseSeconds = 120 } = {}) {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch target lease first to know its lane_key
    const targetRes = await client.query(
      `SELECT * FROM glabs_image_lane_leases WHERE id = $1 FOR UPDATE`,
      [leaseId]
    );
    if (!targetRes.rows.length) {
      await client.query('ROLLBACK');
      return { acquired: false, status: 'not_found', lease: null };
    }
    const target = targetRes.rows[0];

    if (target.status === 'released' || target.status === 'expired') {
      await client.query('COMMIT');
      return { acquired: false, status: target.status, lease: target };
    }

    // 2. Lock the lane namespace using transactional advisory lock
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [target.lane_key]);

    // 3. Expire any active leases on this lane whose lease_expires_at has passed
    await client.query(
      `UPDATE glabs_image_lane_leases
       SET status = 'expired', released_at = CURRENT_TIMESTAMP, release_reason = 'lease_expired'
       WHERE lane_key = $1 AND status = 'active' AND lease_expires_at < CURRENT_TIMESTAMP`,
      [target.lane_key]
    );

    // If target was already active and not expired, refresh lease and return acquired
    if (target.status === 'active' && target.lease_expires_at && new Date(target.lease_expires_at) >= new Date()) {
      const refreshed = await client.query(
        `UPDATE glabs_image_lane_leases
         SET heartbeat_at = CURRENT_TIMESTAMP,
             lease_expires_at = CURRENT_TIMESTAMP + ($1 * INTERVAL '1 second')
         WHERE id = $2 RETURNING *`,
        [leaseSeconds, leaseId]
      );
      await client.query('COMMIT');
      return { acquired: true, status: 'active', lease: refreshed.rows[0] };
    }

    // 4. Count active owners on this lane
    const activeRes = await client.query(
      `SELECT mode, COUNT(*)::int AS count
       FROM glabs_image_lane_leases
       WHERE lane_key = $1
         AND status = 'active'
         AND (lease_expires_at IS NULL OR lease_expires_at >= CURRENT_TIMESTAMP)
       GROUP BY mode`,
      [target.lane_key]
    );
    let activeExclusiveCount = 0;
    let activeSharedCount = 0;
    for (const row of activeRes.rows) {
      if (row.mode === 'exclusive') activeExclusiveCount += row.count;
      if (row.mode === 'shared') activeSharedCount += row.count;
    }

    // 5. Count older waiters on this lane (FIFO queue priority)
    const waitersRes = await client.query(
      `SELECT mode, COUNT(*)::int AS count
       FROM glabs_image_lane_leases
       WHERE lane_key = $1
         AND status = 'waiting'
         AND requested_at < $2
         AND id != $3
       GROUP BY mode`,
      [target.lane_key, target.requested_at, target.id]
    );
    let olderExclusiveWaitersCount = 0;
    let olderSharedWaitersCount = 0;
    for (const row of waitersRes.rows) {
      if (row.mode === 'exclusive') olderExclusiveWaitersCount += row.count;
      if (row.mode === 'shared') olderSharedWaitersCount += row.count;
    }

    // 6. Concurrency Evaluation Rules
    let canAcquire = false;
    if (target.mode === 'exclusive') {
      // Exclusive can acquire ONLY IF zero active owners AND zero older waiters
      canAcquire = activeExclusiveCount === 0 &&
                   activeSharedCount === 0 &&
                   olderExclusiveWaitersCount === 0 &&
                   olderSharedWaitersCount === 0;
    } else {
      // Shared can acquire ONLY IF zero active exclusive AND zero older exclusive waiters
      // (Older exclusive waiters block new shared to prevent exclusive starvation)
      canAcquire = activeExclusiveCount === 0 && olderExclusiveWaitersCount === 0;
    }

    if (canAcquire) {
      const acquiredRes = await client.query(
        `UPDATE glabs_image_lane_leases
         SET status = 'active',
             acquired_at = CURRENT_TIMESTAMP,
             heartbeat_at = CURRENT_TIMESTAMP,
             lease_expires_at = CURRENT_TIMESTAMP + ($1 * INTERVAL '1 second')
         WHERE id = $2 RETURNING *`,
        [leaseSeconds, leaseId]
      );
      await client.query('COMMIT');
      return { acquired: true, status: 'active', lease: acquiredRes.rows[0] };
    }

    await client.query('COMMIT');
    return {
      acquired: false,
      status: 'waiting',
      lease: target,
      blocking: {
        activeExclusiveCount,
        activeSharedCount,
        olderExclusiveWaitersCount,
        olderSharedWaitersCount
      }
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Attach provider task ID to lease
 */
export async function attachProviderTask(leaseId, providerTaskId) {
  if (!leaseId || !providerTaskId) return;
  const pool = getPgPool();
  await pool.query(
    `UPDATE glabs_image_lane_leases
     SET provider_task_id = $1, heartbeat_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [providerTaskId, leaseId]
  );
}

/**
 * Send heartbeat to active lease to extend its expiration
 */
export async function heartbeatImageLane(leaseId, { extendSeconds = 60 } = {}) {
  if (!leaseId) return false;
  const pool = getPgPool();
  const res = await pool.query(
    `UPDATE glabs_image_lane_leases
     SET heartbeat_at = CURRENT_TIMESTAMP,
         lease_expires_at = CURRENT_TIMESTAMP + ($1 * INTERVAL '1 second')
     WHERE id = $2 AND status = 'active'
     RETURNING id`,
    [extendSeconds, leaseId]
  );
  return (res.rowCount || 0) > 0;
}

/**
 * Release image lane lease
 */
export async function releaseImageLane(leaseId, reason = 'completed') {
  if (!leaseId) return false;
  const pool = getPgPool();
  const res = await pool.query(
    `UPDATE glabs_image_lane_leases
     SET status = 'released',
         released_at = CURRENT_TIMESTAMP,
         release_reason = $1
     WHERE id = $2 AND status IN ('waiting', 'active')
     RETURNING id`,
    [reason, leaseId]
  );
  return (res.rowCount || 0) > 0;
}

/**
 * Recover expired active leases across all lanes
 */
export async function recoverExpiredImageLanes(tenantId = null) {
  const pool = getPgPool();
  const sql = tenantId
    ? `UPDATE glabs_image_lane_leases
       SET status = 'expired', released_at = CURRENT_TIMESTAMP, release_reason = 'lease_expired'
       WHERE tenant_id = $1 AND status = 'active' AND lease_expires_at < CURRENT_TIMESTAMP
       RETURNING id`
    : `UPDATE glabs_image_lane_leases
       SET status = 'expired', released_at = CURRENT_TIMESTAMP, release_reason = 'lease_expired'
       WHERE status = 'active' AND lease_expires_at < CURRENT_TIMESTAMP
       RETURNING id`;
  const params = tenantId ? [tenantId] : [];
  const res = await pool.query(sql, params);
  return res.rowCount || 0;
}

/**
 * Higher-order helper for executing an action within a provider image lane.
 * Handles queuing, waiting, heartbeat, execution, and guaranteed release in finally.
 */
export async function withGlabsImageLane({
  tenantId = null,
  webhookOverride = null,
  mode = 'shared',
  ownerKind = 'scheduler_initial',
  ownerId = null,
  campaignId = null,
  campaignItemId = null,
  assetId = null,
  leaseSeconds = 120,
  maxWaitMs = 300000,
  pollIntervalMs = 2000
} = {}, callback) {
  const requested = await requestImageLane({
    tenantId,
    webhookOverride,
    mode,
    ownerKind,
    ownerId,
    campaignId,
    campaignItemId,
    assetId,
    leaseSeconds
  });

  let currentLease = requested.lease || requested;
  let acquired = requested.acquired;
  const startTime = Date.now();

  while (!acquired) {
    if (Date.now() - startTime > maxWaitMs) {
      await releaseImageLane(currentLease.id, 'wait_timeout');
      const err = new Error(`Timeout waiting for G-Labs image lane (${mode}): exceeded ${maxWaitMs}ms`);
      err.code = 'LANE_WAIT_TIMEOUT';
      throw err;
    }
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    const pollResult = await tryAcquireImageLane(currentLease.id, { leaseSeconds });
    acquired = pollResult.acquired;
    currentLease = pollResult.lease || currentLease;
  }

  // Acquired! Setup automatic heartbeat during callback execution
  let heartbeatTimer = null;
  const heartbeatIntervalMs = Math.max(5000, Math.floor((leaseSeconds / 3) * 1000));
  heartbeatTimer = setInterval(() => {
    heartbeatImageLane(currentLease.id, { extendSeconds: leaseSeconds }).catch(() => {});
  }, heartbeatIntervalMs);

  let executionError = null;
  try {
    return await callback({ ...currentLease, id: currentLease.id });
  } catch (err) {
    executionError = err;
    throw err;
  } finally {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    const releaseReason = executionError ? `error:${executionError.message?.slice(0, 100)}` : 'completed';
    await releaseImageLane(currentLease.id, releaseReason).catch(() => {});
  }
}

/**
 * Get current lane stats for a campaign (for UI banner & status indicators)
 */
export async function getCampaignImageLaneState(campaignId, tenantId = null) {
  if (!campaignId) return null;
  const effectiveTenantId = tenantId || getActiveTenantId();
  const pool = getPgPool();
  const res = await pool.query(
    `SELECT
      COUNT(CASE WHEN status = 'active' AND mode = 'exclusive' THEN 1 END)::int AS exclusive_active_count,
      COUNT(CASE WHEN status = 'waiting' AND mode = 'exclusive' THEN 1 END)::int AS exclusive_waiting_count,
      COUNT(CASE WHEN status = 'active' AND mode = 'shared' THEN 1 END)::int AS shared_active_count,
      COUNT(CASE WHEN status = 'waiting' AND mode = 'shared' THEN 1 END)::int AS shared_waiting_count
     FROM glabs_image_lane_leases
     WHERE tenant_id = $1 AND (campaign_id = $2 OR status IN ('active', 'waiting'))`,
    [effectiveTenantId, String(campaignId)]
  );
  const row = res.rows[0] || {};
  return {
    has_exclusive_active: (row.exclusive_active_count || 0) > 0,
    exclusive_waiting_count: row.exclusive_waiting_count || 0,
    shared_active_count: row.shared_active_count || 0,
    shared_waiting_count: row.shared_waiting_count || 0
  };
}
