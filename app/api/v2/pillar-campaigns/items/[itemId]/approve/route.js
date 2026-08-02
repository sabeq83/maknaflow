import { NextResponse } from 'next/server';
import { approvePillarCampaignItem } from '@/lib/pillar-campaign-approval';

export async function POST(request, { params }) {
  try {
    const { itemId } = await params;
    const result = await approvePillarCampaignItem(itemId, await request.json());
    return NextResponse.json({
      success: true,
      ...result,
      message: result.onlySaved
        ? 'Storyboard draft berhasil disimpan!'
        : 'Pillar campaign item approved and queued for production.'
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status || 500 });
  }
}
