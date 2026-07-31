import { NextResponse } from 'next/server';
import { createPillarCampaign, createPillarCampaignItem, getDb } from '@/lib/db';
import { generateCampaignId } from '@/lib/id-generator';
import { startCampaignScheduler } from '@/lib/campaign-scheduler';

function extractSpreadsheetId(input) {
  if (!input) return null;
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : input.trim();
}

function autoDetectNarrativeMode(row) {
  if (row.narrative_mode && row.narrative_mode !== 'Storytelling' && row.narrative_mode !== 'auto') {
    return row.narrative_mode;
  }
  const textToScan = `${row.pillar || ''} ${row.category_cep || ''} ${row.vfo || ''} ${row.strategic_angle || ''}`.toLowerCase();
  
  if (
    textToScan.includes('edukasi') ||
    textToScan.includes('tips') ||
    textToScan.includes('tutorial') ||
    textToScan.includes('review') ||
    textToScan.includes('pengetahuan')
  ) {
    return 'Educational Review';
  }
  if (
    textToScan.includes('promo') ||
    textToScan.includes('diskon') ||
    textToScan.includes('hard sell') ||
    textToScan.includes('hardsell') ||
    textToScan.includes('beli') ||
    textToScan.includes('penawaran')
  ) {
    return 'Promo Hard Sell';
  }
  return 'Storytelling';
}

