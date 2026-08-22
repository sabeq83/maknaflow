import { NextResponse } from 'next/server';
import { withAffiliateStudioAccess } from '@/lib/affiliate-studio-access';
import { buildAffiliateStudioCapabilities } from '@/lib/affiliate-studio-contract';
import { listAffiliateConnectorDescriptors } from '@/lib/affiliate-studio-connector-registry';

export const dynamic = 'force-dynamic';

export const GET = withAffiliateStudioAccess('read', async () =>
  NextResponse.json({
    success: true,
    data: buildAffiliateStudioCapabilities(listAffiliateConnectorDescriptors())
  })
);
