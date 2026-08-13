import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { listEligibleAutomationProducts } from '@/lib/content-automation-product-snapshot';

export const dynamic = 'force-dynamic';
export const GET = withTenantContext(async request => {
  try {
    const brandProfileId = new URL(request.url).searchParams.get('brand_profile_id');
    return NextResponse.json({ success: true, products: await listEligibleAutomationProducts({ brandProfileId }) });
  } catch (error) {
    return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status || 500 });
  }
});
