import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initExportRecordsTable,
  recordRecipeExport,
  getExportRecordsByTenant,
  getExportHistoryForItem
} from '../lib/recipe-export-records.js';

test('recipe_export_records lifecycle: record, retrieve by tenant, and filter by item', async () => {
  await initExportRecordsTable();

  const testItemId = `test_item_${Date.now()}`;
  const testTenantId = 'test_tenant_export_suite';

  // Override context via process.env / tenant
  const recId = await recordRecipeExport({
    source: 'labs',
    sourceItemId: testItemId,
    recipeTitle: 'Crispy Honey Mustard Salmon',
    targetApp: 'ProteinPrep Webadmin',
    categoryName: 'High Protein',
    webadminRecipeId: '1088',
    videoUrl: 'https://pub-r2.maknaflow.com/recipes/salmon_muted.mp4'
  });

  assert.ok(recId.startsWith('exp_'), 'Record ID must start with exp_ prefix');

  // Verify retrieval
  const records = await getExportRecordsByTenant('default_tenant');
  assert.ok(Array.isArray(records), 'Should return array of records');

  const itemHistory = await getExportHistoryForItem(testItemId, 'default_tenant');
  assert.ok(itemHistory.length >= 1, 'Should find recorded item in history');

  const found = itemHistory[0];
  assert.equal(found.recipe_title, 'Crispy Honey Mustard Salmon');
  assert.equal(found.target_app, 'ProteinPrep Webadmin');
  assert.equal(found.webadmin_recipe_id, '1088');
  assert.equal(found.video_url, 'https://pub-r2.maknaflow.com/recipes/salmon_muted.mp4');
});
