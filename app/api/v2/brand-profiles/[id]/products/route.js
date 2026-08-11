import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import {
  listBrandProducts,
  upsertBrandProduct,
  deactivateBrandProduct
} from '@/lib/brand-product-repository';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v2/brand-profiles/[id]/products
 * Mendapatkan daftar produk terhubung (dan opsional produk yang belum terhubung)
 */
export const GET = withTenantContext(async (req, { params }) => {
  try {
    const { id: brandProfileId } = await params;
    const { searchParams } = new URL(req.url);
    const includeUnlinked = searchParams.get('includeUnlinked') === 'true';
    const search = searchParams.get('search') || '';

    const products = await listBrandProducts({
      brandProfileId,
      includeUnlinked,
      search
    });

    return NextResponse.json({ success: true, data: products });
  } catch (err) {
    console.error('[GET Brand Products API Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: err.status || 500 }
    );
  }
});

/**
 * PUT /api/v2/brand-profiles/[id]/products
 * Menghubungkan atau memperbarui link affiliate produk dengan Brand Profile
 */
export const PUT = withTenantContext(async (req, { params }) => {
  try {
    const { id: brandProfileId } = await params;
    const body = await req.json();
    const {
      productId,
      affiliateLink,
      trackingCode,
      landingPageUrl,
      productNameOverride,
      ctaOverride,
      notes,
      isActive = true
    } = body;

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'Parameter productId wajib dikirim.' },
        { status: 400 }
      );
    }

    const association = await upsertBrandProduct({
      brandProfileId,
      productId,
      affiliateLink,
      trackingCode,
      landingPageUrl,
      productNameOverride,
      ctaOverride,
      notes,
      isActive
    });

    return NextResponse.json({
      success: true,
      message: 'Hubungan Brand-Product berhasil disimpan.',
      data: association
    });
  } catch (err) {
    console.error('[PUT Brand Products API Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: err.status || 500 }
    );
  }
});

/**
 * DELETE /api/v2/brand-profiles/[id]/products
 * Menonaktifkan hubungan Brand-Product
 */
export const DELETE = withTenantContext(async (req, { params }) => {
  try {
    const { id: brandProfileId } = await params;
    const { searchParams } = new URL(req.url);
    
    // Ambil productId dari body (JSON) atau dari query parameter
    let productId = searchParams.get('productId');
    if (!productId) {
      try {
        const body = await req.json();
        productId = body.productId;
      } catch (_) {}
    }

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'Parameter productId wajib dikirim.' },
        { status: 400 }
      );
    }

    const association = await deactivateBrandProduct({
      brandProfileId,
      productId
    });

    if (!association) {
      return NextResponse.json(
        { success: false, error: 'Hubungan Brand-Product tidak ditemukan.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Hubungan Brand-Product dinonaktifkan.',
      data: association
    });
  } catch (err) {
    console.error('[DELETE Brand Products API Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: err.status || 500 }
    );
  }
});
