import { getUniverseManifest, normalizeCharacterId } from '../lib/universe-manifests.js';
import { resolveClipReferenceImages } from '../lib/cartoon-reference-resolver.js';
import { validateCartoonContinuity } from '../lib/cartoon-continuity-validator.js';
import fs from 'fs';
import path from 'path';

console.log('========================================================================');
console.log('🧪 RUNNING CARTOON CHARACTER REFERENCE LOCK AUTOMATED TESTS');
console.log('========================================================================\n');

let failedTests = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failedTests++;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

// Test Case 1: Manifest Retrieval & Key Normalization
console.log('--- Test Case 1: Manifest & Normalization ---');
const manifest = getUniverseManifest('pawville');
assert(manifest !== null, 'Should load PawVille universe manifest');
assert(manifest.characters.mochi !== undefined, 'Mochi should be registered in PawVille characters');
assert(normalizeCharacterId('Dr. Paw') === 'dr_paw', 'Should normalize "Dr. Paw" to "dr_paw"');
assert(normalizeCharacterId('coco') === 'coco', 'Should normalize "coco" to "coco"');
assert(normalizeCharacterId('InvalidChar') === null, 'Should return null for invalid character ID');

// Test Case 2: Reference Image Resolution
console.log('\n--- Test Case 2: Reference Image Resolution ---');

// Mock a simple base64 product image path or local dummy asset
const dummyProductImagePath = 'public/uploads/dummy_product.png';
if (!fs.existsSync('public/uploads')) {
  fs.mkdirSync('public/uploads', { recursive: true });
}
fs.writeFileSync(dummyProductImagePath, 'dummy png content');

const mockCampaignSnapshot = {
  manifest: {
    characters: {
      mochi: { identity_reference_path: 'public/universe-assets/pawville/characters/mochi/v1/identity.png' },
      dr_paw: { identity_reference_path: 'public/universe-assets/pawville/characters/dr-paw/v1/identity.png' }
    },
    style_reference_path: 'public/universe-assets/pawville/style/v1/style_reference.png'
  }
};

// Write mock files if they don't exist with unique content to prevent Set deduplication
const pathsToCreate = [
  'public/universe-assets/pawville/characters/mochi/v1/identity.png',
  'public/universe-assets/pawville/characters/dr-paw/v1/identity.png',
  'public/universe-assets/pawville/style/v1/style_reference.png'
];
const mockContents = [
  'dummy reference image mochi unique data',
  'dummy reference image dr_paw unique data',
  'dummy reference image style unique data'
];
pathsToCreate.forEach((p, idx) => {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, mockContents[idx]);
});

// Clip 3: has mochi and dr_paw, no product (before reveal beat)
const resolvedClip3 = resolveClipReferenceImages({
  contentWorld: 'cartoon_universe',
  universeProfile: 'pawville',
  universeSnapshot: mockCampaignSnapshot,
  clip: 3,
  productReference: dummyProductImagePath,
  productRevealBeat: 'beat_4',
  clipCharacters: ['mochi', 'dr_paw']
});

assert(resolvedClip3.characterReferences.length === 2, 'Should resolve exactly 2 character references for clip 3');
assert(resolvedClip3.productReferences.length === 0, 'Product reference should be empty before reveal beat');
assert(resolvedClip3.styleReferences.length === 1, 'Style reference should be resolved');
assert(resolvedClip3.allReferences.length === 3, 'Total references resolved should be 3 (2 characters + 1 style)');

// Clip 4: has mochi, has product (reveal beat >= 4)
const resolvedClip4 = resolveClipReferenceImages({
  contentWorld: 'cartoon_universe',
  universeProfile: 'pawville',
  universeSnapshot: mockCampaignSnapshot,
  clip: 4,
  productReference: dummyProductImagePath,
  productRevealBeat: 'beat_4',
  clipCharacters: ['mochi']
});

