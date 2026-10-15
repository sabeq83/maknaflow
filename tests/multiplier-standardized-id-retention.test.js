import assert from 'assert';
import { generateCampaignId, generateVideoId } from '../lib/id-generator.js';
import { buildMultiplierPhase2Prompt } from '../lib/prompts.js';

console.log('🧪 Starting Multiplier Standardized ID & 4 Accordions Config Retention Test...\n');

// Test 1: Standardized Campaign ID Generation
console.log('Test 1: Standardized Campaign ID Generation (mul_YYMMDD_6hex)');
const mulCampaignId = generateCampaignId('mul');
assert(mulCampaignId.startsWith('mul_'), `Expected mul_ prefix, got: ${mulCampaignId}`);
const parts = mulCampaignId.split('_');
assert.strictEqual(parts.length, 3, `Expected 3 parts (mul_date_hash), got: ${parts.length}`);
assert.strictEqual(parts[0], 'mul');
assert.strictEqual(parts[1].length, 6, `Date part should be 6 chars (YYMMDD), got: ${parts[1]}`);
assert.strictEqual(parts[2].length, 6, `Hash part should be 6 chars hex, got: ${parts[2]}`);
console.log(`  ✓ Generated Campaign ID: ${mulCampaignId}`);

// Test 2: Standardized Task ID per Row (batchId_01..0N)
console.log('\nTest 2: Standardized Task ID for Batch Rows');
const batchId = mulCampaignId;
const rowCount = 5;
for (let i = 0; i < rowCount; i++) {
  const paddedIndex = String(i + 1).padStart(2, '0');
  const taskId = `${batchId}_${paddedIndex}`;
  assert.strictEqual(taskId, `${batchId}_0${i + 1}`);
  console.log(`  ✓ Row #${i + 1} Task ID: ${taskId}`);
}

// Test 3: Standardized Video ID in ContentFlow Lineage
console.log('\nTest 3: Standardized Video ID in ContentFlow (<account>_mul_<campaign_hash>_<sequence>)');
const accountName = 'nutribake';
const seq = 1;
const videoIdNew = generateVideoId({
  accountName,
  modulePrefix: 'mul',
  campaignId: mulCampaignId,
  sequence: seq
});
assert.strictEqual(videoIdNew, `nutribake_mul_${parts[2]}_01`, `Unexpected Video ID: ${videoIdNew}`);
console.log(`  ✓ New Campaign ContentFlow Video ID: ${videoIdNew}`);

// Test 3b: Legacy Batch ID Compatibility (mtb_df60f17a012440f9)
const legacyBatchId = 'mtb_df60f17a012440f9';
const legacyVideoId = generateVideoId({
  accountName: 'Nutribake',
  modulePrefix: 'mul',
  campaignId: legacyBatchId,
  sequence: 1
});
assert.strictEqual(legacyVideoId, 'nutribake_mul_2440f9_01', `Expected nutribake_mul_2440f9_01, got: ${legacyVideoId}`);
console.log(`  ✓ Legacy Batch ContentFlow Video ID: ${legacyVideoId}`);

// Test 4: Gemini AI Prompt Generator Fallback to Audio Config Object
console.log('\nTest 4: Gemini AI Prompt Generator Fallback to Audio Config Object');
const originalStoryboard = [{ narration_transcript: 'Klip 1', visual_prompt: 'Scene 1' }];
const productDNA = { product_name: 'Nutribake Brownies', unique_selling_point: 'Tanpa gula & tepung', product_description: 'Camilan sehat' };
const aesthetics = { narrativeMode: 'Storytelling' }; // does NOT contain targetDemographic, mandatoryOutroLine, etc.
const bridging = { targetClipsCount: 4, bridgeAtClip: 2, bridgeDurationClips: 1 };
const vso = { isVsoActive: false };
const audio = {
  targetDemographic: 'genz_casual',
  aiDirective: 'Pastikan nada bicara santai dan akrab tanpa berlebihan',
  mandatoryOutroLine: 'Nutribake, pilihan sehat keluarga Anda.',
  customInstruction: 'Sorot tekstur brownies yang lembut di klip penutup'
};

const generatedPrompt = buildMultiplierPhase2Prompt(originalStoryboard, productDNA, aesthetics, bridging, vso, audio);

assert(generatedPrompt.includes('Gen-Z'), 'Prompt must contain demographic instruction from audio config');
assert(generatedPrompt.includes('Pastikan nada bicara santai dan akrab tanpa berlebihan'), 'Prompt must contain AI directive from audio config');
assert(generatedPrompt.includes('Nutribake, pilihan sehat keluarga Anda.'), 'Prompt must contain mandatory outro line from audio config');
assert(generatedPrompt.includes('Sorot tekstur brownies yang lembut di klip penutup'), 'Prompt must contain custom instruction from audio config');
console.log('  ✓ Gemini prompt successfully injected targetDemographic, aiDirective, mandatoryOutroLine, and customInstruction from audio config');

console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
