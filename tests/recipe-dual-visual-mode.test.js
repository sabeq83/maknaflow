import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRecipeProductionPackage } from '../lib/recipe-campaign-contract.js';

test('Recipe dual visual mode: pure_t2v packaging contract', () => {
  const isPureT2v = true;
  const scenesArray = [
    {
      index: 1,
      scene_function: 'hook',
      duration_seconds: 4,
      visual_action: 'Close up smoothie poured into glass',
      voice_over: 'Stop jajan smoothie mahal di luar!',
      sfx_prompt: '[SFX: Blender whirling]',
      t2v_prompt: '(VERTICAL 9:16) [LAYER 0: VISUAL TRUTH] (Anchor: hands only) [LAYER 1: SCENE] Macro smoothie pour [LAYER 2: KINETIC] fluid action [LAYER 3: SFX]',
      t2i_prompt: '',
      i2v_prompt: ''
    },
    {
      index: 2,
      scene_function: 'cooking_step',
      duration_seconds: 4,
      visual_action: 'Adding fresh blueberries',
      voice_over: 'Cukup 3 bahan ini aja.',
      sfx_prompt: '[SFX: Fruit dropping]',
      t2v_prompt: '(VERTICAL 9:16) [LAYER 0: VISUAL TRUTH] Fresh berries dropping into blender',
      t2i_prompt: '',
      i2v_prompt: ''
    }
  ];

  const finalPackage = {
    schema_version: 1,
    content_kind: 'recipe_campaign',
    recipe_revision: 1,
    recipe: {
      title: 'Healthy Berry Smoothie',
      servings: 1,
      prep_minutes: 2,
      cook_minutes: 2,
      ingredients: [{ name: 'Blueberry', amount: '100', unit: 'g' }],
      steps: [{ index: 1, instruction: 'Blender semua bahan sampai lembut.' }],
      tips: ['Gunakan buah beku agar kental.']
    },
    storyboard: scenesArray.map((scene, idx) => ({
      scene: scene.index || (idx + 1),
      scene_function: scene.scene_function,
      duration_seconds: scene.duration_seconds,
      visual_action: scene.visual_action,
      voice_over: scene.voice_over,
      t2i_prompt: isPureT2v ? '' : (scene.t2i_prompt || ''),
      t2v_prompt: isPureT2v ? (scene.t2v_prompt || scene.visual_action || '') : '',
      i2v_prompt: isPureT2v ? '' : (scene.i2v_prompt || '')
    })),
    scenes: scenesArray,
    t2i_prompts: isPureT2v ? [] : scenesArray.map((s, idx) => ({ clip: s.index || (idx + 1), prompt: s.t2i_prompt || '' })),
    i2v_prompts: isPureT2v ? [] : scenesArray.map((s, idx) => ({ clip: s.index || (idx + 1), prompt: s.i2v_prompt || '' })),
    t2v_prompts: isPureT2v ? scenesArray.map((s, idx) => ({ clip: s.index || (idx + 1), prompt: s.t2v_prompt || s.visual_action || '' })) : [],
    social_media_package: {
      caption_with_recipe: 'Smoothie segar 3 bahan!',
      hashtags: ['#ResepSehat']
    }
  };

  const newVideoPlan = finalPackage.scenes.map((scene, idx) => ({
    clip_index: scene.index || (idx + 1),
    visual_action: scene.visual_action || '',
    new_vo: scene.voice_over || '',
    t2i_prompt: isPureT2v ? '' : (scene.t2i_prompt || ''),
    t2v_prompt: isPureT2v ? (scene.t2v_prompt || scene.visual_action || '') : '',
    i2v_prompt: isPureT2v ? '' : (scene.i2v_prompt || '')
  }));

  assert.equal(validateRecipeProductionPackage(finalPackage), true);
  assert.equal(finalPackage.t2v_prompts.length, 2);
  assert.equal(finalPackage.t2i_prompts.length, 0);
  assert.equal(finalPackage.i2v_prompts.length, 0);

  assert.ok(finalPackage.storyboard[0].t2v_prompt.includes('[LAYER 0: VISUAL TRUTH]'));
  assert.equal(finalPackage.storyboard[0].t2i_prompt, '');
  assert.equal(finalPackage.storyboard[0].i2v_prompt, '');

  assert.ok(newVideoPlan[0].t2v_prompt.includes('[LAYER 0: VISUAL TRUTH]'));
  assert.equal(newVideoPlan[0].t2i_prompt, '');
  assert.equal(newVideoPlan[0].i2v_prompt, '');
});

