import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { syncCampaignItemToContentFlow } from '@/lib/strategic-campaign-engine';

export async function POST(request, { params }) {
  try {
    const { itemId } = await params;
    const db = getDb();

    const item = await db.prepare('SELECT * FROM strategic_campaign_items WHERE id = ?').get(itemId);
    if (!item) {
      return NextResponse.json({ success: false, error: 'Item kampanye tidak ditemukan.' }, { status: 404 });
    }

    const campaign = await db.prepare('SELECT * FROM strategic_campaigns WHERE id = ?').get(item.campaign_id);
    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Kampanye induk tidak ditemukan.' }, { status: 404 });
    }

    const assetUrl = item.drive_link || item.video_url || '';
    await syncCampaignItemToContentFlow(campaign, item, assetUrl);

    return NextResponse.json({
      success: true,
      message: `Item #${itemId} berhasil disinkronkan ke Content Flow!`,
      item_id: itemId,
      asset_url: assetUrl
    });
  } catch (error) {
    console.error('[API Strategic Item Sync ContentFlow Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
