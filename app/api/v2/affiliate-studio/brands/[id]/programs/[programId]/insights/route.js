import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getProgramCreativeInsights } from '@/lib/affiliate-studio-insight-adapter';

export const GET = withTenantContext(async (request, { params }, user) => {
  try {
    const { id: brandId, programId } = await params;
    const insights = await getProgramCreativeInsights(user, brandId, programId);
    return NextResponse.json({ success: true, data: insights });
  } catch (error) {
    console.error('[API /insights GET Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
