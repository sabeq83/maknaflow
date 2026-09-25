import { pgQuery } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';

export const USD_TO_IDR_RATE = 16000;

/**
 * Official Google AI Studio / Gemini API Paid Tier Rates (per 1,000,000 Tokens)
 */
export const GEMINI_MODEL_RATES = {
  'gemini-3.6-flash': { inputRate: 0.25, outputRate: 0.75, role: 'Workhorse Utama', displayName: 'Gemini 3.6 Flash' },
  'gemini-3.8-flash': { inputRate: 0.30, outputRate: 0.90, role: 'Turbo & Cascade Fallback', displayName: 'Gemini 3.8 Flash' },
  'gemini-3.7-flash': { inputRate: 0.25, outputRate: 0.75, role: 'YouTube Studio & Sonic Scripting', displayName: 'Gemini 3.7 Flash' },
  'gemini-1.5-flash-8b': { inputRate: 0.075, outputRate: 0.30, role: 'Scraper & OCR Extraction', displayName: 'Gemini 1.5 Flash-8B' },
  'gemini-3.1-flash-lite': { inputRate: 0.10, outputRate: 0.40, role: 'Lightweight Tasks', displayName: 'Gemini 3.1 Flash-Lite' },
  'gemini-2.5-flash': { inputRate: 0.20, outputRate: 0.60, role: 'Deconstruct & Compliance', displayName: 'Gemini 2.5 Flash' },
  'gemini-1.5-flash': { inputRate: 0.075, outputRate: 0.30, role: 'Legacy Flash', displayName: 'Gemini 1.5 Flash' },
  'gemini-3.1-pro': { inputRate: 1.75, outputRate: 7.00, role: 'Deep Reasoning', displayName: 'Gemini 3.1 Pro' },
  'gemini-1.5-pro': { inputRate: 1.25, outputRate: 5.00, role: 'Legacy Pro', displayName: 'Gemini 1.5 Pro' },
  'default': { inputRate: 0.25, outputRate: 0.75, role: 'Standard Flash', displayName: 'Gemini Standard Flash' }
};

/**
 * Calculate estimated token cost in USD and IDR
 */
export function calculateTokenCost(modelName, promptTokens = 0, candidatesTokens = 0, cachedTokens = 0) {
  const normModel = (modelName || '').toLowerCase().trim();
  const rates = GEMINI_MODEL_RATES[normModel] || GEMINI_MODEL_RATES['default'];

  // Net dynamic prompt tokens (subtract cached tokens from full prompt rate if present)
  const dynamicPromptTokens = Math.max(0, promptTokens - cachedTokens);
  
  // Cached prompt tokens typically receive a 75% discount (25% of input rate)
  const promptCost = (dynamicPromptTokens / 1_000_000) * rates.inputRate;
  const cachedCost = (cachedTokens / 1_000_000) * (rates.inputRate * 0.25);
  const candidatesCost = (candidatesTokens / 1_000_000) * rates.outputRate;

  const costUsd = Number((promptCost + cachedCost + candidatesCost).toFixed(6));
  const costIdr = Number((costUsd * USD_TO_IDR_RATE).toFixed(2));

  return {
    costUsd,
    costIdr,
    inputRate: rates.inputRate,
    outputRate: rates.outputRate
  };
}

/**
 * Asynchronously record Gemini token usage in database ledger (Non-blocking)
 */
export async function recordAiTokenUsage({
  tenantId = null,
  feature = 'general_ai',
  model = 'gemini-3.6-flash',
  usageMetadata = null,
  meta = {}
} = {}) {
  try {
    if (!usageMetadata) return null;

    const resolvedTenant = tenantId || getActiveTenantId() || 'default_tenant';
    const promptTokens = Number.parseInt(usageMetadata.promptTokenCount || 0, 10) || 0;
    const candidatesTokens = Number.parseInt(usageMetadata.candidatesTokenCount || 0, 10) || 0;
    const cachedTokens = Number.parseInt(usageMetadata.cachedContentTokenCount || 0, 10) || 0;
    const totalTokens = Number.parseInt(usageMetadata.totalTokenCount || (promptTokens + candidatesTokens), 10) || 0;

    if (totalTokens <= 0) return null;

    const { costUsd, costIdr } = calculateTokenCost(model, promptTokens, candidatesTokens, cachedTokens);

    const query = `
      INSERT INTO ai_token_usage_ledger (
        tenant_id, feature_name, model_name,
        prompt_tokens, candidates_tokens, cached_tokens, total_tokens,
        estimated_cost_usd, estimated_cost_idr, meta_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      RETURNING id, created_at
    `;

    const res = await pgQuery(query, [
      resolvedTenant,
      feature,
      model,
      promptTokens,
      candidatesTokens,
      cachedTokens,
      totalTokens,
      costUsd,
      costIdr,
      JSON.stringify(meta || {})
    ]);

    return res.rows[0] || null;
  } catch (err) {
    // Zero impact on generator flow: log warning and continue
    console.warn('[AI Token Meter] Failed to record token usage:', err.message);
    return null;
  }
}

