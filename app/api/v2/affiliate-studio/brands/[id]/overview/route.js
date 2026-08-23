import { NextResponse } from 'next/server';
import { withAffiliateStudioAccess } from '@/lib/affiliate-studio-access';
import { getAffiliateBrandOverview } from '@/lib/affiliate-studio-brand-read-adapter';

export const dynamic = 'force-dynamic';

export const GET = withAffiliateStudioAccess('read', async (_request, context, user) => {
  const params = await context.params;
  const id = params?.id;
  const data = await getAffiliateBrandOverview({ user, brandId: id });
  if (!data) return NextResponse.json(
    { success: false, error: 'Brand Profile not found' },
    { status: 404 }
  );
  return NextResponse.json({ success: true, data });
});
