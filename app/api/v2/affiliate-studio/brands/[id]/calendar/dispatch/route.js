import { NextResponse } from 'next/server';
import { withAffiliateStudioAccess } from '@/lib/affiliate-studio-access';
import { dispatchCalendarSchedulesToPlanner } from '@/lib/affiliate-studio-calendar-dispatch-service';

export const dynamic = 'force-dynamic';

export const POST = withAffiliateStudioAccess('write', async (request, context, user) => {
  try {
    const params = await context.params;
    const brandId = params?.id;

    const body = await request.json().catch(() => ({}));
    const { scheduleIds, targetPlannerId, programId } = body;

    if (!Array.isArray(scheduleIds) || scheduleIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'scheduleIds array is required and must not be empty' },
        { status: 400 }
      );
    }

    const result = await dispatchCalendarSchedulesToPlanner({
      user,
      brandId,
      scheduleIds,
      targetPlannerId,
      programId
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('[API Calendar Dispatch Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to dispatch schedules to planner' },
      { status: 500 }
    );
  }
});
