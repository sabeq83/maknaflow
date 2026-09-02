import { NextResponse } from 'next/server';
import { handleCallback, verifyOAuthState, normalizeAllowedReturnPath } from '@/lib/google-auth';

export async function GET(request) {
  const host = request.headers.get('host') || 'localhost:3000';
  const proto = request.headers.get('x-forwarded-proto') || 'http';
  const origin = `${proto}://${host}`;

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const stateStr = searchParams.get('state');

  const parsedState = verifyOAuthState(stateStr);
  const returnTo = normalizeAllowedReturnPath(parsedState?.returnTo);
  const sep = returnTo.includes('?') ? '&' : '?';

  try {
    if (error) {
      return NextResponse.redirect(
        `${origin}${returnTo}${sep}google_error=${encodeURIComponent(error)}`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${origin}${returnTo}${sep}google_error=${encodeURIComponent('No authorization code received')}`
      );
    }

    const redirectUri = `${origin}/api/google/callback`;
    const result = await handleCallback(code, redirectUri);

    return NextResponse.redirect(
      `${origin}${returnTo}${sep}google_connected=true&google_email=${encodeURIComponent(result.email || '')}`
    );
  } catch (err) {
    console.error('Google callback error:', err);
    return NextResponse.redirect(
      `${origin}${returnTo}${sep}google_error=${encodeURIComponent(err.message)}`
    );
  }
}

