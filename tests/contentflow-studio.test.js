process.env.PG_SEARCH_PATH = 'dev,public';
process.env.DISABLE_AUTO_MIGRATIONS = 'true';

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ensurePlannerNotConsumed,
  withPlannerConsumptionOwner,
  withPlannerGenerationLease,
  assertPlannerResearchApplicationAllowed
} from '../lib/content-planner-consumption.js';
import {
  validateStudioSchedule,
  computeApprovalRevisionHash,
  projectStudioSlotStatus
} from '../lib/contentflow-studio-contract.js';
import { pgQuery } from '../lib/db-pg.js';
import crypto from 'crypto';

test('Studio Contract - validateStudioSchedule validates production & publish times', () => {
  // Invalid: production after publish
  const invalidOrder = validateStudioSchedule({
    scheduledProductionAt: '2026-10-23T15:00:00Z',
    scheduledPublishAt: '2026-10-23T12:00:00Z',
    targets: [{ accountId: 'acc_1', platform: 'tiktok' }]
  });
  assert.equal(invalidOrder.valid, false);
  assert.match(invalidOrder.errors[0], /harus mendahului atau sama/);

  // Invalid: no targets
  const noTargets = validateStudioSchedule({
    scheduledProductionAt: '2026-10-23T10:00:00Z',
    scheduledPublishAt: '2026-10-23T14:00:00Z',
    targets: []
  });
  assert.equal(noTargets.valid, false);
  assert.match(noTargets.errors[0], /Minimal satu akun/);

  // Valid
  const valid = validateStudioSchedule({
    scheduledProductionAt: '2026-10-23T10:00:00Z',
    scheduledPublishAt: '2026-10-23T14:00:00Z',
    targets: [{ accountId: 'acc_1', platform: 'tiktok' }]
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.errors.length, 0);
});

test('Studio Contract - computeApprovalRevisionHash is deterministic and sensitive to changes', () => {
  const hash1 = computeApprovalRevisionHash({
    mediaUrl: 'https://cdn.example.com/video1.mp4',
    caption: 'Resep Viral',
    accountIds: ['acc_1', 'acc_2'],
    scheduledPublishAt: '2026-10-25T10:00:00Z'
  });

  const hash2 = computeApprovalRevisionHash({
    mediaUrl: 'https://cdn.example.com/video1.mp4',
    caption: 'Resep Viral',
    accountIds: ['acc_2', 'acc_1'], // order reversed
    scheduledPublishAt: '2026-10-25T10:00:00Z'
  });

  // Account sorting ensures identical hash
  assert.equal(hash1, hash2);

  const hashModified = computeApprovalRevisionHash({
    mediaUrl: 'https://cdn.example.com/video1.mp4',
    caption: 'Resep Viral (Revisi)',
    accountIds: ['acc_1', 'acc_2'],
    scheduledPublishAt: '2026-10-25T10:00:00Z'
  });

  assert.notEqual(hash1, hashModified);
});

test('Studio Contract - projectStudioSlotStatus maps domain states correctly', () => {
  // Cancelled stays cancelled
  assert.equal(projectStudioSlotStatus({ currentStage: 'cancelled' }), 'cancelled');

  // Review stage
  assert.equal(
    projectStudioSlotStatus({
      currentStage: 'in_progress',
      sourceItem: { workflow_status: 'ready_for_review' }
    }),
    'needs_review'
  );

  // Final media ready
  assert.equal(
    projectStudioSlotStatus({
      currentStage: 'in_progress',
      sourceItem: { ffmpeg_output_path: '/path/video.mp4', contentflow_item_id: 'cf_123' },
      hasFinalMedia: true
    }),
    'ready'
  );

  // Failed item
  assert.equal(
    projectStudioSlotStatus({
      currentStage: 'in_progress',
      sourceItem: { status: 'failed' }
    }),
    'failed'
  );
});

test('Single-Use Planner - withPlannerConsumptionOwner enforces atomic ownership & same-owner idempotency', async () => {
  const testTenantId = 'default_tenant';
  const testPlannerId = `pln_test_${crypto.randomBytes(4).toString('hex')}`;

  // Insert mock planner in DB for foreign key / existence check if needed
  await pgQuery(
    `INSERT INTO content_planners (id, tenant_id, title, status)
     VALUES ($1, $2, 'Test Planner Single Use', 'completed')
     ON CONFLICT DO NOTHING`,
    [testPlannerId, testTenantId]
  ).catch(() => {});

  try {
    // 1. Initial consumption by Owner A
    let executionCountA = 0;
    const resultA = await withPlannerConsumptionOwner({
      plannerId: testPlannerId,
      ownerType: 'opc_campaign',
      ownerId: 'opc_123',
      tenantId: testTenantId
    }, async ({ reused }) => {
      executionCountA++;
      return { success: true, campaignId: 'opc_123', reused };
    });

    assert.equal(resultA.success, true);
    assert.equal(resultA.reused, false);
    assert.equal(executionCountA, 1);

    // 2. Same-owner retry (Owner A again with same campaignId)
    const resultARetry = await withPlannerConsumptionOwner({
      plannerId: testPlannerId,
      ownerType: 'opc_campaign',
      ownerId: 'opc_123',
      tenantId: testTenantId
    }, async ({ reused }) => {
      return { success: true, campaignId: 'opc_123', reused };
    });

    assert.equal(resultARetry.success, true);
    assert.equal(resultARetry.reused, true);

    // 3. Different owner conflict (Owner B tries to consume the same planner)
    await assert.rejects(
      async () => {
        await withPlannerConsumptionOwner({
          plannerId: testPlannerId,
          ownerType: 'studio_batch',
          ownerId: 'stb_different',
          tenantId: testTenantId
        }, async () => {
          return { success: true };
        });
      },
      (err) => {
        assert.equal(err.code, 'PLANNER_ALREADY_CONSUMED');
        assert.equal(err.status, 409);
        return true;
      }
    );

    // 4. Guard check: ensurePlannerNotConsumed throws 409
    await assert.rejects(
      async () => {
        await ensurePlannerNotConsumed(testPlannerId, testTenantId);
      },
      (err) => {
        assert.equal(err.code, 'PLANNER_ALREADY_CONSUMED');
        assert.equal(err.status, 409);
        return true;
      }
    );

    // 5. Research apply check: assertPlannerResearchApplicationAllowed throws 409
    await assert.rejects(
      async () => {
        await assertPlannerResearchApplicationAllowed({ plannerId: testPlannerId, tenantId: testTenantId });
      },
      (err) => {
        assert.equal(err.code, 'PLANNER_ALREADY_CONSUMED');
        assert.equal(err.status, 409);
        return true;
      }
    );

    // 6. Generation lease check: withPlannerGenerationLease throws 409
    await assert.rejects(
      async () => {
        await withPlannerGenerationLease(testPlannerId, async () => {}, testTenantId);
      },
      (err) => {
        assert.equal(err.code, 'PLANNER_ALREADY_CONSUMED');
        assert.equal(err.status, 409);
        return true;
      }
    );
  } finally {
    // Cleanup test data
    await pgQuery(`DELETE FROM content_planner_consumptions WHERE tenant_id = $1`, [testTenantId]).catch(() => {});
    await pgQuery(`DELETE FROM content_planners WHERE id = $1 AND tenant_id = $2`, [testPlannerId, testTenantId]).catch(() => {});
  }
});

test('Single-Use Planner - Concurrent consumption attempts reject race conditions', async () => {
  const testTenantId = 'default_tenant';
  const testPlannerId = `pln_race_${crypto.randomBytes(4).toString('hex')}`;

  try {
    let winnerCount = 0;
    let loserCount = 0;

    const attempt = async (ownerId) => {
      try {
        await withPlannerConsumptionOwner({
          plannerId: testPlannerId,
          ownerType: 'studio_batch',
          ownerId,
          tenantId: testTenantId
        }, async () => {
          return { success: true, ownerId };
        });
        winnerCount++;
      } catch (err) {
        if (err.code === 'PLANNER_ALREADY_CONSUMED' && err.status === 409) {
          loserCount++;
        } else {
          throw err;
        }
      }
    };

    // Run 2 parallel requests simultaneously
    await Promise.all([attempt('batch_alpha'), attempt('batch_beta')]);

    assert.equal(winnerCount, 1, 'Exactly one concurrent attempt must succeed');
    assert.equal(loserCount, 1, 'The other attempt must be rejected with 409 PLANNER_ALREADY_CONSUMED');
  } finally {
    await pgQuery(`DELETE FROM content_planner_consumptions WHERE tenant_id = $1`, [testTenantId]).catch(() => {});
  }
});
