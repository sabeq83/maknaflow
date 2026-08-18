import test from 'node:test';
import assert from 'node:assert/strict';
import { tenantContext } from '../lib/tenant-context.js';
import {
  createSavedDeconstructAssets,
  listDeconstructAssets,
  enqueueDeconstructAssets,
  getNextPendingDeconstructAsset,
  getDeconstructAssetById,
  updateDeconstructAsset,
  updateDeconstructBatchProgress,
  getDb
} from '../lib/db.js';

test('Deconstruct Library - Save URLs as saved without running scheduler', async () => {
  await tenantContext.run('test_tenant_a', async () => {
    // Clean old test assets if any
    const db = getDb();
    await db.prepare("DELETE FROM re_deconstructed_assets WHERE tenant_id = ?").run('test_tenant_a');

    const urls = [
      { url: 'https://example.com/video1', caption: 'Test Video 1' },
      { url: 'https://example.com/video2', caption: 'Test Video 2' }
    ];
    
    const res = await createSavedDeconstructAssets(urls, 'Skincare', 'test_tenant_a');
    assert.equal(res.savedCount, 2);
    assert.equal(res.duplicateCount, 0);

    const list = await listDeconstructAssets({ niche: 'Skincare' }, 'test_tenant_a');
    assert.equal(list.assets.length, 2);
    assert.equal(list.assets[0].status, 'saved');
    assert.equal(list.assets[0].niche, 'Skincare');
  });
});

test('Deconstruct Library - Tenant Boundary Isolation', async () => {
  // Test Tenant B cannot see Tenant A's saved assets
  await tenantContext.run('test_tenant_b', async () => {
    const list = await listDeconstructAssets({ niche: 'Skincare' }, 'test_tenant_b');
    assert.equal(list.assets.length, 0);
  });
});

test('Deconstruct Library - Enqueue serial selection and next pending retrieval', async () => {
  await tenantContext.run('test_tenant_a', async () => {
    const list = await listDeconstructAssets({ niche: 'Skincare' }, 'test_tenant_a');
    const assetIds = list.assets.map(a => a.id);

    // Enqueue
    const batchId = await enqueueDeconstructAssets(assetIds, { target_recommendation_count: 3 }, 'test_tenant_a');
    assert.ok(batchId);

    // Verify status changed to pending_download
    const asset1 = await getDeconstructAssetById(assetIds[0], 'test_tenant_a');
    assert.equal(asset1.status, 'pending_download');
    assert.equal(asset1.batch_id, batchId);

    // Get next pending download in this batch and tenant
    const nextPending = await getNextPendingDeconstructAsset(batchId, 'test_tenant_a');
    assert.ok(nextPending);
    assert.ok(assetIds.includes(nextPending.id));

    // Update status to deconstructed
    await updateDeconstructAsset(nextPending.id, {
      status: 'deconstructed',
      deconstructed_at: new Date()
    });

    const assetUpdated = await getDeconstructAssetById(nextPending.id, 'test_tenant_a');
    assert.equal(assetUpdated.status, 'deconstructed');
    assert.ok(assetUpdated.deconstructed_at);

    // Update progress
    const progress = await updateDeconstructBatchProgress(batchId);
    assert.equal(progress.total, 2);
    assert.equal(progress.processed, 1);
    assert.equal(progress.status, 'processing');
  });
});
