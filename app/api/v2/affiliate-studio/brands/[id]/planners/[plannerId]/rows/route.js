import { NextResponse } from 'next/server';
import { withAffiliateStudioAccess } from '@/lib/affiliate-studio-access';
import { getPlannerRowLinks, updatePlannerRowLink } from '@/lib/affiliate-studio-planner-adapter';

export const dynamic = 'force-dynamic';

export const GET = withAffiliateStudioAccess('read', async (_request, context, user) => {
  const params = await context.params;
  const brandId = params?.id;
  const plannerId = params?.plannerId;

  try {
    const rows = await getPlannerRowLinks(user, brandId, null, plannerId);
    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});

export const PUT = withAffiliateStudioAccess('write', async (request, context, user) => {
  const params = await context.params;
  const brandId = params?.id;
  const plannerId = params?.plannerId;

  try {
    const body = await request.json();
    const { rowId, programProductId, funnelStage, metadata } = body;

    if (!rowId) {
      return NextResponse.json({ success: false, error: 'rowId is required' }, { status: 400 });
    }

    const ok = await updatePlannerRowLink(
      user,
      brandId,
      null,
      plannerId,
      rowId,
      programProductId,
      funnelStage,
      metadata
    );

    return NextResponse.json({ success: ok, message: 'Row updated' });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});
