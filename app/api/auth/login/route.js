import { NextResponse } from 'next/server';
import { loginUser } from '@/lib/auth';

export async function POST(req) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'Username dan password wajib diisi' }, { status: 400 });
    }

    const result = await loginUser(username, password);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 401 });
    }

    const response = NextResponse.json({
      success: true,
      user: result.user,
      message: 'Login berhasil'
    });

    // Set HTTP-Only Session Cookie
    response.cookies.set({
      name: process.env.SESSION_COOKIE_NAME || 'makna_session',
      value: result.token,
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      expires: new Date(result.expiresAt)
    });

    return response;
  } catch (error) {
    console.error('[API Auth Login Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
