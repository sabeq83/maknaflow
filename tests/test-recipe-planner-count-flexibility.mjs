import assert from 'node:assert/strict';
import {
  DEFAULT_RECIPE_COUNT,
  MIN_RECIPE_COUNT,
  MAX_RECIPE_COUNT,
  validateRecipePlannerDraft
} from '../lib/recipe-campaign-contract.js';

console.log('🧪 [Test] Running Recipe Planner Count Flexibility Tests...');

// 1. Check Constants
assert.equal(DEFAULT_RECIPE_COUNT, 3, 'DEFAULT_RECIPE_COUNT must be 3');
assert.equal(MIN_RECIPE_COUNT, 1, 'MIN_RECIPE_COUNT must be 1');
assert.equal(MAX_RECIPE_COUNT, 30, 'MAX_RECIPE_COUNT must be 30');
console.log('✅ Constants verified (Default: 3, Min: 1, Max: 30)');

// 2. Test valid counts
const validCounts = [1, 2, 3, 5, 10, 15, 20, 25, 30, '3', '30'];
for (const count of validCounts) {
  const result = validateRecipePlannerDraft({
    category: 'minuman',
    count: count
  });
  assert.equal(result.count, Number(count), `Count ${count} should be accepted`);
  assert.equal(result.category, 'minuman');
}
console.log('✅ Valid counts (1 to 30) successfully validated');

// 3. Test invalid counts (<1, >30, invalid types)
const invalidCounts = [0, -1, -10, 31, 50, 100, 'invalid', null, undefined, NaN];
for (const invalidCount of invalidCounts) {
  assert.throws(
    () => {
      validateRecipePlannerDraft({
        category: 'masakan',
        count: invalidCount
      });
    },
    /Jumlah baris Recipe Campaign harus berupa integer antara 1 dan 30/,
    `Invalid count '${invalidCount}' should throw validation error`
  );
}
console.log('✅ Out-of-bounds and invalid counts properly rejected with validation error');

console.log('🎉 ALL RECIPE PLANNER COUNT FLEXIBILITY TESTS PASSED!');
