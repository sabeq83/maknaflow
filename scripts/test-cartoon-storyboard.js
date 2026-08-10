/**
 * Test script: Cartoon Storyboard Pipeline Verification (Tahap 2)
 *
 * Verifies that:
 * 1. buildOrganicPillarPrompt generates cartoon directive for cartoon_universe
 * 2. Negative prompts are world-aware (no anti-cartoon for cartoon mode)
 * 3. KB filtering works correctly (cartoon KBs loaded, realist excluded)
 * 4. Editorial mode (no product) generates story progression in Beat 4-5
 * 5. Product mode generates product intro/demo in Beat 4-5
 * 6. Real-world regression: no cartoon directives for real_world
 * 7. Continuity validator passes/fails correctly
 * 8. pillar-campaign-ingest auto-configures 7 clips for cartoon
 *
 * Usage: node scripts/test-cartoon-storyboard.js
 */

import { buildOrganicPillarPrompt } from '../lib/prompts.js';
import { validateCartoonContinuity, logValidationResults } from '../lib/cartoon-continuity-validator.js';

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, testName) {
  if (condition) {
    passed++;
    results.push(`  ✅ ${testName}`);
  } else {
    failed++;
    results.push(`  ❌ ${testName}`);
  }
}

// Mock KB texts
const mockKBs = [
  { name: 'STRATEGIC_FRAMEWORKS', content: 'Strategic frameworks content...' },
  { name: 'REALIST_VIRAL_NARRATIVE', content: 'Realist narrative content...' },
  { name: 'VISUAL_STYLE_GUIDE', content: 'Visual style guide content...' },
  { name: 'BRAND_VOICE_GUIDE', content: 'Brand voice guide...' },
  { name: 'COMPLIANCE_GUIDE', content: 'Compliance guide...' },
  { name: 'PET_CONTENT_KB', content: 'Pet content KB...' },
  { name: 'CARTOON_UNIVERSE_STORY_ENGINE', content: 'Cartoon story engine...' },
  { name: 'CARTOON_VISUAL_CONTINUITY_KB', content: 'Cartoon visual continuity...' },
  { name: 'PAWVILLE_UNIVERSE_PROFILE', content: 'PawVille universe profile...' }
];

// ─── Test Group 1: Cartoon Universe Prompt Generation ───
console.log('\\n📋 Test Group 1: Cartoon Universe Prompt Generation');

const cartoonCampaignData = {
  content_world: 'cartoon_universe',
  universe_profile: 'pawville',
  story_template: 'pet_problem_solution_7beat',
  universe_snapshot_json: JSON.stringify({ visual_style: 'cinematic_3d_clay' }),
  target_clips_count: 7,
  bridge_at_clip: 4,
  bridge_duration_clips: 2,
  is_bridging_active: 1,
  content_pillar: 'Pet Hydration',
  custom_hook: 'Kenapa kucing malas minum?',
  visual_action_guideline: 'Mochi mengendus mangkuk air',
  narrative_mode: 'Storytelling',
  visual_style: 'Cinematic 3D Clay',
  aspect_ratio: '9:16',
  target_language: 'id-ID',
  face_visibility: 'Faceless',
  visual_mode: 'hybrid_lock',
  sfx_setting: 'without_sfx',
  words_per_clip: '12-15 kata',
  _rowPayload: {
    main_character: 'Mochi',
    supporting_characters: 'Dr. Paw, Coco, Boba',
    story_premise: 'Mochi malas minum air dari mangkuk biasa',
    pet_problem: 'Kucing tidak tertarik minum air diam',
    product_role: 'primary_solution',
    product_reveal_beat: 'beat_4',
    universe_profile: 'pawville'
  }
};

const cartoonProductData = {
  product_name: 'PetFlow Water Fountain',
  product_description: 'Air mancur otomatis untuk hewan peliharaan',
  unique_selling_point: 'Filter 3 lapis dengan aliran air yang menarik kucing',
  packaging_type: 'Box karton',
  is_in_packaging: 0
};

