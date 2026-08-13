import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { listEligibleAutomationProducts } from '@/lib/content-automation-product-snapshot';

export const dynamic = 'force-dynamic';
export const GET = withTenantContext(async request => {
  try {
    const query = new URL(request.url).searchParams;
    const result = await listEligibleAutomationProducts({ brandProfileId: query.get('brand_profile_id'), search: query.get('search') || '' });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ success: false, code: error.code, error: error.message }, { status: error.status || 500 });
  }
});
