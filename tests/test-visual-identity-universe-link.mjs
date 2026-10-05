import assert from 'assert';
import { validateAndNormalizeVisualIdentity } from '../lib/visual-identity-contract.js';
import { buildVisualIdentityPromptSection } from '../lib/visual-identity-allocator.js';

console.log('🧪 Starting tests for Visual Identity Universe Linking & Character Integration...\n');

// --------------------------------------------------------------------------
// Test 1: Normalize Visual Identity with Universe Profile Link
// --------------------------------------------------------------------------
console.log('▶ Test 1: Testing normalization of Visual Identity with Universe Link...');

const rawKioViConfig = {
  schema_version: '2',
  label: 'Kio Wonders — 3D Sci-Fi Curiosity',
  description: '3D Science Curiosity style',
  subject: {
    kind: 'stylized_3d_character',
    faceless_mode: 'not_applicable',
    universe_profile_id: 'univ_kio_wonders_12345',
    universe_slug: 'kio-wonders',
    universe_name: 'Kio Wonders',
    character_keys: ['kio', 'bimo'],
    custom_description: 'Kio (3D Boy Explorer) & BIMO (AI Hover-Bot)',
    character_count: 2,
    population_mode: 'group'
  },
  visual_language: {
    primary_style: 'stylized_3d_character',
    supporting_styles: ['isometric_society']
  },
  rendering: {
    geometry: 'simplified_semi_realistic',
    textures: ['smooth_matte_plastic', 'glowing_hologram_glass']
  },
  guardrails: {
    face_visibility: 'allowed'
  }
};

const normalized = validateAndNormalizeVisualIdentity(rawKioViConfig);

console.log('  Normalized subject:', normalized.subject);
console.log('  Normalized guardrails:', normalized.guardrails);

assert.strictEqual(normalized.subject.kind, 'stylized_3d_character', 'subject.kind should be stylized_3d_character');
assert.strictEqual(normalized.subject.universe_slug, 'kio-wonders', 'universe_slug should be preserved');
assert.strictEqual(normalized.subject.universe_name, 'Kio Wonders', 'universe_name should be preserved');
assert.deepStrictEqual(normalized.subject.character_keys, ['kio', 'bimo'], 'character_keys should be preserved');
assert.strictEqual(normalized.guardrails.face_visibility, 'allowed', 'guardrails.face_visibility should be allowed for 3D character');

console.log('  ✅ Test 1 Passed: Visual Identity correctly preserves Universe Linking fields and allowed face visibility.\n');

// --------------------------------------------------------------------------
// Test 2: Prompt Generation with Universe-Linked 3D Visual Identity
// --------------------------------------------------------------------------
console.log('▶ Test 2: Testing prompt generation with Universe-Linked 3D Visual Identity...');

const promptSection = buildVisualIdentityPromptSection(normalized, 8);
console.log('  Prompt Section Preview (excerpts):');
const lines = promptSection.split('\n').filter(l => l.includes('Konsep Karakter') || l.includes('GUARDRAILS') || l.includes('Wajib konsisten'));
lines.forEach(l => console.log('   ', l));

assert.ok(promptSection.includes('FULL 3D STYLIZED ANIMATED CHARACTER'), 'Prompt should include full 3D stylized animated character');
assert.ok(!promptSection.includes('STRICTLY FACELESS'), 'Prompt should not mandate strictly faceless hands only');
assert.ok(promptSection.includes('DILARANG KERAS memunculkan wajah manusia fotorealistik'), 'Prompt should still prohibit photorealistic human faces');

console.log('  ✅ Test 2 Passed: Prompt Section generated without faceless restrictions.\n');

console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
