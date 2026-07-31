import { NextResponse } from 'next/server';
import { getSheetsCampaigns, createSheetsCampaign, deleteSheetsCampaign, getSetting } from '@/lib/db';
import { getAuthorizedClient } from '@/lib/google-auth';
import { google } from 'googleapis';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (id) {
      const { getSheetsCampaign, getSheetsJobs } = await import('@/lib/db');
      const campaign = await getSheetsCampaign(id);
      if (!campaign) {
        return NextResponse.json({ success: false, error: 'Kampanye tidak ditemukan.' }, { status: 404 });
      }
      const jobs = await getSheetsJobs(id);
      return NextResponse.json({ success: true, data: { campaign, jobs } });
    }

    const campaigns = await getSheetsCampaigns();
    const isSchedulerActive = await getSetting('sheets_autopilot_scheduler_active') !== 'false';
    return NextResponse.json({ success: true, data: campaigns, isSchedulerActive });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      campaign_name, campaign_type, spreadsheet_id, gdrive_folder_id,
      aspect_ratio, target_language, target_ai, video_model, visual_mode,
      words_per_clip, face_visibility, custom_instruction, brand_profile_id,
      visual_overrides_json, is_bridging_active, target_clips_count, bridge_at_clip,
      bridge_duration_clips, bridging_mode, target_product_id, promotion_style,
      enable_tts, enable_glabs, enable_ffmpeg, enable_social_post, voice_provider,
      voice_persona, voice_speed, voice_volume, ffmpeg_sync_option, ffmpeg_video_scale,
      ffmpeg_sfx_volume, ffmpeg_bgm_volume, tts_model_quality, visual_style
    } = body;

    // 1. Basic validation
    if (!campaign_name || !campaign_type || !spreadsheet_id) {
      return NextResponse.json({ success: false, error: 'Nama kampanye, tipe kampanye, dan Spreadsheet ID wajib diisi.' }, { status: 400 });
    }

    if (!['RE', 'OPC', 'IFC'].includes(campaign_type)) {
      return NextResponse.json({ success: false, error: 'Tipe kampanye tidak valid. Harus RE, OPC, atau IFC.' }, { status: 400 });
    }

    // 2. Validate Google Sheet accessibility
    try {
      const auth = getAuthorizedClient();
      const sheets = google.sheets({ version: 'v4', auth });
      // Try fetching sheet metadata to verify accessibility
      await sheets.spreadsheets.get({ spreadsheetId: spreadsheet_id, fields: 'spreadsheetId' });
    } catch (sheetError) {
      console.error('[Autopilot Setup] Google Sheets verification failed:', sheetError.message);
      return NextResponse.json({
        success: false,
        error: `Gagal mengakses Google Spreadsheet. Pastikan ID benar dan akun Google sudah terhubung. Detail: ${sheetError.message}`
      }, { status: 400 });
    }

    // 3. Save to database
    const campaignId = generateCampaignId('sheets');
    const newCampaign = {
      id: campaignId,
      campaign_name,
      campaign_type,
      target_language: target_language || 'id-ID',
      spreadsheet_id,
      gdrive_folder_id: gdrive_folder_id || null,
      aspect_ratio: aspect_ratio || '9:16',
      target_ai: target_ai || 'Google Veo (8s)',
      video_model: video_model || 'veo_31_lite',
      visual_mode: visual_mode || 'hybrid_lock',
      words_per_clip: words_per_clip || '17-19 kata',
      face_visibility: face_visibility || 'Faceless',
      custom_instruction: custom_instruction || '',
      brand_profile_id: brand_profile_id || null,
      visual_overrides_json: visual_overrides_json || null,
      is_bridging_active: is_bridging_active ? 1 : 0,
      target_clips_count: target_clips_count || 4,
      bridge_at_clip: bridge_at_clip || 2,
      bridge_duration_clips: bridge_duration_clips || 1,
      bridging_mode: bridging_mode || 'select_existing',
      target_product_id: target_product_id || null,
      promotion_style: promotion_style || 'Softselling',
      enable_tts: enable_tts ? 1 : 0,
      enable_glabs: enable_glabs ? 1 : 0,
      enable_ffmpeg: enable_ffmpeg ? 1 : 0,
      enable_social_post: enable_social_post ? 1 : 0,
      voice_provider: voice_provider || 'minimax',
      voice_persona: voice_persona || 'Professional Anchor',
      voice_speed: voice_speed ? parseFloat(voice_speed) : 1.0,
      voice_volume: voice_volume ? parseFloat(voice_volume) : 1.0,
      ffmpeg_sync_option: ffmpeg_sync_option || 'smart_sync',
      ffmpeg_video_scale: ffmpeg_video_scale ? parseFloat(ffmpeg_video_scale) : 1.0,
      ffmpeg_sfx_volume: ffmpeg_sfx_volume ? parseFloat(ffmpeg_sfx_volume) : 0.0,
      ffmpeg_bgm_volume: ffmpeg_bgm_volume ? parseFloat(ffmpeg_bgm_volume) : 0.15,
      tts_model_quality: tts_model_quality || 'speech-2.8-turbo',
      visual_style: visual_style || 'Cinematic',
      narrative_mode: body.narrative_mode || 'Storytelling',
      status: body.status || 'active'
    };

    await createSheetsCampaign(newCampaign);

    return NextResponse.json({ success: true, message: 'Kampanye autopilot berhasil disimpan.', data: newCampaign });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID kampanye wajib disertakan.' }, { status: 400 });
    }
    await deleteSheetsCampaign(id);
    return NextResponse.json({ success: true, message: 'Kampanye autopilot berhasil dihapus.' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, status, schedulerStatus } = body;

    const { updateSheetsCampaignStatus, setSetting } = await import('@/lib/db');

    if (schedulerStatus !== undefined) {
      await setSetting('sheets_autopilot_scheduler_active', schedulerStatus ? 'true' : 'false');
      return NextResponse.json({ success: true, message: `Status skeduler berhasil diubah menjadi ${schedulerStatus ? 'Active' : 'Inactive'}.` });
    }

    if (!id || !status) {
      return NextResponse.json({ success: false, error: 'ID kampanye dan status wajib disertakan.' }, { status: 400 });
    }

    if (!['active', 'paused', 'draft'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Status tidak valid. Harus "active", "paused", atau "draft".' }, { status: 400 });
    }

    await updateSheetsCampaignStatus(id, status);
    return NextResponse.json({ success: true, message: `Status kampanye berhasil diubah menjadi ${status}.` });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
