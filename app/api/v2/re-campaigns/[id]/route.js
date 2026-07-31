import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getReCampaign, listReCampaignItems, getReCampaignStats, getDb } from '../../../../../lib/db';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const campaign = await getReCampaign(id);
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

    const items = await listReCampaignItems(id);
    const db = getDb();
    for (const item of items) {
      if (item.tts_status === 'completed' && item.tts_batch_id) {
        item.tts_clips = await db.prepare('SELECT * FROM tts_studio_clips WHERE batch_id = ? ORDER BY clip_index ASC').all(item.tts_batch_id);
      } else {
        item.tts_clips = [];
      }

      // Load G-Labs tasks for the item
      item.glabs_tasks = await db.prepare('SELECT * FROM glabs_tasks WHERE campaign_id = ? AND item_id = ? ORDER BY clip_index ASC').all(id, item.id);

      // Load angle variants
      item.angle_variants = await db.prepare('SELECT * FROM re_item_angle_variants WHERE re_item_id = ? ORDER BY created_at ASC').all(item.id);
      for (const variant of item.angle_variants) {
        if (variant.tts_status === 'completed' && variant.tts_batch_id) {
          variant.tts_clips = await db.prepare('SELECT * FROM tts_studio_clips WHERE batch_id = ? ORDER BY clip_index ASC').all(variant.tts_batch_id);
        } else {
          variant.tts_clips = [];
        }

        // Load G-Labs tasks for the variant
        let variantTaskIds = [];
        try {
          if (variant.glabs_task_ids) {
            variantTaskIds = JSON.parse(variant.glabs_task_ids);
          }
        } catch {}
        if (variantTaskIds.length > 0) {
          const placeholders = variantTaskIds.map(() => '?').join(',');
          variant.glabs_tasks = await db.prepare(`SELECT * FROM glabs_tasks WHERE task_id IN (${placeholders})`).all(...variantTaskIds);
        } else {
          variant.glabs_tasks = [];
        }

        // Check if start frame files exist for hybrid lock clips
        const clips = JSON.parse(variant.visual_tasks_json || '[]');
        variant.t2i_start_frame_paths = {};
        clips.forEach((clip, idx) => {
          const cNum = idx + 1;
          const filename = `start_frame_variant_${variant.id}_clip_${cNum}.png`;
          const localPath = path.join(process.cwd(), 'public', 'uploads', 'start_frames', filename);
          if (fs.existsSync(localPath)) {
            variant.t2i_start_frame_paths[cNum] = `/uploads/start_frames/${filename}`;
          }
        });
      }
    }

    const stats = await getReCampaignStats(id);
    const { getSetting } = await import('../../../../../lib/db');
    const storageProvider = await getSetting('storage_provider') || 'gdrive';
    const nextcloudUrl = await getSetting('nextcloud_url') || '';

    return NextResponse.json({ 
      campaign, 
      items, 
      stats, 
      storage_provider: storageProvider, 
      nextcloud_url: nextcloudUrl 
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { updateReCampaign } = await import('../../../../../lib/db');
    
    const updates = {};
    if (body.status !== undefined && ['running', 'paused', 'completed', 'draft'].includes(body.status)) {
      updates.status = body.status;
    }
    if (body.local_scheduler !== undefined) {
      updates.local_scheduler = body.local_scheduler ? 1 : 0;
    }
    if (body.scheduler_pause_at !== undefined) {
      // null atau string kosong = hapus pause point (autopilot penuh)
      const validPauseValues = ['tts', 'visuals', 'ffmpeg', 'social'];
      const val = body.scheduler_pause_at;
      updates.scheduler_pause_at = (val && validPauseValues.includes(val)) ? val : null;
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
    if (body.post_youtube_draft !== undefined) {
      updates.post_youtube_draft = body.post_youtube_draft ? 1 : 0;
    }
    if (body.post_tiktok_draft !== undefined) {
      updates.post_tiktok_draft = body.post_tiktok_draft ? 1 : 0;
    }
    if (body.post_facebook_draft !== undefined) {
      updates.post_facebook_draft = body.post_facebook_draft ? 1 : 0;
    }
    if (body.facebook_page_id !== undefined) {
      updates.facebook_page_id = body.facebook_page_id || null;
    }
    if (body.facebook_server_url !== undefined) {
      updates.facebook_server_url = body.facebook_server_url || null;
    }
    if (body.bridge_duration_clips !== undefined) {
      updates.bridge_duration_clips = Number(body.bridge_duration_clips);
    }
    if (body.narrative_mode !== undefined) {
      updates.narrative_mode = body.narrative_mode;
    }
    
    // TTS options updates
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
    if (body.tts_model_quality !== undefined) {
      updates.tts_model_quality = body.tts_model_quality;
    }

    // FFmpeg options updates
    if (body.ffmpeg_sync_option !== undefined) {
      updates.ffmpeg_sync_option = body.ffmpeg_sync_option;
    }
    if (body.ffmpeg_video_scale !== undefined) {
      updates.ffmpeg_video_scale = Number(body.ffmpeg_video_scale);
    }
    if (body.ffmpeg_sfx_volume !== undefined) {
      updates.ffmpeg_sfx_volume = Number(body.ffmpeg_sfx_volume);
    }
    if (body.ffmpeg_bgm_volume !== undefined) {
      updates.ffmpeg_bgm_volume = Number(body.ffmpeg_bgm_volume);
    }
    if (body.nextcloud_parent_folder !== undefined) {
      updates.nextcloud_parent_folder = body.nextcloud_parent_folder ? body.nextcloud_parent_folder.trim() : 'MAKNA_Production_Final';
    }
    if (body.fb_draft_mode !== undefined) {
      updates.fb_draft_mode = body.fb_draft_mode || 'auto';
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
    
    const campaign = await getReCampaign(id);
    await updateReCampaign(id, updates);
    
    try {
      const campaignName = campaign ? campaign.product_name : id;
      const changeSummary = Object.entries(updates)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      const { writeLogToFile } = await import('../../../../../lib/console-hook');
      const logFile = path.join(process.cwd(), 'public', 're_campaign_logs.txt');
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
    const { deleteReCampaign } = await import('../../../../../lib/db');
    await deleteReCampaign(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
