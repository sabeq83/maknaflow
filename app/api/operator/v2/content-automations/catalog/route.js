import { NextResponse } from 'next/server';
import { authenticateOperator, runAsOperatorTenant } from '@/lib/operator-auth';
import { getAllBrandProfiles } from '@/lib/db';
import { listProductCatalog } from '@/lib/product-catalog-service';
import { listOperatorPresets } from '@/lib/operator-presets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const identity = await authenticateOperator(request, 'automation:read');
    const query = new URL(request.url).searchParams;
    const search = String(query.get('search') || '').slice(0, 120);
    const result = await runAsOperatorTenant(identity, async () => {
      const [brands, catalog] = await Promise.all([
        getAllBrandProfiles(),
        listProductCatalog({ search, limit: Math.min(50, Math.max(1, Number(query.get('limit') || 20))) })
      ]);
      return {
        brands: brands.map(item => ({ id: item.id, name: item.brand_name })),
        products: catalog.data.map(item => ({
          id: item.id,
          name: item.product_name || item.name,
          target_audience: item.target_audience || null
        })),
        presets: listOperatorPresets().map(item => ({ key: item.key, label: item.label }))
      };
    });
    return NextResponse.json({ success: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ success: false, code: error.code, error: error.status && error.status < 500 ? error.message : 'Gagal membaca katalog automation.' }, { status: error.status || 500 });
  }
}
