process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attachResearchRevisionToPlanner,
  replacePlannerRowEvidenceAtomic,
  getPlannerResearchContext,
  getPlannerRowEvidence,
  listPlannerRowsEvidence,
  deletePlannerRowEvidence
} from '../lib/content-planner-research-repository.js';
import { getPgPool, pgQuery, closePgPool } from '../lib/db-pg.js';
import crypto from 'crypto';

test('Content Planner Research Repository - Full Lifecycle & Atomic Isolation', async (t) => {
  const testTenant = `test_tenant_${crypto.randomBytes(4).toString('hex')}`;
  const testPlannerId = `cp_test_${crypto.randomBytes(4).toString('hex')}`;
  const testRowId1 = `row_test_${crypto.randomBytes(4).toString('hex')}_1`;
  const testRowId2 = `row_test_${crypto.randomBytes(4).toString('hex')}_2`;
  const testRevisionId = `arev_test_${crypto.randomBytes(4).toString('hex')}`;
  const testSha = crypto.randomBytes(32).toString('hex');

  // Setup test planner
  await pgQuery(`
    INSERT INTO content_planners (id, tenant_id, title, product_name, status)
    VALUES ($1, $2, 'Test Planner Evidence', 'Pagibaik Rolled Oat', 'draft')
  `, [testPlannerId, testTenant]);

  t.after(async () => {
    await pgQuery(`DELETE FROM content_planner_row_evidence WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM content_planners WHERE tenant_id = $1`, [testTenant]);
  });

  // 1. Attach research revision
  const attached = await attachResearchRevisionToPlanner({
    tenantId: testTenant,
    plannerId: testPlannerId,
    researchRevisionId: testRevisionId,
    researchSha256: testSha,
    researchQuery: 'Manfaat oat gluten free untuk sarapan',
    researchedAt: new Date().toISOString(),
    sourcePolicy: 'primary_and_reputable',
    schemaVersion: '1',
    status: 'validated'
  });

  assert.equal(attached.id, testPlannerId);
  assert.equal(attached.research_revision_id, testRevisionId);
  assert.equal(attached.research_status, 'validated');
  assert.equal(attached.research_snapshot_sha256, testSha);

  // 2. Query planner research context
  const context = await getPlannerResearchContext({
    tenantId: testTenant,
    plannerId: testPlannerId
  });

  assert.ok(context);
  assert.equal(context.research_revision_id, testRevisionId);
  assert.equal(context.research_query, 'Manfaat oat gluten free untuk sarapan');

  // 3. Atomically replace row evidence assignments
  const assignments = [
    {
      planner_row_id: testRowId1,
      angle_id: 'angle_1',
      insight_ids: ['ins_1', 'ins_2'],
      source_ids: ['src_1'],
      risk_level: 'low',
      evidence_snapshot: { title: 'Angle 1 Evidence', hook_hint: 'Sarapan bernutrisi' }
    },
    {
      planner_row_id: testRowId2,
      angle_id: 'angle_2',
      insight_ids: ['ins_3'],
      source_ids: ['src_2'],
      risk_level: 'medium',
      evidence_snapshot: { title: 'Angle 2 Evidence', hook_hint: 'Bebas gluten' }
    }
  ];

  const persisted = await replacePlannerRowEvidenceAtomic({
    tenantId: testTenant,
    plannerId: testPlannerId,
    researchRevisionId: testRevisionId,
    assignments
  });

  assert.equal(persisted.length, 2);

  // 4. List planner row evidence
  const allEvidence = await listPlannerRowsEvidence({
    tenantId: testTenant,
    plannerId: testPlannerId
  });

  assert.equal(allEvidence.length, 2);
  assert.equal(allEvidence[0].planner_row_id, testRowId1);
  assert.equal(allEvidence[0].angle_id, 'angle_1');
  assert.equal(allEvidence[0].risk_level, 'low');

  // 5. Get single row evidence
  const singleRow = await getPlannerRowEvidence({
    tenantId: testTenant,
    plannerId: testPlannerId,
    rowId: testRowId2
  });

  assert.ok(singleRow);
  assert.equal(singleRow.planner_row_id, testRowId2);
  assert.equal(singleRow.risk_level, 'medium');

  // 6. Delete single row evidence
  const deleted = await deletePlannerRowEvidence({
    tenantId: testTenant,
    plannerId: testPlannerId,
    rowId: testRowId1
  });

  assert.equal(deleted, true);

  const remaining = await listPlannerRowsEvidence({
    tenantId: testTenant,
    plannerId: testPlannerId
  });

  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].planner_row_id, testRowId2);
});
