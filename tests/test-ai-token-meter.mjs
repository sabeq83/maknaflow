import assert from 'node:assert/strict';
import {
  calculateTokenCost,
  recordAiTokenUsage,
  getMonthlyTokenUsageReport,
  getRecentAiTransactions,
  GEMINI_MODEL_RATES,
  USD_TO_IDR_RATE
} from '../lib/ai-token-meter.js';

console.log('🧪 [Test] Running AI Token Meter & Pricing Engine Tests...');

// 1. Check Pricing Constants
assert.equal(USD_TO_IDR_RATE, 16000, 'USD_TO_IDR_RATE must be 16000');
assert.equal(GEMINI_MODEL_RATES['gemini-3.6-flash'].inputRate, 0.25);
assert.equal(GEMINI_MODEL_RATES['gemini-3.6-flash'].outputRate, 0.75);
assert.equal(GEMINI_MODEL_RATES['gemini-3.8-flash'].inputRate, 0.30);
assert.equal(GEMINI_MODEL_RATES['gemini-3.8-flash'].outputRate, 0.90);
assert.equal(GEMINI_MODEL_RATES['gemini-1.5-flash-8b'].inputRate, 0.075);
console.log('✅ Rates and catalog constants verified');

// 2. Cost Calculation Test (Standard)
// gemini-3.6-flash: 1,000,000 prompt ($0.25) + 1,000,000 output ($0.75) = $1.00 -> Rp 16,000
const cost1 = calculateTokenCost('gemini-3.6-flash', 1_000_000, 1_000_000, 0);
assert.equal(cost1.costUsd, 1.000000);
assert.equal(cost1.costIdr, 16000);

// Typical single-pass recipe campaign: 4,000 prompt, 2,000 output
// prompt: (4000/1M)*0.25 = $0.001
// output: (2000/1M)*0.75 = $0.0015
// total = $0.0025 -> ~Rp 40
const costRecipe = calculateTokenCost('gemini-3.6-flash', 4000, 2000, 0);
assert.equal(costRecipe.costUsd, 0.0025);
assert.equal(costRecipe.costIdr, 40);
console.log('✅ Cost calculation formulas accurate');

// 3. Cost Calculation Test with Context Caching (75% discount on cached input)
// 10,000 prompt (of which 8,000 is cached, 2,000 dynamic) + 1,000 output
// dynamic prompt: 2000/1M * 0.25 = 0.0005
// cached prompt: 8000/1M * (0.25 * 0.25) = 0.0005
// output: 1000/1M * 0.75 = 0.00075
// total = 0.00175
const costCached = calculateTokenCost('gemini-3.6-flash', 10000, 1000, 8000);
assert.equal(costCached.costUsd, 0.00175);
console.log('✅ Context caching discount calculation verified');

// 4. Record & Ledger Query Integration Test
const testTenantId = `test_tenant_${Date.now()}`;
const record1 = await recordAiTokenUsage({
  tenantId: testTenantId,
  feature: 'recipe_campaign',
  model: 'gemini-3.6-flash',
  usageMetadata: {
    promptTokenCount: 5000,
    candidatesTokenCount: 3000,
    cachedContentTokenCount: 1000,
    totalTokenCount: 8000
  }
});
assert(record1 && record1.id, 'Record must be inserted and return id');

const record2 = await recordAiTokenUsage({
  tenantId: testTenantId,
  feature: 'strategic_campaign',
  model: 'gemini-3.8-flash',
  usageMetadata: {
    promptTokenCount: 6000,
    candidatesTokenCount: 4000,
    cachedContentTokenCount: 0,
    totalTokenCount: 10000
  }
});
assert(record2 && record2.id, 'Record 2 must be inserted');

// 5. Test Monthly Report Aggregation
const now = new Date();
const report = await getMonthlyTokenUsageReport({
  tenantId: testTenantId,
  year: now.getFullYear(),
  month: now.getMonth() + 1
});

assert.equal(report.summary.totalCalls, 2, 'Total calls must equal 2');
assert.equal(report.summary.totalTokens, 18000, 'Total tokens must equal 18,000 (8k + 10k)');
assert.equal(report.summary.totalPromptTokens, 11000);
assert.equal(report.summary.totalCandidatesTokens, 7000);
assert.equal(report.summary.totalCachedTokens, 1000);
assert(report.summary.totalCostUsd > 0, 'Cost USD must be greater than 0');
assert(report.summary.totalCostIdr > 0, 'Cost IDR must be greater than 0');

assert.equal(report.featureBreakdown.length, 2, 'Should have 2 features in breakdown');
assert.equal(report.modelBreakdown.length, 2, 'Should have 2 models in breakdown');

// 6. Test Recent Transactions Query
const recentLogs = await getRecentAiTransactions({
  tenantId: testTenantId,
  limit: 5
});
assert.equal(recentLogs.length, 2, 'Should return 2 recent transactions');
assert.equal(recentLogs[0].featureName, 'strategic_campaign');

console.log('🎉 ALL AI TOKEN METER TESTS PASSED!');
process.exit(0);
