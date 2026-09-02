import { getPgPool, pgQuery } from './db-pg.js';
import { getPlannerResearchContext, attachResearchRevisionToPlanner } from './content-planner-research-repository.js';
import { executeContentPlanner } from './content-planner-engine.js';
import crypto from 'crypto';

/**
 * Request a fresh research cycle for an existing content planner.
 * Spawns a research task without mutating the existing planner rows.
 */
export async function requestPlannerResearchRefresh({
  plannerId,
  queryOverride = null,
  actor = 'user',
  tenantId = 'default_tenant'
}) {
  if (!plannerId) throw new Error('plannerId wajib diisi.');

  const plannerRes = await pgQuery(`
    SELECT * FROM content_planners WHERE id = $1 AND tenant_id = $2
  `, [plannerId, tenantId]);

  if (plannerRes.rowCount === 0) {
    throw new Error(`Planner ${plannerId} tidak ditemukan.`);
  }

  const planner = plannerRes.rows[0];
  const query = queryOverride || `Riset tren dan sudut pandang konten untuk ${planner.product_name || planner.account_name}`;

  // Check if a research run is already running
  const activeRun = await pgQuery(`
    SELECT id, status FROM agent_automation_runs
    WHERE tenant_id = $1 AND status IN ('scheduled', 'researching', 'research_ready')
      AND research_policy_json->>'planner_id' = $2
    LIMIT 1
  `, [tenantId, plannerId]);

  if (activeRun.rowCount > 0) {
    const error = new Error('Riset untuk planner ini sedang berjalan.');
    error.code = 'RESEARCH_REFRESH_ALREADY_RUNNING';
    throw error;
  }

  const runId = `arun_${crypto.randomBytes(8).toString('hex')}`;
  const idempotencyKey = `refresh:${plannerId}:${Date.now()}`;

  await pgQuery(`
    INSERT INTO agent_automation_runs (
      id, tenant_id, status, idempotency_key,
      research_policy_json, publishing_policy_json,
      created_at, updated_at
    ) VALUES (
      $1, $2, 'scheduled', $3,
      $4::jsonb, $5::jsonb,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `, [
    runId,
    tenantId,
    idempotencyKey,
    JSON.stringify({ query, planner_id: plannerId, source_policy: 'primary_and_reputable', requested_by: actor }),
    JSON.stringify({ mode: 'draft_only' })
  ]);

  return {
    success: true,
    run_id: runId,
    planner_id: plannerId,
    status: 'scheduled',
    message: 'Permintaan riset baru berhasil dijadwalkan.'
  };
}

/**
 * Apply a specific research revision to a content planner and re-generate rows.
 */
export async function applyPlannerResearchRevision({
  plannerId,
  revisionId,
  actor = 'user',
  tenantId = 'default_tenant'
}) {
  if (!plannerId || !revisionId) {
    throw new Error('plannerId dan revisionId wajib diisi.');
  }

  const revRes = await pgQuery(`
    SELECT * FROM agent_research_revisions
    WHERE id = $1 AND tenant_id = $2
    LIMIT 1
  `, [revisionId, tenantId]);

  if (revRes.rowCount === 0) {
    const error = new Error(`Research revision ${revisionId} tidak ditemukan.`);
    error.code = 'RESEARCH_REVISION_NOT_FOUND';
    throw error;
  }

  const revision = revRes.rows[0];
  const brief = typeof revision.payload_json === 'string'
    ? JSON.parse(revision.payload_json)
    : revision.payload_json;

  // Execute planner using this explicit revision
  const result = await executeContentPlanner(plannerId, {
    revisionId: revision.id,
    snapshotSha256: revision.payload_sha256,
    brief
  });

  return {
    success: true,
    planner_id: plannerId,
    applied_revision_id: revision.id,
    rows_generated: result.rows?.length || 0
  };
}

/**
 * Resolve frozen research context stored on a content planner.
 */
export async function resolveFrozenPlannerResearchContext(plannerId, tenantId = 'default_tenant') {
  const context = await getPlannerResearchContext({ tenantId, plannerId });
  if (!context || !context.research_revision_id || context.research_revision_id === 'rev_none') {
    return null;
  }

  const revRes = await pgQuery(`
    SELECT * FROM agent_research_revisions
    WHERE id = $1 AND tenant_id = $2
    LIMIT 1
  `, [context.research_revision_id, tenantId]);

  if (revRes.rowCount > 0) {
    const revision = revRes.rows[0];
    const brief = typeof revision.payload_json === 'string'
      ? JSON.parse(revision.payload_json)
      : revision.payload_json;

    return {
      revisionId: revision.id,
      snapshotSha256: revision.payload_sha256,
      brief
    };
  }

  return {
    revisionId: context.research_revision_id,
    snapshotSha256: context.research_snapshot_sha256,
    brief: null
  };
}
