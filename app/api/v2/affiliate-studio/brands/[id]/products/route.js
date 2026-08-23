import { NextResponse } from 'next/server';
import { withAffiliateStudioAccess } from '@/lib/affiliate-studio-access';
import { listAffiliateBrandProductPortfolio } from '@/lib/affiliate-studio-brand-product-read-adapter';

export const dynamic = 'force-dynamic';

export const GET = withAffiliateStudioAccess('read', async (request, context, user) => {
  const params = await context.params;
  const id = params?.id;
  
  const searchParams = new URL(request.url).searchParams;
  const filters = Object.fromEntries(searchParams.entries());

  const data = await listAffiliateBrandProductPortfolio({ user, brandId: id, filters });
  if (!data) return NextResponse.json(
    { success: false, error: 'Brand Profile not found' },
    { status: 404 }
  );

  return NextResponse.json({ success: true, data });
});
