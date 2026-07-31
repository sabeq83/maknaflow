import { NextResponse } from 'next/server';
import { handleCallback } from '@/lib/google-auth';

export async function GET(request) {
  try {
    const { origin, searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        `${origin}/settings?google_error=${encodeURIComponent(error)}`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${origin}/settings?google_error=${encodeURIComponent('No authorization code received')}`
      );
    }

    const redirectUri = `${origin}/api/google/callback`;
    const result = await handleCallback(code, redirectUri);

    return NextResponse.redirect(
      `${origin}/settings?google_connected=true&google_email=${encodeURIComponent(result.email || '')}`
    );
  } catch (error) {
    const { origin } = new URL(request.url || 'http://localhost:3000');
    console.error('Google callback error:', error);
    return NextResponse.redirect(
      `${origin}/settings?google_error=${encodeURIComponent(error.message)}`
    );
  }
}
