import assert from 'node:assert';
import { getResolvedGeminiModels, GEMINI_MODELS } from '../lib/gemini.js';
import { allocateClipsToNarrativeModes } from '../lib/visual-identity-allocator.js';

console.log('--- Starting Unit Tests: Gemini Model Dynamic Resolution & Allocation ---');

// Test 1: Gemini Dynamic Resolution
async function testGeminiDynamicResolution() {
  console.log('Testing Gemini Model Dynamic Resolution...');

  const paidResult = await getResolvedGeminiModels({
    taskType: 'PILLAR_CAMPAIGN',
    explicitTier: 'paid'
  });
  console.log('Paid tier result:', paidResult);
  assert.strictEqual(paidResult.resolvedPrimary, 'gemini-3.6-flash');

  const freeResult = await getResolvedGeminiModels({
    taskType: 'PILLAR_CAMPAIGN',
    explicitTier: 'free'
  });
  console.log('Free tier result:', freeResult);
  assert.strictEqual(freeResult.resolvedPrimary, 'gemini-3.8-flash');

  const scraperResult = await getResolvedGeminiModels({
    taskType: 'SCRAPER',
    explicitTier: 'paid'
  });
  console.log('Scraper paid result:', scraperResult);
  assert.strictEqual(scraperResult.resolvedPrimary, 'gemini-1.5-flash-8b');

  console.log('✅ Gemini Dynamic Resolution tests passed.');
}

// Test 2: Visual Identity Allocator for 15 clips
function testVisualIdentityAllocator() {
  console.log('Testing Visual Identity Allocator for 15 clips...');
  const allocations = allocateClipsToNarrativeModes(15);
  assert.strictEqual(allocations.length, 15);
  assert.strictEqual(allocations[0].narrativeFunction, 'hook');
  assert.strictEqual(allocations[14].narrativeFunction, 'conclusion');

  const distinctFunctions = new Set(allocations.map(a => a.narrativeFunction));
  assert.ok(distinctFunctions.has('hook'));
  assert.ok(distinctFunctions.has('context'));
  assert.ok(distinctFunctions.has('mechanism'));
  assert.ok(distinctFunctions.has('consequence'));
  assert.ok(distinctFunctions.has('evidence_reveal'));
  assert.ok(distinctFunctions.has('conclusion'));

  console.log('✅ Visual Identity Allocator 15 clips tests passed.');
}

// Run all tests
async function run() {
  await testGeminiDynamicResolution();
  testVisualIdentityAllocator();
  console.log('🎉 ALL UNIT TESTS PASSED!');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
