import { NextResponse } from 'next/server';
import { withAffiliateStudioAccess } from '@/lib/affiliate-studio-access';
import { forwardRunAction } from '@/lib/affiliate-studio-production-workspace-adapter';

export const dynamic = 'force-dynamic';

export const POST = withAffiliateStudioAccess('write', async (request, context, user) => {
  try {
    const params = await context.params;
    const brandId = params?.id;
    const runId = params?.runId;
    const action = params?.action;

    const body = await request.json().catch(() => ({}));

    const result = await forwardRunAction(user, brandId, runId, action, body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('[API Production Action Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to execute production action' },
      { status: 500 }
    );
  }
});
