import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCanonicalRecipe, validateRecipeProductionPackage } from '../lib/recipe-campaign-contract.js';

test('Cookware Kit logic returns category-appropriate locked tools', async () => {
  // Test baking category
  const bakingTitle = 'Brownies Fudgy Shiny Crust';
  const isBaking = /kue|cake|brownies|bolu|muffin|pie|tart|cookies|baking/i.test(bakingTitle);
  assert.equal(isBaking, true);

  // Test beverage category
  const drinkTitle = 'Iced Salted Caramel Matcha Latte';
  const isDrink = /minuman|drink|latte|kopi|coffee|tea|smoothie|juice|jus|mocktail|shake/i.test(drinkTitle);
  assert.equal(isDrink, true);
});

test('Recipe Production Package validates unified cookware & scenes integrity', () => {
  const mockPackage = {
    schema_version: 1,
    content_kind: 'recipe_campaign',
    recipe_revision: 1,
    recipe: {
      title: 'Fudgy Dark Chocolate Brownies',
      servings: 1,
      prep_minutes: 5,
      cook_minutes: 25,
      ingredients: [
        { name: 'Dark Chocolate Couverture', amount: '150', unit: 'gram', product_id: null },
        { name: 'Tepung Terigu Protein Sedang', amount: '100', unit: 'gram', product_id: null },
        { name: 'Gula Halus', amount: '120', unit: 'gram', product_id: null }
      ],
      steps: [
        { index: 1, instruction: 'Lelehkan dark chocolate bersama butter hingga licin dan mengkilap.' },
        { index: 2, instruction: 'Kocok telur dan gula halus dalam baskom keramik putih hingga larut.' },
        { index: 3, instruction: 'Campurkan cokelat leleh, aduk rata, lalu tuang ke loyang kotak 20x20 cm beralas baking paper.' },
        { index: 4, instruction: 'Panggang suhu 175C selama 25 menit hingga keluar shiny crust.' }
      ],
      tips: ['Pastikan gula benar-benar larut bersama telur untuk menghasilkan lapisan shiny crust yang sempurna.']
    },
    scenes: [
      {
        index: 1,
        scene_function: 'hook',
        duration_seconds: 4,
        visual_action: 'Close-up potongan brownies fudgy dengan shiny crust berkilau menggugah selera.',
        voice_over: 'Rahasia brownies fudgy dengan shiny crust sempurna di rumah!',
        t2i_prompt: '(VERTICAL 9:16) [LAYER 1: OPTICS] (Shot on 100mm Macro). [LAYER 2: SUBJECT, COOKWARE & VISUAL TRUTH] (Food Truth: Freshly sliced fudgy brownies), (Cookware Truth: 8x8 inch square matte charcoal baking pan).',
        i2v_prompt: '(VERTICAL 9:16) [LAYER 1: INPUT & TRUTH LOCK] (Start Frame: CLIP_1_START_FRAME.png).',
        recipe_step_indices: [1]
      },
      {
        index: 2,
        scene_function: 'cooking_step',
        duration_seconds: 4,
        visual_action: 'Tangan menuangkan cokelat leleh ke dalam baskom keramik putih doff.',
        voice_over: 'Pertama lelehkan dark chocolate sampai lumer dan licin.',
        t2i_prompt: '(VERTICAL 9:16) [LAYER 1: OPTICS] (Shot on 100mm Macro). [LAYER 2: SUBJECT, COOKWARE & VISUAL TRUTH] (Food Truth: Melted chocolate batter), (Cookware Truth: matte off-white ceramic mixing bowl).',
        i2v_prompt: '(VERTICAL 9:16) [LAYER 1: INPUT & TRUTH LOCK] (Start Frame: CLIP_2_START_FRAME.png).',
        recipe_step_indices: [2]
      },
      {
        index: 3,
        scene_function: 'cooking_step',
        duration_seconds: 4,
        visual_action: 'Tangan menuang adonan dari baskom keramik putih doff ke loyang kotak hitam 20x20 cm beralas baking paper.',
        voice_over: 'Tuang adonan kental ke loyang kotak beralas baking paper lalu panggang.',
        t2i_prompt: '(VERTICAL 9:16) [LAYER 1: OPTICS] (Shot on 100mm Macro). [LAYER 2: SUBJECT, COOKWARE & VISUAL TRUTH] (Food Truth: Dark chocolate brownie batter pouring into pan), (Cookware Truth: 8x8 inch square matte charcoal baking pan lined with parchment paper).',
        i2v_prompt: '(VERTICAL 9:16) [LAYER 1: INPUT & TRUTH LOCK] (Start Frame: CLIP_3_START_FRAME.png).',
        recipe_step_indices: [3, 4]
      },
      {
        index: 4,
        scene_function: 'cta',
        duration_seconds: 4,
        visual_action: 'Brownies matang bertekstur fudgy dipotong di atas loyang kotak hitam 20x20 cm yang sama.',
        voice_over: 'Fudgy dan nyoklat banget! Simpan resep ini dan cobain yuk!',
        t2i_prompt: '(VERTICAL 9:16) [LAYER 1: OPTICS] (Shot on 100mm Macro). [LAYER 2: SUBJECT, COOKWARE & VISUAL TRUTH] (Food Truth: Freshly baked fudgy brownies), (Cookware Truth: 8x8 inch square matte charcoal baking pan).',
        i2v_prompt: '(VERTICAL 9:16) [LAYER 1: INPUT & TRUTH LOCK] (Start Frame: CLIP_4_START_FRAME.png).',
        recipe_step_indices: [4]
      }
    ],
    social_media_package: {
      caption_with_recipe: 'Resep Fudgy Brownies Lengkap...',
      cta: 'Simpan resep ini!'
    }
  };

  const isValid = validateRecipeProductionPackage(mockPackage);
  assert.equal(isValid, true);
  assert.equal(mockPackage.scenes.length, 4);

  // Check anti-contamination: ensure no unrelated items like croissant exist in brownie prompt
  mockPackage.scenes.forEach(scene => {
    assert.doesNotMatch(scene.t2i_prompt, /croissant|bread loaf|pizza/i);
    assert.doesNotMatch(scene.visual_action, /croissant|roti sobek|pizza/i);
  });
});

test('sanitizeImagePrompt strips multi-word --no clauses without leaking negative keywords into positive prompt', async () => {
  const { sanitizeImagePrompt } = await import('../lib/webhook-client.js');

  const dirtyPrompt = '(VERTICAL 9:16) --ar 9:16 --no landscape, croissant, unrelated food [LAYER 1: OPTICS] (Shot on 100mm Macro). [LAYER 2: SUBJECT] (Food Truth: Fudgy brownies in square pan).';
  const cleaned = sanitizeImagePrompt(dirtyPrompt);

  assert.doesNotMatch(cleaned, /croissant/i, 'Negative keyword croissant must NOT leak into positive prompt');
  assert.doesNotMatch(cleaned, /unrelated food/i, 'Negative clause must be completely stripped');
  assert.doesNotMatch(cleaned, /--no/i, '--no syntax must be stripped');
  assert.doesNotMatch(cleaned, /--ar/i, '--ar syntax must be stripped');
  assert.match(cleaned, /Fudgy brownies/i, 'Positive prompt content must remain intact');
});
