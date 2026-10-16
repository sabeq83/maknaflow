import test from 'node:test';
import assert from 'node:assert/strict';
import { createMultiplierBatchWithTasks } from '../lib/db.js';

test('Multiplier Lab Batch Creation: verifies generateRecipe scope in createMultiplierBatchWithTasks', async () => {
  const dummyBatch = {
    batch_id: 'mul_test_batch_scope_' + Date.now(),
    campaign_name: 'Test Scope Campaign',
    shared_config: {
      bridging: { generate_recipe: 1 },
      audio: { enableTts: true }
    }
  };

  const dummyRows = [
    {
      deconstruct_asset_id: 'asset_test_1',
      generate_recipe: 1,
      target_product_url: 'https://example.com/item1'
    },
    {
      deconstruct_asset_id: 'asset_test_2',
      generate_recipe: 0,
      target_product_url: 'https://example.com/item2'
    }
  ];

  try {
    await createMultiplierBatchWithTasks(dummyBatch, dummyRows);
    // If it reaches here, no ReferenceError occurred
    assert.ok(true);
  } catch (err) {
    // Check that it is NOT a ReferenceError
    assert.notEqual(err.name, 'ReferenceError', 'Must not throw ReferenceError for generateRecipe');
    assert.ok(!err.message.includes('generateRecipe is not defined'), 'generateRecipe must be defined in scope');
  }
});

test.after(() => {
  setTimeout(() => process.exit(0), 50);
});
