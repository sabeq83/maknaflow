import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { suggestCampaignProgram } from '@/lib/affiliate-studio-builder-adapter';

export const POST = withTenantContext(async (request, { params }, user) => {
  try {
    const { id: brandId } = await params;
    const suggested = await suggestCampaignProgram(user, brandId);
    return NextResponse.json({ success: true, data: suggested });
  } catch (error) {
    console.error('[API /programs/suggest POST Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
