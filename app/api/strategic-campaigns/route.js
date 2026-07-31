import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { createStrategicCampaign } from '@/lib/strategic-campaign-engine';

export async function GET(request) {
  try {
    const db = getDb();
    const campaigns = await db.prepare(`
      SELECT c.*, COUNT(i.id) as item_count
      FROM strategic_campaigns c
      LEFT JOIN strategic_campaign_items i ON c.id = i.campaign_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `).all();

    return NextResponse.json({ success: true, campaigns });
  } catch (error) {
    console.error('[API /strategic-campaigns GET Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const result = await createStrategicCampaign(body);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[API /strategic-campaigns POST Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
