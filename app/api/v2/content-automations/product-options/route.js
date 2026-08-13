import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { listProductCatalog, listBindingSummaries } from '@/lib/product-catalog-service';

export const dynamic = 'force-dynamic';
export const GET = withTenantContext(async request => {
  try {
    const query = new URL(request.url).searchParams;
    const catalog = await listProductCatalog({ search: query.get('search') || '', cursor: query.get('cursor'), limit: query.get('limit') || 50 });
    const bindings = await listBindingSummaries({ brandProfileId: query.get('brand_profile_id'), productIds: catalog.data.map(item=>item.id) });
    const products=catalog.data.map(product=>{const binding=bindings.get(product.id);return {...product,product_id:product.id,brand_product_id:binding?.id||null,is_linked:Boolean(binding?.is_active),binding_active:Boolean(binding?.is_active),affiliate_link:binding?.affiliate_link||product.affiliate_link||'',tracking_code:binding?.tracking_code||'',landing_page_url:binding?.landing_page_url||'',cta_override:binding?.cta_override||''};});
    return NextResponse.json({ success: true, products, summary:{total:products.length,linked:products.filter(item=>item.is_linked).length,unlinked:products.filter(item=>!item.is_linked).length},pagination:catalog.pagination });
  } catch (error) {
    return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status || 500 });
  }
});