assert(resolvedClip4.characterReferences.length === 1, 'Should resolve 1 character reference for clip 4');
assert(resolvedClip4.productReferences.length === 1, 'Product reference should be resolved at reveal beat 4');
assert(resolvedClip4.allReferences.length === 3, 'Total references resolved should be 3 (1 character + 1 product + 1 style)');

// Test Case 3: Cartoon Continuity Validator
console.log('\n--- Test Case 3: Continuity Validator Checks ---');

// Mock a valid cartoon JSON output
const validCartoonOutput = {
  storyboard: [
    { scene: 1, characters: ['mochi'], location: 'mochi_home', product_visible: false },
    { scene: 2, characters: ['mochi', 'dr_paw'], location: 'dr_paw_clinic', product_visible: false },
    { scene: 3, characters: ['mochi', 'dr_paw'], location: 'dr_paw_clinic', product_visible: false },
    { scene: 4, characters: ['mochi', 'dr_paw'], location: 'dr_paw_clinic', product_visible: true },
    { scene: 5, characters: ['mochi'], location: 'mochi_home', product_visible: true },
    { scene: 6, characters: ['mochi'], location: 'mochi_home', product_visible: false },
    { scene: 7, characters: ['mochi'], location: 'mochi_home', product_visible: false }
  ],
  voiceover: [
    { scene: 1, narration: 'Mochi suka bermain.' },
    { scene: 2, narration: 'Mochi lelah bermain.' },
    { scene: 3, narration: 'Dr Paw datang berkunjung.' },
    { scene: 4, narration: 'Gunakan produk ini membantu menjaga bulu Mochi.' },
    { scene: 5, narration: 'Hasilnya tampak sangat bagus.' },
    { scene: 6, narration: 'Mochi senang sekali.' },
    { scene: 7, narration: 'Ayo berikan yang terbaik untuk kucing kesayangan.' }
  ],
  t2i_prompts: [
    { clip: 1, prompt: 'CHARACTER REFERENCE LOCK — MANDATORY mochi playing around' },
    { clip: 2, prompt: 'CHARACTER REFERENCE LOCK — MANDATORY mochi and dr paw talking' },
    { clip: 3, prompt: 'CHARACTER REFERENCE LOCK — MANDATORY mochi and dr paw looking at bag' },
    { clip: 4, prompt: 'CHARACTER REFERENCE LOCK — MANDATORY PRODUCT REFERENCE LOCK — MANDATORY product displayed' },
    { clip: 5, prompt: 'CHARACTER REFERENCE LOCK — MANDATORY PRODUCT REFERENCE LOCK — MANDATORY product texture close-up' },
    { clip: 6, prompt: 'CHARACTER REFERENCE LOCK — MANDATORY mochi smiling' },
    { clip: 7, prompt: 'CHARACTER REFERENCE LOCK — MANDATORY mochi resting' }
  ],
  i2v_prompts: [
    { clip: 1, prompt: 'Animate only the supplied start frame. Mochi jumps.' },
    { clip: 2, prompt: 'Animate only the supplied start frame. Mochi nods.' },
    { clip: 3, prompt: 'Animate only the supplied start frame. Dr Paw walks.' },
    { clip: 4, prompt: 'Animate only the supplied start frame. Showing product action.' },
    { clip: 5, prompt: 'Animate only the supplied start frame. Close-up zoom.' },
    { clip: 6, prompt: 'Animate only the supplied start frame. Mochi wags tail.' },
    { clip: 7, prompt: 'Animate only the supplied start frame. Soft camera pan.' }
  ]
};

const validResult = validateCartoonContinuity(validCartoonOutput, mockCampaignSnapshot, {
  main_character: 'Mochi',
  supporting_characters: 'Dr. Paw',
  product_role: 'supporting_solution',
  product_reveal_beat: 'beat_4'
});

assert(validResult.valid === true, 'Valid cartoon storyboard structure should pass validation without warnings');
if (!validResult.valid) {
  console.log('Warnings returned:', validResult.warnings);
}

