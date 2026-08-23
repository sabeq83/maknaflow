import { pgQuery } from './db-pg.js';
import { getAuthorizedAffiliateBrand } from './affiliate-studio-brand-read-adapter.js';

export async function getSmartRouteRecommendation(user, brandId, programId, plannerId, rowId) {
  if (!user || user.tenantId === '__none__') return null;

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return null;

  const tenantId = user.tenantId;

  // 1. Fetch row linkage and associated product snapshot
  const linkRows = (await pgQuery(
    `SELECT aprl.*, app.product_snapshot, cpr.pillar, cpr.category_cep, cpr.context
     FROM affiliate_planner_row_links aprl
     JOIN content_planner_rows cpr ON cpr.id = aprl.planner_row_id
     LEFT JOIN affiliate_program_products app ON app.id = aprl.program_product_id AND app.tenant_id = aprl.tenant_id
     WHERE aprl.tenant_id = $1 AND aprl.affiliate_program_id = $2 
       AND aprl.content_planner_id = $3 AND aprl.planner_row_id = $4`,
    [tenantId, programId, plannerId, rowId]
  )).rows;

  if (linkRows.length === 0) {
    return {
      recommendedEngine: 're',
      reasoning: 'Planner row is not linked. Defaulting to RE Campaign as it is the most flexible template engine.',
      confidence: 0.5
    };
  }

  const link = linkRows[0];
  const funnelStage = link.funnel_stage || 'TOFU';
  const category = (link.category_cep || '').toLowerCase();
  const pillar = (link.pillar || '').toLowerCase();
  const snapshot = link.product_snapshot || {};
  const productTitle = (snapshot.name || '').toLowerCase();

  // 2. Recommendation Logic
  let recommendedEngine = 're';
  let reasoning = 'RE Campaign is selected as the default versatile video engine for general affiliate content.';
  let confidence = 0.6;

  if (funnelStage === 'BOFU' && (category.includes('recipe') || category.includes('food') || productTitle.includes('bumbu') || productTitle.includes('cook'))) {
    recommendedEngine = 'recipe';
    reasoning = 'Recipe Labs is highly recommended for BOFU (conversion stage) with food/cooking categories, leveraging structured recipe/steps visualization to drive purchase intent.';
    confidence = 0.95;
  } else if (funnelStage === 'MOFU' && (pillar.includes('edu') || pillar.includes('tutorial') || pillar.includes('tips'))) {
    recommendedEngine = 'pillar';
    reasoning = 'Pillar Campaign is optimal for MOFU stage to deliver highly structured educational content or step-by-step guides using custom TTS narration.';
    confidence = 0.85;
  } else if (category.includes('multiplier') || category.includes('viral')) {
    recommendedEngine = 'multiplier';
    reasoning = 'Multiplier Lab is selected to dynamically upscale and test multiple viral variants of high-intent products.';
    confidence = 0.8;
  } else if (snapshot.affiliate?.mode === 'bridge' || category.includes('bridge')) {
    recommendedEngine = 'bridge';
    reasoning = 'Product Bridging is required to inject landing page redirects and safely route users through intermediate links.';
    confidence = 0.9;
  } else if (funnelStage === 'BOFU' && category.includes('instant')) {
    recommendedEngine = 'instant';
    reasoning = 'Instant Factory is selected for fast-turnaround BOFU product promotions using quick template bindings.';
    confidence = 0.85;
  }

  // Log recommendation event for audit trail
  const eventId = `ev_rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  await pgQuery(
    `INSERT INTO affiliate_program_events (id, tenant_id, affiliate_program_id, event_type, actor_id, payload)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [eventId, tenantId, programId, 'route_recommended', user.id, JSON.stringify({ rowId, recommendedEngine, funnelStage, category })]
  );

  return { recommendedEngine, reasoning, confidence };
}
