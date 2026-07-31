import { NextResponse } from 'next/server';
import { getGoogleStatus, disconnectGoogle } from '@/lib/google-auth';

export async function GET() {
  try {
    const status = getGoogleStatus();
    return NextResponse.json({ success: true, data: status });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    disconnectGoogle();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
