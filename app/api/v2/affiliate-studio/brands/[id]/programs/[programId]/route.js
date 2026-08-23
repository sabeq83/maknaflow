import { NextResponse } from 'next/server';
import { withAffiliateStudioAccess } from '@/lib/affiliate-studio-access';
import {
  getCampaignProgram,
  updateCampaignProgram,
  archiveCampaignProgram,
  listCampaignProgramProducts
} from '@/lib/affiliate-studio-campaign-program-adapter';
import {
  getProgramCoverageSummary,
  getProgramCalendarEvents
} from '@/lib/affiliate-studio-planner-adapter';

export const dynamic = 'force-dynamic';

export const GET = withAffiliateStudioAccess('read', async (request, context, user) => {
  const params = await context.params;
  const brandId = params?.id;
  const programId = params?.programId;

  const program = await getCampaignProgram(user, brandId, programId);
  if (!program) {
    return NextResponse.json({ success: false, error: 'Campaign program not found or unauthorized' }, { status: 404 });
  }

  // Include bound products
  const products = await listCampaignProgramProducts(user, brandId, programId);
  program.products = products;

  // Include coverage and calendar projection
  const coverage = await getProgramCoverageSummary(user, brandId, programId);
  const calendar = await getProgramCalendarEvents(user, brandId, programId);
  program.coverage = coverage;
  program.calendar = calendar;

  return NextResponse.json({ success: true, data: program });
});

export const PUT = withAffiliateStudioAccess('write', async (request, context, user) => {
  const params = await context.params;
  const brandId = params?.id;
  const programId = params?.programId;

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
  }

  const ok = await updateCampaignProgram(user, brandId, programId, body);
  if (!ok) {
    return NextResponse.json({ success: false, error: 'Failed to update campaign program' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: { success: true } });
});

export const DELETE = withAffiliateStudioAccess('write', async (request, context, user) => {
  const params = await context.params;
  const brandId = params?.id;
  const programId = params?.programId;

  const ok = await archiveCampaignProgram(user, brandId, programId);
  if (!ok) {
    return NextResponse.json({ success: false, error: 'Failed to archive campaign program' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: { success: true } });
});