// Mock an invalid cartoon JSON output (missing locks, using pure T2V, invalid character)
const invalidCartoonOutput = {
  storyboard: [
    { scene: 1, characters: ['invalid_character_name'], location: 'mochi_home', product_visible: false },
    { scene: 2, characters: ['mochi'], location: 'mochi_home', product_visible: false },
    { scene: 3, characters: ['mochi'], location: 'mochi_home', product_visible: false },
    { scene: 4, characters: ['mochi'], location: 'mochi_home', product_visible: false },
    { scene: 5, characters: ['mochi'], location: 'mochi_home', product_visible: false },
    { scene: 6, characters: ['mochi'], location: 'mochi_home', product_visible: false },
    { scene: 7, characters: ['mochi'], location: 'mochi_home', product_visible: false }
  ],
  voiceover: [
    { scene: 1, narration: 'Mochi sedang sakit dan obat ini menyembuhkan penyakit Mochi.' },
    { scene: 2, narration: 'Membeli produk di keranjang kuning.' },
    { scene: 3, narration: 'Narasi standard.' },
    { scene: 4, narration: 'Narasi standard.' },
    { scene: 5, narration: 'Narasi standard.' },
    { scene: 6, narration: 'Narasi standard.' },
    { scene: 7, narration: 'Narasi CTA penutup.' }
  ],
  t2i_prompts: [
    { clip: 1, prompt: 'mochi playing without lock' },
    { clip: 3, prompt: 'mochi running' },
    { clip: 4, prompt: 'mochi sleeping' },
    { clip: 5, prompt: 'mochi resting' },
    { clip: 6, prompt: 'mochi eating' },
    { clip: 7, prompt: 'mochi styling' }
  ],
  t2v_prompts: [
    { clip: 2, prompt: 'mochi pure t2v prompt' }
  ],
  i2v_prompts: [
    { clip: 1, prompt: 'Zoom in fast' },
    { clip: 3, prompt: 'Animate only the supplied start frame. Mochi wags tail.' },
    { clip: 4, prompt: 'Animate only the supplied start frame. Mochi wags tail.' },
    { clip: 5, prompt: 'Animate only the supplied start frame. Mochi wags tail.' },
    { clip: 6, prompt: 'Animate only the supplied start frame. Mochi wags tail.' },
    { clip: 7, prompt: 'Animate only the supplied start frame. Mochi wags tail.' }
  ]
};

const invalidResult = validateCartoonContinuity(invalidCartoonOutput, mockCampaignSnapshot, {
  main_character: 'Mochi',
  product_role: 'supporting_solution',
  product_reveal_beat: 'beat_4'
});

assert(invalidResult.valid === false, 'Invalid storyboard should trigger warnings');
assert(invalidResult.warnings.some(w => w.includes('tidak terdaftar di manifest')), 'Should warn about invalid character name');
assert(invalidResult.warnings.some(w => w.includes('CHARACTER REFERENCE LOCK — MANDATORY')), 'Should warn about missing T2I prompt lock');
assert(invalidResult.warnings.some(w => w.includes('DILARANG menggunakan pure T2V')), 'Should warn about using pure T2V on character clip');
assert(invalidResult.warnings.some(w => w.includes('preservasi start frame/no-morphing')), 'Should warn about missing I2V preservation directive');
assert(invalidResult.warnings.some(w => w.includes('menyembuhkan')), 'Should flag medical claim words');
assert(invalidResult.warnings.some(w => w.includes('CTA terdeteksi di Beat 2')), 'Should warn about early CTA placement');

// Clean up dummy assets
try {
  fs.unlinkSync(dummyProductImagePath);
  for (const p of pathsToCreate) {
    fs.unlinkSync(p);
  }
} catch (_) {}

console.log('\n========================================================================');
if (failedTests > 0) {
  console.error(`❌ TESTING FAILED: ${failedTests} assertions failed.`);
  process.exit(1);
} else {
  console.log('✅ ALL TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}
