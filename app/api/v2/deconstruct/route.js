import { NextResponse } from 'next/server';
import {
  createSavedDeconstructAssets,
  listDeconstructAssets,
  getDb
} from '@/lib/db';
import { getActiveTenantId } from '@/lib/tenant-context';
import { withTenantContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = getActiveTenantId();

    // Mode legacy: list completed assets untuk consumer Labs
    if (searchParams.get('assets') === 'true') {
      const db = getDb();
      const assets = await db.prepare("SELECT * FROM re_deconstructed_assets WHERE status = 'deconstructed' AND tenant_id = ? ORDER BY created_at DESC").all(tenantId);
      return NextResponse.json({ success: true, assets });
    }

    const q = searchParams.get('q') || '';
    const niche = searchParams.get('niche') || '';
    const status = searchParams.get('status') || '';
    const page = Number(searchParams.get('page') || 1);
    const limit = Number(searchParams.get('limit') || 25);

    const result = await listDeconstructAssets({ q, niche, status, page, limit }, tenantId);
    return NextResponse.json({
      success: true,
      assets: result.assets,
      niches: result.niches,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('[Deconstruct API] GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const POST = withTenantContext(async (request) => {
  try {
    const body = await request.json();
    const { niche } = body;
    const tenantId = getActiveTenantId();

    if (!niche || !niche.trim()) {
      return NextResponse.json({ success: false, error: 'Niche wajib ditentukan' }, { status: 400 });
    }

    let items = [];

    if (body.csv_data && Array.isArray(body.csv_data)) {
      items = body.csv_data
        .filter(row => row.url && row.url.trim())
        .map(row => ({
          url: row.url.trim(),
          caption: (row.caption || '').trim() || null,
        }));
    } else if (body.urls) {
      const urls = body.urls
        .split('\n')
        .map(u => u.trim())
        .filter(u => u.length > 0);

      const captions = body.captions
        ? body.captions.split('\n').map(c => c.trim())
        : [];

      items = urls.map((url, i) => ({
        url,
        caption: captions[i] || null,
      }));
    }

    if (items.length === 0) {
      return NextResponse.json({ success: false, error: 'Setidaknya satu URL video wajib diisi' }, { status: 400 });
    }

    if (items.length > 50) {
      return NextResponse.json({ success: false, error: 'Maksimum 50 URL per batch' }, { status: 400 });
    }

    // URL validation
    for (const item of items) {
      try {
        new URL(item.url);
      } catch {
        return NextResponse.json({ success: false, error: `URL tidak valid: ${item.url}` }, { status: 400 });
      }
    }

    const { savedCount, duplicateCount, savedIds } = await createSavedDeconstructAssets(
      items,
      niche.trim(),
      tenantId
    );

    return NextResponse.json({
      success: true,
      saved_count: savedCount,
      duplicate_count: duplicateCount,
      saved_ids: savedIds
    });

  } catch (error) {
    console.error('[Deconstruct API] POST error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
