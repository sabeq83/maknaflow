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
