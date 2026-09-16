import test from 'node:test';
import assert from 'node:assert/strict';
import { processRecipeCampaignCreative } from '../lib/recipe-production-adapter.js';
import { validateRecipeProductionPackage } from '../lib/recipe-campaign-contract.js';

test('processRecipeCampaignCreative is defined as async processor function', () => {
  assert.equal(typeof processRecipeCampaignCreative, 'function');
});

test('validateRecipeProductionPackage validates complete production package payload', () => {
  const samplePackage = {
    content_kind: 'recipe_campaign',
    recipe_revision: 1,
    recipe: {
      title: 'Iced Matcha Oat Latte',
      servings: 1,
      prep_minutes: 2,
      cook_minutes: 3,
      ingredients: [
        { name: 'Susu Oat Barista', amount: '150', unit: 'ml', product_id: 'prod_1' }
      ],
      steps: [
        { index: 1, instruction: 'Campurkan semua bahan.' }
      ],
      tips: ['Sajikan dingin.']
    },
    scenes: [
      {
        index: 1,
        duration_seconds: 4,
        visual_action: 'Beauty shot',
        voice_over: 'Stop beli mahal di kafe!',
        t2i_prompt: 'Photorealistic matcha latte...',
        i2v_prompt: 'Cinematic tilt down...'
      }
    ],
    video_dna: {
      visual_style: 'photorealistic_culinary',
      aspect_ratio: '9:16'
    },
    social_media_package: {
      caption_with_recipe: 'Full recipe caption...',
      caption_short: 'Short caption...',
      hashtags: ['#ResepViral']
    }
  };

  const isValid = validateRecipeProductionPackage(samplePackage);
  assert.equal(isValid, true);
});
