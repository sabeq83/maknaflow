import { pgQuery } from './db-pg.js';
import { getAuthorizedAffiliateBrand } from './affiliate-studio-brand-read-adapter.js';

export async function importPerformanceSnapshots(user, brandId, programId, snapshots) {
  if (!user || user.tenantId === '__none__') return null;

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return null;

  const tenantId = user.tenantId;
  const importedIds = [];

  for (const item of snapshots) {
    const id = `perf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await pgQuery(
      `INSERT INTO affiliate_performance_snapshots (
         id, tenant_id, brand_profile_id, affiliate_program_id, affiliate_content_run_id,
         platform, external_post_id, views_count, likes_count, shares_count, clicks_count,
         conversions_count, revenue_amount, currency, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        id, tenantId, brand.id, programId, item.runId || null,
        item.platform || 'tiktok', item.externalPostId || null,
        item.views || 0, item.likes || 0, item.shares || 0, item.clicks || 0,
        item.conversions || 0, item.revenue || 0.00, item.currency || 'IDR',
        item.status || 'measured'
      ]
    );
    importedIds.push(id);

    // Update status to 'Measured' on run if linked
    if (item.runId) {
      await pgQuery(
        `UPDATE affiliate_content_runs SET normalized_status = 'Measured', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND tenant_id = $2`,
        [item.runId, tenantId]
      );
    }
  }

  return importedIds;
}

export async function getProgramPerformanceSummary(user, brandId, programId) {
  if (!user || user.tenantId === '__none__') return null;

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return null;

  const tenantId = user.tenantId;

  const row = (await pgQuery(
    `SELECT 
       COALESCE(SUM(views_count), 0)::bigint as total_views,
       COALESCE(SUM(likes_count), 0)::bigint as total_likes,
       COALESCE(SUM(shares_count), 0)::bigint as total_shares,
       COALESCE(SUM(clicks_count), 0)::bigint as total_clicks,
       COALESCE(SUM(conversions_count), 0)::bigint as total_conversions,
       COALESCE(SUM(revenue_amount), 0.00)::numeric(15,2) as total_revenue
     FROM affiliate_performance_snapshots
     WHERE tenant_id = $1 AND brand_profile_id = $2 AND affiliate_program_id = $3`,
    [tenantId, brand.id, programId]
  )).rows[0];

  return {
    total_views: Number(row.total_views),
    total_likes: Number(row.total_likes),
    total_shares: Number(row.total_shares),
    total_clicks: Number(row.total_clicks),
    total_conversions: Number(row.total_conversions),
    total_revenue: row.total_revenue
  };
}