/**
 * Fetch Month-To-Date (MTD) Token Usage & Cost Analytics for a specific tenant and month
 */
export async function getMonthlyTokenUsageReport({
  tenantId = null,
  year = null,
  month = null
} = {}) {
  const now = new Date();
  const targetYear = year ? Number.parseInt(year, 10) : now.getFullYear();
  const targetMonth = month ? Number.parseInt(month, 10) : (now.getMonth() + 1);

  const startDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0));
  const endDate = new Date(Date.UTC(targetYear, targetMonth, 1, 0, 0, 0));

  const resolvedTenant = tenantId || getActiveTenantId() || 'default_tenant';
  const isSuperadminAll = resolvedTenant === '__all__';

  const tenantClause = isSuperadminAll ? '' : 'AND tenant_id = $3';
  const baseParams = [startDate.toISOString(), endDate.toISOString()];
  if (!isSuperadminAll) baseParams.push(resolvedTenant);

  // 1. Overall Aggregate MTD
  const summarySql = `
    SELECT
      COUNT(*)::INTEGER AS total_calls,
      COALESCE(SUM(prompt_tokens), 0)::BIGINT AS total_prompt_tokens,
      COALESCE(SUM(candidates_tokens), 0)::BIGINT AS total_candidates_tokens,
      COALESCE(SUM(cached_tokens), 0)::BIGINT AS total_cached_tokens,
      COALESCE(SUM(total_tokens), 0)::BIGINT AS total_tokens,
      COALESCE(SUM(estimated_cost_usd), 0)::NUMERIC(10, 4) AS total_cost_usd,
      COALESCE(SUM(estimated_cost_idr), 0)::NUMERIC(12, 2) AS total_cost_idr
    FROM ai_token_usage_ledger
    WHERE created_at >= $1 AND created_at < $2
    ${tenantClause}
  `;
  const summaryRes = await pgQuery(summarySql, baseParams);
  const summary = summaryRes.rows[0] || {
    total_calls: 0,
    total_prompt_tokens: 0,
    total_candidates_tokens: 0,
    total_cached_tokens: 0,
    total_tokens: 0,
    total_cost_usd: 0,
    total_cost_idr: 0
  };

  // 2. Feature Breakdown
  const featureSql = `
    SELECT
      feature_name,
      COUNT(*)::INTEGER AS call_count,
      SUM(prompt_tokens)::BIGINT AS prompt_tokens,
      SUM(candidates_tokens)::BIGINT AS candidates_tokens,
      SUM(cached_tokens)::BIGINT AS cached_tokens,
      SUM(total_tokens)::BIGINT AS total_tokens,
      SUM(estimated_cost_usd)::NUMERIC(10, 4) AS cost_usd,
      SUM(estimated_cost_idr)::NUMERIC(12, 2) AS cost_idr
    FROM ai_token_usage_ledger
    WHERE created_at >= $1 AND created_at < $2
    ${tenantClause}
    GROUP BY feature_name
    ORDER BY total_tokens DESC
  `;
  const featureRes = await pgQuery(featureSql, baseParams);

  // 3. Model Breakdown
  const modelSql = `
    SELECT
      model_name,
      COUNT(*)::INTEGER AS call_count,
      SUM(prompt_tokens)::BIGINT AS prompt_tokens,
      SUM(candidates_tokens)::BIGINT AS candidates_tokens,
      SUM(cached_tokens)::BIGINT AS cached_tokens,
      SUM(total_tokens)::BIGINT AS total_tokens,
      SUM(estimated_cost_usd)::NUMERIC(10, 4) AS cost_usd,
      SUM(estimated_cost_idr)::NUMERIC(12, 2) AS cost_idr
    FROM ai_token_usage_ledger
    WHERE created_at >= $1 AND created_at < $2
    ${tenantClause}
    GROUP BY model_name
    ORDER BY total_tokens DESC
  `;
  const modelRes = await pgQuery(modelSql, baseParams);

  // 4. Daily Trend
  const dailySql = `
    SELECT
      TO_CHAR(created_at, 'YYYY-MM-DD') AS day,
      COUNT(*)::INTEGER AS call_count,
      SUM(total_tokens)::BIGINT AS total_tokens,
      SUM(estimated_cost_usd)::NUMERIC(10, 4) AS cost_usd,
      SUM(estimated_cost_idr)::NUMERIC(12, 2) AS cost_idr
    FROM ai_token_usage_ledger
    WHERE created_at >= $1 AND created_at < $2
    ${tenantClause}
    GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
    ORDER BY day ASC
  `;
  const dailyRes = await pgQuery(dailySql, baseParams);

  const totalTokensNum = Number(summary.total_tokens) || 0;
  const totalCallsNum = Number(summary.total_calls) || 0;
  const avgTokensPerCall = totalCallsNum > 0 ? Math.round(totalTokensNum / totalCallsNum) : 0;

  return {
    period: {
      year: targetYear,
      month: targetMonth,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    },
    tenantId: resolvedTenant,
    summary: {
      totalCalls: totalCallsNum,
      totalPromptTokens: Number(summary.total_prompt_tokens) || 0,
      totalCandidatesTokens: Number(summary.total_candidates_tokens) || 0,
      totalCachedTokens: Number(summary.total_cached_tokens) || 0,
      totalTokens: totalTokensNum,
      totalCostUsd: Number(summary.total_cost_usd) || 0,
      totalCostIdr: Number(summary.total_cost_idr) || 0,
      avgTokensPerCall
    },
    featureBreakdown: featureRes.rows.map(row => ({
      featureName: row.feature_name,
      callCount: Number(row.call_count),
      promptTokens: Number(row.prompt_tokens),
      candidatesTokens: Number(row.candidates_tokens),
      cachedTokens: Number(row.cached_tokens),
      totalTokens: Number(row.total_tokens),
      sharePercentage: totalTokensNum > 0 ? Number(((Number(row.total_tokens) / totalTokensNum) * 100).toFixed(1)) : 0,
      costUsd: Number(row.cost_usd),
      costIdr: Number(row.cost_idr)
    })),
    modelBreakdown: modelRes.rows.map(row => {
      const rateInfo = GEMINI_MODEL_RATES[(row.model_name || '').toLowerCase()] || GEMINI_MODEL_RATES['default'];
      return {
        modelName: row.model_name,
        displayName: rateInfo.displayName,
        role: rateInfo.role,
        inputRate: rateInfo.inputRate,
        outputRate: rateInfo.outputRate,
        callCount: Number(row.call_count),
        promptTokens: Number(row.prompt_tokens),
        candidatesTokens: Number(row.candidates_tokens),
        cachedTokens: Number(row.cached_tokens),
        totalTokens: Number(row.total_tokens),
        costUsd: Number(row.cost_usd),
        costIdr: Number(row.cost_idr)
      };
    }),
    dailyTrend: dailyRes.rows.map(row => ({
      day: row.day,
      callCount: Number(row.call_count),
      totalTokens: Number(row.total_tokens),
      costUsd: Number(row.cost_usd),
      costIdr: Number(row.cost_idr)
    }))
  };
}

