import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import { pgQuery } from '@/lib/db-pg';
import { getProductById } from '@/lib/product-repository';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v2/products/regenerate-photos
 * Body: { ids: string[], provider?: 'gemini'|'glabs'|'system_default' }
 *
 * Hanya mengantrikan pekerjaan foto.
 * - Reference selalu raw_photo_url (bukan clean/rembg lama)
 * - Tidak menjalankan Gemini atau G-Labs di dalam request ini
 * - Worker (product-bulk-worker) yang memproses queue
 * - Hasil adalah foto Clean baru, disimpan ke clean_photo_url
 * - TIDAK menulis ke generated_photo_url atau active_photo
 */
export const POST = withTenantContext(async (req) => {
  try {
    const body = await req.json();
    const { ids, provider } = body;
    const tenantId = getActiveTenantId();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: false, error: 'Daftar ID produk wajib dikirim.' }, { status: 400 });
    }

    if (ids.length > 50) {
      return NextResponse.json({ success: false, error: 'Maksimum 50 produk per request.' }, { status: 400 });
    }

    const results = [];
    const resolvedProvider = (provider && provider !== 'system_default') ? provider : null;

    for (const id of ids) {
      try {
        // Verifikasi produk ada dan milik tenant ini
        const product = await getProductById(id);
        if (!product) {
          results.push({ id, status: 'not_found' });
          continue;
        }

        // Produk harus punya raw_photo_url (lokal atau URL) untuk bisa diproses
        if (!product.raw_photo_url && !product.scraped_image_url) {
          results.push({ id, status: 'skipped', reason: 'Tidak ada raw photo tersedia' });
          continue;
        }

        // Antrikan: set photo_status = pending, agar worker mengambil dan memproses
        // Jangan hapus clean_photo_url lama sebelum hasil baru selesai
        const updateRes = await pgQuery(`
          UPDATE product_extractions
          SET photo_status = 'pending',
              photo_error = NULL,
              ${resolvedProvider ? 'photo_provider = $3,' : ''}
              extraction_status = 'pending_image',
              updated_at = NOW()
          WHERE id = $1 AND tenant_id = $2
          RETURNING id
        `, resolvedProvider ? [id, tenantId, resolvedProvider] : [id, tenantId]);

        if (updateRes.rowCount > 0) {
          results.push({ id, status: 'queued', provider: resolvedProvider || 'system_default' });
        } else {
          results.push({ id, status: 'not_found' });
        }
      } catch (err) {
        console.error(`[Regenerate Photo Queue Error] ID ${id}:`, err.message);
        results.push({ id, status: 'error', error: err.message });
      }
    }

    const queuedCount = results.filter(r => r.status === 'queued').length;

    return NextResponse.json({
      success: true,
      message: `${queuedCount} produk dimasukkan ke antrean foto ulang.`,
      results
    });

  } catch (err) {
    console.error('[Regenerate Photos API Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});
