import { NextResponse } from 'next/server';
import { syncStrategicCampaignItemAssets } from '@/lib/scheduler-processors';

export async function POST(request, { params }) {
  try {
    const { itemId } = params;
    if (!itemId) {
      return NextResponse.json({ success: false, error: 'Missing itemId parameter' }, { status: 400 });
    }

    const result = await syncStrategicCampaignItemAssets(itemId);
    return NextResponse.json(result);
  } catch (error) {
    console.error(`[API /v2/strategic-campaigns/items/${params?.itemId}/sync-assets POST Error]`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to sync item assets' },
      { status: 500 }
    );
  }
}
