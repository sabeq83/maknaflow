import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getPublishingPreflight, projectPublishingStatus } from '@/lib/affiliate-studio-publishing-adapter';

export const GET = withTenantContext(async (request, { params }, user) => {
  try {
    const { id: brandId, programId, runId } = await params;

    const preflight = await getPublishingPreflight(user, brandId, programId, runId);
    const statusProjection = await projectPublishingStatus(user, brandId, runId);

    if (!preflight) {
      return NextResponse.json({ success: false, error: 'Failed to retrieve preflight information' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        preflight,
        projection: statusProjection
      }
    });
  } catch (error) {
    console.error('[API /runs/[runId]/publishing GET Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
