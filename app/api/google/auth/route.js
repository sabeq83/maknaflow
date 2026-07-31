import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/google-auth';

export async function GET(request) {
  try {
    const { origin } = new URL(request.url);
    const redirectUri = `${origin}/api/google/callback`;
    const url = getAuthUrl(redirectUri);
    return NextResponse.redirect(url);
  } catch (error) {
    const { origin } = new URL(request.url || 'http://localhost:3000');
    return NextResponse.redirect(
      `${origin}/settings?error=${encodeURIComponent(error.message)}`
    );
  }
}
