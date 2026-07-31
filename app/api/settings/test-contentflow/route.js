import { NextResponse } from 'next/server';
import { testContentFlowConnection } from '@/lib/contentflow-client';

export async function POST(request) {
  try {
    const { contentflow_api_key, contentflow_api_url } = await request.json().catch(() => ({}));
    const result = await testContentFlowConnection(contentflow_api_key, contentflow_api_url);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, message: result.message, details: result.details });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
