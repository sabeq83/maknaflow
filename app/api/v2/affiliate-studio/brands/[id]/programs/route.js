import { NextResponse } from 'next/server';
import { withAffiliateStudioAccess } from '@/lib/affiliate-studio-access';
import {
  listCampaignPrograms,
  createCampaignProgram
} from '@/lib/affiliate-studio-campaign-program-adapter';

export const dynamic = 'force-dynamic';

export const GET = withAffiliateStudioAccess('read', async (request, context, user) => {
  const params = await context.params;
  const brandId = params?.id;
  
  const searchParams = new URL(request.url).searchParams;
  const status = searchParams.get('status') || 'active';

  const data = await listCampaignPrograms(user, brandId, { status });
  return NextResponse.json({ success: true, data });
});

export const POST = withAffiliateStudioAccess('write', async (request, context, user) => {
  const params = await context.params;
  const brandId = params?.id;

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
  }

  const programId = await createCampaignProgram(user, brandId, body);
  if (!programId) {
    return NextResponse.json({ success: false, error: 'Failed to create campaign program or unauthorized' }, { status: 403 });
  }

  return NextResponse.json({ success: true, data: { id: programId } });
});
