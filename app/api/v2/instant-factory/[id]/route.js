import { NextResponse } from 'next/server';
import { getInstantCampaign, listInstantCampaignItems, getDb, updateInstantCampaign, deleteInstantCampaign } from '@/lib/db';
import path from 'path';
import { withTenantContext } from '@/lib/auth';

export const GET = withTenantContext(async (request, { params }, user) => {
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
});

export const PATCH = withTenantContext(async (request, { params }, user) => {
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
    if (body.post_facebook_draft !== undefined) {
      updates.post_facebook_draft = body.post_facebook_draft ? 1 : 0;
    }
    if (body.facebook_page_id !== undefined) {
      updates.facebook_page_id = body.facebook_page_id || null;
    }
    if (body.nextcloud_parent_folder !== undefined) {
      updates.nextcloud_parent_folder = body.nextcloud_parent_folder ? body.nextcloud_parent_folder.trim() : 'MAKNA_Production_Final';
    }
    if (body.fb_draft_mode !== undefined) {
      updates.fb_draft_mode = body.fb_draft_mode || 'auto';
    }
    if (body.voice_provider !== undefined) {
      updates.voice_provider = body.voice_provider;
    }
    if (body.voice_persona !== undefined) {
      updates.voice_persona = body.voice_persona;
    }
    if (body.voice_speed !== undefined) {
      updates.voice_speed = Number(body.voice_speed);
    }
    if (body.voice_volume !== undefined) {
      updates.voice_volume = Number(body.voice_volume);
    }
    if (body.enable_audio_segment !== undefined) {
      updates.enable_audio_segment = body.enable_audio_segment ? 1 : 0;
    }
    if (body.voice_cast_json !== undefined) {
      updates.voice_cast_json = body.voice_cast_json || null;
    }
    
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid update fields' }, { status: 400 });
    }
    
    const campaign = await getInstantCampaign(id);
    await updateInstantCampaign(id, updates);
    
    try {
      const campaignName = campaign ? campaign.campaign_name : id;
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
});

export const DELETE = withTenantContext(async (request, { params }, user) => {
  try {
    const { id } = await params;
    await deleteInstantCampaign(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
