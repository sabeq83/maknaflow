import { NextResponse } from 'next/server';
import { getConnectedFacebookPages } from '@/lib/facebook-helper';
import { withTenantContext } from '@/lib/auth';

export const GET = withTenantContext(async () => {
  try {
    const result = await getConnectedFacebookPages();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const POST = withTenantContext(async (request) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { token, manualPageIds } = body;
    const result = await getConnectedFacebookPages(token || undefined, manualPageIds || undefined);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
