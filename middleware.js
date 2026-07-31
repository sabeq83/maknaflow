import { NextResponse } from 'next/server';

export function middleware(req) {
  const { pathname } = req.nextUrl;

  // Allow public static assets and auth API endpoints
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/api/auth/logout') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/public') ||
    pathname.startsWith('/uploads/')
  ) {
    return NextResponse.next();
  }

  // Check for session cookie
  const cookieName = process.env.SESSION_COOKIE_NAME || 'makna_session';
  const sessionToken = req.cookies.get(cookieName)?.value;

  if (!sessionToken) {
    // If API request, return 401 Unauthorized
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ success: false, error: 'Unauthenticated. Silakan login terlebih dahulu.' }, { status: 401 });
    }
    // Redirect to login page for browser navigation
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
