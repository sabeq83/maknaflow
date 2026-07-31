import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { ALL_MENU_KEYS } from '@/lib/schema/user-schema';

export async function GET(req) {
  try {
    const user = getCurrentUser(req);

    if (!user) {
      // Fallback: If no user session, return guest/default admin view if single-user mode, or unauthenticated status
      return NextResponse.json({
        authenticated: false,
        user: null
      });
    }

    return NextResponse.json({
      authenticated: true,
      user,
      allAvailableMenus: ALL_MENU_KEYS
    });
  } catch (error) {
    console.error('[API Auth Me Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
