import { NextResponse } from 'next/server';
import { withAffiliateStudioAccess } from '@/lib/affiliate-studio-access';
import { getProductionRunScenes, updateSceneProjectionDetails } from '@/lib/affiliate-studio-production-workspace-adapter';

export const dynamic = 'force-dynamic';

export const GET = withAffiliateStudioAccess('read', async (_request, context, user) => {
  try {
    const params = await context.params;
    const brandId = params?.id;
    const runId = params?.runId;

    const data = await getProductionRunScenes(user, brandId, runId);
    if (!data) {
      return NextResponse.json({ success: false, error: 'Run or scenes not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[API Production Scenes Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch production scenes' },
      { status: 500 }
    );
  }
});

export const PUT = withAffiliateStudioAccess('write', async (request, context, user) => {
  try {
    const params = await context.params;
    const brandId = params?.id;
    const runId = params?.runId;

    const body = await request.json().catch(() => ({}));
    const { sceneIndex, updates } = body;

    if (sceneIndex === undefined) {
      return NextResponse.json({ success: false, error: 'sceneIndex is required' }, { status: 400 });
    }

    const updated = await updateSceneProjectionDetails(user, brandId, runId, sceneIndex, updates);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Failed to update scene projection' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error('[API Update Scene Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to update scene' },
      { status: 500 }
    );
  }
});
