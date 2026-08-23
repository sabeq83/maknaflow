import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import {
  listProgramContentRuns,
  createContentRun
} from '@/lib/affiliate-studio-production-adapter';

export const GET = withTenantContext(async (request, { params }, user) => {
  try {
    const { id: brandId, programId } = await params;
    const runs = await listProgramContentRuns(user, brandId, programId);
    return NextResponse.json({ success: true, data: runs });
  } catch (error) {
    console.error('[API /runs GET Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const POST = withTenantContext(async (request, { params }, user) => {
  try {
    const { id: brandId, programId } = await params;
    const body = await request.json();
    const { plannerId, rowId, engineType, engineCampaignId, engineItemId, metadata } = body;

    if (!plannerId || !rowId || !engineType || !engineCampaignId) {
      return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 });
    }

    const runId = await createContentRun(user, brandId, programId, plannerId, rowId, engineType, engineCampaignId, engineItemId, metadata);
    if (!runId) {
      return NextResponse.json({ success: false, error: 'Failed to register content run' }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: { runId } });
  } catch (error) {
    console.error('[API /runs POST Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
