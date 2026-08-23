import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { unlinkPlannerFromProgram } from '@/lib/affiliate-studio-planner-adapter';

export const DELETE = withTenantContext(async (request, { params }, user) => {
  try {
    const { id: brandId, programId, plannerId } = await params;

    const ok = await unlinkPlannerFromProgram(user, brandId, programId, plannerId);
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Failed to unlink planner' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Planner unlinked successfully' });
  } catch (error) {
    console.error('[API /affiliate-studio/.../planners/[plannerId] DELETE Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
