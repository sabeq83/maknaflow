import { NextResponse } from 'next/server';
import { withAffiliateStudioAccess } from '@/lib/affiliate-studio-access';
import { getBrandCalendarEvents, listBrandPlanners } from '@/lib/affiliate-studio-planner-adapter';

export const dynamic = 'force-dynamic';

export const GET = withAffiliateStudioAccess('read', async (request, context, user) => {
  const params = await context.params;
  const brandId = params?.id;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');

  try {
    if (type === 'events') {
      const events = await getBrandCalendarEvents(user, brandId);
      return NextResponse.json({ success: true, data: events });
    }

    const planners = await listBrandPlanners(user, brandId);
    return NextResponse.json({ success: true, data: planners, linked: planners });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});
