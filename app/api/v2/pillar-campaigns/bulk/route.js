import { NextResponse } from 'next/server';
import { createPillarCampaignBundle, getDb } from '@/lib/db';
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

    const campaignId = generateCampaignId('opc');
    const db = getDb();
    let accountName = global_settings.account_name || null;
    if (global_settings.brand_profile_id) {
      const brand = await db.prepare('SELECT id, brand_name FROM brand_profiles WHERE id = ?').get(global_settings.brand_profile_id);
      if (!brand) return NextResponse.json({ error: 'Brand Account tidak ditemukan pada tenant aktif' }, { status: 400 });
      accountName = brand.brand_name || accountName;
    }

    // 1. Create the global campaign row
    const campaignData = {
      id: campaignId,
      campaign_name: campaign_name.trim(),
      account_name: accountName,
      status: global_settings.status || 'running',
      content_pillar: 'Mass Production Content Pillar', // Placeholder for global table, actual values are row-specific
      custom_hook: 'Mass Production Hook',
      visual_action_guideline: 'Mass Production Visual Action',
      custom_instruction: global_settings.custom_instruction || '',
      brand_profile_id: global_settings.brand_profile_id || null,
      target_demographic: global_settings.target_demographic || null,
      target_demographic_custom: global_settings.target_demographic_custom || null,
      narrative_mode: global_settings.narrative_mode || 'Storytelling',
      visual_style: global_settings.visual_style || 'Cinematic',
      face_visibility: global_settings.face_visibility || 'Faceless',
      is_bridging_active: global_settings.is_bridging_active ? 1 : 0,
      target_clips_count: global_settings.target_clips_count || 4,
      bridge_at_clip: global_settings.bridge_at_clip || 2,
      bridge_duration_clips: global_settings.bridge_duration_clips !== undefined ? Number(global_settings.bridge_duration_clips) : 1,
      bridging_mode: global_settings.bridging_mode || 'select_existing',
      target_product_id: null,
      ephemeral_product_data: null,
      aspect_ratio: global_settings.aspect_ratio || '9:16',
      target_ai: global_settings.target_ai || 'Google Veo (8s)',
      video_model: global_settings.video_model || 'veo_31_lite',
      visual_mode: global_settings.visual_mode || 'hybrid_lock',
      product_ref_image_path: null,
      product_filename_declare: null,
      visual_overrides_json: global_settings.visual_overrides_json || null,
      enable_tts: global_settings.enable_tts ? 1 : 0,
      enable_glabs: global_settings.enable_glabs ? 1 : 0,
      enable_ffmpeg: global_settings.enable_ffmpeg ? 1 : 0,
      enable_social_post: global_settings.enable_social_post ? 1 : 0,
      upload_markdown: global_settings.upload_markdown !== undefined ? (global_settings.upload_markdown ? 1 : 0) : 1,
      upload_spreadsheet: global_settings.upload_spreadsheet !== undefined ? (global_settings.upload_spreadsheet ? 1 : 0) : 1,
      target_spreadsheet_id: extractSpreadsheetId(global_settings.target_spreadsheet_id),
      voice_provider: global_settings.voice_provider || 'minimax',
      voice_persona: global_settings.voice_persona || 'Indonesian_casual_reporter_vv2',
      words_per_clip: global_settings.words_per_clip || '17-19 kata',
      tts_model_quality: global_settings.tts_model_quality || 'speech-2.8-turbo',
      voice_speed: global_settings.voice_speed !== undefined ? Number(global_settings.voice_speed) : 1.0,
      voice_volume: global_settings.voice_volume !== undefined ? Number(global_settings.voice_volume) : 1.0,
      target_language: global_settings.target_language || 'id-ID',
      local_scheduler: global_settings.local_scheduler !== undefined ? (global_settings.local_scheduler ? 1 : 0) : 1,
      scheduler_pause_at: global_settings.scheduler_pause_at || null,
      is_mass_production: 1,
      ffmpeg_sync_option: global_settings.ffmpeg_sync_option || 'smart_sync',
      ffmpeg_video_scale: global_settings.ffmpeg_video_scale !== undefined ? Number(global_settings.ffmpeg_video_scale) : 1.0,
      ffmpeg_sfx_volume: global_settings.ffmpeg_sfx_volume !== undefined ? Number(global_settings.ffmpeg_sfx_volume) : 0.0,
      ffmpeg_bgm_volume: global_settings.ffmpeg_bgm_volume !== undefined ? Number(global_settings.ffmpeg_bgm_volume) : 0.15,
      nextcloud_parent_folder: global_settings.nextcloud_parent_folder || 'MAKNA_Production_Final',
      fb_draft_mode: global_settings.fb_draft_mode || 'auto',
      enable_vo_audit: global_settings.enable_vo_audit !== undefined ? Number(global_settings.enable_vo_audit) : 0,
      enable_audio_segment: global_settings.enable_audio_segment ? 1 : 0,
      voice_cast_json: global_settings.voice_cast_json || null
    };

    const items = rows_data.map((row, i) => {
        // Determine JIT status: if it has a product URL (or direct image URL) but no product reference image -> pending_sourcing
        const hasUrl = (row.source_product_url && row.source_product_url.trim() !== '') || (row.product_image_url && row.product_image_url.trim() !== '');
        const hasImage = row.product_ref_image_path && row.product_ref_image_path.trim() !== '';
        const generation_status = (hasUrl && !hasImage) ? 'pending_sourcing' : 'pending';

        const payload = {
          row_number: i + 1,
          content_pillar: row.content_pillar || '',
          custom_hook: row.custom_hook || '',
          visual_action_guideline: row.visual_action_guideline || '',
          source_product_url: row.source_product_url || '',
          product_image_url: row.product_image_url || '',
          product_name: row.product_name || '',
          product_desc: row.product_desc || '',
          product_usp: row.product_usp || '',
          product_ref_image_path: row.product_ref_image_path || null,
          product_filename_declare: row.product_filename_declare || null,
          custom_instruction: row.custom_instruction || ''
        };

        return {
          campaign_id: campaignId,
          row_creative_payload: JSON.stringify(payload),
          generation_status
        };
    });

    await createPillarCampaignBundle({ campaign: campaignData, items });

    return NextResponse.json({
      success: true,
      campaign_id: campaignId,
      total_items: rows_data.length,
      expected_items: rows_data.length,
      created_items: items.length
    }, { status: 201 });

  } catch (err) {
    console.error('[Bulk OPC Ingestion] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
