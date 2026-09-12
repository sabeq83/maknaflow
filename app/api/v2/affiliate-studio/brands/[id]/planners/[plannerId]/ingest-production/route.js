import { NextResponse } from 'next/server';
import { withAffiliateStudioAccess } from '@/lib/affiliate-studio-access';
import { ingestApprovedPlannerRowsToProduction } from '@/lib/affiliate-studio-planner-adapter';

export const dynamic = 'force-dynamic';

export const POST = withAffiliateStudioAccess('write', async (request, context, user) => {
  try {
    const params = await context.params;
    const brandId = params?.id;
    const plannerId = params?.plannerId;

    const body = await request.json().catch(() => ({}));
    const { programId } = body;

    const result = await ingestApprovedPlannerRowsToProduction({
      user,
      brandId,
      plannerId,
      programId
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('[API Ingest to Production Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to ingest approved rows to production' },
      { status: 500 }
    );
  }
});
