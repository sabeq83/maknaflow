import test from 'node:test';
import assert from 'node:assert/strict';
import { safeParseRecipeJson } from '../lib/recipe-production-adapter.js';
import { parseSafeJson as parseRecipePlannerSafeJson } from '../lib/recipe-planner-engine.js';

test('safeParseRecipeJson parses standard valid JSON', () => {
  const input = JSON.stringify({
    recipe: { title: 'Garlic Butter Salmon', servings: 2 },
    scenes: [{ index: 1, scene_function: 'hook', voice_over: 'Rahasia salmon juicy!' }]
  });

  const parsed = safeParseRecipeJson(input);
  assert.equal(parsed.recipe.title, 'Garlic Butter Salmon');
  assert.equal(parsed.scenes.length, 1);
});

test('safeParseRecipeJson repairs unescaped double quotes inside property values (root cause of error 7049)', () => {
  // Simulates Gemini outputting unescaped quotes inside prompt strings or measurements (e.g., 8x8" pan)
  const problematicJson = `{
    "recipe": {
      "title": "Garlic Butter Seared Salmon with Creamy Cauliflower Mash",
      "servings": 1,
      "prep_minutes": 5,
      "cook_minutes": 10,
      "ingredients": [
        { "name": "Salmon Fillet", "amount": "200", "unit": "gram", "product_id": null }
      ],
      "steps": [
        { "index": 1, "instruction": "Bumbui salmon dan gunakan wajan 10" anti lengket", "visual_cue": "Salmon searing" }
      ],
      "tips": ["Gunakan api sedang"]
    },
    "scenes": [
      {
        "index": 1,
        "scene_function": "hook",
        "duration_seconds": 4,
        "visual_action": "Tangan memegang pisau "Chef Knife" dan memotong salmon",
        "on_screen_text": "Resep Salmon 10"",
        "voice_over": "Pernah gak makan salmon tapi kering? Ini solusinya!",
        "sfx_prompt": "[SFX: Sizzling]",
        "t2i_prompt": "(VERTICAL 9:16) [LAYER 2: FOOD TRUTH] (Food Truth: Salmon seared in "Garlic Butter")",
        "i2v_prompt": "(VERTICAL 9:16) 0.0s-2.0s: Action",
        "recipe_step_indices": [1],
        "product_ids": []
      }
    ],
    "video_dna": {
      "visual_style": "photorealistic_culinary",
      "aspect_ratio": "9:16"
    },
    "social_media_package": {
      "cta": "Simpan resep ini!",
      "hashtags": ["#ResepSalmon", "#HealthyFood"]
    }
  }`;

  // Standard JSON.parse MUST fail on this input
  assert.throws(() => {
    JSON.parse(problematicJson);
  }, /Unexpected|Expected/);

  // safeParseRecipeJson MUST successfully parse and recover the data
  const parsed = safeParseRecipeJson(problematicJson);
  assert.ok(parsed, 'Parsed object must exist');
  assert.equal(parsed.recipe.title, 'Garlic Butter Seared Salmon with Creamy Cauliflower Mash');
  assert.equal(parsed.scenes.length, 1);
  assert.ok(parsed.scenes[0].visual_action.includes('Chef Knife'));
});

test('safeParseRecipeJson handles markdown code fences and trailing commas', () => {
  const fencedWithTrailingComma = `\`\`\`json
  {
    "recipe": {
      "title": "Iced Matcha Latte",
      "ingredients": [
        { "name": "Matcha Powder", "amount": "1", "unit": "tsp" },
      ],
    },
    "scenes": [],
  }
  \`\`\``;

  const parsed = safeParseRecipeJson(fencedWithTrailingComma);
  assert.equal(parsed.recipe.title, 'Iced Matcha Latte');
  assert.equal(parsed.recipe.ingredients.length, 1);
});

test('parseRecipePlannerSafeJson handles unescaped quotes in planner engine', () => {
  const plannerGlitch = `{
    "recipe_rows": [
      {
        "sequence": 1,
        "title": "Avocado Toast with "Poached" Egg",
        "hook": "Sarapan sehat 5 menit!"
      }
    ]
  }`;

  const parsed = parseRecipePlannerSafeJson(plannerGlitch);
  assert.equal(parsed.recipe_rows.length, 1);
  assert.ok(parsed.recipe_rows[0].title.includes('Avocado Toast'));
});
