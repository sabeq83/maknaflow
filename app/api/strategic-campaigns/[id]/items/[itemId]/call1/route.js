import { NextResponse } from 'next/server';
import { executeCall1CreativeEngine } from '@/lib/strategic-campaign-engine';

export async function POST(request, { params }) {
  try {
    const { itemId } = await params;
    const result = await executeCall1CreativeEngine(itemId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[API Call 1 Creative Engine Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