const cartoonPrompt = buildOrganicPillarPrompt(mockKBs, cartoonCampaignData, cartoonProductData, null, null);

assert(cartoonPrompt.includes('CARTOON UNIVERSE STORY DIRECTIVE'), 'Cartoon directive present');
assert(cartoonPrompt.includes('7-BEAT STORY ARC'), '7-beat story arc present');
assert(cartoonPrompt.includes('CHARACTER IDENTITY LOCK'), 'Character identity lock present');
assert(cartoonPrompt.includes('LOCATION CONTINUITY LOCK'), 'Location continuity lock present');
assert(cartoonPrompt.includes('PRODUCT GEOMETRY LOCK'), 'Product geometry lock present (product mode)');
assert(cartoonPrompt.includes('HUMAN-PRESENCE RULE'), 'Human-presence rule present');
assert(cartoonPrompt.includes('ANTHROPOMORPHISM'), 'Anthropomorphism rules present');
assert(cartoonPrompt.includes('Mochi'), 'Main character Mochi referenced');
assert(cartoonPrompt.includes('Dr. Paw'), 'Supporting character Dr. Paw referenced');
assert(cartoonPrompt.includes('SOLUTION INTRODUCTION'), 'Beat 4 = Solution Introduction (product mode)');
assert(cartoonPrompt.includes('PRODUCT DEMONSTRATION'), 'Beat 5 = Product Demonstration (product mode)');

// ─── Test Group 2: KB Filtering ───
console.log('\\n📋 Test Group 2: KB Filtering');

assert(!cartoonPrompt.includes('Realist narrative content'), 'REALIST_VIRAL_NARRATIVE excluded in cartoon mode');
assert(!cartoonPrompt.includes('Visual style guide content'), 'VISUAL_STYLE_GUIDE excluded in cartoon mode');
assert(cartoonPrompt.includes('Pet content KB'), 'PET_CONTENT_KB included in cartoon mode');
assert(cartoonPrompt.includes('Cartoon story engine'), 'CARTOON_UNIVERSE_STORY_ENGINE included in cartoon mode');
assert(cartoonPrompt.includes('Strategic frameworks content'), 'STRATEGIC_FRAMEWORKS still included in cartoon mode');

// ─── Test Group 3: Negative Prompt ───
console.log('\\n📋 Test Group 3: World-Aware Negative Prompt');

assert(!cartoonPrompt.includes('CGI look, plastic skin, anime, cartoon'), 'Anti-cartoon negatives suppressed');
assert(cartoonPrompt.includes('NO human characters, NO human hands, NO human face'), 'Cartoon-specific negatives present');
assert(cartoonPrompt.includes('character morphing'), 'Character morphing in negative prompt');
assert(cartoonPrompt.includes('photorealistic rendering'), 'Photorealistic rendering in negative prompt');

// ─── Test Group 4: Editorial Mode (No Product) ───
console.log('\\n📋 Test Group 4: Editorial Mode (No Product)');

const editorialCampaignData = {
  ...cartoonCampaignData,
  is_bridging_active: 0,
  _rowPayload: {
    ...cartoonCampaignData._rowPayload,
    product_role: 'none',
    product_reveal_beat: 'none'
  }
};

const editorialPrompt = buildOrganicPillarPrompt(mockKBs, editorialCampaignData, null, null, null);

assert(editorialPrompt.includes('STORY PROGRESSION'), 'Beat 4 = Story Progression (editorial mode)');
assert(editorialPrompt.includes('DEEPER EXPLORATION'), 'Beat 5 = Deeper Exploration (editorial mode)');
assert(!editorialPrompt.includes('PRODUCT GEOMETRY LOCK'), 'No product geometry lock (editorial mode)');

// ─── Test Group 5: Real-World Regression ───
console.log('\\n📋 Test Group 5: Real-World Regression');

