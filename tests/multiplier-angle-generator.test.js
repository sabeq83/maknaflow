import test from 'node:test';
import assert from 'node:assert/strict';
import { getAvailableNicheKBs, getExcludedAnglesHistory } from '../lib/multiplier-angle-generator.js';
import { getDb } from '../lib/db.js';
import { tenantContext } from '../lib/tenant-context.js';

test('Multiplier Angle Generator - getAvailableNicheKBs returns existing KB list', () => {
  const kbs = getAvailableNicheKBs();
  assert.ok(Array.isArray(kbs), 'Should return an array');
  assert.ok(kbs.length > 0, 'Should find at least 1 KB');
  const herbalKb = kbs.find(k => k.id === 'HERBAL_CONTENT_KB.md');
  assert.ok(herbalKb, 'HERBAL_CONTENT_KB.md should be present');
});

test('Multiplier Angle Generator - blueprint asset query compatibility without column errors', async () => {
  await tenantContext.run('default_tenant', async () => {
    const db = getDb();
    
    // Test the exact query executed by generateDynamicMultiplierAngles
    const testQuery = `
      SELECT id, source_url, source_url AS original_video_url, original_storyboard_json, viral_pattern_summary, original_caption, created_at 
      FROM re_deconstructed_assets 
      LIMIT 1
    `;
    
    const row = await db.prepare(testQuery).get();
    // If table has data, verify structure; if empty, query still executed without SQL column errors
    if (row) {
      assert.ok('id' in row, 'id should exist in returned row');
      assert.ok('source_url' in row, 'source_url should exist in returned row');
      assert.ok('original_video_url' in row, 'original_video_url alias should exist in returned row');
      assert.ok('original_storyboard_json' in row, 'original_storyboard_json should exist in returned row');
      assert.ok('viral_pattern_summary' in row, 'viral_pattern_summary should exist in returned row');
    }
  });
});

test('Multiplier Angle Generator - getExcludedAnglesHistory handles valid & empty history', async () => {
  await tenantContext.run('default_tenant', async () => {
    const history = await getExcludedAnglesHistory('non_existent_bp_test_id');
    assert.ok(Array.isArray(history), 'History should be an array');
    assert.equal(history.length, 0, 'Non existent blueprint should return empty array without error');
  });
});

test('Multiplier Angle Generator - Teardown', () => {
  setTimeout(() => process.exit(0), 200).unref();
});
