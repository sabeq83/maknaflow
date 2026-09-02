process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  requestPlannerResearchRefresh,
  resolveFrozenPlannerResearchContext
} from '../lib/content-planner-research-service.js';
import { pgQuery, closePgPool } from '../lib/db-pg.js';
import crypto from 'crypto';

test('Content Planner Research Service - Refresh & Frozen Context Resolution', async (t) => {
  const testTenant = `test_tenant_${crypto.randomBytes(4).toString('hex')}`;
  const testPlannerId = `cp_test_${crypto.randomBytes(4).toString('hex')}`;
  const testRevisionId = `arev_test_${crypto.randomBytes(4).toString('hex')}`;
  const testSha = crypto.randomBytes(32).toString('hex');

  const testBrief = {
    schema_version: '1',
    query: 'Riset sarapan oat',
    summary: 'Ringkasan riset oat',
    sources: [{ id: 'src_1', url: 'https://example.com' }]
  };

  const testRunId = `arun_test_${crypto.randomBytes(4).toString('hex')}`;

  // Setup test records
  await pgQuery(`
    INSERT INTO content_planners (
      id, tenant_id, title, product_name, status,
      research_revision_id, research_snapshot_sha256
    ) VALUES ($1, $2, 'Planner Refresh Test', 'Pagibaik Rolled Oat', 'completed', $3, $4)
  `, [testPlannerId, testTenant, testRevisionId, testSha]);

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

  t.after(async () => {
    await pgQuery(`DELETE FROM agent_automation_runs WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM agent_research_revisions WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM content_planners WHERE tenant_id = $1`, [testTenant]);
  });

  // 1. Test frozen research context resolution
  const resolved = await resolveFrozenPlannerResearchContext(testPlannerId, testTenant);
  assert.ok(resolved);
  assert.equal(resolved.revisionId, testRevisionId);
  assert.equal(resolved.snapshotSha256, testSha);
  assert.equal(resolved.brief.query, 'Riset sarapan oat');

  // 2. Test request research refresh (creates new agent run without modifying planner)
  const refreshRes = await requestPlannerResearchRefresh({
    plannerId: testPlannerId,
    queryOverride: 'Riset variasi resep oat overnight',
    actor: 'operator_test',
    tenantId: testTenant
  });

  assert.equal(refreshRes.success, true);
  assert.ok(refreshRes.run_id);
  assert.equal(refreshRes.status, 'scheduled');

  // Verify planner status and rows are untouched
  const plannerCheck = await pgQuery(`
    SELECT status, research_revision_id FROM content_planners WHERE id = $1 AND tenant_id = $2
  `, [testPlannerId, testTenant]);

  assert.equal(plannerCheck.rows[0].status, 'completed');
  assert.equal(plannerCheck.rows[0].research_revision_id, testRevisionId);
});
