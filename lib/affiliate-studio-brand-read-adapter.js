import 'server-only';
import { pgQuery } from './db-pg.js';
import { buildAffiliateLegacyLinks } from './affiliate-studio-workspace-state.js';

export async function listAuthorizedAffiliateBrands(user) {
  if (!user || user.tenantId === '__none__') {
    return [];
  }
  
  if (user.role === 'admin') {
    const res = await pgQuery(
      `SELECT id, brand_name AS name, tone_of_voice, visual_signature, editorial_brand_context, editorial_content_goal, editorial_content_pillars_json
       FROM brand_profiles
       WHERE tenant_id = $1
       ORDER BY brand_name ASC`,
      [user.tenantId]
    );
    return res.rows.map(row => ({
      ...row,
      editorial_content_pillars_json: row.editorial_content_pillars_json ? (typeof row.editorial_content_pillars_json === 'string' ? JSON.parse(row.editorial_content_pillars_json) : row.editorial_content_pillars_json) : []
    }));
  } else if (user.role === 'user') {
    const assignedIds = user.assignedBrandIds || [];
    if (assignedIds.length === 0) {
      return [];
    }
    const res = await pgQuery(
      `SELECT id, brand_name AS name, tone_of_voice, visual_signature, editorial_brand_context, editorial_content_goal, editorial_content_pillars_json
       FROM brand_profiles
       WHERE tenant_id = $1 AND id = ANY($2::text[])
       ORDER BY brand_name ASC`,
      [user.tenantId, assignedIds]
    );
    return res.rows.map(row => ({
      ...row,
      editorial_content_pillars_json: row.editorial_content_pillars_json ? (typeof row.editorial_content_pillars_json === 'string' ? JSON.parse(row.editorial_content_pillars_json) : row.editorial_content_pillars_json) : []
    }));
  }
  
  return [];
}

export async function getAuthorizedAffiliateBrand(user, brandId) {
  const brands = await listAuthorizedAffiliateBrands(user);
  const found = brands.find(b => b.id === brandId);
  if (!found) return null;
  return found;
}

export async function getAffiliateBrandOverview({ user, brandId }) {
  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return null;
  
  const tenantId = user.tenantId;
  const brandName = brand.name;

  const sources = [];
  let partial = false;
  const warnings = [];

  const runProjection = async (key, source, fn) => {
    try {
      const result = await fn();
      sources.push({ key, source, scope: 'tenant+brand_profile_id', status: 'ok' });
      return result;
    } catch (err) {
      console.error(`[Affiliate Studio Overview] Failed to project ${key}:`, err);
      partial = true;
      sources.push({ key, source, scope: 'tenant+brand_profile_id', status: 'unavailable' });
      warnings.push({ code: `PROJECTION_${key.toUpperCase()}_FAILED`, message: err.message });
      return null;
    }
  };

  const products = await runProjection('products', 'brand_products', () => projectProductSummary({ tenantId, brandId }));
  const planners = await runProjection('planners', 'content_planners', () => projectPlannerSummary({ tenantId, brandId, brandName }));
  const campaigns = await runProjection('campaigns', 're_campaigns/pillar_campaigns/recipe_campaigns', () => projectCampaignSummary({ tenantId, brandId }));
  const contentFlow = await runProjection('contentFlow', 'content_flow_items', () => projectContentFlowSummary({ tenantId, brandId, brandName }));

  return {
    brand: {
      id: brand.id,
      name: brand.name,
      toneOfVoice: brand.tone_of_voice || '',
      visualSignature: brand.visual_signature || '',
      contentGoal: brand.editorial_content_goal || '',
      contentPillars: brand.editorial_content_pillars_json || []
    },
    summaries: {
      products,
      planners,
      campaigns,
      contentFlow
    },
    sources,
    generatedAt: new Date().toISOString(),
    freshness: 'live',
    partial,
    warnings,
    links: buildAffiliateLegacyLinks(brand)
  };
}

async function projectProductSummary({ tenantId, brandId }) {
  const result = await pgQuery(
    `SELECT 
       COUNT(*)::int AS linked,
       COUNT(*) FILTER (WHERE is_active = TRUE)::int AS active,
       COUNT(*) FILTER (WHERE is_active = TRUE AND (affiliate_link IS NULL OR TRIM(affiliate_link) = ''))::int AS missing_affiliate_link
     FROM brand_products
     WHERE tenant_id = $1 AND brand_profile_id = $2`,
    [tenantId, brandId]
  );
  
  const row = result.rows[0];
  return {
    linked: row?.linked || 0,
    active: row?.active || 0,
    missingAffiliateLink: row?.missing_affiliate_link || 0
  };
}

