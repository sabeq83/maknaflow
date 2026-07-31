import { NextResponse } from 'next/server';
import { getDb, updateStrategicCampaignItem } from '@/lib/db';

export async function POST(req, { params }) {
  try {
    const resolvedParams = await params;
    const itemId = resolvedParams.itemId;
    const body = await req.json().catch(() => ({}));

    const { 
      video_dna, 
      enable_tts, 
      enable_glabs, 
      enable_ffmpeg,
      voice_provider,
      voice_persona,
      voice_speed,
      voice_volume,
      ffmpeg_video_scale,
      ffmpeg_sfx_volume,
      ffmpeg_bgm_volume,
      ffmpeg_sync_option,
      sync_mode,
      only_save
    } = body;

    if (!itemId) {
      return NextResponse.json({ success: false, error: "itemId is required" }, { status: 400 });
    }

    const db = getDb();
    const item = await db.prepare("SELECT * FROM strategic_campaign_items WHERE id = ?").get(itemId);
    if (!item) {
      return NextResponse.json({ success: false, error: "Campaign item not found" }, { status: 404 });
    }

    const campaign = await db.prepare("SELECT * FROM strategic_campaigns WHERE id = ?").get(item.campaign_id);
    if (!campaign) {
      return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
    }

    let existingWorkflow = {};
    try {
      existingWorkflow = JSON.parse(campaign.workflow_config_json || '{}');
    } catch (_) {}

    const updatedWorkflow = {
      ...existingWorkflow,
      enable_tts: enable_tts !== undefined ? !!enable_tts : existingWorkflow.enable_tts,
      enable_glabs: enable_glabs !== undefined ? !!enable_glabs : existingWorkflow.enable_glabs,
      enable_ffmpeg: enable_ffmpeg !== undefined ? !!enable_ffmpeg : existingWorkflow.enable_ffmpeg,
      voice_provider: voice_provider || existingWorkflow.voice_provider || 'minimax',
      voice_persona: voice_persona || existingWorkflow.voice_persona || 'Indonesian_professional_anchor_vv2',
      voice_speed: voice_speed !== undefined ? Number(voice_speed) : Number(existingWorkflow.voice_speed || 1.0),
      voice_volume: voice_volume !== undefined ? Number(voice_volume) : Number(existingWorkflow.voice_volume || 1.0),
      ffmpeg_video_scale: ffmpeg_video_scale !== undefined ? Number(ffmpeg_video_scale) : Number(existingWorkflow.ffmpeg_video_scale || 1.0),
      ffmpeg_sfx_volume: ffmpeg_sfx_volume !== undefined ? Number(ffmpeg_sfx_volume) : Number(existingWorkflow.ffmpeg_sfx_volume || 0.0),
      ffmpeg_bgm_volume: ffmpeg_bgm_volume !== undefined ? Number(ffmpeg_bgm_volume) : Number(existingWorkflow.ffmpeg_bgm_volume || 0.15),
      ffmpeg_sync_option: ffmpeg_sync_option || existingWorkflow.ffmpeg_sync_option || 'smart_sync',
      sync_mode: sync_mode || existingWorkflow.sync_mode || 'auto'
    };

    if (only_save) {
      await db.prepare(`
        UPDATE strategic_campaigns
        SET workflow_config_json = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(JSON.stringify(updatedWorkflow), campaign.id);

      await updateStrategicCampaignItem(itemId, {
        video_dna_json: video_dna ? JSON.stringify(video_dna) : item.video_dna_json
      });

      return NextResponse.json({
        success: true,
        message: "Draft pengaturan berhasil disimpan!"
      });
    }

    // 2. Approve and run production (Fase 2)
    await db.prepare(`
      UPDATE strategic_campaigns
      SET workflow_config_json = ?, status = 'running', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(JSON.stringify(updatedWorkflow), campaign.id);

    const isTts = updatedWorkflow.enable_tts !== false;
    const isGlabs = updatedWorkflow.enable_glabs !== false;
    const isFfmpeg = updatedWorkflow.enable_ffmpeg !== false;

    await updateStrategicCampaignItem(itemId, {
      workflow_status: 'production_processing',
      tts_status: isTts ? 'pending' : 'skipped',
      visual_status: isGlabs ? 'pending' : 'skipped',
      ffmpeg_status: isFfmpeg ? 'pending' : 'skipped',
      social_post_status: 'pending',
      video_dna_json: video_dna ? JSON.stringify(video_dna) : item.video_dna_json
    });

    return NextResponse.json({
      success: true,
      message: "Item campaign approved and queued for production (Fase 2)."
    });

  } catch (error) {
    console.error('[Strategic Approve API Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
