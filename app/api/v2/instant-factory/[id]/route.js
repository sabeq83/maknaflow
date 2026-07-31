import { NextResponse } from 'next/server';
import { getInstantCampaign, listInstantCampaignItems, getDb, updateInstantCampaign, deleteInstantCampaign } from '@/lib/db';
import path from 'path';

export async function GET(request, { params }) {
  try {
    // Auto-start campaign scheduler if stopped (HMR recovery)
    const { startCampaignScheduler } = await import('@/lib/campaign-scheduler.js');
    startCampaignScheduler();

    const { id } = await params;
    const campaign = await getInstantCampaign(id);
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

    const db = getDb();
    const items = await listInstantCampaignItems(id);

    for (const item of items) {
      if (item.tts_status === 'completed' && item.tts_batch_id) {
        item.tts_clips = await db.prepare('SELECT * FROM tts_studio_clips WHERE batch_id = ? ORDER BY clip_index ASC').all(item.tts_batch_id);
      } else {
        item.tts_clips = [];
      }

      // Load G-Labs tasks for the item
      item.glabs_tasks = await db.prepare('SELECT * FROM glabs_tasks WHERE campaign_id = ? AND item_id = ? ORDER BY clip_index ASC').all(id, item.id);
    }

    const stats = await db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN generation_status = 'completed' THEN 1 ELSE 0 END) as generated,
        SUM(CASE WHEN generation_status = 'failed' THEN 1 ELSE 0 END) as generate_failed,
        SUM(CASE WHEN tts_status = 'completed' THEN 1 ELSE 0 END) as tts_completed,
        SUM(CASE WHEN visual_status = 'completed' THEN 1 ELSE 0 END) as visual_completed
      FROM instant_campaign_items WHERE campaign_id = ?
    `).get(id);

    return NextResponse.json({ campaign, items, stats });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const updates = {};
    if (body.status !== undefined && ['running', 'paused', 'completed', 'draft'].includes(body.status)) {
      updates.status = body.status;
    }
    if (body.local_scheduler !== undefined) {
      updates.local_scheduler = body.local_scheduler ? 1 : 0;
    }
    if (body.scheduler_pause_at !== undefined) {
      updates.scheduler_pause_at = body.scheduler_pause_at || null;
    }
    if (body.enable_glabs !== undefined) {
      updates.enable_glabs = body.enable_glabs ? 1 : 0;
    }
    if (body.enable_tts !== undefined) {
      updates.enable_tts = body.enable_tts ? 1 : 0;
    }
    if (body.enable_ffmpeg !== undefined) {
      updates.enable_ffmpeg = body.enable_ffmpeg ? 1 : 0;
    }
    if (body.enable_social_post !== undefined) {
      updates.enable_social_post = body.enable_social_post ? 1 : 0;
    }
    if (body.is_bridging_active !== undefined) {
      updates.is_bridging_active = body.is_bridging_active ? 1 : 0;
    }
    if (body.bridge_at_clip !== undefined) {
      updates.bridge_at_clip = parseInt(body.bridge_at_clip, 10) || 2;
    }
    if (body.visual_mode !== undefined) {
      updates.visual_mode = body.visual_mode || 'hybrid_lock';
    }
    if (body.post_youtube_draft !== undefined) {
      updates.post_youtube_draft = body.post_youtube_draft ? 1 : 0;
    }
    if (body.post_tiktok_draft !== undefined) {
      updates.post_tiktok_draft = body.post_tiktok_draft ? 1 : 0;
    }
    if (body.post_facebook_draft !== undefined) {
      updates.post_facebook_draft = body.post_facebook_draft ? 1 : 0;
    }
    
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid update fields' }, { status: 400 });
    }
    
    const campaign = await getInstantCampaign(id);
    await updateInstantCampaign(id, updates);
    
    try {
      const campaignName = campaign ? campaign.product_name : id;
      const changeSummary = Object.entries(updates)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      const { writeLogToFile } = await import('@/lib/console-hook');
      const logFile = path.join(process.cwd(), 'public', 'instant_factory_logs.txt');
      writeLogToFile(logFile, `Campaign "${campaignName}" updated: [${changeSummary}]`);
    } catch (logErr) {
      // Fail silently
    }
    
    return NextResponse.json({ success: true, updates });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    await deleteInstantCampaign(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
