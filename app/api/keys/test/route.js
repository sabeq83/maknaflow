import { NextResponse } from 'next/server';
import { testGeminiConnection } from '@/lib/gemini';

export async function POST(request) {
  try {
    const { api_key } = await request.json();
    if (!api_key) {
      return NextResponse.json({ success: false, error: 'api_key wajib diisi' }, { status: 400 });
    }
    const result = await testGeminiConnection(api_key);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
