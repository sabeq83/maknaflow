import assert from 'assert';
import { readKbFile, getWorldAwareKB, synthesizeUniverseProfileKB } from '../lib/kb-loader.js';
import { buildOpcStartFrameRequest } from '../lib/opc-start-frame-request.js';

console.log('🧪 RUNNING UNIVERSE KB LOADER & NEGATIVE PROMPT TESTS\n');

// Test 1: Verify Kio Wonders KB file
console.log('--- Test 1: KIO_WONDERS_UNIVERSE_PROFILE.md ---');
const kioKb = readKbFile('universes/KIO_WONDERS_UNIVERSE_PROFILE.md');
assert(kioKb && kioKb.length > 200, 'Kio Wonders KB should load from disk');
assert(kioKb.includes('Kio (Lead Science Explorer)'), 'Kio Wonders KB should contain Kio');
assert(kioKb.includes('BIMO (AI Companion Hover-Bot)'), 'Kio Wonders KB should contain BIMO');
console.log('✅ KIO_WONDERS_UNIVERSE_PROFILE.md loaded successfully');

// Test 2: Verify WonderQuest Kids KB file
console.log('\n--- Test 2: WONDERQUEST_KIDS_UNIVERSE_PROFILE.md ---');
const wqKb = readKbFile('universes/WONDERQUEST_KIDS_UNIVERSE_PROFILE.md');
assert(wqKb && wqKb.length > 200, 'WonderQuest Kids KB should load from disk');
assert(wqKb.includes('Luna (The Brave Pathfinder)'), 'WonderQuest Kids KB should contain Luna');
assert(wqKb.includes('Miko (The Curious Scholar)'), 'WonderQuest Kids KB should contain Miko');
console.log('✅ WONDERQUEST_KIDS_UNIVERSE_PROFILE.md loaded successfully');

// Test 3: Verify getWorldAwareKB with Kio Wonders
console.log('\n--- Test 3: getWorldAwareKB ---');
const worldKb = getWorldAwareKB({
  contentWorld: 'cartoon_universe',
  knowledgeDomain: 'general',
  universeProfile: 'kio-wonders'
});
assert(worldKb.includes('UNIVERSE PROFILE: KIO-WONDERS'), 'getWorldAwareKB should include Kio Wonders universe profile');
assert(worldKb.includes('CARTOON UNIVERSE STORY ENGINE'), 'getWorldAwareKB should include cartoon shared engine');
console.log('✅ getWorldAwareKB loaded cartoon shared engine and Kio Wonders profile');

// Test 4: Dynamic manifest synthesis fallback
console.log('\n--- Test 4: Dynamic Synthesis Fallback ---');
const mockCustomManifest = {
  universe_profile: 'astrodog',
  universe_type: 'animal_scifi',
  human_presence: 'none',
  style_reference_path: '/style.png',
  characters: {
    rex: {
      display_name: 'Rex Astro',
      role: 'captain',
      canonical_description: 'Golden retriever in silver spacesuit',
      forbidden_changes: ['no fur color change']
    }
  },
  locations: [
    { location_key: 'lunar_base', name: 'Lunar Base Alpha', visual_description: 'High-tech lunar crater dome' }
  ]
};
const synthKb = synthesizeUniverseProfileKB(mockCustomManifest);
assert(synthKb.includes('Rex Astro'), 'Synthesized KB should contain character');
assert(synthKb.includes('Lunar Base Alpha'), 'Synthesized KB should contain location');
console.log('✅ synthesizeUniverseProfileKB dynamically generated valid KB');

// Test 5: Cartoon Clean Negative Prompt in buildOpcStartFrameRequest
console.log('\n--- Test 5: Clean Cartoon Negative Prompt in buildOpcStartFrameRequest ---');
const cartoonReq = await buildOpcStartFrameRequest({
  campaign: { content_world: 'cartoon_universe', universe_profile: 'kio-wonders' },
  item: { new_video_plan_json: '[]' },
  clipIndex: 1,
  prompt: 'A cheerful 8-year-old boy named Kio smiling in WonderLab'
});

assert(cartoonReq.providerRequest.negative_prompt, 'Should have negative prompt');
assert(!cartoonReq.providerRequest.negative_prompt.includes('eyes, nose, mouth'), 'Cartoon negative prompt must NOT prohibit eyes, nose, or mouth');
assert(!cartoonReq.providerRequest.negative_prompt.includes('human face, facial features'), 'Cartoon negative prompt must NOT prohibit human face/facial features');
assert(cartoonReq.providerRequest.negative_prompt.includes('photorealistic human photography'), 'Cartoon negative prompt should prohibit photorealism');
console.log('✅ buildOpcStartFrameRequest generates clean cartoon negative prompt without stripping facial features');

// Test 6: Faceless Negative Prompt preserved for realist_faceless
console.log('\n--- Test 6: Preserved Faceless Negative Prompt for Realist Campaigns ---');
const realistReq = await buildOpcStartFrameRequest({
  campaign: { content_world: 'realist_editorial', visual_mode: 'faceless_editorial' },
  item: { new_video_plan_json: '[]' },
  clipIndex: 1,
  prompt: 'Preparing herbal tea on kitchen counter'
});
assert(realistReq.providerRequest.negative_prompt.includes('eyes, nose, mouth'), 'Realist faceless negative prompt must prohibit eyes, nose, mouth');
console.log('✅ Realist faceless negative prompt correctly preserved');

console.log('\n🎉 ALL UNIVERSE KB & NEGATIVE PROMPT TESTS PASSED!');
process.exit(0);
