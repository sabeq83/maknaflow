import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { tenantContext } from '../lib/tenant-context.js';
import {
  createMultiplierBatchWithTasks,
  getMultiplierTasks,
  getMultiplierTaskById,
  getNextPendingMultiplierTask,
  updateMultiplierTask,
  getDb
} from '../lib/db.js';

// Setup environment and ensure clean tests
async function cleanTenantTasks(tenantId) {
  const db = getDb();
  // Using direct SQL prepare since we are cleaning mock data
  db.prepare("DELETE FROM re_multiplier_tasks WHERE tenant_id = ?").run(tenantId);
}

test('Multiplier Workflows - Mode A: Multi-Blueprint to 1-Product', async () => {
  // Wait for background DB pools and migrations to settle
  await new Promise(resolve => setTimeout(resolve, 2500));

  const tenantId = 'test_tenant_alpha';
  await tenantContext.run(tenantId, async () => {
    await cleanTenantTasks(tenantId);

    const batch = {
      batch_id: 'batch_mode_a_' + crypto.randomUUID().slice(0, 8),
      shared_config: {
        vso: { narrativeMode: 'Problem-Solution' },
        bridging: { isBridgingActive: true, promotionStyle: 'Softselling' },
        audio: { enableTts: true }
      },
      enable_vo_audit: 1
    };

    const rows = [
      {
        deconstruct_asset_id: 'asset_bp_1',
        target_product_url: 'https://shopee.co.id/product-alpha-1',
        affiliate_url: 'https://shope.ee/aff-1'
      },
      {
        deconstruct_asset_id: 'asset_bp_2',
        target_product_url: 'https://shopee.co.id/product-alpha-1',
        affiliate_url: 'https://shope.ee/aff-1'
      }
    ];

    const resultBatchId = await createMultiplierBatchWithTasks(batch, rows);
    assert.equal(resultBatchId, batch.batch_id);

    // Verify task creation
    const tasks = await getMultiplierTasks();
    const batchTasks = tasks.filter(t => t.batch_id === batch.batch_id);
    assert.equal(batchTasks.length, 2);

    // Check row indices and values
    const task1 = batchTasks.find(t => t.row_index === 0);
    const task2 = batchTasks.find(t => t.row_index === 1);

    assert.ok(task1);
    assert.ok(task2);
    assert.equal(task1.deconstruct_asset_id, 'asset_bp_1');
    assert.equal(task2.deconstruct_asset_id, 'asset_bp_2');
    assert.equal(task1.target_product_url, 'https://shopee.co.id/product-alpha-1');
    assert.equal(task1.affiliate_url, 'https://shope.ee/aff-1');
    assert.equal(task1.status, 'pending_resolution');
  });
});

test('Multiplier Workflows - Mode B: 1-Blueprint to Multi-Product', async () => {
  const tenantId = 'test_tenant_alpha';
  await tenantContext.run(tenantId, async () => {
    const batch = {
      batch_id: 'batch_mode_b_' + crypto.randomUUID().slice(0, 8),
      shared_config: {
        vso: { narrativeMode: 'Storytelling' },
        bridging: { isBridgingActive: true, promotionStyle: 'Hardsell' },
        audio: { enableTts: false }
      },
      enable_vo_audit: 0
    };

    const rows = [
      {
        deconstruct_asset_id: 'asset_bp_main',
        target_product_url: 'https://shopee.co.id/product-beta-1',
        affiliate_url: 'https://shope.ee/aff-b1'
      },
      {
        deconstruct_asset_id: 'asset_bp_main',
        target_product_url: 'https://shopee.co.id/product-beta-2',
        affiliate_url: 'https://shope.ee/aff-b2'
      }
    ];

    const resultBatchId = await createMultiplierBatchWithTasks(batch, rows);
    assert.equal(resultBatchId, batch.batch_id);

    // Verify task creation
    const tasks = await getMultiplierTasks();
    const batchTasks = tasks.filter(t => t.batch_id === batch.batch_id);
    assert.equal(batchTasks.length, 2);

    const task1 = batchTasks.find(t => t.row_index === 0);
    const task2 = batchTasks.find(t => t.row_index === 1);

    assert.ok(task1);
    assert.ok(task2);
    assert.equal(task1.deconstruct_asset_id, 'asset_bp_main');
    assert.equal(task2.deconstruct_asset_id, 'asset_bp_main');
    assert.equal(task1.target_product_url, 'https://shopee.co.id/product-beta-1');
    assert.equal(task2.target_product_url, 'https://shopee.co.id/product-beta-2');
  });
});

test('Multiplier Workflows - Tenant Boundary Isolation', async () => {
  const tenantA = 'test_tenant_alpha';
  const tenantB = 'test_tenant_omega';

  // Seed tasks under Tenant A
  await tenantContext.run(tenantA, async () => {
    await cleanTenantTasks(tenantA);
    const batch = {
      batch_id: 'batch_tenant_a',
      shared_config: {},
      enable_vo_audit: 1
    };
    const rows = [
      { deconstruct_asset_id: 'asset_a1', target_product_url: 'https://shopee.co.id/product-a1' }
    ];
    await createMultiplierBatchWithTasks(batch, rows);
    const listA = await getMultiplierTasks();
    assert.equal(listA.length, 1);
  });

  // Query under Tenant B context - must be empty
  await tenantContext.run(tenantB, async () => {
    await cleanTenantTasks(tenantB);
    const listB = await getMultiplierTasks();
    assert.equal(listB.length, 0);
  });
});

test('Multiplier Workflows - Failure Tolerance & Serial Queue Order', async () => {
  const tenantId = 'test_tenant_alpha';
  await tenantContext.run(tenantId, async () => {
    await cleanTenantTasks(tenantId);

    const batch = {
      batch_id: 'batch_failure_test',
      shared_config: {},
      enable_vo_audit: 1
    };
    
    // Seed three tasks sequentially
    const rows = [
      { id: 'task_serial_1', deconstruct_asset_id: 'asset_s1', target_product_url: 'https://shopee.co.id/s1' },
      { id: 'task_serial_2', deconstruct_asset_id: 'asset_s2', target_product_url: 'https://shopee.co.id/s2' },
      { id: 'task_serial_3', deconstruct_asset_id: 'asset_s3', target_product_url: 'https://shopee.co.id/s3' }
    ];

    await createMultiplierBatchWithTasks(batch, rows);

    // Retrieve tasks - verify serial queue retrieves first pending task (task_serial_1)
    const pending1 = await getNextPendingMultiplierTask();
    assert.ok(pending1);
    assert.equal(pending1.id, 'task_serial_1');

    // Simulate task_serial_1 failure
    await updateMultiplierTask('task_serial_1', { status: 'failed' });

    // Verify task_serial_1 failed, but the remaining tasks (task_serial_2, task_serial_3) are untouched
    const t1 = await getMultiplierTaskById('task_serial_1');
    const t2 = await getMultiplierTaskById('task_serial_2');
    const t3 = await getMultiplierTaskById('task_serial_3');

    assert.equal(t1.status, 'failed');
    assert.equal(t2.status, 'pending_resolution'); // untouched
    assert.equal(t3.status, 'pending_resolution'); // untouched

    // Verify serial queue naturally skips the failed task and returns task_serial_2 next
    const pending2 = await getNextPendingMultiplierTask();
    assert.ok(pending2);
    assert.equal(pending2.id, 'task_serial_2');
  });
});
