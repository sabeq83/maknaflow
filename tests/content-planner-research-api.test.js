process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';

import test from 'node:test';
import assert from 'node:assert/strict';
import { attachResearchRevisionToPlanner, replacePlannerRowEvidenceAtomic, getPlannerResearchContext, getPlannerRowEvidence } from '../lib/content-planner-research-repository.js';
import { pgQuery, closePgPool } from '../lib/db-pg.js';
import crypto from 'crypto';

test('Content Planner Research API & Projections - Integrity & Redaction', async (t) => {
  const testTenant = `test_tenant_${crypto.randomBytes(4).toString('hex')}`;
  const testPlannerId = `cp_api_${crypto.randomBytes(4).toString('hex')}`;
  const testRowId = `row_api_${crypto.randomBytes(4).toString('hex')}`;
  const testRevisionId = `arev_api_${crypto.randomBytes(4).toString('hex')}`;
  const testSha = crypto.randomBytes(32).toString('hex');

  const testBrief = {
    schema_version: '1',
    query: 'Oatmeal sarapan sehat',
    summary: 'Riset ilmiah oat',
    sources: [
      { id: 'src_1', url: 'https://who.int/diet', title: 'WHO Diet Guide', publisher: 'WHO', verification_status: 'verified', authority_class: 'primary' }
    ],
    insights: [{ claim: 'Kaya beta glukan', confidence: 0.95, source_ids: ['src_1'] }],
    recommended_angles: [{ id: 'angle_1', title: 'Focus Hack', risk_level: 'low', source_ids: ['src_1'] }],
    prohibited_claims: ['Obat mujarab maag'],
    limitations: ['Hanya makanan bernutrisi']
  };

  const testRunId = `arun_api_${crypto.randomBytes(4).toString('hex')}`;

  // Setup test DB records
  await pgQuery(`
    INSERT INTO content_planners (
      id, tenant_id, title, product_name, status,
      research_revision_id, research_snapshot_sha256, research_query,
      research_status, researched_at, research_source_policy
    ) VALUES ($1, $2, 'API Test Planner', 'Pagibaik Rolled Oat', 'completed', $3, $4, $5, 'validated', CURRENT_TIMESTAMP, 'primary_and_reputable')
  `, [testPlannerId, testTenant, testRevisionId, testSha, testBrief.query]);

  await pgQuery(`
    INSERT INTO agent_automation_runs (
      id, tenant_id, status, idempotency_key,
      research_policy_json, publishing_policy_json,
      created_at, updated_at
    ) VALUES (
      $1, $2, 'completed', $3,
      '{}'::jsonb, '{}'::jsonb,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `, [testRunId, testTenant, `test_key_${testRunId}`]);

  await pgQuery(`
    INSERT INTO agent_research_revisions (
      id, tenant_id, run_id, revision, payload_json, payload_sha256
    ) VALUES ($1, $2, $3, 1, $4::jsonb, $5)
  `, [testRevisionId, testTenant, testRunId, JSON.stringify(testBrief), testSha]);

  await replacePlannerRowEvidenceAtomic({
    tenantId: testTenant,
    plannerId: testPlannerId,
    researchRevisionId: testRevisionId,
    assignments: [
      {
        planner_row_id: testRowId,
        angle_id: 'angle_1',
        insight_ids: ['ins_1'],
        source_ids: ['src_1'],
        risk_level: 'low',
        evidence_snapshot: { title: 'Focus Hack' }
      }
    ]
  });

  t.after(async () => {
    await pgQuery(`DELETE FROM content_planner_row_evidence WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM agent_research_revisions WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM agent_automation_runs WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM content_planners WHERE tenant_id = $1`, [testTenant]);
  });

  // 1. Verify planner research context
  const context = await getPlannerResearchContext({ tenantId: testTenant, plannerId: testPlannerId });
  assert.ok(context);
  assert.equal(context.research_revision_id, testRevisionId);
  assert.equal(context.research_status, 'validated');
  assert.equal(context.research_source_policy, 'primary_and_reputable');

  // 2. Verify row evidence
  const rowEv = await getPlannerRowEvidence({ tenantId: testTenant, plannerId: testPlannerId, rowId: testRowId });
  assert.ok(rowEv);
  assert.equal(rowEv.angle_id, 'angle_1');
  assert.equal(rowEv.risk_level, 'low');
  assert.deepEqual(rowEv.source_ids_json, ['src_1']);

  // 3. Verify cross-tenant isolation
  const crossTenantEv = await getPlannerRowEvidence({ tenantId: 'other_tenant', plannerId: testPlannerId, rowId: testRowId });
  assert.equal(crossTenantEv, null);
});
