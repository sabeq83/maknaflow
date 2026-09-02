import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { requestPlannerResearchRefresh } from '@/lib/content-planner-research-service.js';

export const POST = withTenantContext(async (request, { params }, user) => {
  try {
    const { id: plannerId } = await params;
    const tenantId = user?.tenantId || 'default_tenant';
    const body = await request.json().catch(() => ({}));

    const result = await requestPlannerResearchRefresh({
      plannerId,
      queryOverride: body.query || null,
      actor: user?.email || user?.id || 'user',
      tenantId
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[API /content-planner/[id]/research/refresh POST Error]', error);
    const statusCode = error.code === 'RESEARCH_REFRESH_ALREADY_RUNNING' ? 409 : 500;
    return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: statusCode });
  }
});