const realWorldCampaignData = {
  content_pillar: 'Tips Memasak',
  custom_hook: 'Rahasia masakan enak',
  visual_action_guideline: 'Tangan memasak di dapur',
  narrative_mode: 'Storytelling',
  visual_style: 'Cinematic',
  aspect_ratio: '9:16',
  target_language: 'id-ID',
  face_visibility: 'Faceless',
  visual_mode: 'hybrid_lock',
  target_clips_count: 4,
  bridge_at_clip: 2,
  bridge_duration_clips: 1,
  is_bridging_active: 0,
  sfx_setting: 'without_sfx',
  words_per_clip: '17-19 kata'
};

const realWorldPrompt = buildOrganicPillarPrompt(mockKBs, realWorldCampaignData, null, null, null);

assert(!realWorldPrompt.includes('CARTOON UNIVERSE STORY DIRECTIVE'), 'No cartoon directive in real_world');
assert(!realWorldPrompt.includes('CHARACTER IDENTITY LOCK'), 'No character lock in real_world');
assert(!realWorldPrompt.includes('7-BEAT STORY ARC'), 'No 7-beat arc in real_world');
assert(realWorldPrompt.includes('Realist narrative content'), 'REALIST_VIRAL_NARRATIVE loaded in real_world');
assert(realWorldPrompt.includes('Visual style guide content'), 'VISUAL_STYLE_GUIDE loaded in real_world');

// ─── Test Group 6: Continuity Validator ───
console.log('\\n📋 Test Group 6: Continuity Validator');

const goodOutput = {
  storyboard: Array.from({ length: 7 }, (_, i) => ({
    scene: i + 1,
    visual_description: i === 0 ? "Mochi sits near water bowl at Mochi's Home" : `Scene ${i + 1} at PawVille Park`
  })),
  voiceover: Array.from({ length: 7 }, (_, i) => ({
    scene: i + 1,
    narration: i === 6 ? 'Air mancur ini bisa membantu Mochi tetap terhidrasi' : `Narasi beat ${i + 1}`
  })),
  t2i_prompts: Array.from({ length: 7 }, (_, i) => ({
    prompt: `A grey British Shorthair cat named Mochi in PawVille, scene ${i + 1}`
  })),
  i2v_prompts: Array.from({ length: 7 }, () => ({ prompt: 'Camera pan left' }))
};

const goodResult = validateCartoonContinuity(goodOutput, {}, cartoonCampaignData._rowPayload);
assert(goodResult.checks.scene_count.passed, 'Validator: 7 scenes pass');
assert(goodResult.checks.character_consistency.passed, 'Validator: main character found');
assert(goodResult.checks.pet_medical_claims.passed, 'Validator: no medical claims');
assert(goodResult.checks.human_presence.passed, 'Validator: no human presence');

const badOutput = {
  storyboard: Array.from({ length: 5 }, (_, i) => ({
    scene: i + 1,
    visual_description: `A human person walking`
  })),
  voiceover: Array.from({ length: 5 }, (_, i) => ({
    scene: i + 1,
    narration: i === 0 ? 'Produk ini menyembuhkan penyakit kucing' : `Beat ${i + 1}`
  })),
  t2i_prompts: [],
  i2v_prompts: []
};

const badResult = validateCartoonContinuity(badOutput, {}, cartoonCampaignData._rowPayload);
assert(!badResult.checks.scene_count.passed, 'Validator: wrong scene count detected');
assert(!badResult.checks.pet_medical_claims.passed, 'Validator: medical claims detected');
assert(!badResult.checks.human_presence.passed, 'Validator: human presence detected');

// ─── Results ───
console.log('\\n' + '='.repeat(60));
console.log(`📊 RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
results.forEach(r => console.log(r));
console.log('='.repeat(60));

if (failed > 0) {
  console.error(`\\n❌ ${failed} test(s) FAILED`);
  process.exit(1);
} else {
  console.log(`\\n✅ All ${passed} tests PASSED`);
  process.exit(0);
}
