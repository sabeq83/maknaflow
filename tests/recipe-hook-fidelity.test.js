import test from 'node:test';
import assert from 'node:assert/strict';
import { enforceExactRecipeHook, validateRecipeProductionPackage } from '../lib/recipe-campaign-contract.js';

const buildPackage = voiceOver => ({
  recipe: {
    title: 'Brownies Sehat',
    ingredients: [{ name: 'Ubi' }],
    steps: [{ index: 1, instruction: 'Campurkan bahan.' }]
  },
  scenes: [{ index: 1, scene_function: 'hook', voice_over: voiceOver }],
  social_media_package: { caption_with_recipe: 'Resep lengkap.' }
});

test('enforceExactRecipeHook restores the planner hook verbatim in scene one', () => {
  const expectedHook = 'Bikin brownies fudgy tanpa tepung dan tanpa gula pasir berlebih untuk cemilan sehat keluarga!';
  const scenes = enforceExactRecipeHook([
    { index: 1, scene_function: 'hook', voice_over: 'Mau brownies sehat? Bikin yuk!' },
    { index: 2, scene_function: 'cooking_step', voice_over: 'Siapkan bahan.' }
  ], expectedHook);

  assert.equal(scenes[0].scene_function, 'hook');
  assert.equal(scenes[0].voice_over, expectedHook);
  assert.equal(scenes[1].voice_over, 'Siapkan bahan.');
});

test('validateRecipeProductionPackage rejects a non-exact planner hook', () => {
  assert.throws(
    () => validateRecipeProductionPackage(buildPackage('Hook yang diparafrasekan.'), {
      expectedHook: 'Hook planner wajib persis.',
      expectedSceneCount: 1
    }),
    /sama persis/
  );
});

test('validateRecipeProductionPackage rejects an unexpected scene count', () => {
  assert.throws(
    () => validateRecipeProductionPackage(buildPackage('Hook planner.'), { expectedSceneCount: 15 }),
    /tepat 15/
  );
});
