import assert from 'node:assert/strict';
import { buildDistributionPlan, normalizePillars, normalizePlannerFocus, validatePlannerDraft } from '../lib/content-planner-contract.js';

const nutribakePillars = [
  'Healthy Breakfast',
  'Meal Prep System',
  'Healthy Baking',
  'Healthy Ingredients',
  'Smart Kitchen',
  'Healthy Snacks',
  'Healthy Lifestyle Hacks'
];

assert.equal(normalizePlannerFocus(undefined), 'product_campaign');
assert.throws(() => normalizePlannerFocus('invalid'), /tidak valid/);
assert.deepEqual(normalizePillars([' Healthy Breakfast ', 'healthy breakfast', 'Smart Kitchen']), ['Healthy Breakfast', 'Smart Kitchen']);

assert.equal(validatePlannerDraft({
  planner_focus: 'product_campaign',
  product_name: 'Oat Flour',
  product_description: 'Tepung oat serbaguna'
}), 'product_campaign');
assert.throws(() => validatePlannerDraft({ planner_focus: 'product_campaign' }), /wajib diisi/);

assert.equal(validatePlannerDraft({
  planner_focus: 'brand_editorial',
  account_name: 'Nutribake',
  brand_context: 'Healthy food education',
  pillars: nutribakePillars
}), 'brand_editorial');
assert.throws(() => validatePlannerDraft({
  planner_focus: 'brand_editorial',
  account_name: 'Nutribake',
  brand_context: 'Healthy food education',
  pillars: []
}), /pilar konten/);

const distribution = buildDistributionPlan(28, nutribakePillars, 0, 'Nutribake');
assert.equal(distribution.length, 28);
assert.deepEqual(new Set(distribution.map(row => row.pillar)), new Set(nutribakePillars));
const counts = nutribakePillars.map(pillar => distribution.filter(row => row.pillar === pillar).length);
assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);

console.log('Content Planner dual-mode tests passed.');
