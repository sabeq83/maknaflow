import assert from 'node:assert/strict';
import { upsertContentFlowItem, getContentFlowItem, deleteContentFlowItem } from '../lib/contentflow-repository.js';
import { tenantContext } from '../lib/tenant-context.js';

async function runTests() {
  console.log('🧪 Starting ContentFlow Publish Status Preservation Tests...');
  const testTenantId = 'test_tenant_cf_protect';
  const testItemId = `cf_test_${Date.now()}`;
  const testVideoId = `VID_TEST_${Date.now()}`;

  await tenantContext.run(testTenantId, async () => {
    try {
      // 1. Ingest item awal (belum dipublish)
      console.log('Test 1: Ingest item baru dengan status default...');
      const created = await upsertContentFlowItem({
        id: testItemId,
        video_id: testVideoId,
        campaign_title: 'Test Campaign',
        account_name: 'test_brand',
        nextcloud_url: 'https://storage.test/video.mp4',
        facebook_status: 'Not Published'
      });
      assert.equal(created.facebook_status, 'Not Published');
      assert.equal(created.permalink_facebook, null);
      console.log('✅ Test 1 Passed: Item created with Not Published status.');

      // 2. Simulasi Repliz berhasil publish dan update status + permalink
      console.log('Test 2: Update status menjadi Published dengan permalink...');
      const published = await upsertContentFlowItem({
        id: testItemId,
        facebook_status: 'Published',
        facebook_publish_date: '2026-09-25T05:00:00.000Z',
        permalink_facebook: 'https://facebook.com/posts/123456789'
      });
      assert.equal(published.facebook_status, 'Published');
      assert.equal(published.permalink_facebook, 'https://facebook.com/posts/123456789');
      console.log('✅ Test 2 Passed: Item successfully marked Published with live permalink.');

      // 3. Simulasi background sync re-ingest dari campaign generator (tidak membawa facebook_status baru)
      console.log('Test 3: Re-sync dari campaign generator tanpa facebook_status...');
      const resynced = await upsertContentFlowItem({
        id: testItemId,
        video_id: testVideoId,
        campaign_title: 'Test Campaign Updated Title',
        account_name: 'test_brand',
        nextcloud_url: 'https://storage.test/video_updated.mp4',
        caption: 'New caption from generator'
        // facebook_status sengaja tidak diisi (akan default ke Not Published di normalized)
      });
      
      // Status Published dan permalink TIDAK BOLEH hilang / ter-overwrite
      assert.equal(resynced.facebook_status, 'Published', 'facebook_status harus tetap Published dan tidak tertimpa!');
      assert.equal(resynced.permalink_facebook, 'https://facebook.com/posts/123456789', 'permalink_facebook harus tetap ada!');
      assert.equal(resynced.caption, 'New caption from generator', 'Field lain seperti caption harus berhasil diupdate');
      console.log('✅ Test 3 Passed: Re-sync preserved Published status and permalink!');

    } finally {
      // Clean up test data
      try {
        await deleteContentFlowItem(testItemId);
      } catch (_) {}
    }
  });

  console.log('🎉 All ContentFlow Publish Status Preservation Tests Passed!\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