export async function POST(request) {
  try {
    const {
      planner_id,
      selected_row_ids = [],
      campaign_name,
      global_settings = {}
    } = await request.json();

    if (!planner_id) {
      return NextResponse.json({ success: false, error: 'planner_id wajib diisi' }, { status: 400 });
    }

    const db = getDb();

    // 1. Fetch content planner master
    const planner = await db.prepare('SELECT * FROM content_planners WHERE id = ?').get(planner_id);
    if (!planner) {
      return NextResponse.json({ success: false, error: 'Content Planner tidak ditemukan' }, { status: 404 });
    }

    // 2. Fetch rows
    let rows = [];
    if (Array.isArray(selected_row_ids) && selected_row_ids.length > 0) {
      const placeholders = selected_row_ids.map(() => '?').join(',');
      rows = await db.prepare(`SELECT * FROM content_planner_rows WHERE planner_id = ? AND id IN (${placeholders}) ORDER BY sequence ASC`).all(planner_id, ...selected_row_ids);
    } else {
      rows = await db.prepare('SELECT * FROM content_planner_rows WHERE planner_id = ? ORDER BY sequence ASC').all(planner_id);
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Tidak ada baris strategi konten yang dapat di-ingest' }, { status: 400 });
    }

    const campaignId = generateCampaignId('opc');
    const finalCampaignName = campaign_name?.trim() || `[OPC Planner] ${planner.title || planner.product_name}`;

    let refImage = global_settings.product_ref_image_path || planner.product_ref_image || planner.product_photo_url || null;
    let targetProdId = global_settings.target_product_id || planner.target_product_id || null;

    // MANDATE: Auto-lock Studio Clean Photo from product_extractions DB
    try {
      let prodMatch = null;
      if (targetProdId) {
        prodMatch = await db.prepare("SELECT * FROM product_extractions WHERE id = ?").get(targetProdId);
      } else if (planner.product_name) {
        // Coba cari nama produk penuh/ketat terlebih dahulu demi mencegah salah pilih produk berprefix nama sama
        prodMatch = await db.prepare("SELECT * FROM product_extractions WHERE LOWER(product_name) = LOWER(?) LIMIT 1").get(planner.product_name);
        
        // Jika tidak ditemukan kecocokan ketat, gunakan fallback pencarian kata pertama (parsial)
        if (!prodMatch) {
          const queryTerm = planner.product_name.split(' ')[0] || planner.product_name;
          prodMatch = await db.prepare("SELECT * FROM product_extractions WHERE product_name LIKE ? ORDER BY id DESC LIMIT 1").get(`%${queryTerm}%`);
        }
      }
      if (prodMatch) {
        if (!targetProdId) targetProdId = prodMatch.id;
        const studioPhoto = prodMatch.clean_photo_url || prodMatch.cleaned_photo_url || prodMatch.raw_photo_url;
        if (studioPhoto) refImage = studioPhoto;
      }
    } catch (_) {}

    const campaignStatus = global_settings.status || 'running';

    // 3. Create global pillar campaign row
    await createPillarCampaign({
      id: campaignId,
      campaign_name: finalCampaignName,
      status: campaignStatus,
      content_pillar: rows[0]?.pillar || 'Planner Content Pillar',
      custom_hook: rows[0]?.hook || 'Planner Hook',
      visual_action_guideline: rows[0]?.visual_action || 'Planner Visual Action',
      custom_instruction: global_settings.custom_instruction || planner.product_description || '',
      brand_profile_id: global_settings.brand_profile_id || planner.brand_id || null,
      narrative_mode: global_settings.narrative_mode || 'auto',
      visual_style: global_settings.visual_style || 'Cinematic',
      face_visibility: global_settings.face_visibility || 'Faceless',
      is_bridging_active: global_settings.is_bridging_active !== undefined ? (global_settings.is_bridging_active ? 1 : 0) : 1,
      target_clips_count: global_settings.target_clips_count ? Number(global_settings.target_clips_count) : 4,
      bridge_at_clip: global_settings.bridge_at_clip ? Number(global_settings.bridge_at_clip) : 2,
      bridge_duration_clips: global_settings.bridge_duration_clips !== undefined ? Number(global_settings.bridge_duration_clips) : 1,
      bridging_mode: global_settings.bridging_mode || 'manual_input',
      target_product_id: null,
      ephemeral_product_data: planner.product_description || null,
      aspect_ratio: global_settings.aspect_ratio || '9:16',
      target_ai: global_settings.target_ai || 'Google Veo (8s)',
      video_model: global_settings.video_model || 'veo_31_lite',
      visual_mode: global_settings.visual_mode || 'hybrid_lock',
      product_ref_image_path: refImage,
      product_filename_declare: global_settings.product_filename_declare || null,
      visual_overrides_json: global_settings.visual_overrides_json || null,
      enable_tts: global_settings.enable_tts !== undefined ? (global_settings.enable_tts ? 1 : 0) : 1,
      enable_glabs: global_settings.enable_glabs ? 1 : 0,
      enable_ffmpeg: global_settings.enable_ffmpeg !== undefined ? (global_settings.enable_ffmpeg ? 1 : 0) : 1,
      enable_social_post: global_settings.enable_social_post !== undefined ? (global_settings.enable_social_post ? 1 : 0) : 0,
      upload_markdown: global_settings.upload_markdown !== undefined ? (global_settings.upload_markdown ? 1 : 0) : 1,
      upload_spreadsheet: global_settings.upload_spreadsheet !== undefined ? (global_settings.upload_spreadsheet ? 1 : 0) : 1,
      target_spreadsheet_id: extractSpreadsheetId(global_settings.target_spreadsheet_id || planner.google_sheet_id),
      voice_provider: global_settings.voice_provider || 'minimax',
      voice_persona: global_settings.voice_persona || 'Indonesian_casual_reporter_vv2',
      words_per_clip: global_settings.words_per_clip || '20-22 kata',
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
      nextcloud_parent_folder: global_settings.nextcloud_parent_folder || '/MAKNA_Assets',
      fb_draft_mode: global_settings.fb_draft_mode || 'auto',
      sfx_setting: global_settings.sfx_setting || 'without_sfx',
      enable_vo_audit: global_settings.enable_vo_audit !== undefined ? Number(global_settings.enable_vo_audit) : 0,
      enable_audio_segment: global_settings.enable_audio_segment ? 1 : 0,
      voice_cast_json: global_settings.voice_cast_json || null
    });

    // 4. Insert items into pillar_campaign_items using transaction
    await db.transaction(async () => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        
        const hasUrl = Boolean(planner.product_url && planner.product_url.trim() !== '');
        const hasImage = Boolean(refImage && refImage.trim() !== '');
        const generationStatus = (hasUrl && !hasImage) ? 'pending_sourcing' : 'pending';

        let rowNarrative = global_settings.narrative_mode;
        if (!rowNarrative || rowNarrative === 'auto') {
          rowNarrative = autoDetectNarrativeMode(row);
        }

        const payload = {
          row_number: i + 1,
          content_pillar: row.pillar || '',
          custom_hook: row.hook || '',
          visual_action_guideline: row.visual_action || '',
          source_product_url: planner.product_url || '',
          product_image_url: planner.product_photo_url || '',
          product_name: row.product || planner.product_name || '',
          product_desc: planner.product_description || '',
          product_usp: planner.product_usp || '',
          product_ref_image_path: refImage,
          visual_mode: global_settings.visual_mode || 'hybrid_lock',
          generation_status: generationStatus,
          narrative_mode: rowNarrative
        };

        await createPillarCampaignItem({
          campaign_id: campaignId,
          row_creative_payload: JSON.stringify(payload),
          generation_status: generationStatus
        });
      }
    })();

    // 5. Trigger campaign scheduler if status is not draft
    if (campaignStatus !== 'draft') {
      try {
        startCampaignScheduler();
      } catch (schedErr) {
        console.warn('[Ingest Planner to OPC] Failed to auto-start scheduler:', schedErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      campaign_id: campaignId,
      campaign_name: finalCampaignName,
      ingested_count: rows.length,
      status: campaignStatus
    });

  } catch (error) {
    console.error('[API /api/v2/pillar-campaigns/ingest-planner POST Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
