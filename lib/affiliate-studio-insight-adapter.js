import { pgQuery } from './db-pg.js';
import { getAuthorizedAffiliateBrand } from './affiliate-studio-brand-read-adapter.js';

export async function getProgramCreativeInsights(user, brandId, programId) {
  if (!user || user.tenantId === '__none__') return null;

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return null;

  const tenantId = user.tenantId;

  // Query averages by Hook
  const hooks = (await pgQuery(
    `SELECT 
       r.hook,
       COUNT(s.id)::int as sample_size,
       COALESCE(AVG(s.views_count), 0)::bigint as avg_views,
       COALESCE(AVG(s.clicks_count), 0)::bigint as avg_clicks,
       COALESCE(AVG(s.revenue_amount), 0.00)::numeric(15,2) as avg_revenue
     FROM affiliate_performance_snapshots s
     JOIN affiliate_content_runs run ON s.affiliate_content_run_id = run.id
     JOIN content_planner_rows r ON run.planner_row_id = r.id
     WHERE s.tenant_id = $1 AND s.brand_profile_id = $2 AND s.affiliate_program_id = $3
       AND r.hook IS NOT NULL AND r.hook != ''
     GROUP BY r.hook
     ORDER BY avg_views DESC LIMIT 5`,
    [tenantId, brand.id, programId]
  )).rows;

  // Query averages by Strategic Angle
  const angles = (await pgQuery(
    `SELECT 
       r.strategic_angle,
       COUNT(s.id)::int as sample_size,
       COALESCE(AVG(s.views_count), 0)::bigint as avg_views,
       COALESCE(AVG(s.clicks_count), 0)::bigint as avg_clicks,
       COALESCE(AVG(s.revenue_amount), 0.00)::numeric(15,2) as avg_revenue
     FROM affiliate_performance_snapshots s
     JOIN affiliate_content_runs run ON s.affiliate_content_run_id = run.id
     JOIN content_planner_rows r ON run.planner_row_id = r.id
     WHERE s.tenant_id = $1 AND s.brand_profile_id = $2 AND s.affiliate_program_id = $3
       AND r.strategic_angle IS NOT NULL AND r.strategic_angle != ''
     GROUP BY r.strategic_angle
     ORDER BY avg_views DESC LIMIT 5`,
    [tenantId, brand.id, programId]
  )).rows;

  // Query averages by Pillar
  const pillars = (await pgQuery(
    `SELECT 
       r.pillar,
       COUNT(s.id)::int as sample_size,
       COALESCE(AVG(s.views_count), 0)::bigint as avg_views,
       COALESCE(AVG(s.clicks_count), 0)::bigint as avg_clicks,
       COALESCE(AVG(s.revenue_amount), 0.00)::numeric(15,2) as avg_revenue
     FROM affiliate_performance_snapshots s
     JOIN affiliate_content_runs run ON s.affiliate_content_run_id = run.id
     JOIN content_planner_rows r ON run.planner_row_id = r.id
     WHERE s.tenant_id = $1 AND s.brand_profile_id = $2 AND s.affiliate_program_id = $3
       AND r.pillar IS NOT NULL AND r.pillar != ''
     GROUP BY r.pillar
     ORDER BY avg_views DESC LIMIT 5`,
    [tenantId, brand.id, programId]
  )).rows;

  return {
    hooks: hooks.map(h => ({
      hook: h.hook,
      sampleSize: h.sample_size,
      avgViews: Number(h.avg_views),
      avgClicks: Number(h.avg_clicks),
      avgRevenue: h.avg_revenue
    })),
    angles: angles.map(a => ({
      strategicAngle: a.strategic_angle,
      sampleSize: a.sample_size,
      avgViews: Number(a.avg_views),
      avgClicks: Number(a.avg_clicks),
      avgRevenue: a.avg_revenue
    })),
    pillars: pillars.map(p => ({
      pillar: p.pillar,
      sampleSize: p.sample_size,
      avgViews: Number(p.avg_views),
      avgClicks: Number(p.avg_clicks),
      avgRevenue: p.avg_revenue
    }))
  };
}
