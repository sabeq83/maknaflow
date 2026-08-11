import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import { pgQuery } from '@/lib/db-pg';
import { getProductById } from '@/lib/product-repository';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v2/products/re-enrich
 * Body: { ids: string[] }
 *
 * Mengantrekan ulang proses AI enrichment (USP, truths, clean photo prompt)
 * untuk diproses secara asinkron oleh background worker.
 */
export const POST = withTenantContext(async (req) => {
  try {
    const body = await req.json();
    const { ids } = body;
    const tenantId = getActiveTenantId();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: false, error: 'Daftar ID produk wajib dikirim.' }, { status: 400 });
    }

    if (ids.length > 50) {
      return NextResponse.json({ success: false, error: 'Maksimum 50 produk per request.' }, { status: 400 });
    }

    const results = [];

    for (const id of ids) {
      try {
        // Verifikasi produk ada dan milik tenant ini
        const product = await getProductById(id);
        if (!product) {
          results.push({ id, status: 'not_found' });
          continue;
        }

        // Antrikan: set enrichment_status = pending dan extraction_status = pending
        const updateRes = await pgQuery(`
          UPDATE product_extractions
          SET enrichment_status = 'pending',
              enrichment_error = NULL,
              extraction_status = 'pending',
              updated_at = NOW()
          WHERE id = $1 AND tenant_id = $2
          RETURNING id
        `, [id, tenantId]);

        if (updateRes.rowCount > 0) {
          results.push({ id, status: 'queued' });
        } else {
          results.push({ id, status: 'not_found' });
        }
      } catch (err) {
        console.error(`[Re-Enrich Queue Error] ID ${id}:`, err.message);
        results.push({ id, status: 'error', error: err.message });
      }
    }

    const queuedCount = results.filter(r => r.status === 'queued').length;

    return NextResponse.json({
      success: true,
      message: `${queuedCount} produk dimasukkan kembali ke antrean AI Enrichment.`,
      results
    });

  } catch (err) {
    console.error('[Re-Enrich API Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});
