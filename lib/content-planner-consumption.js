import { pgQuery, withPgTransaction } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';
import crypto from 'crypto';

export class PlannerConsumptionError extends Error {
  constructor(message, status = 409, code = 'PLANNER_ALREADY_CONSUMED') {
    super(message);
    this.name = 'PlannerConsumptionError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Checks whether a content planner has already been consumed or reserved by any engine.
 */
export async function getPlannerConsumption(plannerId, tenantId = null) {
  const tId = tenantId || getActiveTenantId() || 'default_tenant';
  const res = await pgQuery(
    `SELECT * FROM content_planner_consumptions WHERE tenant_id = $1 AND planner_id = $2 LIMIT 1`,
    [tId, plannerId]
  );
  return res.rows[0] || null;
}

/**
 * Throws PlannerConsumptionError if the planner has already been consumed.
 */
export async function ensurePlannerNotConsumed(plannerId, tenantId = null) {
  const consumption = await getPlannerConsumption(plannerId, tenantId);
  if (consumption) {
    throw new PlannerConsumptionError(
      `Content Planner (${plannerId}) sudah digunakan (consumed oleh ${consumption.owner_type} #${consumption.owner_id}) dan terkunci permanen. Planner sekali pakai tidak dapat dimodifikasi atau digunakan kembali.`,
      409,
      'PLANNER_ALREADY_CONSUMED'
    );
  }
}

/**
 * Guard for generation lease. Prevents running generation on consumed planners
 * and prevents concurrent generation requests on the same planner.
 */
export async function withPlannerGenerationLease(plannerId, work, tenantId = null) {
  const tId = tenantId || getActiveTenantId() || 'default_tenant';
  const planner = await withPgTransaction(async client => {
    const p = (await client.query('SELECT * FROM content_planners WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [plannerId,tId])).rows[0];
    if (!p) throw Object.assign(Error('Planner tidak ditemukan.'), {status:404,code:'PLANNER_NOT_FOUND'});
    if (p.status==='generating') throw Object.assign(Error('Planner sedang digenerate.'), {status:409,code:'PLANNER_GENERATION_IN_PROGRESS'});
    if ((await client.query('SELECT id FROM content_planner_consumptions WHERE planner_id=$1 AND tenant_id=$2',[plannerId,tId])).rowCount) throw new PlannerConsumptionError('Planner sudah digunakan.');
    await client.query("UPDATE content_planners SET status='generating' WHERE id=$1 AND tenant_id=$2",[plannerId,tId]);
    return p;
  });
  try { return await work(planner); }
  catch(error) {
    await pgQuery("UPDATE content_planners SET status='draft' WHERE id=$1 AND tenant_id=$2 AND status='generating'",[plannerId,tId]);
    throw error;
  }
}

/**
 * Invariant wrapper for caller-based consumption (Legacy Ingest, Operator, etc.).
 * Uses atomic reserve -> ingest -> finalize. Same owner retries are idempotent.
 */
export async function withPlannerConsumptionOwner({
  plannerId,
  ownerType,
  ownerId,
  tenantId = null,
  metadata = {}
}, ingestWork) {
  const tId = tenantId || getActiveTenantId() || 'default_tenant';
  if (!plannerId) throw new Error('plannerId wajib diisi.');

  const existing = await getPlannerConsumption(plannerId, tId);
  if (existing) {
    if (existing.owner_type === ownerType && String(existing.owner_id) === String(ownerId)) {
      // Same owner retry: proceed idempotently
      return await ingestWork({ existingConsumption: existing, reused: true });
    }
    throw new PlannerConsumptionError(
      `Content Planner (${plannerId}) sudah digunakan oleh ${existing.owner_type} #${existing.owner_id}.`,
      409,
      'PLANNER_ALREADY_CONSUMED'
    );
  }

  const consumptionId = `cpc_${crypto.randomBytes(8).toString('hex')}`;
  const metaJson = JSON.stringify(metadata || {});

  // Reserve ownership atomically
  try {
    await pgQuery(
      `INSERT INTO content_planner_consumptions (
        id, tenant_id, planner_id, owner_type, owner_id, status, metadata_json, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, 'reserved', $6::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [consumptionId, tId, plannerId, ownerType, String(ownerId), metaJson]
    );
  } catch (err) {
    if (err.code === '23505') { // Postgres unique_violation
      const freshExisting = await getPlannerConsumption(plannerId, tId);
      if (freshExisting && freshExisting.owner_type === ownerType && String(freshExisting.owner_id) === String(ownerId)) {
        return await ingestWork({ existingConsumption: freshExisting, reused: true });
      }
      throw new PlannerConsumptionError(
        `Content Planner (${plannerId}) baru saja dikonsumsi oleh proses lain.`,
        409,
        'PLANNER_ALREADY_CONSUMED'
      );
    }
    throw err;
  }

  // Execute ingestion work
  try {
    const result = await ingestWork({ consumptionId, reused: false });

    // Finalize consumption status
    await pgQuery(
      `UPDATE content_planner_consumptions
       SET status = 'consumed', consumed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [consumptionId]
    );

    // Update status in content_planners table for visibility
    await pgQuery(
      `UPDATE content_planners SET status = 'consumed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [plannerId]
    ).catch(() => {});

    return result;
  } catch (error) {
    // If ingestion failed before completing, check if it's retryable or keep reserved
    console.error(`[PlannerConsumption] Ingest failed for planner ${plannerId}:`, error.message);
    throw error;
  }
}

/**
 * Asserts that applying a research revision is allowed (not consumed).
 */
export async function assertPlannerResearchApplicationAllowed({ plannerId, tenantId = null }) {
  const tId = tenantId || getActiveTenantId() || 'default_tenant';
  await ensurePlannerNotConsumed(plannerId, tId);
}

/**
 * Reserve planner for Operator content job deterministically.
 */
export async function reservePlannerForOperatorJob(job) {
  const tenantId = job.tenant_id || 'default_tenant';
  const plannerId = job.planner_id;
  if (!plannerId) throw new Error('Job tidak memiliki planner_id.');

  const existing = await getPlannerConsumption(plannerId, tenantId);
  if (existing) {
    if (existing.owner_type === 'operator_job' && String(existing.owner_id) === String(job.id)) {
      return existing;
    }
    throw new PlannerConsumptionError(
      `Planner ${plannerId} sudah digunakan oleh ${existing.owner_type} #${existing.owner_id}.`,
      409,
      'PLANNER_ALREADY_CONSUMED'
    );
  }

  const consumptionId = `cpc_${crypto.randomBytes(8).toString('hex')}`;
  await pgQuery(
    `INSERT INTO content_planner_consumptions (
      id, tenant_id, planner_id, owner_type, owner_id, status, metadata_json, created_at, updated_at
    ) VALUES ($1, $2, $3, 'operator_job', $4, 'reserved', '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (tenant_id, planner_id) DO NOTHING`,
    [consumptionId, tenantId, plannerId, String(job.id)]
  );

  return await getPlannerConsumption(plannerId, tenantId);
}

export async function assertStudioPlannerOwner({ plannerId, tenantId, batchId, rowIds }) {
  const consumption = await getPlannerConsumption(plannerId, tenantId);
  if (!consumption || consumption.owner_type !== 'studio_batch' || consumption.owner_id !== batchId) throw new PlannerConsumptionError('Planner bukan milik batch Studio ini.');
  const result = await pgQuery('SELECT planner_row_id FROM content_studio_slots WHERE tenant_id=$1 AND batch_id=$2 AND planner_row_id=ANY($3::text[])', [tenantId, batchId, rowIds.map(String)]);
  if (result.rowCount !== new Set(rowIds.map(String)).size) throw new PlannerConsumptionError('Row Planner tidak termasuk output batch ini.');
}
