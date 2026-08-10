#!/usr/bin/env node
/**
 * Regression Test: Universe Profile Field Mapping
 * Verifies mapping of 6 canonical fields across presets, db schemas, and contracts.
 * 
 * Run: node scripts/test-universe-field-mapping.js
 */

import assert from 'assert';
import { listPresets, getPreset } from '../lib/universe-presets.js';
import { getUniverseDefaults, buildUniverseConfigJson } from '../lib/content-world-contract.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
    failed++;
  }
}

console.log('\n🔍 Starting Universe Field Mapping Regression Tests...\n');

// 1. Test Preset List contains visual_style
test('Preset list returns visual_style', () => {
  const presets = listPresets();
  assert.ok(presets.length > 0, 'Presets should not be empty');
  presets.forEach(p => {
    assert.ok(p.visual_style !== undefined, `Preset ${p.key} should have visual_style defined`);
    assert.strictEqual(typeof p.visual_style, 'string', `Preset ${p.key} visual_style should be a string`);
  });
});

// 2. Test Preset Detail structure has correct 6 fields
test('Preset detail profile has correct canonical fields', () => {
  const key = 'pawville_pet_story';
  const preset = getPreset(key);
  assert.ok(preset, 'PawVille preset should exist');
  const profile = preset.profile;
  
  assert.ok(profile.default_visual_style, 'profile.default_visual_style is required');
  assert.ok(profile.default_aspect_ratio, 'profile.default_aspect_ratio is required');
  assert.ok(profile.default_scene_count, 'profile.default_scene_count is required');
  assert.ok(profile.default_scene_duration, 'profile.default_scene_duration is required');
  assert.ok(profile.default_story_template, 'profile.default_story_template is required');
  assert.ok(profile.default_pillars_json, 'profile.default_pillars_json is required');
});

// 3. Test Content World Contract mapping consistency
test('Content World Contract retrieves correct canonical defaults', () => {
  const defaults = getUniverseDefaults('pawville');
  assert.ok(defaults, 'PawVille default config should exist');
  
  // The contract maps canonical properties to clean UI properties for consumer engines
  assert.strictEqual(defaults.visual_style, 'cinematic_3d_clay', 'visual_style mapping matches default_visual_style');
  assert.strictEqual(defaults.aspect_ratio, '9:16', 'aspect_ratio mapping matches default_aspect_ratio');
  assert.strictEqual(defaults.scene_count, 7, 'scene_count mapping matches default_scene_count');
  assert.strictEqual(defaults.scene_duration, 8, 'scene_duration mapping matches default_scene_duration');
  assert.strictEqual(defaults.story_template, 'pet_problem_solution_7beat', 'story_template mapping matches default_story_template');
});

// 4. Test UI Form Mapping Contract Helper Logic
test('UI Form Mapping contract helpers mock verification', () => {
  // Test mock UI helper record mapping (simulating app/settings/universes/page.js mapUniverseRecordToForm)
  function mockMapUniverseRecordToForm(u) {
    return {
      visual_style: u.default_visual_style ?? u.visual_style ?? '',
      aspect_ratio: u.default_aspect_ratio ?? u.aspect_ratio ?? '9:16',
      scene_count: u.default_scene_count ?? u.scene_count ?? 5,
      scene_duration: u.default_scene_duration ?? u.scene_duration ?? 3,
      story_template: u.default_story_template ?? u.story_template ?? '',
      pillars: (() => {
        const pData = u.default_pillars_json ?? u.pillars ?? [];
        try {
          return typeof pData === 'string' ? JSON.parse(pData) : (pData || []);
        } catch { return []; }
      })()
    };
  }

  function mockMapUniverseFormToPayload(form) {
    return {
      default_visual_style: form.visual_style,
      default_aspect_ratio: form.aspect_ratio,
      default_scene_count: Number(form.scene_count),
      default_scene_duration: Number(form.scene_duration),
      default_story_template: form.story_template,
      default_pillars_json: form.pillars
    };
  }

  const dbRecord = {
    default_visual_style: 'clay-3d',
    default_aspect_ratio: '16:9',
    default_scene_count: 10,
    default_scene_duration: 5,
    default_story_template: 'test-template',
    default_pillars_json: JSON.stringify(['p1', 'p2'])
  };

  const form = mockMapUniverseRecordToForm(dbRecord);
  assert.strictEqual(form.visual_style, 'clay-3d');
  assert.strictEqual(form.aspect_ratio, '16:9');
  assert.strictEqual(form.scene_count, 10);
  assert.strictEqual(form.scene_duration, 5);
  assert.strictEqual(form.story_template, 'test-template');
  assert.deepStrictEqual(form.pillars, ['p1', 'p2']);

  // Convert back to payload
  const payload = mockMapUniverseFormToPayload(form);
  assert.strictEqual(payload.default_visual_style, 'clay-3d');
  assert.strictEqual(payload.default_aspect_ratio, '16:9');
  assert.strictEqual(payload.default_scene_count, 10);
  assert.strictEqual(payload.default_scene_duration, 5);
  assert.strictEqual(payload.default_story_template, 'test-template');
  assert.deepStrictEqual(payload.default_pillars_json, ['p1', 'p2']);
});

console.log(`\n==================================================`);
console.log(`📊 Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`==================================================`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
