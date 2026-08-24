import { NextResponse } from 'next/server';
import { withAffiliateStudioAccess } from '@/lib/affiliate-studio-access';
import { reconcileBrandRuns } from '@/lib/affiliate-studio-production-adapter';

export const dynamic = 'force-dynamic';

export const POST = withAffiliateStudioAccess('write', async (_request, context, user) => {
  const params = await context.params;
  const brandId = params?.id;
  try {
    const success = await reconcileBrandRuns(user, brandId);
    return NextResponse.json({ success });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});
