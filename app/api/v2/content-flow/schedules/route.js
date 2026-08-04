import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { withTenantContext } from '@/lib/auth';

export const GET = withTenantContext(async (request, _context, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brandId');
    if (!brandId) {
      return NextResponse.json({ success: false, error: 'brandId parameter is required' }, { status: 400 });
    }

    const db = getDb();
    const brandProfile = await db.prepare('SELECT id FROM brand_profiles WHERE (id = ? OR brand_name = ?)').get(brandId, brandId);
    if (!brandProfile) {
      return NextResponse.json({ success: false, error: 'Brand profile tidak ditemukan atau akses ditolak.' }, { status: 403 });
    }

    const rows = await db.prepare(`
      SELECT bs.*, 
             pe.cleaned_photo_url, pe.clean_photo_url, pe.generated_photo_url, pe.active_photo
      FROM brand_schedules bs
      LEFT JOIN (
        SELECT id, product_name, cleaned_photo_url, clean_photo_url, generated_photo_url, active_photo 
        FROM product_extractions 
        GROUP BY product_name
      ) pe ON (bs.product_id = pe.id OR bs.product_name = pe.product_name)
      WHERE bs.brand_id = ? 
      ORDER BY bs.slot_index ASC
    `).all(brandId);

    const { pgQuery } = await import('@/lib/db-pg');
    const todayStr = new Date().toLocaleDateString('sv-SE'); // 'YYYY-MM-DD'

    for (const row of rows) {
      row.published_today = 0;
      if (!row.product_name || row.product_name.trim() === '') continue;

      try {
        const pgRes = await pgQuery(`
          SELECT COUNT(*) as count FROM content_flow_items
          WHERE LOWER(account_name) = LOWER($1)
            AND (LOWER($2) LIKE '%' || LOWER(nama_produk) || '%' OR LOWER(nama_produk) LIKE '%' || LOWER($2) || '%')
            AND (
              (LOWER(tiktok_status) = 'published' AND tiktok_publish_date = $3) OR
              (LOWER(facebook_status) = 'published' AND facebook_publish_date = $3) OR
              (LOWER(instagram_status) = 'published' AND instagram_publish_date = $3) OR
              (LOWER(youtube_status) = 'published' AND youtube_publish_date = $3)
            )
        `, [brandId, row.product_name, todayStr]);
        row.published_today = parseInt(pgRes.rows[0].count, 10) || 0;
      } catch (pgErr) {
        console.warn('[API schedules GET] PG count query failed, falling back to SQLite:', pgErr.message);
        try {
          const sqliteDb = getDb();
          const litRes = sqliteDb.prepare(`
            SELECT COUNT(*) as count FROM content_flow_items
            WHERE LOWER(account_name) = LOWER(?)
              AND (? LIKE '%' || LOWER(nama_produk) || '%' OR LOWER(nama_produk) LIKE '%' || ?)
              AND (
                (LOWER(tiktok_status) = 'published' AND tiktok_publish_date = ?) OR
                (LOWER(facebook_status) = 'published' AND facebook_publish_date = ?) OR
                (LOWER(instagram_status) = 'published' AND instagram_publish_date = ?) OR
                (LOWER(youtube_status) = 'published' AND youtube_publish_date = ?)
              )
          `).get(brandId, row.product_name, row.product_name, todayStr, todayStr, todayStr, todayStr);
          row.published_today = litRes?.count || 0;
        } catch (sqliteErr) {
          console.error('[API schedules GET] SQLite fallback count query failed:', sqliteErr.message);
        }
      }
    }

    return NextResponse.json({ success: true, schedules: rows });
  } catch (error) {
    console.error('[API /v2/content-flow/schedules GET Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const POST = withTenantContext(async (request, _context, user) => {
  try {
    const body = await request.json();
    const { brandId, slots } = body; // slots = [{ slot_index, product_id, product_name, target_daily_posts }]

    if (!brandId || !Array.isArray(slots)) {
      return NextResponse.json({ success: false, error: 'Invalid brandId or slots array' }, { status: 400 });
    }

    const db = getDb();
    const brandProfile = await db.prepare('SELECT id FROM brand_profiles WHERE (id = ? OR brand_name = ?)').get(brandId, brandId);
    if (!brandProfile) {
      return NextResponse.json({ success: false, error: 'Brand profile tidak ditemukan atau akses ditolak.' }, { status: 403 });
    }

    const stmt = await db.prepare(`
      INSERT INTO brand_schedules (brand_id, slot_index, product_id, product_name, target_daily_posts, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(brand_id, slot_index) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        product_name = EXCLUDED.product_name,
        target_daily_posts = EXCLUDED.target_daily_posts,
        updated_at = CURRENT_TIMESTAMP
    `);

    for (const slot of slots) {
      stmt.run(
        brandId,
        slot.slot_index,
        slot.product_id || '',
        slot.product_name || '',
        slot.target_daily_posts || 1
      );
    }

    return NextResponse.json({ success: true, message: 'Brand schedules updated successfully' });
  } catch (error) {
    console.error('[API /v2/content-flow/schedules POST Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
