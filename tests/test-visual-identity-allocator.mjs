import { strict as assert } from 'assert';
import { allocateClipsToNarrativeModes, buildVisualIdentityPromptSection } from '../lib/visual-identity-allocator.js';
import { buildOrganicPillarPrompt } from '../lib/prompts.js';
import { SYSTEM_VISUAL_IDENTITIES, WAY_SIYASI_DEFAULT_ROUTING } from '../lib/visual-identity-system-presets.js';

const waySiyasiPreset = SYSTEM_VISUAL_IDENTITIES.find(p => p.key === 'way_siyasi_editorial_system');
const WAY_SIYASI_EDITORIAL_SYSTEM = waySiyasiPreset.config;

console.log('🧪 [TEST 1] Testing Dynamic Clip Allocator (allocateClipsToNarrativeModes)...');

// Test N = 4 clips
const alloc4 = allocateClipsToNarrativeModes(4, WAY_SIYASI_EDITORIAL_SYSTEM.mode_routing);
assert.equal(alloc4.length, 4);
assert.equal(alloc4[0].narrativeFunction, 'hook');
assert.equal(alloc4[0].visualMode, 'symbolic_surrealism');
assert.equal(alloc4[3].narrativeFunction, 'conclusion');
assert.equal(alloc4[3].visualMode, 'symbolic_surrealism');
console.log('  ✅ N=4 clips allocated successfully:', alloc4.map(a => `Klip ${a.clipIndex}: ${a.narrativeFunction} (${a.visualMode})`).join(', '));

// Test N = 6 clips
const alloc6 = allocateClipsToNarrativeModes(6, WAY_SIYASI_EDITORIAL_SYSTEM.mode_routing);
assert.equal(alloc6.length, 6);
assert.equal(alloc6[0].narrativeFunction, 'hook');
assert.equal(alloc6[0].visualMode, 'symbolic_surrealism');
assert.equal(alloc6[1].narrativeFunction, 'context');
assert.equal(alloc6[1].visualMode, 'editorial_graphic_novel');
assert.equal(alloc6[2].narrativeFunction, 'mechanism');
assert.equal(alloc6[2].visualMode, 'isometric_society');
assert.equal(alloc6[5].narrativeFunction, 'conclusion');
assert.equal(alloc6[5].visualMode, 'symbolic_surrealism');
console.log('  ✅ N=6 clips allocated successfully:', alloc6.map(a => `Klip ${a.clipIndex}: ${a.narrativeFunction} (${a.visualMode})`).join(', '));

// Test N = 10 clips
const alloc10 = allocateClipsToNarrativeModes(10, WAY_SIYASI_EDITORIAL_SYSTEM.mode_routing);
assert.equal(alloc10.length, 10);
assert.equal(alloc10[0].narrativeFunction, 'hook');
assert.equal(alloc10[9].narrativeFunction, 'conclusion');
const distinctModes10 = new Set(alloc10.map(a => a.visualMode));
assert.ok(distinctModes10.has('symbolic_surrealism'));
assert.ok(distinctModes10.has('editorial_graphic_novel'));
assert.ok(distinctModes10.has('isometric_society'));
console.log('  ✅ N=10 clips allocated successfully with diverse modes:', [...distinctModes10].join(', '));

// Test N = 15 clips
const alloc15 = allocateClipsToNarrativeModes(15, WAY_SIYASI_EDITORIAL_SYSTEM.mode_routing);
assert.equal(alloc15.length, 15);
assert.equal(alloc15[0].narrativeFunction, 'hook');
assert.equal(alloc15[14].narrativeFunction, 'conclusion');
console.log('  ✅ N=15 clips allocated successfully:', alloc15.map(a => `Klip ${a.clipIndex}: ${a.narrativeFunction} (${a.visualMode})`).join(' | '));

console.log('\n🧪 [TEST 2] Testing buildVisualIdentityPromptSection with Wa\'y Siyasi...');
const snapshot = {
  schema_version: 'visual_identity_snapshot_v1',
  identity_ref: { id: 'way_siyasi', key: 'way_siyasi_editorial_system', version: 1 },
  label: WAY_SIYASI_EDITORIAL_SYSTEM.label,
  structured: WAY_SIYASI_EDITORIAL_SYSTEM
};

