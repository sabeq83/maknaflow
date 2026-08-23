import { NextResponse } from 'next/server';
import { withAffiliateStudioAccess } from '@/lib/affiliate-studio-access';
import { listAuthorizedAffiliateBrands } from '@/lib/affiliate-studio-brand-read-adapter';

export const dynamic = 'force-dynamic';

export const GET = withAffiliateStudioAccess('read', async (_request, _context, user) =>
  NextResponse.json({ success: true, data: await listAuthorizedAffiliateBrands(user) })
);
