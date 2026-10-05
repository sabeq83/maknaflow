import assert from 'assert';
import { getWorldAwareKB } from '../lib/kb-loader.js';
import { validateCartoonContinuity } from '../lib/cartoon-continuity-validator.js';
import { buildVisualIdentityPromptSection } from '../lib/visual-identity-allocator.js';

console.log('🧪 Starting tests for Cartoon Universe & 3D Style harmonisation...\n');

// --------------------------------------------------------------------------
// Test 1: getWorldAwareKB Export & Execution
// --------------------------------------------------------------------------
console.log('▶ Test 1: Testing getWorldAwareKB export & loading...');
assert.strictEqual(typeof getWorldAwareKB, 'function', 'getWorldAwareKB should be an exported function');

const worldContext = {
  contentWorld: 'cartoon_universe',
  knowledgeDomain: 'general',
  universeProfile: 'pawville'
};
const kbContent = getWorldAwareKB(worldContext);
console.log(`  KB Content length: ${kbContent.length}`);
assert.ok(typeof kbContent === 'string', 'KB content should be a string');
console.log('  ✅ Test 1 Passed: getWorldAwareKB successfully imported and executed.\n');

// --------------------------------------------------------------------------
// Test 2: Cartoon Continuity Validator for 3D Human Universe (Kio Wonders)
// --------------------------------------------------------------------------
console.log('▶ Test 2: Testing validateCartoonContinuity for Kio Wonders (3D Stylized Boy)...');

const mockKioUniverse = {
  name: 'Kio Wonders',
  slug: 'kio-wonders',
  universe_type: 'character_driven',
  human_presence: 'stylized_3d',
  depiction_policy: 'stylized_3d_family',
  default_scene_count: 8,
  manifest: {
    characters: {
      kio: { name: 'Kio', species: 'Human (Stylized 3D Boy)' },
      bimo: { name: 'BIMO', species: 'AI Companion Hover-Bot' }
    },
    locations: [
      { name: "Kio's WonderLab", location_key: 'kios_wonderlab' }
    ]
  }
};

const mockKioOutput = {
  storyboard: [
    { clip: 1, location: "kios_wonderlab", visual_description: "3D animated boy Kio in orange vest looking at glowing portal with BIMO hovering beside him." },
    { clip: 2, location: "kios_wonderlab", visual_description: "Kio and BIMO stepping through the cosmic simulation portal in full 3D animation." },
    { clip: 3, location: "kios_wonderlab", visual_description: "Kio pointing excitedly at gigantic floating atoms." },
    { clip: 4, location: "kios_wonderlab", visual_description: "BIMO projecting colorful holographic data while boy Kio laughs." },
    { clip: 5, location: "kios_wonderlab", visual_description: "Close-up of animated boy Kio with wide curious eyes observing micro particles." },
    { clip: 6, location: "kios_wonderlab", visual_description: "Cosmic simulation swirling around Kio and BIMO." },
    { clip: 7, location: "kios_wonderlab", visual_description: "Kio and BIMO high-fiving in the WonderLab workshop." },
    { clip: 8, location: "kios_wonderlab", visual_description: "Kio smiles at camera inviting curious kids to ask questions in the comments." }
  ],
  voiceover: [
    { clip: 1, narration: "Pernah bayangin nggak kalau kita bisa jalan-jalan di cincin planet Saturnus?" },
    { clip: 2, narration: "BIMO, aktifkan simulasi gravitasi kosmik sekarang!" },
    { clip: 3, narration: "Lihat partikel es raksasa ini melayang mengelilingi orbit." },
    { clip: 4, narration: "Gravitasi menjaga mereka tetap stabil berputar jutaan tahun." },
    { clip: 5, narration: "Suhu di sini bisa mencapai minus ratusan derajat!" },
    { clip: 6, narration: "Semua data simulasi berhasil terekam sempurna." },
    { clip: 7, narration: "Sains itu seru dan penuh misteri menakjubkan." },
    { clip: 8, narration: "Tulis pertanyaan sains ajaib kamu di kolom komentar ya!" }
  ],
  t2i_prompts: [
    { clip: 1, prompt: "CHARACTER REFERENCE LOCK — MANDATORY Stylized 3D animated boy Kio with orange goggles in WonderLab." },
    { clip: 2, prompt: "CHARACTER REFERENCE LOCK — MANDATORY 3D animated boy Kio and hover-bot BIMO near cosmic portal." }
  ],
  i2v_prompts: [
    { clip: 1, prompt: "Animate only the supplied start frame. Preserve the exact character identity of Kio." },
    { clip: 2, prompt: "Animate only the supplied start frame. Preserve the exact character identity of Kio." }
  ]
};

