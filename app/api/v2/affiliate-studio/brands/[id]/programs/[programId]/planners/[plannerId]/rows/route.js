import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import {
  getPlannerRowLinks,
  updatePlannerRowLink
} from '@/lib/affiliate-studio-planner-adapter';

export const GET = withTenantContext(async (request, { params }, user) => {
  try {
    const { id: brandId, programId, plannerId } = await params;
    
    const rows = await getPlannerRowLinks(user, brandId, programId, plannerId);

    return NextResponse.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('[API /affiliate-studio/.../rows GET Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const PUT = withTenantContext(async (request, { params }, user) => {
  try {
    const { id: brandId, programId, plannerId } = await params;
    const body = await request.json();
    const { rowId, programProductId, funnelStage, metadata } = body;

    if (!rowId) {
      return NextResponse.json({ success: false, error: 'rowId is required' }, { status: 400 });
    }

    const ok = await updatePlannerRowLink(
      user,
      brandId,
      programId,
      plannerId,
      rowId,
      programProductId,
      funnelStage,
      metadata
    );

    if (!ok) {
      return NextResponse.json({ success: false, error: 'Failed to update row linkage' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Row linkage updated successfully' });
  } catch (error) {
    console.error('[API /affiliate-studio/.../rows PUT Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
