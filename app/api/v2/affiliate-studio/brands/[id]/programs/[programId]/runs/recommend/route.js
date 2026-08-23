import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getSmartRouteRecommendation } from '@/lib/affiliate-studio-recommendation-adapter';

export const GET = withTenantContext(async (request, { params }, user) => {
  try {
    const { id: brandId, programId } = await params;
    const { searchParams } = new URL(request.url);
    const plannerId = searchParams.get('plannerId');
    const rowId = searchParams.get('rowId');

    if (!plannerId || !rowId) {
      return NextResponse.json({ success: false, error: 'Missing plannerId or rowId' }, { status: 400 });
    }

    const recommendation = await getSmartRouteRecommendation(user, brandId, programId, plannerId, rowId);
    if (!recommendation) {
      return NextResponse.json({ success: false, error: 'Failed to generate recommendation' }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: recommendation });
  } catch (error) {
    console.error('[API /runs/recommend GET Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