async function projectPlannerSummary({ tenantId, brandId, brandName }) {
  const plannersResult = await pgQuery(
    `SELECT id, status FROM content_planners
     WHERE tenant_id = $1 AND (brand_id = $2 OR LOWER(account_name) = LOWER($3))`,
    [tenantId, brandId, brandName]
  );
  
  const planners = plannersResult.rows;
  if (planners.length === 0) {
    return {
      total: 0,
      rows: 0,
      draft: 0
    };
  }

  const plannerIds = planners.map(p => p.id);
  const rowsResult = await pgQuery(
    `SELECT COUNT(*)::int AS count FROM content_planner_rows
     WHERE planner_id = ANY($1::text[])`,
    [plannerIds]
  );

  const total = planners.length;
  const draft = planners.filter(p => p.status === 'draft').length;
  const rows = rowsResult.rows[0]?.count || 0;

  return {
    total,
    rows,
    draft
  };
}

async function projectCampaignSummary({ tenantId, brandId }) {
  const reResult = await pgQuery(
    `SELECT status FROM re_campaigns WHERE tenant_id = $1 AND brand_profile_id = $2`,
    [tenantId, brandId]
  );
  
  const pillarResult = await pgQuery(
    `SELECT status FROM pillar_campaigns WHERE tenant_id = $1 AND brand_profile_id = $2`,
    [tenantId, brandId]
  );

  const recipeResult = await pgQuery(
    `SELECT status FROM recipe_campaigns WHERE tenant_id = $1 AND brand_profile_id = $2`,
    [tenantId, brandId]
  );

  const reCampaigns = reResult.rows;
  const pillarCampaigns = pillarResult.rows;
  const recipeCampaigns = recipeResult.rows;

  const allCampaigns = [
    ...reCampaigns.map(c => ({ engine: 're', status: c.status })),
    ...pillarCampaigns.map(c => ({ engine: 'pillar', status: c.status })),
    ...recipeCampaigns.map(c => ({ engine: 'recipe', status: c.status }))
  ];

  const total = allCampaigns.length;
  
  const activeStatuses = ['running', 'processing', 'pending', 'active', 'queued', 'generating', 'rendering'];
  const completedStatuses = ['completed', 'ready', 'success', 'done', 'published'];
  const failedStatuses = ['failed', 'error'];

  let active = 0;
  let completed = 0;
  let failed = 0;

  for (const c of allCampaigns) {
    const statusLower = (c.status || '').toLowerCase();
    if (activeStatuses.includes(statusLower)) {
      active++;
    } else if (completedStatuses.includes(statusLower)) {
      completed++;
    } else if (failedStatuses.includes(statusLower)) {
      failed++;
    }
  }

  const byEngine = {
    re: reCampaigns.length,
    pillar: pillarCampaigns.length,
    recipe: recipeCampaigns.length
  };

  return {
    total,
    active,
    completed,
    failed,
    byEngine
  };
}

async function projectContentFlowSummary({ tenantId, brandId, brandName }) {
  const result = await pgQuery(
    `SELECT 
       COUNT(*)::int AS total,
       COUNT(*) FILTER (
         WHERE LOWER(pipeline_status) = 'completed' 
         AND COALESCE(LOWER(tiktok_status), '') <> 'published'
         AND COALESCE(LOWER(facebook_status), '') <> 'published'
         AND COALESCE(LOWER(instagram_status), '') <> 'published'
         AND COALESCE(LOWER(youtube_status), '') <> 'published'
       )::int AS ready,
       COUNT(*) FILTER (
         WHERE LOWER(tiktok_status) = 'published'
         OR LOWER(facebook_status) = 'published'
         OR LOWER(instagram_status) = 'published'
         OR LOWER(youtube_status) = 'published'
       )::int AS published_any
     FROM content_flow_items
     WHERE tenant_id = $1 AND (
       brand_profile_id = $2
       OR (
         (brand_profile_id IS NULL OR brand_profile_id = '') 
         AND LOWER(account_name) = LOWER($3)
       )
     )`,
    [tenantId, brandId, brandName]
  );
  
  const row = result.rows[0];
  const total = row?.total || 0;
  const ready = row?.ready || 0;
  const publishedAny = row?.published_any || 0;
  const unpublished = total - publishedAny;

  return {
    total,
    ready,
    publishedAny,
    unpublished
  };
}
