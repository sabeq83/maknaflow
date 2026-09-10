import { NextResponse } from 'next/server';
import { getAuthUrl, signOAuthState, normalizeAllowedReturnPath } from '@/lib/google-auth';
import { getCurrentUser } from '@/lib/auth';
import { tenantContext } from '@/lib/tenant-context';

export async function GET(request) {
  const host = request.headers.get('host') || 'localhost:3000';
  const proto = request.headers.get('x-forwarded-proto') || 'http';
  const origin = `${proto}://${host}`;

  const searchParams = request.nextUrl.searchParams;
  const returnTo = normalizeAllowedReturnPath(searchParams.get('returnTo'));
  const user = getCurrentUser(request);
  const tenantId = user?.tenantId || 'default_tenant';

  try {
    const redirectUri = `${origin}/api/google/callback`;
    const state = signOAuthState({
      tenantId,
      returnTo,
      exp: Date.now() + 15 * 60 * 1000 // 15 menit
    });
    const url = await tenantContext.run(tenantId, () => getAuthUrl(redirectUri, state));
    return NextResponse.redirect(url);
  } catch (error) {
    const sep = returnTo.includes('?') ? '&' : '?';
    return NextResponse.redirect(
      `${origin}${returnTo}${sep}google_error=${encodeURIComponent(error.message)}`
    );
  }
}