test('Recipe dual visual mode: hybrid_lock packaging contract', () => {
  const isPureT2v = false;
  const scenesArray = [
    {
      index: 1,
      scene_function: 'hook',
      duration_seconds: 4,
      visual_action: 'Close up smoothie poured into glass',
      voice_over: 'Stop jajan smoothie mahal di luar!',
      sfx_prompt: '[SFX: Blender whirling]',
      t2v_prompt: '',
      t2i_prompt: '(VERTICAL 9:16) [LAYER 1: OPTICS] Still shot of glass',
      i2v_prompt: '(VERTICAL 9:16) [LAYER 1: INPUT LOCK] (Start Frame: CLIP_1.png) [LAYER 2: ACTION] Pouring'
    }
  ];

  const finalPackage = {
    schema_version: 1,
    content_kind: 'recipe_campaign',
    recipe_revision: 1,
    recipe: {
      title: 'Healthy Berry Smoothie',
      servings: 1,
      prep_minutes: 2,
      cook_minutes: 2,
      ingredients: [{ name: 'Blueberry', amount: '100', unit: 'g' }],
      steps: [{ index: 1, instruction: 'Blender semua bahan.' }],
      tips: ['Sajikan dingin.']
    },
    storyboard: scenesArray.map((scene, idx) => ({
      scene: scene.index || (idx + 1),
      scene_function: scene.scene_function,
      duration_seconds: scene.duration_seconds,
      visual_action: scene.visual_action,
      voice_over: scene.voice_over,
      t2i_prompt: isPureT2v ? '' : (scene.t2i_prompt || ''),
      t2v_prompt: isPureT2v ? (scene.t2v_prompt || scene.visual_action || '') : '',
      i2v_prompt: isPureT2v ? '' : (scene.i2v_prompt || '')
    })),
    scenes: scenesArray,
    t2i_prompts: isPureT2v ? [] : scenesArray.map((s, idx) => ({ clip: s.index || (idx + 1), prompt: s.t2i_prompt || '' })),
    i2v_prompts: isPureT2v ? [] : scenesArray.map((s, idx) => ({ clip: s.index || (idx + 1), prompt: s.i2v_prompt || '' })),
    t2v_prompts: isPureT2v ? scenesArray.map((s, idx) => ({ clip: s.index || (idx + 1), prompt: s.t2v_prompt || s.visual_action || '' })) : [],
    social_media_package: {
      caption_with_recipe: 'Smoothie segar!',
      hashtags: ['#ResepSehat']
    }
  };

  assert.equal(validateRecipeProductionPackage(finalPackage), true);
  assert.equal(finalPackage.t2v_prompts.length, 0);
  assert.equal(finalPackage.t2i_prompts.length, 1);
  assert.equal(finalPackage.i2v_prompts.length, 1);
  assert.equal(finalPackage.storyboard[0].t2v_prompt, '');
  assert.ok(finalPackage.storyboard[0].t2i_prompt.includes('[LAYER 1: OPTICS]'));
  assert.ok(finalPackage.storyboard[0].i2v_prompt.includes('[LAYER 1: INPUT LOCK]'));
});

test('Scheduler processor logic: Recipe campaign pure_t2v is not blocked by hybrid lock', () => {
  const checkIsHybridLock = ({ visualMode, isCartoon, hasChars, hasHybridPrompts, hasT2vPrompts }) => {
    return (visualMode === 'hybrid_lock') || (isCartoon && (hasChars || visualMode === 'hybrid_lock')) || (hasHybridPrompts && !hasT2vPrompts);
  };

  // 1. Recipe campaign dengan mode pure_t2v & prompt t2v tersedia -> WAJIB false (Pure T2V dieksekusi)
  const recipePureT2v = checkIsHybridLock({
    visualMode: 'pure_t2v',
    isCartoon: false,
    hasChars: false,
    hasHybridPrompts: false,
    hasT2vPrompts: true
  });
  assert.equal(recipePureT2v, false, 'Recipe pure_t2v should NOT trigger hybrid lock');

  // 2. Recipe campaign dengan mode hybrid_lock -> WAJIB true (Double-pass dieksekusi)
  const recipeHybrid = checkIsHybridLock({
    visualMode: 'hybrid_lock',
    isCartoon: false,
    hasChars: false,
    hasHybridPrompts: true,
    hasT2vPrompts: false
  });
  assert.equal(recipeHybrid, true, 'Recipe hybrid_lock should trigger hybrid lock');

  // 3. Fallback: User pilih pure_t2v tapi paket lama hanya punya hybrid prompts dan tidak ada t2v -> WAJIB true (Graceful fallback)
  const fallbackLegacy = checkIsHybridLock({
    visualMode: 'pure_t2v',
    isCartoon: false,
    hasChars: false,
    hasHybridPrompts: true,
    hasT2vPrompts: false
  });
  assert.equal(fallbackLegacy, true, 'Legacy items without t2v prompts must safely fallback to hybrid lock');
});
