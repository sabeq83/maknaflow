import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/google-auth';

export async function GET(request) {
  try {
    const host = request.headers.get('host') || 'localhost:3000';
    const proto = request.headers.get('x-forwarded-proto') || 'http';
    const origin = `${proto}://${host}`;
    const redirectUri = `${origin}/api/google/callback`;
    const url = getAuthUrl(redirectUri);
    return NextResponse.redirect(url);
  } catch (error) {
    const host = request.headers.get('host') || 'localhost:3000';
    const proto = request.headers.get('x-forwarded-proto') || 'http';
    const origin = `${proto}://${host}`;
    return NextResponse.redirect(
      `${origin}/settings?error=${encodeURIComponent(error.message)}`
    );
  }
}
