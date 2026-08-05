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
      SELECT * FROM brand_schedules 
      WHERE brand_id = ? 
      ORDER BY slot_index ASC
    `).all(brandId);

    // Ambil seluruh data produk untuk dicocokkan fotonya di memori (database-agnostic & case-insensitive)
    const products = await db.prepare(`
      SELECT id, product_name, cleaned_photo_url, clean_photo_url, generated_photo_url, active_photo 
      FROM product_extractions
    `).all();

    for (const row of rows) {
      let matchedProd = null;
      if (row.product_id) {
        matchedProd = products.find(p => p.id === row.product_id);
      }
      if (!matchedProd && row.product_name) {
        const lowerName = row.product_name.toLowerCase().trim();
        // 1. Exact match (case insensitive)
        matchedProd = products.find(p => p.product_name && p.product_name.toLowerCase().trim() === lowerName);
        
        // 2. Substring fallback match (e.g. matching "Matcha" with "Matcha Powder")
        if (!matchedProd) {
          matchedProd = products.find(p => p.product_name && (
            p.product_name.toLowerCase().includes(lowerName) || 
            lowerName.includes(p.product_name.toLowerCase())
          ));
        }
      }

      if (matchedProd) {
        row.cleaned_photo_url = matchedProd.cleaned_photo_url;
        row.clean_photo_url = matchedProd.clean_photo_url;
        row.generated_photo_url = matchedProd.generated_photo_url;
        row.active_photo = matchedProd.active_photo;
      } else {
        row.cleaned_photo_url = null;
        row.clean_photo_url = null;
        row.generated_photo_url = null;
        row.active_photo = null;
      }
    }

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
      INSERT INTO brand_schedules (id, brand_id, slot_index, product_id, product_name, target_daily_posts, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(brand_id, slot_index) DO UPDATE SET
        product_id = EXCLUDED.product_id,
        product_name = EXCLUDED.product_name,
        target_daily_posts = EXCLUDED.target_daily_posts,
        updated_at = CURRENT_TIMESTAMP
    `);

    for (const slot of slots) {
      // Generate a numeric-like unique string that fits in both BIGINT and TEXT
      const uniqueId = String(Date.now()) + Math.floor(Math.random() * 1000);
      stmt.run(
        uniqueId,
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
