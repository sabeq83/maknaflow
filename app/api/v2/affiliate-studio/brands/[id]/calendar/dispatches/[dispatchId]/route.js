import { NextResponse } from 'next/server';
import { withAffiliateStudioAccess } from '@/lib/affiliate-studio-access';
import { getDispatchDetails } from '@/lib/affiliate-studio-calendar-dispatch-service';

export const dynamic = 'force-dynamic';

export const GET = withAffiliateStudioAccess('read', async (_request, context, user) => {
  try {
    const params = await context.params;
    const brandId = params?.id;
    const dispatchId = params?.dispatchId;

    if (!dispatchId) {
      return NextResponse.json(
        { success: false, error: 'dispatchId parameter is required' },
        { status: 400 }
      );
    }

    const data = await getDispatchDetails(user, brandId, dispatchId);
    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Dispatch record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[API Get Dispatch Details Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch dispatch details' },
      { status: 500 }
    );
  }
});
