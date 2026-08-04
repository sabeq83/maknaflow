import assert from 'node:assert/strict';
import {
  DEFAULT_EDITORIAL_ROWS_PER_PILLAR,
  PRODUCT_PLANNER_COUNTS,
  buildDistributionPlan,
  getBrandEditorialCountOptions,
  normalizeGeneratedPlannerRows,
  validatePlannerCount
} from '../lib/content-planner-contract.js';

for (const count of PRODUCT_PLANNER_COUNTS) {
  assert.deepEqual(validatePlannerCount('product_campaign', count), { count, rowsPerPillar: null });
}
for (const count of [0, 1, 5, 7, 29, 31]) {
  assert.throws(() => validatePlannerCount('product_campaign', count), /siklus CEP/);
}

const optionCases = new Map([
  [1, Array.from({ length: 30 }, (_, index) => index + 1)],
  [3, [3, 6, 9, 12, 15, 18, 21, 24, 27, 30]],
  [4, [4, 8, 12, 16, 20, 24, 28]],
  [7, [7, 14, 21, 28]],
  [10, [10, 20, 30]],
  [12, [12, 24]]
]);

assert.deepEqual(getBrandEditorialCountOptions(0), []);
for (const [pillarCount, expectedValues] of optionCases) {
  const options = getBrandEditorialCountOptions(pillarCount);
  assert.deepEqual(options.map(option => option.value), expectedValues);
  assert.ok(options.every(option => option.value <= 30 && option.value % pillarCount === 0));
  assert.equal(options[DEFAULT_EDITORIAL_ROWS_PER_PILLAR - 1]?.rowsPerPillar, DEFAULT_EDITORIAL_ROWS_PER_PILLAR);
}

const pillars = ['Edukasi', 'Resep', 'Lifestyle', 'Behind the Scene'];
assert.deepEqual(validatePlannerCount('brand_editorial', 8, pillars), { count: 8, rowsPerPillar: 2 });
for (const invalidCount of [0, 3, 6, 10, 31]) {
  assert.throws(() => validatePlannerCount('brand_editorial', invalidCount, pillars), /kelipatan jumlah pilar/);
}
assert.throws(() => validatePlannerCount('brand_editorial', 8, []), /kelipatan jumlah pilar/);

for (const offset of [0, 1, 9, 27]) {
  const distribution = buildDistributionPlan(12, pillars, offset, 'Fixture Brand');
  assert.equal(distribution.length, 12);
  for (const pillar of pillars) {
    assert.equal(distribution.filter(row => row.pillar === pillar).length, 3);
  }
}

const fallback = buildDistributionPlan(8, pillars, 0, 'Fixture Brand');
const normalized = normalizeGeneratedPlannerRows([{ hook: 'Satu' }], fallback, 8);
assert.equal(normalized.length, 8);
assert.deepEqual(normalized.map(row => row.sequence), [1, 2, 3, 4, 5, 6, 7, 8]);
assert.equal(normalized[7].pillar, fallback[7].pillar);

console.log('Dynamic Content Planner count tests passed.');
