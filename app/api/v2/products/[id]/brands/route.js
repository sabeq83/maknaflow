import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { listProductBrands } from '@/lib/brand-product-repository';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v2/products/[id]/brands
 * Mendapatkan semua Brand Profile yang terhubung dengan produk ini
 */
export const GET = withTenantContext(async (req, { params }) => {
  try {
    const { id: productId } = await params;
    const associations = await listProductBrands({ productId });
    return NextResponse.json({ success: true, data: associations });
  } catch (err) {
    console.error('[GET Product Brands API Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: err.status || 500 }
    );
  }
});
