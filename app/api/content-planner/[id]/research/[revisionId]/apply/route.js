import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { applyPlannerResearchRevision } from '@/lib/content-planner-research-service.js';

export const POST = withTenantContext(async (request, { params }, user) => {
  try {
    const { id: plannerId, revisionId } = await params;
    const tenantId = user?.tenantId || 'default_tenant';

    const result = await applyPlannerResearchRevision({
      plannerId,
      revisionId,
      actor: user?.email || user?.id || 'user',
      tenantId
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[API /content-planner/[id]/research/[revisionId]/apply POST Error]', error);
    const statusCode = error.code === 'RESEARCH_REVISION_NOT_FOUND' ? 404 : 500;
    return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: statusCode });
  }
});
