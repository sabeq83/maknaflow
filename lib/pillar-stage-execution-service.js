import crypto from 'crypto';
import os from 'os';
import { pgQuery, withPgTransaction } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';
import { buildStageIdempotencyKey as buildStageKey } from './pillar-stage-contract.js';

export function buildStageIdempotencyKey({ tenantId = getActiveTenantId(), itemId, stage, revision = 1 }) {
  return buildStageKey({ tenantId, itemId, stage, revision });
}

export async function claimStageExecution({ itemId, stage, revision = 1, leaseSeconds = 300, workerId = `${os.hostname()}:${process.pid}` }) {
  const tenantId = getActiveTenantId();
  const key = buildStageIdempotencyKey({ tenantId, itemId, stage, revision });
  const id = `pse_${crypto.createHash('sha256').update(key).digest('hex').slice(0, 24)}`;
  return withPgTransaction(async client => {
    await client.query(
      `INSERT INTO pillar_campaign_stage_executions(id,tenant_id,campaign_item_id,stage,revision,idempotency_key)
       VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(tenant_id,idempotency_key) DO NOTHING`,
      [id, tenantId, String(itemId), stage, revision, key]
    );
    const row = (await client.query(
      `SELECT * FROM pillar_campaign_stage_executions WHERE tenant_id=$1 AND idempotency_key=$2 FOR UPDATE`,
      [tenantId, key]
    )).rows[0];
    if (row.status === 'completed') return { claimed: false, completed: true, execution: row };
    if (row.status === 'processing' && row.lease_expires_at && new Date(row.lease_expires_at) > new Date()) return { claimed: false, busy: true, execution: row };
    const claimed = (await client.query(
      `UPDATE pillar_campaign_stage_executions SET status='processing',attempt_count=attempt_count+1,
       lease_owner=$1,lease_expires_at=CURRENT_TIMESTAMP+($2*INTERVAL '1 second'),
       started_at=COALESCE(started_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP,error_json=NULL
       WHERE id=$3 RETURNING *`, [workerId, leaseSeconds, row.id]
    )).rows[0];
    return { claimed: true, execution: claimed };
  });
}

export async function completeStageExecution(id, output = {}) {
  return (await pgQuery(
    `UPDATE pillar_campaign_stage_executions SET status='completed',output_json=$1,completed_at=CURRENT_TIMESTAMP,
     lease_owner=NULL,lease_expires_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING *`,
    [JSON.stringify(output), id]
  )).rows[0];
}

export async function failStageExecution(id, error, { retryable = true } = {}) {
  return (await pgQuery(
    `UPDATE pillar_campaign_stage_executions SET status=$1,error_json=$2,lease_owner=NULL,lease_expires_at=NULL,
     updated_at=CURRENT_TIMESTAMP WHERE id=$3 RETURNING *`,
    [retryable ? 'retry_wait' : 'failed', JSON.stringify({ code: error.code || 'STAGE_FAILED', message: error.message }), id]
  )).rows[0];
}

export async function executeIdempotentStage(options, operation) {
  const claim = await claimStageExecution(options);
  if (claim.completed) return { ...(typeof claim.execution.output_json === 'string' ? JSON.parse(claim.execution.output_json) : claim.execution.output_json), idempotent: true };
  if (!claim.claimed) {
    const error = new Error(`Stage ${options.stage} sedang diproses worker lain.`);
    error.code = 'STAGE_EXECUTION_BUSY';
    error.status = 409;
    throw error;
  }
  try {
    const output = await operation(claim.execution);
    await completeStageExecution(claim.execution.id, output);
    return output;
  } catch (error) {
    await failStageExecution(claim.execution.id, error, { retryable: error.retryable !== false });
    throw error;
  }
}
