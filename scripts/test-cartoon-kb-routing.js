#!/usr/bin/env node
/**
 * Test Script: Cartoon KB Routing & Content World Validation
 * Verifies KB loader conditional routing and contract validators.
 * 
 * Run: node scripts/test-cartoon-kb-routing.js
 */

import path from 'path';
import fs from 'fs';

// Resolve paths
const KB_DIR = path.join(process.cwd(), 'kb');

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failed++;
  }
}

// ============================================
// Test 1: KB Files Exist
// ============================================
console.log('\n📁 Test 1: KB Files Existence');
assert(fs.existsSync(path.join(KB_DIR, 'PET_CONTENT_KB.md')), 'PET_CONTENT_KB.md exists');
assert(fs.existsSync(path.join(KB_DIR, 'CARTOON_UNIVERSE_STORY_ENGINE.md')), 'CARTOON_UNIVERSE_STORY_ENGINE.md exists');
assert(fs.existsSync(path.join(KB_DIR, 'CARTOON_VISUAL_CONTINUITY_KB.md')), 'CARTOON_VISUAL_CONTINUITY_KB.md exists');
assert(fs.existsSync(path.join(KB_DIR, 'universes', 'PAWVILLE_UNIVERSE_PROFILE.md')), 'universes/PAWVILLE_UNIVERSE_PROFILE.md exists');

// ============================================
// Test 2: Content World Contract Validators
// ============================================
console.log('\n🔒 Test 2: Content World Contract Validators');
const {
  validateContentWorld,
  validateKnowledgeDomain,
  validateUniverseProfile,
  validateProductRole,
  validateProductRevealBeat,
  getUniverseDefaults,
  buildUniverseConfigJson,
  normalizeContentWorldParams,
  refreshDynamicProfiles,
  CONTENT_WORLDS,
  KNOWLEDGE_DOMAINS,
  UNIVERSE_PROFILES
} = await import('../lib/content-world-contract.js');

await refreshDynamicProfiles();

assert(validateContentWorld('real_world') === 'real_world', 'real_world accepted');
assert(validateContentWorld('cartoon_universe') === 'cartoon_universe', 'cartoon_universe accepted');
assert(validateContentWorld('real_animal') === 'real_animal', 'real_animal accepted');
assert(validateContentWorld(null) === 'real_world', 'null defaults to real_world');
try { validateContentWorld('invalid_world'); assert(false, 'invalid world rejected'); } catch(e) { assert(e.code === 'CONTENT_WORLD_VALIDATION', 'invalid_world throws validation error'); }

assert(validateKnowledgeDomain('pet_supplies') === 'pet_supplies', 'pet_supplies accepted');
assert(validateKnowledgeDomain(null) === 'general', 'null defaults to general');

assert(validateUniverseProfile('pawville') === 'pawville', 'pawville accepted');
assert(validateUniverseProfile('PAWVILLE') === 'pawville', 'PAWVILLE case-insensitive');
assert(validateUniverseProfile(null) === null, 'null profile returns null');
try { validateUniverseProfile('nonexistent'); assert(false, 'nonexistent rejected'); } catch(e) { assert(e.code === 'CONTENT_WORLD_VALIDATION', 'nonexistent universe throws error'); }

assert(validateProductRole('primary_solution') === 'primary_solution', 'primary_solution accepted');
assert(validateProductRole('invalid') === 'none', 'invalid product role defaults to none');
assert(validateProductRevealBeat('beat_4') === 'beat_4', 'beat_4 accepted');
assert(validateProductRevealBeat('invalid') === 'none', 'invalid beat defaults to none');

// ============================================
// Test 3: Universe Defaults & Config
// ============================================
console.log('\n🏰 Test 3: Universe Defaults');
const pawvilleDefaults = getUniverseDefaults('pawville');
assert(pawvilleDefaults !== null, 'PawVille defaults exist');
assert(pawvilleDefaults.content_world === 'cartoon_universe', 'PawVille is cartoon_universe');
assert(pawvilleDefaults.knowledge_domain === 'pet_supplies', 'PawVille uses pet_supplies');
assert(pawvilleDefaults.human_presence === 'none', 'PawVille has no humans');
assert(pawvilleDefaults.visual_style === 'cinematic_3d_clay', 'PawVille uses 3D clay');
assert(pawvilleDefaults.scene_count === 7, 'PawVille has 7 scenes');
assert(Array.isArray(pawvilleDefaults.default_pillars), 'PawVille has default pillars');
assert(getUniverseDefaults('nonexistent') === null, 'nonexistent universe returns null');

