import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { 
  createPillarCampaignBundle,
  listPillarCampaigns,
  getDb,
  getSetting
} from '../../../../lib/db';
import { generateCampaignId } from '../../../../lib/id-generator';
import { withTenantContext } from '../../../../lib/auth';

function extractSpreadsheetId(input) {
  if (!input) return null;
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : input.trim();
}

export const GET = withTenantContext(async (request, _context, user) => {
  try {
    // Auto-start campaign scheduler if stopped (HMR recovery)
    const { startCampaignScheduler } = await import('../../../../lib/campaign-scheduler.js');
    startCampaignScheduler();

    const campaigns = await listPillarCampaigns();
    const db = getDb();
    const withStats = await Promise.all(campaigns.map(async c => {
      const stats = await db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN generation_status = 'completed' THEN 1 ELSE 0 END) as generated,
          SUM(CASE WHEN generation_status = 'failed' THEN 1 ELSE 0 END) as generate_failed,
          SUM(CASE WHEN tts_status = 'completed' THEN 1 ELSE 0 END) as tts_completed,
          SUM(CASE WHEN visual_status = 'completed' THEN 1 ELSE 0 END) as visual_completed
        FROM pillar_campaign_items WHERE campaign_id = ?
      `).get(c.id);
      return { ...c, stats };
    }));
    
    const isSchedulerActive = await getSetting('opc_campaigns_scheduler_active') !== 'false';
    return NextResponse.json({ campaigns: withStats, isSchedulerActive });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});

export const POST = withTenantContext(async (request, _context, user) => {
  try {
    const contentType = request.headers.get('content-type') || '';
    let parsedBody = {};
    let productRefImagePath = null;
    let productFilenameDeclare = null;

    const id = generateCampaignId('opc');

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      parsedBody = {
        campaign_name: formData.get('campaign_name'),
        account_name: formData.get('account_name') || null,
        status: formData.get('status') || 'running',
        content_pillar: formData.get('content_pillar'),
        custom_hook: formData.get('custom_hook'),
        visual_action_guideline: formData.get('visual_action_guideline'),
        custom_instruction: formData.get('custom_instruction') || '',
        brand_profile_id: formData.get('brand_profile_id') || null,
        narrative_mode: formData.get('narrative_mode') || 'Storytelling',
        visual_style: formData.get('visual_style') || 'Cinematic',
        face_visibility: formData.get('face_visibility') || 'Faceless',
        is_bridging_active: Number(formData.get('is_bridging_active') || 0),
        target_clips_count: Number(formData.get('target_clips_count') || 4),
        bridge_at_clip: Number(formData.get('bridge_at_clip') || 2),
        bridge_duration_clips: Number(formData.get('bridge_duration_clips') !== null ? formData.get('bridge_duration_clips') : 1),
        bridging_mode: formData.get('bridging_mode') || 'select_existing',
        target_product_id: formData.get('target_product_id') || null,
        ephemeral_product_data: formData.get('ephemeral_product_data') || null,
        aspect_ratio: formData.get('aspect_ratio') || '9:16',
        target_ai: formData.get('target_ai') || 'Google Veo (8s)',
        video_model: formData.get('video_model') || 'veo_31_lite',
        visual_mode: formData.get('visual_mode') || 'hybrid_lock',
        product_filename_declare: formData.get('product_filename_declare') || null,
        visual_overrides_json: formData.get('visual_overrides_json') || null,
        enable_tts: Number(formData.get('enable_tts') || 0),
        enable_glabs: Number(formData.get('enable_glabs') || 0),
        enable_ffmpeg: Number(formData.get('enable_ffmpeg') || 0),
        enable_social_post: Number(formData.get('enable_social_post') || 0),
        post_facebook_draft: Number(formData.get('post_facebook_draft') || 0),
        facebook_page_id: formData.get('facebook_page_id') || null,
        facebook_server_url: formData.get('facebook_server_url') || null,
        upload_markdown: Number(formData.get('upload_markdown') || 0),
        upload_spreadsheet: Number(formData.get('upload_spreadsheet') || 0),
        voice_provider: formData.get('voice_provider') || 'minimax',
        voice_persona: formData.get('voice_persona') || 'Indonesian_casual_reporter_vv2',
        words_per_clip: formData.get('words_per_clip') || '17-19 kata',
        tts_model_quality: formData.get('tts_model_quality') || 'speech-2.8-turbo',
        voice_speed: Number(formData.get('voice_speed') || 1.0),
        voice_volume: Number(formData.get('voice_volume') || 1.0),
        target_language: formData.get('target_language') || 'id-ID',
        ffmpeg_sync_option: formData.get('ffmpeg_sync_option') || 'smart_sync',
        ffmpeg_video_scale: formData.get('ffmpeg_video_scale') !== null ? Number(formData.get('ffmpeg_video_scale')) : 1.0,
        ffmpeg_sfx_volume: formData.get('ffmpeg_sfx_volume') !== null ? Number(formData.get('ffmpeg_sfx_volume')) : 0.0,
        ffmpeg_music_volume: formData.get('ffmpeg_music_volume') !== null ? Number(formData.get('ffmpeg_music_volume')) : 0.4,
        ffmpeg_subtitles_mode: formData.get('ffmpeg_subtitles_mode') || 'dynamic',
        font_name: formData.get('font_name') || 'Arial Black',
        font_color: formData.get('font_color') || '&H00FFFFFF',
        font_size: formData.get('font_size') !== null ? Number(formData.get('font_size')) : 24,
        voiceover_type: formData.get('voiceover_type') || 'normal',
        compliance_check_enabled: Number(formData.get('compliance_check_enabled') || 0),
        target_audience: formData.get('target_audience') || 'General',
        brand_editorial_guide: formData.get('brand_editorial_guide') || '',
        sfx_setting: formData.get('sfx_setting') || 'without_sfx',
        enable_vo_audit: Number(formData.get('enable_vo_audit') || 0),
        enable_audio_segment: Number(formData.get('enable_audio_segment') || 0),
        target_demographic: formData.get('target_demographic') || null,
        target_demographic_custom: formData.get('target_demographic_custom') || null,
        ai_directive: formData.get('ai_directive') || null,
        mandatory_outro_line: formData.get('mandatory_outro_line') || null
      };

      const file = formData.get('product_ref_image');
      if (file && typeof file === 'object' && file.name) {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'products');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const ext = path.extname(file.name) || '.jpg';
        const filename = `${id}${ext}`;
        const finalPath = path.join(uploadsDir, filename);
        fs.writeFileSync(finalPath, buffer);
        productRefImagePath = `/uploads/products/${filename}`;
        productFilenameDeclare = file.name;
      }
    } else {
      parsedBody = await request.json();
      parsedBody.is_bridging_active = parsedBody.is_bridging_active ? 1 : 0;
      parsedBody.bridge_duration_clips = parsedBody.bridge_duration_clips !== undefined ? Number(parsedBody.bridge_duration_clips) : 1;
      parsedBody.enable_tts = parsedBody.enable_tts ? 1 : 0;
      parsedBody.enable_glabs = parsedBody.enable_glabs ? 1 : 0;
      parsedBody.enable_ffmpeg = parsedBody.enable_ffmpeg ? 1 : 0;
      parsedBody.enable_social_post = parsedBody.enable_social_post ? 1 : 0;
      parsedBody.upload_markdown = parsedBody.upload_markdown ? 1 : 0;
      parsedBody.upload_spreadsheet = parsedBody.upload_spreadsheet ? 1 : 0;
      parsedBody.tts_model_quality = parsedBody.tts_model_quality || 'speech-2.8-turbo';
      parsedBody.voice_speed = parsedBody.voice_speed !== undefined ? Number(parsedBody.voice_speed) : 1.0;
      parsedBody.voice_volume = parsedBody.voice_volume !== undefined ? Number(parsedBody.voice_volume) : 1.0;
      parsedBody.target_language = parsedBody.target_language || 'id-ID';
      parsedBody.ffmpeg_sync_option = parsedBody.ffmpeg_sync_option || 'smart_sync';
      parsedBody.ffmpeg_video_scale = parsedBody.ffmpeg_video_scale !== undefined ? Number(parsedBody.ffmpeg_video_scale) : 1.0;
      parsedBody.ffmpeg_sfx_volume = parsedBody.ffmpeg_sfx_volume !== undefined ? Number(parsedBody.ffmpeg_sfx_volume) : 0.0;
      parsedBody.ffmpeg_bgm_volume = parsedBody.ffmpeg_bgm_volume !== undefined ? Number(parsedBody.ffmpeg_bgm_volume) : 0.15;
      productFilenameDeclare = parsedBody.product_filename_declare || null;
      productRefImagePath = parsedBody.product_ref_image_path || null;
      parsedBody.nextcloud_parent_folder = parsedBody.nextcloud_parent_folder || '/MAKNA_Assets';
      parsedBody.fb_draft_mode = parsedBody.fb_draft_mode || 'auto';
      parsedBody.target_spreadsheet_id = parsedBody.target_spreadsheet_id || null;
      parsedBody.sfx_setting = parsedBody.sfx_setting || 'without_sfx';
      parsedBody.enable_vo_audit = parsedBody.enable_vo_audit !== undefined ? Number(parsedBody.enable_vo_audit) : 0;
      parsedBody.enable_audio_segment = parsedBody.enable_audio_segment !== undefined ? Number(parsedBody.enable_audio_segment) : 0;
      parsedBody.ai_directive = parsedBody.ai_directive || null;
      parsedBody.mandatory_outro_line = parsedBody.mandatory_outro_line || null;
    }

    if (parsedBody.visual_overrides_json) {
      try {
        const vso = JSON.parse(parsedBody.visual_overrides_json);
        if (vso && vso.subject_demographic && !vso.subject_demographic.startsWith('mascot_universe_')) {
          vso.visual_style_preset = null;
          parsedBody.visual_overrides_json = JSON.stringify(vso);
        }
      } catch (e) {}
    }

    const {
      campaign_name,
      status,
      content_pillar,
      custom_hook,
      visual_action_guideline,
      custom_instruction,
      brand_profile_id,
      narrative_mode,
      visual_style,
      face_visibility,
      is_bridging_active,
      target_clips_count,
      bridge_at_clip,
      bridge_duration_clips,
      bridging_mode,
      target_product_id,
      ephemeral_product_data,
      aspect_ratio,
      target_ai,
      video_model,
      visual_mode,
      visual_overrides_json,
      enable_tts,
      enable_glabs,
      enable_ffmpeg,
      enable_social_post,
      post_facebook_draft,
      facebook_page_id,
      facebook_server_url,
      upload_markdown,
      upload_spreadsheet,
      voice_provider,
      voice_persona,
      words_per_clip,
      tts_model_quality,
      voice_speed,
      voice_volume,
      target_language,
      ffmpeg_sync_option,
      ffmpeg_video_scale,
      ffmpeg_sfx_volume,
      ffmpeg_bgm_volume,
      nextcloud_parent_folder,
      fb_draft_mode,
      target_spreadsheet_id,
      sfx_setting,
      enable_vo_audit,
      enable_audio_segment,
      target_demographic,
      target_demographic_custom,
      ai_directive,
      mandatory_outro_line
    } = parsedBody;

    if (!campaign_name?.trim()) {
      return NextResponse.json({ error: 'campaign_name is required' }, { status: 400 });
    }
    if (!content_pillar?.trim()) {
      return NextResponse.json({ error: 'content_pillar is required' }, { status: 400 });
    }
    if (!custom_hook?.trim()) {
      return NextResponse.json({ error: 'custom_hook is required' }, { status: 400 });
    }
    if (!visual_action_guideline?.trim()) {
      return NextResponse.json({ error: 'visual_action_guideline is required' }, { status: 400 });
    }

    let accountName = parsedBody.account_name || null;
    if (brand_profile_id) {
      const brand = await getDb().prepare('SELECT id, brand_name FROM brand_profiles WHERE id = ?').get(brand_profile_id);
      if (!brand) return NextResponse.json({ error: 'Brand Account tidak ditemukan pada tenant aktif' }, { status: 400 });
      accountName = brand.brand_name || accountName;
    }

    const campaignData = {
      id,
      campaign_name: campaign_name.trim(),
      account_name: accountName,
      status: status || 'running',
      content_pillar: content_pillar.trim(),
      custom_hook: custom_hook.trim(),
      visual_action_guideline: visual_action_guideline.trim(),
      custom_instruction: custom_instruction || '',
      brand_profile_id: brand_profile_id || null,
      narrative_mode: narrative_mode || 'Storytelling',
      visual_style: visual_style || 'Cinematic',
      face_visibility: face_visibility || 'Faceless',
      is_bridging_active: is_bridging_active ? 1 : 0,
      target_clips_count: target_clips_count || 4,
      bridge_at_clip: bridge_at_clip || 2,
      bridge_duration_clips: bridge_duration_clips !== undefined ? Number(bridge_duration_clips) : 1,
      bridging_mode: bridging_mode || 'select_existing',
      target_product_id: target_product_id || null,
      ephemeral_product_data: ephemeral_product_data || null,
      aspect_ratio: aspect_ratio || '9:16',
      target_ai: target_ai || 'Google Veo (8s)',
      video_model: video_model || 'veo_31_lite',
      visual_mode: visual_mode || 'hybrid_lock',
      product_ref_image_path: productRefImagePath,
      product_filename_declare: productFilenameDeclare,
      visual_overrides_json: visual_overrides_json || null,
      enable_tts: enable_tts !== undefined ? Number(enable_tts) : 0,
      enable_glabs: enable_glabs !== undefined ? Number(enable_glabs) : 0,
      enable_ffmpeg: enable_ffmpeg !== undefined ? Number(enable_ffmpeg) : 0,
      enable_social_post: enable_social_post !== undefined ? Number(enable_social_post) : 0,
      post_facebook_draft: post_facebook_draft !== undefined ? Number(post_facebook_draft) : 0,
      facebook_page_id: facebook_page_id || null,
      facebook_server_url: facebook_server_url || null,
      upload_markdown: upload_markdown !== undefined ? Number(upload_markdown) : 0,
      upload_spreadsheet: upload_spreadsheet !== undefined ? Number(upload_spreadsheet) : 0,
      target_spreadsheet_id: extractSpreadsheetId(target_spreadsheet_id),
      target_markdown_url: null,
      voice_provider: voice_provider || 'minimax',
      voice_persona: voice_persona || 'Indonesian_casual_reporter_vv2',
      words_per_clip: words_per_clip || '17-19 kata',
      tts_model_quality: tts_model_quality || 'speech-2.8-turbo',
      voice_speed: voice_speed !== undefined ? Number(voice_speed) : 1.0,
      voice_volume: voice_volume !== undefined ? Number(voice_volume) : 1.0,
      target_language: target_language || 'id-ID',
      local_scheduler: parsedBody.local_scheduler !== undefined ? (parsedBody.local_scheduler ? 1 : 0) : 1,
      scheduler_pause_at: parsedBody.scheduler_pause_at || null,
      ffmpeg_sync_option: ffmpeg_sync_option || 'smart_sync',
      ffmpeg_video_scale: ffmpeg_video_scale !== undefined ? Number(ffmpeg_video_scale) : 1.0,
      ffmpeg_sfx_volume: ffmpeg_sfx_volume !== undefined ? Number(ffmpeg_sfx_volume) : 0.0,
      ffmpeg_bgm_volume: ffmpeg_bgm_volume !== undefined ? Number(ffmpeg_bgm_volume) : 0.15,
      nextcloud_parent_folder: nextcloud_parent_folder || 'MAKNA_Production_Final',
      fb_draft_mode: fb_draft_mode || 'auto',
      sfx_setting: sfx_setting || 'without_sfx',
      enable_vo_audit: enable_vo_audit || 0,
      enable_audio_segment: enable_audio_segment || 0,
      target_demographic: target_demographic || null,
      target_demographic_custom: target_demographic_custom || null,
      ai_directive: ai_directive || null,
      mandatory_outro_line: mandatory_outro_line || null
    };

    await createPillarCampaignBundle({
      campaign: campaignData,
      items: [{ campaign_id: id }]
    });

    return NextResponse.json({ campaign: { id, campaign_name, status: campaignData.status }, expected_items: 1, created_items: 1 }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
