import { NextResponse } from 'next/server';
import { withAffiliateStudioAccess } from '@/lib/affiliate-studio-access';
import { getBrandCalendarEvents } from '@/lib/affiliate-studio-planner-adapter';

export const dynamic = 'force-dynamic';

export const GET = withAffiliateStudioAccess('read', async (_request, context, user) => {
  const params = await context.params;
  const brandId = params?.id;
  try {
    const data = await getBrandCalendarEvents(user, brandId);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});
