import { pgQuery, withPgTransaction } from './db-pg.js';
import crypto from 'crypto';

/**
 * Attach or update research revision metadata on a content planner.
 */
export async function attachResearchRevisionToPlanner({
  tenantId = 'default_tenant',
  plannerId,
  researchRevisionId,
  researchSha256 = null,
  researchQuery = null,
  researchedAt = null,
  sourcePolicy = null,
  schemaVersion = '1',
  status = 'validated'
}) {
  if (!plannerId) throw new Error('plannerId wajib diisi.');
  if (!tenantId) throw new Error('tenantId wajib diisi.');

  const res = await pgQuery(`
    UPDATE content_planners
    SET
      research_revision_id = $1,
      research_snapshot_sha256 = $2,
      research_query = $3,
      research_status = $4,
      researched_at = $5,
      research_source_policy = $6,
      research_schema_version = $7,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $8 AND tenant_id = $9
    RETURNING id, research_revision_id, research_status, research_snapshot_sha256
  `, [
    researchRevisionId || null,
    researchSha256 || null,
    researchQuery || null,
    status || 'validated',
    researchedAt ? new Date(researchedAt) : null,
    sourcePolicy || null,
    schemaVersion || '1',
    plannerId,
    tenantId
  ]);

  if (res.rowCount === 0) {
    throw new Error(`Planner ${plannerId} tidak ditemukan untuk tenant ${tenantId}.`);
  }

  return res.rows[0];
}

/**
 * Atomically replace row-level evidence assignments for a content planner.
 * Uses a single transaction to delete old assignments and insert new ones.
 */
export async function replacePlannerRowEvidenceAtomic({
  tenantId = 'default_tenant',
  plannerId,
  researchRevisionId,
  assignments = []
}) {
  if (!plannerId) throw new Error('plannerId wajib diisi.');
  if (!tenantId) throw new Error('tenantId wajib diisi.');

  return await withPgTransaction(async (client) => {
    // 1. Delete existing row evidence for this planner and tenant
    await client.query(`
      DELETE FROM content_planner_row_evidence
      WHERE tenant_id = $1 AND planner_id = $2
    `, [tenantId, plannerId]);

    const insertedRows = [];

    // 2. Insert new assignments
    for (const item of assignments) {
      const evidenceId = item.id || `cpre_${crypto.randomBytes(8).toString('hex')}`;
      const rowId = String(item.planner_row_id || item.row_id || item.rowId);
      if (!rowId) throw new Error('Setiap assignment wajib memiliki planner_row_id.');

      const angleId = item.angle_id || null;
      const insightIds = Array.isArray(item.insight_ids) ? item.insight_ids : (item.insight_ids_json || []);
      const sourceIds = Array.isArray(item.source_ids) ? item.source_ids : (item.source_ids_json || []);
      const productFactIds = Array.isArray(item.product_fact_ids) ? item.product_fact_ids : (item.product_fact_ids_json || []);
      const riskLevel = String(item.risk_level || 'low').toLowerCase();
      const evidenceStatus = item.evidence_status || 'allocated';
      const evidenceSnapshot = item.evidence_snapshot || item.evidence_snapshot_json || {};
      const evidenceSha256 = item.evidence_sha256 || crypto.createHash('sha256').update(JSON.stringify(evidenceSnapshot)).digest('hex');

      const insertRes = await client.query(`
        INSERT INTO content_planner_row_evidence (
          id, tenant_id, planner_id, planner_row_id, research_revision_id,
          angle_id, insight_ids_json, source_ids_json, product_fact_ids_json,
          risk_level, evidence_status, evidence_snapshot_json, evidence_sha256,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7::jsonb, $8::jsonb, $9::jsonb,
          $10, $11, $12::jsonb, $13,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        RETURNING *
      `, [
        evidenceId,
        tenantId,
        plannerId,
        rowId,
        researchRevisionId || 'rev_none',
        angleId,
        JSON.stringify(insightIds),
        JSON.stringify(sourceIds),
        JSON.stringify(productFactIds),
        riskLevel,
        evidenceStatus,
        JSON.stringify(evidenceSnapshot),
        evidenceSha256
      ]);

      insertedRows.push(insertRes.rows[0]);
    }

    return insertedRows;
  });
}

/**
 * Get research context attached to a content planner.
 */
export async function getPlannerResearchContext({ tenantId = 'default_tenant', plannerId }) {
  if (!plannerId) throw new Error('plannerId wajib diisi.');

  const res = await pgQuery(`
    SELECT
      id,
      tenant_id,
      title,
      research_revision_id,
      research_snapshot_sha256,
      research_query,
      research_status,
      researched_at,
      research_source_policy,
      research_schema_version
    FROM content_planners
    WHERE id = $1 AND tenant_id = $2
    LIMIT 1
  `, [plannerId, tenantId]);

  if (res.rowCount === 0) return null;
  return res.rows[0];
}

/**
 * Get evidence allocated to a single planner row.
 */
export async function getPlannerRowEvidence({ tenantId = 'default_tenant', plannerId, rowId }) {
  if (!plannerId || !rowId) throw new Error('plannerId dan rowId wajib diisi.');

  const res = await pgQuery(`
    SELECT *
    FROM content_planner_row_evidence
    WHERE tenant_id = $1 AND planner_id = $2 AND planner_row_id = $3
    LIMIT 1
  `, [tenantId, plannerId, rowId]);

  if (res.rowCount === 0) return null;
  return res.rows[0];
}

/**
 * List all row-level evidence assignments for a content planner.
 */
export async function listPlannerRowsEvidence({ tenantId = 'default_tenant', plannerId }) {
  if (!plannerId) throw new Error('plannerId wajib diisi.');

  const res = await pgQuery(`
    SELECT *
    FROM content_planner_row_evidence
    WHERE tenant_id = $1 AND planner_id = $2
    ORDER BY created_at ASC
  `, [tenantId, plannerId]);

  return res.rows;
}

/**
 * Delete evidence for a single planner row.
 */
export async function deletePlannerRowEvidence({ tenantId = 'default_tenant', plannerId, rowId }) {
  if (!plannerId || !rowId) throw new Error('plannerId dan rowId wajib diisi.');

  const res = await pgQuery(`
    DELETE FROM content_planner_row_evidence
    WHERE tenant_id = $1 AND planner_id = $2 AND planner_row_id = $3
    RETURNING id
  `, [tenantId, plannerId, rowId]);

  return res.rowCount > 0;
}
