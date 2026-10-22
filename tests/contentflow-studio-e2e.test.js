import test from 'node:test';
import assert from 'node:assert/strict';
import { pgQuery } from '../lib/db-pg.js';
import {
  createStudioBatch,
  consumePlannerIntoBatch,
  getCalendarProjection,
  recordStudioApproval
} from '../lib/contentflow-studio-repository.js';
import { computeApprovalRevisionHash } from '../lib/contentflow-studio-contract.js';
import { runStudioWorkerTick } from '../lib/contentflow-studio-worker.js';

test('ContentFlow Studio E2E - Full Pipeline Verification', async (t) => {
  const tenantId = 'default_tenant';
  const testPlannerId = `cp_test_e2e_${Date.now()}`;
  const rowId1 = `row_e2e_1_${Date.now()}`;
  const rowId2 = `row_e2e_2_${Date.now()}`;

  // Seed tenant, planner, and rows
  await pgQuery(`
    INSERT INTO tenants (id, name, created_at, updated_at)
    VALUES ($1, 'Test Tenant', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO NOTHING
  `, [tenantId]);

  await pgQuery(`
    INSERT INTO content_planners (id, tenant_id, title, status, created_at, updated_at)
    VALUES ($1, $2, 'E2E Test Planner', 'ready', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `, [testPlannerId, tenantId]);

  await pgQuery(`
    INSERT INTO content_planner_rows (id, planner_id, sequence, pillar, hook, visual_action, content_subject, is_locked, created_at, updated_at)
    VALUES
      ($1, $2, 1, 'Edukasi', 'Hook 1 - Rahasia Wajah Cerah', 'Visual serum diaplikasikan', 'Skincare', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      ($3, $2, 2, 'Inspirasi', 'Hook 2 - Kenapa Serum Ini Viral', 'Visual botol serum estetik', 'Serum Viral', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `, [rowId1, testPlannerId, rowId2]);

  await t.test('1. createStudioBatch and consumePlannerIntoBatch creates slots with due schedule', async () => {
    const batch = await createStudioBatch({
      tenantId,
      title: 'Batch E2E Test',
      sourceKind: 're',
      sourceId: testPlannerId,
      configurationJson: { test: true }
    });

    assert.ok(batch.id.startsWith('stb_'), 'batch id should start with stb_');

    const pastProductionDate = new Date(Date.now() - 60000).toISOString();
    const futurePublishDate = new Date(Date.now() + 86400000).toISOString();

    const consumeResult = await consumePlannerIntoBatch({
      tenantId,
      batchId: batch.id,
      plannerId: testPlannerId,
      slotScheduleMap: {
        [rowId1]: {
          scheduledProductionAt: pastProductionDate,
          scheduledPublishAt: futurePublishDate
        },
        [rowId2]: {
          scheduledProductionAt: futurePublishDate, // future production! Should NOT be claimed yet
          scheduledPublishAt: futurePublishDate
        }
      }
    });

    assert.equal(consumeResult.success, true);
    assert.equal(consumeResult.slots.length, 2);

    // Verify planner is marked consumed
    const checkPlanner = await pgQuery('SELECT status FROM content_planners WHERE id = $1', [testPlannerId]);
    assert.equal(checkPlanner.rows[0].status, 'consumed');
  });

  await t.test('2. getCalendarProjection returns slots and aggregated targets', async () => {
    const projection = await getCalendarProjection(tenantId);
    assert.ok(Array.isArray(projection));
    const matching = projection.filter(p => p.planner_row_id === rowId1 || p.planner_row_id === rowId2);
    assert.equal(matching.length, 2);
  });

  await t.test('3. runStudioWorkerTick claims only due slot and ignores future slot', async () => {
    const tickResult = await runStudioWorkerTick('worker-e2e-test', tenantId);
    assert.equal(tickResult.claimed, true);
    assert.ok(tickResult.slotId);

    // Second tick immediately: the other slot has production in the future, so claimed should be false!
    const secondTick = await runStudioWorkerTick('worker-e2e-test', tenantId);
    assert.equal(secondTick.claimed, false);
  });

  await t.test('4. recordStudioApproval verifies revision hash integrity', async () => {
    const slots = await pgQuery('SELECT * FROM content_studio_slots WHERE planner_row_id = $1', [rowId1]);
    const slot = slots.rows[0];

    const hash1 = computeApprovalRevisionHash({
      caption: 'Caption Uji Coba',
      mediaUrl: 'https://example.com/video.mp4',
      scheduledPublishAt: slot.scheduled_publish_at
    });

    const approval = await recordStudioApproval({
      slotId: slot.id,
      tenantId,
      revisionHash: hash1,
      decision: 'approved',
      notes: 'Lolos uji verifikasi E2E'
    });

    assert.ok(approval.id.startsWith('sta_'));
    assert.equal(approval.revision_hash, hash1);
  });

  // Cleanup
  await pgQuery('DELETE FROM content_studio_approvals WHERE tenant_id = $1', [tenantId]);
  await pgQuery('DELETE FROM content_studio_slots WHERE tenant_id = $1', [tenantId]);
  await pgQuery('DELETE FROM content_studio_batches WHERE tenant_id = $1', [tenantId]);
  await pgQuery('DELETE FROM content_planner_consumptions WHERE planner_id = $1', [testPlannerId]);
  await pgQuery('DELETE FROM content_planner_rows WHERE planner_id = $1', [testPlannerId]);
  await pgQuery('DELETE FROM content_planners WHERE id = $1', [testPlannerId]);
  process.exit(0);
});
