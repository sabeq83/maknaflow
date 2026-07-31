import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    
    // 1. Ambil kampanye RE cloud dan item-itemnya
    const reCampaigns = await db.prepare(`
      SELECT c.id, c.campaign_name, c.status as campaign_status, c.created_at,
             i.source_url, i.scrape_status, i.analyze_status, i.tts_status, 
             i.visual_status, i.ffmpeg_status, i.drive_link, i.social_post_status, i.retry_count
      FROM re_campaigns c
      LEFT JOIN re_campaign_items i ON i.campaign_id = c.id
      WHERE c.id LIKE 'cloud_%'
      ORDER BY c.created_at DESC
    `).all();

    // 2. Ambil kampanye OPC cloud dan item-itemnya
    const opcCampaigns = await db.prepare(`
      SELECT c.id, c.campaign_name, c.status as campaign_status, c.created_at,
             i.row_creative_payload, i.generation_status, i.tts_status, 
             i.visual_status, i.ffmpeg_status, i.drive_link, i.social_post_status, i.retry_count
      FROM pillar_campaigns c
      LEFT JOIN pillar_campaign_items i ON i.campaign_id = c.id
      WHERE c.id LIKE 'cloud_%'
      ORDER BY c.created_at DESC
    `).all();

    // Petakan ke objek job yang terpadu
    const jobs = [
      ...reCampaigns.map(c => ({
        id: c.id.replace('cloud_', ''),
        type: 'RE',
        campaign_name: c.campaign_name,
        target_url: c.source_url || '',
        status: c.campaign_status,
        retry_count: c.retry_count || 0,
        drive_link: c.drive_link || '',
        steps: {
          scrape: c.scrape_status || 'pending',
          analyze: c.analyze_status || 'pending',
          tts: c.tts_status || 'pending',
          visual: c.visual_status || 'pending',
          ffmpeg: c.ffmpeg_status || 'pending',
        },
        created_at: c.created_at
      })),
      ...opcCampaigns.map(c => {
        let targetUrl = '';
        if (c.row_creative_payload) {
          try {
            const p = JSON.parse(c.row_creative_payload);
            targetUrl = p.source_product_url || '';
          } catch(e){}
        }
        return {
          id: c.id.replace('cloud_', ''),
          type: 'OPC',
          campaign_name: c.campaign_name,
          target_url: targetUrl,
          status: c.campaign_status,
          retry_count: c.retry_count || 0,
          drive_link: c.drive_link || '',
          steps: {
            generate: c.generation_status || 'pending',
            tts: c.tts_status || 'pending',
            visual: c.visual_status || 'pending',
            ffmpeg: c.ffmpeg_status || 'pending',
          },
          created_at: c.created_at
        };
      })
    ];

    // Urutkan berdasarkan tanggal dibuat desc
    jobs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return NextResponse.json({
      success: true,
      jobs
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
