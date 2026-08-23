import { NextResponse } from 'next/server';
import { withAffiliateStudioAccess } from '@/lib/affiliate-studio-access';
import { listCampaignProgramEvents } from '@/lib/affiliate-studio-campaign-program-adapter';

export const dynamic = 'force-dynamic';

export const GET = withAffiliateStudioAccess('read', async (request, context, user) => {
  try {
    const params = await context.params;
    const brandId = params?.id;
    const programId = params?.programId;

    const events = await listCampaignProgramEvents(user, brandId, programId);

    return NextResponse.json({
      success: true,
      data: events
    });
  } catch (error) {
    console.error('[API /affiliate-studio/.../events GET Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