const vsoSection = buildVisualIdentityPromptSection(snapshot, 6);
assert.ok(vsoSection.includes('VISUAL IDENTITY SYSTEM & DYNAMIC MODE ROUTING'));
assert.ok(vsoSection.includes('symbolic_surrealism'));
assert.ok(vsoSection.includes('editorial_graphic_novel'));
assert.ok(vsoSection.includes('isometric_society'));
assert.ok(vsoSection.includes('printed_paper_grain, editorial_ink'));
assert.ok(vsoSection.includes('METAPHOR ENGINE MANDATE'));
assert.ok(vsoSection.includes('STRICT VISUAL GUARDRAILS'));
console.log('  ✅ buildVisualIdentityPromptSection generated comprehensive prompt section.');

console.log('\n🧪 [TEST 3] Testing buildOrganicPillarPrompt with Schema v2 Visual Identity...');
const mockKBs = [
  { name: 'STRATEGIC_FRAMEWORKS', content: 'Framework content' },
  { name: 'PROMPT_SYSTEM', content: 'Prompt system content' }
];

const mockCampaignData = {
  campaign_name: 'Uji Coba Wa\'y Siyasi',
  content_pillar: 'Fenomena Sosial',
  custom_hook: 'Pernahkah Anda bertanya mengapa rasa lelah tidak pernah hilang?',
  visual_action_guideline: 'Low angle tracking shot jendela kereta',
  narrative_mode: 'Storytelling',
  target_clips_count: 6,
  clip_duration: 8,
  visual_mode: 'hybrid_lock',
  aspect_ratio: '9:16',
  target_language: 'id-ID'
};

const mockBrandProfile = {
  brand_name: "Wa'y Siyasi",
  editorial_brand_context: 'Pendidikan politik Islam & kebangkitan umat.',
  editorial_content_goal: 'Literasi kritis dan wawasan sistemik.',
  editorial_content_pillars_json: '["Fenomena Sosial", "Kritik Kebijakan"]'
};

const fullPrompt = buildOrganicPillarPrompt(mockKBs, mockCampaignData, null, mockBrandProfile, snapshot);

assert.ok(fullPrompt.includes('VISUAL IDENTITY SYSTEM & DYNAMIC MODE ROUTING'), 'Must contain Visual Identity System');
assert.ok(fullPrompt.includes('Editorial Multi-Mode System'), 'Visual style must be Editorial Multi-Mode System');
assert.ok(fullPrompt.includes('"visual_mode":'), 'Storyboard output schema must require visual_mode');
assert.ok(fullPrompt.includes('[STYLE: symbolic_surrealism'), 'Must provide editorial style layer sample');
assert.ok(fullPrompt.includes('METAPHOR ENGINE MANDATE'), 'Must mandate Metaphor Engine');
assert.ok(fullPrompt.includes('printed_paper_grain, editorial_ink'), 'Must mandate paper grain and ink textures');
console.log('  ✅ buildOrganicPillarPrompt correctly injected Schema v2 Visual Identity.');

console.log('\n🧪 [TEST 4] Testing Legacy Fallback in buildOrganicPillarPrompt...');
const legacyVso = {
  character_concept: 'faceless',
  subject_demographic: 'custom',
  subject_demographic_custom: 'an Indonesian worker',
  wardrobe_style: 'custom',
  wardrobe_style_custom: 'navy batik shirt',
  lighting_style: 'custom',
  lighting_style_custom: 'warm golden hour'
};

const legacyPrompt = buildOrganicPillarPrompt(mockKBs, mockCampaignData, null, mockBrandProfile, legacyVso);
assert.ok(legacyPrompt.includes('navy batik shirt'), 'Legacy must include wardrobe');
assert.ok(legacyPrompt.includes('VISUAL IDENTITY MANDATE'), 'Legacy must include legacy mandate');
assert.ok(!legacyPrompt.includes('METAPHOR ENGINE MANDATE'), 'Legacy must not include Metaphor Engine');
console.log('  ✅ Legacy fallback works seamlessly without regression.');

console.log('\n🎉 ALL 4 UNIT TESTS PASSED SUCCESSFULLY!');
