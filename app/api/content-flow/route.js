import { NextResponse } from 'next/server';
import { getContentFlowItems } from '@/lib/db';
import { pgQuery } from '@/lib/db-pg';
import { scanAndSyncExistingCampaigns } from '@/lib/contentflow-ingest';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceType = searchParams.get('source_type') || 'all';
    const accountName = searchParams.get('account') || 'all';
    const productName = searchParams.get('product') || 'all';
    const pipelineStatus = searchParams.get('pipeline_status') || 'all';
    const tiktokStatus = searchParams.get('tiktok_status') || 'Semua';
    const facebookStatus = searchParams.get('facebook_status') || 'Semua';
    const instagramStatus = searchParams.get('instagram_status') || 'Semua';
    const q = searchParams.get('q') || '';
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '50';

    try {
      let baseSql = 'FROM content_flow_items WHERE 1=1';
      const params = [];
      if (sourceType && sourceType !== 'all') {
        params.push(sourceType);
        baseSql += ` AND source_type = $${params.length}`;
      }
      if (accountName && accountName !== 'all') {
        params.push(accountName);
        baseSql += ` AND account_name ILIKE $${params.length}`;
      }
      if (productName && productName !== 'all') {
        params.push(productName);
        baseSql += ` AND nama_produk = $${params.length}`;
      }
      if (pipelineStatus && pipelineStatus !== 'all') {
        params.push(pipelineStatus);
        baseSql += ` AND pipeline_status = $${params.length}`;
      }
      if (tiktokStatus && tiktokStatus !== 'Semua') {
        params.push(tiktokStatus);
        baseSql += ` AND tiktok_status = $${params.length}`;
      }
      if (facebookStatus && facebookStatus !== 'Semua') {
        params.push(facebookStatus);
        baseSql += ` AND facebook_status = $${params.length}`;
      }
      if (instagramStatus && instagramStatus !== 'Semua') {
        params.push(instagramStatus);
        baseSql += ` AND instagram_status = $${params.length}`;
      }
      if (q && q.trim()) {
        params.push(`%${q.trim()}%`);
        baseSql += ` AND (video_id ILIKE $${params.length} OR hook ILIKE $${params.length} OR nama_produk ILIKE $${params.length} OR campaign_title ILIKE $${params.length} OR caption ILIKE $${params.length})`;
      }

      const countSql = `SELECT count(*) ${baseSql}`;
      const totalRes = await pgQuery(countSql, params);
      const totalItems = parseInt(totalRes.rows[0].count, 10);
      const totalPages = Math.ceil(totalItems / parseInt(limit, 10)) || 1;

      let sql = `SELECT * ${baseSql} ORDER BY created_at ASC`;
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      params.push(parseInt(limit, 10), offset);
      sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

      const itemsRes = await pgQuery(sql, params);
      const accountsRes = await pgQuery('SELECT DISTINCT account_name FROM content_flow_items WHERE account_name IS NOT NULL;');
      const productsRes = await pgQuery('SELECT DISTINCT nama_produk FROM content_flow_items WHERE nama_produk IS NOT NULL;');

      return NextResponse.json({
        success: true,
        items: itemsRes.rows,
        total_items: totalItems,
        total_pages: totalPages,
        available_accounts: accountsRes.rows.map(r => r.account_name),
        available_products: productsRes.rows.map(r => r.nama_produk)
      });
    } catch (pgErr) {
      console.warn('[API /api/content-flow] Falling back to SQLite:', pgErr.message);
      const currentUser = getCurrentUser(request);
      let allowedAccounts = currentUser && currentUser.role !== 'admin' ? currentUser.assignedBrandNames : undefined;
      const result = await getContentFlowItems({ sourceType, accountName, productName, pipelineStatus, tiktokStatus, facebookStatus, instagramStatus, q, page, limit, allowedAccounts });
      return NextResponse.json({ success: true, ...result });
    }
  } catch (err) {
    console.error('[API /api/content-flow Error]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
