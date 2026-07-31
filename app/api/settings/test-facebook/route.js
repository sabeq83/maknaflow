import { NextResponse } from 'next/server';
import { testFacebookConnection } from '@/lib/facebook-helper';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { fb_page_id, fb_page_token } = body;

    const result = await testFacebookConnection(fb_page_id || null, fb_page_token);

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil terhubung ke Facebook Page: "${result.page_name}"`,
      data: result
    });
  } catch (error) {
    console.error('[API Test Facebook Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
