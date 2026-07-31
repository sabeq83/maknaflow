import { NextResponse } from 'next/server';
import { getCompletedTtsBatches } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const batches = await getCompletedTtsBatches();
    return NextResponse.json({
      success: true,
      data: batches
    });
  } catch (error) {
    console.error('Error fetching completed TTS batches:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