const kioRowPayload = {
  main_character: 'kio',
  scene_count: 8,
  product_role: 'none'
};

const kioResult = validateCartoonContinuity(mockKioOutput, mockKioUniverse, kioRowPayload);
console.log('  Kio Validation Summary:', kioResult.summary);
console.log('  Kio Warnings:', kioResult.warnings);

assert.strictEqual(kioResult.checks.human_presence.passed, true, 'Human presence should pass for stylized 3D character universe');
assert.strictEqual(kioResult.checks.scene_count.passed, true, '8 scenes should pass for 8-scene configured campaign');
assert.strictEqual(kioResult.checks.character_consistency.passed, true, 'Character Kio should be detected');
console.log('  ✅ Test 2 Passed: Kio Wonders validated successfully without false human warnings.\n');

// --------------------------------------------------------------------------
// Test 3: Cartoon Continuity Validator for Animal Universe (PawVille)
// --------------------------------------------------------------------------
console.log('▶ Test 3: Testing validateCartoonContinuity for PawVille (Animal Only)...');

const mockPawvilleUniverse = {
  name: 'PawVille',
  slug: 'pawville',
  universe_type: 'animal',
  human_presence: 'none',
  default_scene_count: 7,
  manifest: {
    characters: {
      mochi: { name: 'Mochi', species: 'Cat' }
    },
    locations: [{ name: "PawVille Town Square", location_key: "town_square" }]
  }
};

const mockViolatingOutput = {
  storyboard: [
    { clip: 1, location: "PawVille Town Square", visual_description: "A human girl and a man walking through the park with cat Mochi." }
  ],
  voiceover: [
    { clip: 1, narration: "Mochi bertemu seorang manusia di jalan." }
  ],
  t2i_prompts: [],
  i2v_prompts: []
};

const pawvilleResult = validateCartoonContinuity(mockViolatingOutput, mockPawvilleUniverse, { main_character: 'mochi', scene_count: 7 });
console.log('  PawVille Violation Human Check Passed:', pawvilleResult.checks.human_presence.passed);
assert.strictEqual(pawvilleResult.checks.human_presence.passed, false, 'Human presence should be flagged as false for animal universe');
console.log('  ✅ Test 3 Passed: Animal-only universe correctly flags human intrusion.\n');

// --------------------------------------------------------------------------
// Test 4: Visual Identity Prompt Section for 3D Stylized Character
// --------------------------------------------------------------------------
console.log('▶ Test 4: Testing buildVisualIdentityPromptSection for 3D Character Identity...');

const viKioConfig = {
  label: 'Kio Wonders — 3D Sci-Fi Curiosity',
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
  },
  wardrobe: {
    custom_description: 'Orange utility vest with atom logo tee',
    sleeve_policy: 'forearms_exposed'
  },
  lighting: {
    custom_description: 'Three-point studio lighting with high-tech cyan/orange rim light'
  }
};

const viPrompt = buildVisualIdentityPromptSection(viKioConfig, 8);
console.log('  VI Prompt Excerpt (Character Concept):');
const charLine = viPrompt.split('\n').find(l => l.includes('Konsep Karakter'));
console.log('   ', charLine);

assert.ok(viPrompt.includes('FULL 3D STYLIZED ANIMATED CHARACTER'), 'VI Prompt should declare FULL 3D STYLIZED ANIMATED CHARACTER');
assert.ok(!viPrompt.includes('STRICTLY FACELESS'), 'VI Prompt should NOT contain STRICTLY FACELESS');
console.log('  ✅ Test 4 Passed: Visual Identity generates full 3D animated character directives.\n');

console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
