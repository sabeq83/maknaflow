import { pgQuery, withPgTransaction } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';
import crypto from 'crypto';

export async function createAgentRun({ scheduleId, runId, idempotencyKey, researchPolicy, publishingPolicy }) {
  const tenantId = getActiveTenantId();
  const id = `arun_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
  const res = await pgQuery(`
    INSERT INTO agent_automation_runs (
      id, tenant_id, schedule_id, run_id, status, idempotency_key, research_policy_json, publishing_policy_json
    ) VALUES ($1, $2, $3, $4, 'scheduled', $5, $6, $7)
    ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
    RETURNING *
  `, [
    id,
    tenantId,
    scheduleId,
    runId,
    idempotencyKey,
    JSON.stringify(researchPolicy || {}),
    JSON.stringify(publishingPolicy || { mode: 'draft_only' })
  ]);

  if (res.rowCount > 0) return { ...res.rows[0], created: true };
  const existing = await pgQuery(
    'SELECT * FROM agent_automation_runs WHERE tenant_id = $1 AND idempotency_key = $2',
    [tenantId, idempotencyKey]
  );
  return existing.rows[0] ? { ...existing.rows[0], created: false } : null;
}

export async function getAgentRun(id) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery(
    'SELECT * FROM agent_automation_runs WHERE id = $1 AND tenant_id = $2',
    [id, tenantId]
  );
  return res.rows[0] || null;
}

export async function attachHermesRun(runId, hermesRunId, researchTaskId) {
  const tenantId = getActiveTenantId();
  return (await pgQuery(`
    UPDATE agent_automation_runs
    SET hermes_run_id = $1, research_task_id = $2, updated_at = CURRENT_TIMESTAMP
    WHERE id = $3 AND tenant_id = $4 AND status = 'researching'
    RETURNING *
  `, [hermesRunId, researchTaskId, runId, tenantId])).rows[0] || null;
}

export async function claimAgentRunForResearch(runId, researchTaskId) {
  const tenantId = getActiveTenantId();
  return (await pgQuery(`UPDATE agent_automation_runs
    SET status='researching',research_task_id=$1,updated_at=CURRENT_TIMESTAMP
    WHERE id=$2 AND tenant_id=$3 AND status='scheduled' RETURNING *`,
  [researchTaskId, runId, tenantId])).rows[0] || null;
}

export async function saveResearchRevision(runId, brief, sha256) {
  const tenantId = getActiveTenantId();
  const id = `arev_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
  return (await pgQuery(`
    INSERT INTO agent_research_revisions (id, tenant_id, run_id, revision, payload_json, payload_sha256)
    VALUES ($1, $2, $3, 1, $4, $5)
    ON CONFLICT (run_id, revision) DO UPDATE SET payload_json = EXCLUDED.payload_json, payload_sha256 = EXCLUDED.payload_sha256
    RETURNING *
  `, [id, tenantId, runId, JSON.stringify(brief), sha256])).rows[0] || null;
}

export async function completeResearchTask({ runId, idempotencyKey, brief, sha256 }) {
  const tenantId = getActiveTenantId();
  return withPgTransaction(async client => {
    const run = (await client.query(
      'SELECT * FROM agent_automation_runs WHERE id=$1 AND tenant_id=$2 FOR UPDATE',
      [runId, tenantId]
    )).rows[0];
    if (!run) return null;
    const existing = (await client.query(
      'SELECT * FROM agent_research_revisions WHERE run_id=$1 AND revision=1', [runId]
    )).rows[0];
    if (run.research_callback_key) {
      if (run.research_callback_key !== idempotencyKey || existing?.payload_sha256 !== sha256) {
        const error = new Error('Idempotency-Key sudah digunakan dengan payload berbeda.');
        error.code = 'HERMES_CALLBACK_IDEMPOTENCY_CONFLICT'; error.status = 409; throw error;
      }
      return { run, revision: existing, reused: true };
    }
    if (run.status !== 'researching') {
      const error = new Error(`Research callback tidak dapat diterima pada status ${run.status}.`);
      error.status = 409; throw error;
    }
    const revisionId = `arev_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
    const revision = (await client.query(`
      INSERT INTO agent_research_revisions(id,tenant_id,run_id,revision,payload_json,payload_sha256)
      VALUES($1,$2,$3,1,$4,$5) RETURNING *
    `, [revisionId, tenantId, runId, JSON.stringify(brief), sha256])).rows[0];
    const updated = (await client.query(`
      UPDATE agent_automation_runs SET status='research_ready',research_callback_key=$1,updated_at=CURRENT_TIMESTAMP
      WHERE id=$2 AND tenant_id=$3 RETURNING *
    `, [idempotencyKey, runId, tenantId])).rows[0];
    await client.query(`INSERT INTO agent_automation_events(tenant_id,run_id,event_type,event_json)
      VALUES($1,$2,'research_completed',$3)`, [tenantId, runId, JSON.stringify({ sha256 })]);
    return { run: updated, revision, reused: false };
  });
}

export async function transitionAgentRun(runId, expectedState, nextState, patch = {}) {
  const tenantId = getActiveTenantId();
  const allowedPatch = new Set(['operator_job_id','completed_at','last_error_code','last_error_message']);
  const keys = Object.keys(patch).filter(key => allowedPatch.has(key));
  const sets = keys.map((key, idx) => `${key} = $${idx + 5}`);
  const values = Object.values(patch);

  const query = `
    UPDATE agent_automation_runs
    SET status = $1, updated_at = CURRENT_TIMESTAMP ${sets.length ? ', ' + sets.join(', ') : ''}
    WHERE id = $2 AND tenant_id = $3 AND status = $4
    RETURNING *
  `;

  const res = await pgQuery(query, [nextState, runId, tenantId, expectedState, ...values]);
  return res.rows[0] || null;
}

export async function appendAgentRunEvent(runId, eventType, event = {}) {
  const tenantId = getActiveTenantId();
  await pgQuery(`
    INSERT INTO agent_automation_events (tenant_id, run_id, event_type, event_json)
    VALUES ($1, $2, $3, $4)
  `, [tenantId, runId, eventType, JSON.stringify(event)]);
}