/**
 * Get recent AI transaction activity logs for live feed
 */
export async function getRecentAiTransactions({
  tenantId = null,
  limit = 15
} = {}) {
  const resolvedTenant = tenantId || getActiveTenantId() || 'default_tenant';
  const isSuperadminAll = resolvedTenant === '__all__';

  const tenantClause = isSuperadminAll ? '' : 'WHERE tenant_id = $1';
  const params = isSuperadminAll ? [limit] : [resolvedTenant, limit];
  const limitIdx = isSuperadminAll ? '$1' : '$2';

  const sql = `
    SELECT
      id, tenant_id, feature_name, model_name,
      prompt_tokens, candidates_tokens, cached_tokens, total_tokens,
      estimated_cost_usd, estimated_cost_idr, created_at
    FROM ai_token_usage_ledger
    ${tenantClause}
    ORDER BY created_at DESC
    LIMIT ${limitIdx}
  `;

  const res = await pgQuery(sql, params);
  return res.rows.map(r => ({
    id: r.id,
    tenantId: r.tenant_id,
    featureName: r.feature_name,
    modelName: r.model_name,
    promptTokens: Number(r.prompt_tokens),
    candidatesTokens: Number(r.candidates_tokens),
    cachedTokens: Number(r.cached_tokens),
    totalTokens: Number(r.total_tokens),
    costUsd: Number(r.estimated_cost_usd),
    costIdr: Number(r.estimated_cost_idr),
    createdAt: r.created_at
  }));
}
