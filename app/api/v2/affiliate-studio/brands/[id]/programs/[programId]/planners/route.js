import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import {
  linkPlannerToProgram,
  listLinkedProgramPlanners,
  listAvailableBrandPlanners
} from '@/lib/affiliate-studio-planner-adapter';

export const GET = withTenantContext(async (request, { params }, user) => {
  try {
    const { id: brandId, programId } = await params;
    
    const linked = await listLinkedProgramPlanners(user, brandId, programId);
    const available = await listAvailableBrandPlanners(user, brandId, programId);

    return NextResponse.json({
      success: true,
      data: { linked, available }
    });
  } catch (error) {
    console.error('[API /affiliate-studio/.../planners GET Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const POST = withTenantContext(async (request, { params }, user) => {
  try {
    const { id: brandId, programId } = await params;
    const { plannerId } = await request.json();

    if (!plannerId) {
      return NextResponse.json({ success: false, error: 'plannerId is required' }, { status: 400 });
    }

    const ok = await linkPlannerToProgram(user, brandId, programId, plannerId);
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Failed to link planner' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Planner linked successfully' });
  } catch (error) {
    console.error('[API /affiliate-studio/.../planners POST Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
