import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RECIPE_CATEGORIES,
  MIN_RECIPE_COUNT,
  MAX_RECIPE_COUNT,
  validateRecipePlannerDraft,
  validateCanonicalRecipe
} from '../lib/recipe-campaign-contract.js';
import { normalizePlannerFocus, PLANNER_FOCI } from '../lib/content-planner-contract.js';

test('PLANNER_FOCI includes recipe_campaign and normalizePlannerFocus works', () => {
  assert.ok(PLANNER_FOCI.includes('recipe_campaign'), 'PLANNER_FOCI must include recipe_campaign');
  assert.equal(normalizePlannerFocus('recipe_campaign'), 'recipe_campaign');
  assert.equal(normalizePlannerFocus('brand_editorial'), 'brand_editorial');
  assert.equal(normalizePlannerFocus('product_campaign'), 'product_campaign');

  assert.throws(() => {
    normalizePlannerFocus('invalid_focus_type');
  }, /Fokus planner tidak valid/);
});

test('validateRecipePlannerDraft validates valid recipe planner configuration with strategyMode', () => {
  const validDraft = {
    category: 'minuman',
    count: 5,
    productIds: ['prod_1', 'prod_2', 'prod_3'],
    strategy_mode: 'synergy',
    targetAudience: 'genz_casual'
  };

  const result = validateRecipePlannerDraft(validDraft);
  assert.equal(result.category, 'minuman');
  assert.equal(result.count, 5);
  assert.equal(result.strategyMode, 'synergy');
  assert.deepEqual(result.productIds, ['prod_1', 'prod_2', 'prod_3']);
});

test('validateRecipePlannerDraft rejects invalid category and count outside 1-20', () => {
  assert.throws(() => {
    validateRecipePlannerDraft({ category: 'invalid_cat', count: 5, productIds: ['p1'] });
  }, /Kategori resep 'invalid_cat' tidak valid/);

  assert.throws(() => {
    validateRecipePlannerDraft({ category: 'masakan', count: 0, productIds: ['p1'] });
  }, /Jumlah baris Recipe Campaign/);

  assert.throws(() => {
    validateRecipePlannerDraft({ category: 'masakan', count: 25, productIds: ['p1'] });
  }, /Jumlah baris Recipe Campaign/);

  assert.throws(() => {
    validateRecipePlannerDraft({ category: 'masakan', count: 5, productIds: [] });
  }, /Minimal satu produk katalog/);
});

test('validateCanonicalRecipe validates complete recipe structure', () => {
  const validRecipe = {
    title: 'Iced Matcha Oat Latte',
    servings: '1 Gelas',
    prep_minutes: 5,
    cook_minutes: 2,
    ingredients: [
      { name: 'Susu Oat Barista', amount: '150', unit: 'ml', product_id: 'prod_1' },
      { name: 'Matcha Powder', amount: '1.5', unit: 'sdt' }
    ],
    steps: [
      { index: 1, instruction: 'Larutkan matcha dengan air hangat.' },
      { index: 2, instruction: 'Tuang susu oat ke dalam gelas dengan es.' },
      { index: 3, instruction: 'Tuang larutan matcha di atas susu oat.' }
    ]
  };

  const validated = validateCanonicalRecipe(validRecipe);
  assert.equal(validated, true);
});