const configJson = buildUniverseConfigJson('pawville');
assert(configJson !== null, 'Config JSON generated');
const parsed = JSON.parse(configJson);
assert(parsed.visual_style === 'cinematic_3d_clay', 'Config JSON has correct style');

// ============================================
// Test 4: normalizeContentWorldParams
// ============================================
console.log('\n🔄 Test 4: normalizeContentWorldParams');
const normalizedReal = normalizeContentWorldParams({ content_world: 'real_world' });
assert(normalizedReal.content_world === 'real_world', 'real_world normalized');
assert(normalizedReal.universe_profile === null, 'real_world has no universe');
assert(normalizedReal.universe_config_json === null, 'real_world has no config json');

const normalizedCartoon = normalizeContentWorldParams({ content_world: 'cartoon_universe', universe_profile: 'pawville' });
assert(normalizedCartoon.content_world === 'cartoon_universe', 'cartoon normalized');
assert(normalizedCartoon.universe_profile === 'pawville', 'pawville auto-set');
assert(normalizedCartoon.universe_config_json !== null, 'config json auto-generated');

// ============================================
// Test 5: KB Loader Conditional Routing
// ============================================
console.log('\n📚 Test 5: KB Loader Conditional Routing');
const { getStrategicSkeletonKB, getCreativeGeneratorKB, readKbFile } = await import('../lib/kb-loader.js');

// Test 5a: Real-world KB (no worldContext) - unchanged behavior
const realWorldStrategic = getStrategicSkeletonKB();
assert(realWorldStrategic.includes('STRATEGIC FRAMEWORKS'), 'Real-world: Strategic Frameworks loaded');
assert(realWorldStrategic.includes('STRATEGIC DECISION TREE'), 'Real-world: Decision Tree loaded');
assert(!realWorldStrategic.includes('PET CONTENT'), 'Real-world: No Pet Content KB');
assert(!realWorldStrategic.includes('CARTOON UNIVERSE STORY ENGINE'), 'Real-world: No Story Engine KB');

const realWorldCreative = getCreativeGeneratorKB();
assert(realWorldCreative.includes('REALIST VIRAL NARRATIVE'), 'Real-world: Realist Narrative loaded');
assert(realWorldCreative.includes('VISUAL STYLE GUIDE'), 'Real-world: Visual Style loaded');

// Test 5b: Cartoon Universe KB
const cartoonContext = { contentWorld: 'cartoon_universe', knowledgeDomain: 'pet_supplies', universeProfile: 'pawville' };
const cartoonStrategic = getStrategicSkeletonKB(cartoonContext);
assert(cartoonStrategic.includes('STRATEGIC FRAMEWORKS'), 'Cartoon: Strategic Frameworks still loaded');
assert(cartoonStrategic.includes('PET CONTENT'), 'Cartoon: Pet Content KB loaded');
assert(cartoonStrategic.includes('CARTOON UNIVERSE STORY ENGINE'), 'Cartoon: Story Engine KB loaded');
assert(cartoonStrategic.includes('CARTOON VISUAL CONTINUITY'), 'Cartoon: Visual Continuity KB loaded');
assert(cartoonStrategic.includes('UNIVERSE PROFILE: PAWVILLE'), 'Cartoon: PawVille profile loaded');

const cartoonCreative = getCreativeGeneratorKB(cartoonContext);
assert(!cartoonCreative.includes('REALIST VIRAL NARRATIVE'), 'Cartoon: Realist Narrative EXCLUDED');
assert(!cartoonCreative.includes('VISUAL STYLE GUIDE'), 'Cartoon: Visual Style EXCLUDED');
assert(cartoonCreative.includes('PET CONTENT'), 'Cartoon Creative: Pet Content KB loaded');
assert(cartoonCreative.includes('NARRATIVE STRUCTURE'), 'Cartoon Creative: Narrative Structure still loaded');

// Test 5c: Real Animal KB (pet without cartoon)
const animalContext = { contentWorld: 'real_animal', knowledgeDomain: 'pet_supplies', universeProfile: null };
const animalCreative = getCreativeGeneratorKB(animalContext);
assert(animalCreative.includes('REALIST VIRAL NARRATIVE'), 'Animal: Realist Narrative still loaded');
assert(animalCreative.includes('PET CONTENT'), 'Animal: Pet Content KB loaded');
assert(!animalCreative.includes('CARTOON UNIVERSE STORY ENGINE'), 'Animal: No Story Engine');

// ============================================
// Summary
// ============================================
console.log(`\n${'='.repeat(50)}`);
console.log(`📊 Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${'='.repeat(50)}`);

if (failed > 0) {
  console.error('\\n❌ Some tests FAILED!');
  process.exit(1);
} else {
  console.log('\\n✅ All tests PASSED!');
  process.exit(0);
}
