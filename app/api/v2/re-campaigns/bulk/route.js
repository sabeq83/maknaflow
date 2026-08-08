import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createReCampaign, addReCampaignItems, getDb } from '@/lib/db';
import { generateCampaignId } from '@/lib/id-generator';

function extractSpreadsheetId(input) {
  if (!input) return null;
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : input.trim();
}

import { withTenantContext } from '@/lib/auth';

export const POST = withTenantContext(async (request) => {
  try {
    const { campaign_name, global_settings, rows_data } = await request.json();

    if (!campaign_name?.trim()) {
      return NextResponse.json({ error: 'campaign_name is required' }, { status: 400 });
    }
    if (!rows_data || !Array.isArray(rows_data) || rows_data.length === 0) {
      return NextResponse.json({ error: 'rows_data must be a non-empty array' }, { status: 400 });
    }

    const campaignId = generateCampaignId('re');

    // 1. Create the global campaign row
    await createReCampaign({
      id: campaignId,
      campaign_name: campaign_name.trim(),
      execution_mode: global_settings.execution_mode || 'manual_review',
      status: global_settings.status || 'running',
      aspect_ratio: global_settings.aspect_ratio || '9:16',
      target_ai: global_settings.target_ai || 'Google Veo (8s)',
      custom_instruction: global_settings.custom_instruction || '',
      brand_profile_id: global_settings.brand_profile_id || null,
      is_bridging_active: global_settings.is_bridging_active ? 1 : 0,
      target_clips_count: global_settings.target_clips_count || 5,
      bridge_at_clip: global_settings.bridge_at_clip || 3,
      bridge_duration_clips: global_settings.bridge_duration_clips !== undefined ? Number(global_settings.bridge_duration_clips) : 0,
      bridging_mode: global_settings.bridging_mode || 'select_existing',
      target_product_id: null,
      ephemeral_product_data: null,
      promotion_style: global_settings.promotion_style || 'Softselling',
      narrative_mode: global_settings.narrative_mode || 'Storytelling',
      post_youtube_draft: global_settings.post_youtube_draft ? 1 : 0,
      post_tiktok_draft: global_settings.post_tiktok_draft ? 1 : 0,
      post_facebook_draft: global_settings.post_facebook_draft ? 1 : 0,
      facebook_page_id: global_settings.facebook_page_id || null,
      facebook_server_url: global_settings.facebook_server_url || null,
      voice_provider: global_settings.voice_provider || 'gemini',
      voice_persona: global_settings.voice_persona || 'Kore',
      voice_speed: global_settings.voice_speed !== undefined ? Number(global_settings.voice_speed) : 1.0,
      voice_volume: global_settings.voice_volume !== undefined ? Number(global_settings.voice_volume) : 1.0,
      ffmpeg_sync_option: global_settings.ffmpeg_sync_option || 'smart_sync',
      ffmpeg_video_scale: global_settings.ffmpeg_video_scale !== undefined ? Number(global_settings.ffmpeg_video_scale) : 1.0,
      ffmpeg_sfx_volume: global_settings.ffmpeg_sfx_volume !== undefined ? Number(global_settings.ffmpeg_sfx_volume) : 0.0,
      ffmpeg_bgm_volume: global_settings.ffmpeg_bgm_volume !== undefined ? Number(global_settings.ffmpeg_bgm_volume) : 0.15,
      video_model: global_settings.video_model || 'veo_31_lite',
      words_per_clip: global_settings.words_per_clip || '17-19 kata',
      face_visibility: global_settings.face_visibility || 'Faceless',
      enable_tts: global_settings.enable_tts ? 1 : 0,
      enable_glabs: global_settings.enable_glabs ? 1 : 0,
      enable_ffmpeg: global_settings.enable_ffmpeg ? 1 : 0,
      enable_social_post: global_settings.enable_social_post ? 1 : 0,
      visual_mode: global_settings.visual_mode || 'hybrid_lock',
      angle_multiplier: global_settings.angle_multiplier !== undefined ? Number(global_settings.angle_multiplier) : 0,
      visual_overrides_json: global_settings.visual_overrides_json || null,
      tts_model_quality: global_settings.tts_model_quality || 'speech-2.8-turbo',
      target_language: global_settings.target_language || 'id-ID',
      visual_style: global_settings.visual_style || 'Cinematic',
      nextcloud_parent_folder: global_settings.nextcloud_parent_folder || 'MAKNA_Production_Final',
      fb_draft_mode: global_settings.fb_draft_mode || 'auto',
      target_spreadsheet_id: extractSpreadsheetId(global_settings.target_spreadsheet_id),
      sfx_setting: global_settings.sfx_setting || 'without_sfx',
      local_scheduler: global_settings.local_scheduler !== undefined ? (global_settings.local_scheduler ? 1 : 0) : 0,
      scheduler_pause_at: global_settings.scheduler_pause_at || null,
      enable_vo_audit: global_settings.enable_vo_audit !== undefined ? Number(global_settings.enable_vo_audit) : 0,
      enable_audio_segment: global_settings.enable_audio_segment ? 1 : 0,
      voice_cast_json: global_settings.voice_cast_json || null
    });

    // 2. Map row data to database format
    const items = rows_data.map(row => ({
      source_url: row.url_source || '',
      product_url: row.link_product || null
    }));

    await addReCampaignItems(campaignId, items);

    return NextResponse.json({
      success: true,
      campaign_id: campaignId,
      total_items: rows_data.length
    }, { status: 201 });

  } catch (err) {
    console.error('[Bulk RE Ingestion] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
