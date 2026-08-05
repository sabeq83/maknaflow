import { NextResponse } from 'next/server';
import { testGeminiConnection } from '@/lib/gemini';
import { getSetting } from '@/lib/db';
import { withTenantContext } from '@/lib/auth';

export const POST = withTenantContext(async (request) => {
  try {
    const { api_key, use_stored } = await request.json();

    let keyToTest = api_key;
    if (use_stored) {
      keyToTest = await getSetting('gemini_api_key');
    }

    if (!keyToTest) {
      return NextResponse.json({ success: false, error: 'API Key is required' }, { status: 400 });
    }

    const result = await testGeminiConnection(keyToTest);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
