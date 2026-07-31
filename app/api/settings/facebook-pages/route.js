import { NextResponse } from 'next/server';
import { getConnectedFacebookPages } from '@/lib/facebook-helper';

export async function GET() {
  try {
    const result = await getConnectedFacebookPages();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
