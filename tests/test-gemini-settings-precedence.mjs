import assert from 'node:assert';
import { resolveModelForTask, getModelWaterfallChain, getResolvedGeminiModels } from '../lib/gemini.js';
import { setSetting } from '../lib/db.js';

console.log('--- Starting Unit Tests: Gemini Settings Precedence (Zero Hardcoding) ---');

async function runTests() {
  // Test 1: User explicitly sets Primary Model to gemini-3.6-flash in Free Tier with Smart Routing ON
  console.log('Test 1: Primary Model gemini-3.6-flash in Free Tier with Smart Routing ON...');
  setSetting('gemini_api_tier', 'free');
  setSetting('gemini_smart_routing', 'on');
  setSetting('gemini_model_primary', 'gemini-3.6-flash');
  setSetting('gemini_model_fallback', 'gemini-3.7-flash');

  const modelForPillar = await resolveModelForTask('PILLAR_CAMPAIGN');
  console.log('Resolved model for PILLAR_CAMPAIGN:', modelForPillar);
  assert.strictEqual(modelForPillar, 'gemini-3.6-flash', 'Must use gemini-3.6-flash as configured in settings, NOT 3.8-flash');

  const waterfallChain = await getModelWaterfallChain();
  console.log('Dynamic Waterfall Chain:', waterfallChain);
  assert.strictEqual(waterfallChain[0], 'gemini-3.6-flash', 'Waterfall MUST start with primary model (3.6-flash)');
  assert.strictEqual(waterfallChain[1], 'gemini-3.7-flash', 'Waterfall step 2 MUST be fallback model (3.7-flash)');
  assert.ok(waterfallChain.includes('gemini-3.8-flash'), 'Waterfall must contain safety net models');

  console.log('✅ Test 1 passed.');

  // Test 2: User changes primary model to a custom model
  console.log('Test 2: Dynamic custom model from Settings...');
  setSetting('gemini_model_primary', 'gemini-3.7-flash-custom');
  setSetting('gemini_model_fallback', 'gemini-3.6-flash');

  const customForPlanner = await resolveModelForTask('CAMPAIGN_PLANNER');
  console.log('Resolved model for CAMPAIGN_PLANNER:', customForPlanner);
  assert.strictEqual(customForPlanner, 'gemini-3.7-flash-custom');

  const customWaterfall = await getModelWaterfallChain();
  console.log('Custom Waterfall Chain:', customWaterfall);
  assert.strictEqual(customWaterfall[0], 'gemini-3.7-flash-custom');
  assert.strictEqual(customWaterfall[1], 'gemini-3.6-flash');

  console.log('✅ Test 2 passed.');

  // Test 3: Micro task (Scraper) uses lightweight model from Smart Routing
  console.log('Test 3: Micro-task SCRAPER uses lightweight model...');
  setSetting('gemini_api_tier', 'paid');
  const scraperModel = await resolveModelForTask('SCRAPER');
  console.log('Resolved model for SCRAPER (paid):', scraperModel);
  assert.strictEqual(scraperModel, 'gemini-1.5-flash-8b');

  console.log('✅ Test 3 passed.');

  console.log('🎉 ALL Gemini Settings Precedence TESTS PASSED!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
