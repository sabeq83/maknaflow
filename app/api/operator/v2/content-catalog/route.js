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

    const brandFilter = String(query.get('brand') || '').trim().toLowerCase();
    const productFilter = String(query.get('product') || query.get('search') || '').trim().toLowerCase();
    const presetFilter = String(query.get('preset') || '').trim().toLowerCase();
    const campaignKind = String(query.get('campaign_kind') || 'product_campaign').trim();
    const limit = Math.min(50, Math.max(1, Number(query.get('limit') || 20)));

    const result = await runAsOperatorTenant(identity, async () => {
      const { ensureTenantPresetsHydrated } = await import('@/lib/content-run-service');
      await ensureTenantPresetsHydrated(identity.tenantId);

      const [allBrands, allCatalog] = await Promise.all([
        getAllBrandProfiles(),
        listProductCatalog({ search: productFilter, limit })
      ]);

      let filteredBrands = allBrands.map(item => ({
        id: item.id,
        name: item.brand_name || item.name || '',
        slug: (item.brand_name || item.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
      }));

      if (brandFilter) {
        filteredBrands = filteredBrands.filter(b =>
          b.id.toLowerCase() === brandFilter ||
          b.name.toLowerCase().includes(brandFilter) ||
          b.slug.toLowerCase().includes(brandFilter)
        );
      }

      let filteredProducts = allCatalog.data.map(item => ({
        id: item.id,
        name: item.product_name || item.name || '',
        target_audience: item.target_audience || null
      }));

      if (productFilter) {
        filteredProducts = filteredProducts.filter(p =>
          p.id.toLowerCase() === productFilter ||
          p.name.toLowerCase().includes(productFilter)
        );
      }

      let filteredPresets = listOperatorPresets().map(item => {
        const isCompatible = !campaignKind || (item.campaign_kinds && item.campaign_kinds.includes(campaignKind));
        return {
          key: item.key,
          label: item.label,
          campaign_kinds: item.campaign_kinds || [],
          compatible: Boolean(isCompatible)
        };
      });

      if (presetFilter) {
        filteredPresets = filteredPresets.filter(p =>
          p.key.toLowerCase() === presetFilter ||
          p.label.toLowerCase().includes(presetFilter)
        );
      }

      // Mark exact matches
      filteredBrands = filteredBrands.map(b => ({
        ...b,
        exact_match: brandFilter ? (b.id.toLowerCase() === brandFilter || b.name.toLowerCase() === brandFilter) : false
      }));

      filteredProducts = filteredProducts.map(p => ({
        ...p,
        exact_match: productFilter ? (p.id.toLowerCase() === productFilter || p.name.toLowerCase() === productFilter) : false
      }));

      filteredPresets = filteredPresets.map(p => ({
        ...p,
        exact_match: presetFilter ? (p.key.toLowerCase() === presetFilter || p.label.toLowerCase() === presetFilter) : false
      }));

      return {
        brands: filteredBrands.slice(0, limit),
        products: filteredProducts.slice(0, limit),
        presets: filteredPresets.slice(0, limit)
      };
    });

    return NextResponse.json(
      { success: true, ...result },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[Operator Content Catalog Error]:', error);
    return NextResponse.json(
      {
        success: false,
        code: error.code || 'CATALOG_FETCH_FAILED',
        error: error.status && error.status < 500 ? error.message : 'Gagal membaca katalog automation.'
      },
      { status: error.status || 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
