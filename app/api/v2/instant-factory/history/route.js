import { NextResponse } from 'next/server';
import { getAllInstantCampaigns } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const campaigns = await getAllInstantCampaigns();
    return NextResponse.json({ success: true, data: campaigns });
  } catch (error) {
    console.error('Instant Factory History Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
