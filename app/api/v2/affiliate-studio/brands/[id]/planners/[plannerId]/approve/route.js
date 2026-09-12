import { NextResponse } from 'next/server';
import { withAffiliateStudioAccess } from '@/lib/affiliate-studio-access';
import { approvePlannerRows } from '@/lib/affiliate-studio-planner-adapter';

export const dynamic = 'force-dynamic';

export const POST = withAffiliateStudioAccess('write', async (request, context, user) => {
  try {
    const params = await context.params;
    const brandId = params?.id;
    const plannerId = params?.plannerId;

    const body = await request.json().catch(() => ({}));
    const { rowIds, allApproved } = body;

    const result = await approvePlannerRows({
      user,
      brandId,
      plannerId,
      rowIds,
      allApproved
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('[API Planner Approval Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to approve planner rows' },
      { status: 500 }
    );
  }
});
