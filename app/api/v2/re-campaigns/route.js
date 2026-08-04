import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { createReCampaign, addReCampaignItems, listReCampaigns, getReCampaignStats, getSetting } from '../../../../lib/db';
import { generateCampaignId } from '../../../../lib/id-generator';
import { withTenantContext } from '../../../../lib/auth';

function extractSpreadsheetId(input) {
  if (!input) return null;
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : input.trim();
}

export const GET = withTenantContext(async (request, _context, user) => {
  try {
    const campaigns = await listReCampaigns();
    const withStats = await Promise.all(campaigns.map(async c => ({ ...c, stats: await getReCampaignStats(c.id) })));
    const isSchedulerActive = await getSetting('re_campaigns_scheduler_active') !== 'false';
    return NextResponse.json({ campaigns: withStats, isSchedulerActive });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});

export const POST = withTenantContext(async (request, _context, user) => {
  try {
    const contentType = request.headers.get('content-type') || '';
    let parsedBody = {};
    let urls = [];
    let productRefImagePath = null;
    let productFilenameDeclare = null;

    const id = generateCampaignId('re');

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      parsedBody = {
        campaign_name: formData.get('campaign_name'),
        status: formData.get('status') || 'running',
        aspect_ratio: formData.get('aspect_ratio'),
        target_ai: formData.get('target_ai'),
        custom_instruction: formData.get('custom_instruction'),
        brand_profile_id: formData.get('brand_profile_id') || null,
        is_bridging_active: Number(formData.get('is_bridging_active') || 0),
        target_clips_count: Number(formData.get('target_clips_count') || 5),
        bridge_at_clip: Number(formData.get('bridge_at_clip') || 2),
        bridge_duration_clips: Number(formData.get('bridge_duration_clips') || 0),
        bridging_mode: formData.get('bridging_mode'),
        target_product_id: formData.get('target_product_id') || null,
        ephemeral_product_data: formData.get('ephemeral_product_data') || null,
        promotion_style: formData.get('promotion_style'),
        narrative_mode: formData.get('narrative_mode') || 'Storytelling',
        post_youtube_draft: Number(formData.get('post_youtube_draft') || 0),
        post_tiktok_draft: Number(formData.get('post_tiktok_draft') || 0),
        post_facebook_draft: Number(formData.get('post_facebook_draft') || 0),
        voice_provider: formData.get('voice_provider'),
        voice_persona: formData.get('voice_persona'),
        voice_speed: Number(formData.get('voice_speed') || 1.0),
        voice_volume: Number(formData.get('voice_volume') || 1.0),
        ffmpeg_sync_option: formData.get('ffmpeg_sync_option'),
        ffmpeg_video_scale: Number(formData.get('ffmpeg_video_scale') || 1.0),
        ffmpeg_sfx_volume: Number(formData.get('ffmpeg_sfx_volume') || 0.0),
        ffmpeg_bgm_volume: Number(formData.get('ffmpeg_bgm_volume') || 0.15),
        video_model: formData.get('video_model'),
        words_per_clip: formData.get('words_per_clip'),
        face_visibility: formData.get('face_visibility'),
        enable_tts: Number(formData.get('enable_tts') || 0),
        enable_glabs: Number(formData.get('enable_glabs') || 0),
        enable_ffmpeg: Number(formData.get('enable_ffmpeg') || 0),
        enable_social_post: Number(formData.get('enable_social_post') || 0),
        visual_mode: formData.get('visual_mode') || 'hybrid_lock',
        product_filename_declare: formData.get('product_filename_declare') || null,
        angle_multiplier: Number(formData.get('angle_multiplier') || 0),
        visual_overrides_json: formData.get('visual_overrides_json') || null,
        tts_model_quality: formData.get('tts_model_quality') || 'speech-2.8-turbo',
        target_language: formData.get('target_language') || 'id-ID',
        visual_style: formData.get('visual_style') || 'Cinematic',
        nextcloud_parent_folder: formData.get('nextcloud_parent_folder') || 'MAKNA_Production_Final',
        target_spreadsheet_id: formData.get('target_spreadsheet_id') || null,
        sfx_setting: formData.get('sfx_setting') || 'without_sfx',
        enable_vo_audit: Number(formData.get('enable_vo_audit') || 0),
        enable_audio_segment: Number(formData.get('enable_audio_segment') || 0),
        target_demographic: formData.get('target_demographic') || null,
        target_demographic_custom: formData.get('target_demographic_custom') || null,
        ai_directive: formData.get('ai_directive') || null,
        mandatory_outro_line: formData.get('mandatory_outro_line') || null,
      };

      const urlsRaw = formData.get('urls');
      if (urlsRaw) {
        try {
          urls = JSON.parse(urlsRaw);
        } catch (e) {
          urls = [];
        }
      }

      // Handle file upload
      const file = formData.get('product_media');
      if (file && typeof file !== 'string') {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'products');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const ext = path.extname(file.name) || '.png';
        const filename = `product_ref_${id}${ext}`;
        const filePath = path.join(uploadsDir, filename);
        fs.writeFileSync(filePath, buffer);
        productRefImagePath = `/uploads/products/${filename}`;
      }
      productFilenameDeclare = parsedBody.product_filename_declare;
    } else {
      parsedBody = await request.json();
      urls = parsedBody.urls || [];
      parsedBody.is_bridging_active = parsedBody.is_bridging_active ? 1 : 0;
      parsedBody.post_youtube_draft = parsedBody.post_youtube_draft ? 1 : 0;
      parsedBody.post_tiktok_draft = parsedBody.post_tiktok_draft ? 1 : 0;
      parsedBody.post_facebook_draft = parsedBody.post_facebook_draft ? 1 : 0;
      parsedBody.enable_tts = parsedBody.enable_tts !== undefined ? Number(parsedBody.enable_tts) : 1;
      parsedBody.enable_glabs = parsedBody.enable_glabs !== undefined ? Number(parsedBody.enable_glabs) : 0;
      parsedBody.enable_ffmpeg = parsedBody.enable_ffmpeg !== undefined ? Number(parsedBody.enable_ffmpeg) : 1;
      parsedBody.enable_social_post = parsedBody.enable_social_post !== undefined ? Number(parsedBody.enable_social_post) : 1;
      parsedBody.visual_mode = parsedBody.visual_mode || 'hybrid_lock';
      productFilenameDeclare = parsedBody.product_filename_declare || null;
      parsedBody.angle_multiplier = parsedBody.angle_multiplier !== undefined ? Number(parsedBody.angle_multiplier) : 0;
      parsedBody.tts_model_quality = parsedBody.tts_model_quality || 'speech-2.8-turbo';
      parsedBody.target_language = parsedBody.target_language || 'id-ID';
      parsedBody.bridge_duration_clips = parsedBody.bridge_duration_clips !== undefined ? Number(parsedBody.bridge_duration_clips) : 0;
      parsedBody.visual_style = parsedBody.visual_style || 'Cinematic';
      parsedBody.nextcloud_parent_folder = parsedBody.nextcloud_parent_folder || 'MAKNA_Production_Final';
      parsedBody.fb_draft_mode = parsedBody.fb_draft_mode || 'auto';
      parsedBody.target_spreadsheet_id = parsedBody.target_spreadsheet_id || null;
      parsedBody.sfx_setting = parsedBody.sfx_setting || 'without_sfx';
      parsedBody.enable_vo_audit = parsedBody.enable_vo_audit !== undefined ? Number(parsedBody.enable_vo_audit) : 0;
      parsedBody.enable_audio_segment = parsedBody.enable_audio_segment !== undefined ? Number(parsedBody.enable_audio_segment) : 0;
      parsedBody.narrative_mode = parsedBody.narrative_mode || 'Storytelling';
      parsedBody.ai_directive = parsedBody.ai_directive || null;
      parsedBody.mandatory_outro_line = parsedBody.mandatory_outro_line || null;
    }

    const {
      campaign_name,
      status,
      aspect_ratio,
      target_ai,
      custom_instruction,
      brand_profile_id,
      is_bridging_active,
      target_clips_count,
      bridge_at_clip,
      bridge_duration_clips,
      bridging_mode,
      target_product_id,
      ephemeral_product_data,
      promotion_style,
      narrative_mode,
      post_youtube_draft,
      post_tiktok_draft,
      post_facebook_draft,
      facebook_page_id,
      facebook_server_url,
      voice_provider,
      voice_persona,
      voice_speed,
      voice_volume,
      ffmpeg_sync_option,
      ffmpeg_video_scale,
      ffmpeg_sfx_volume,
      ffmpeg_bgm_volume,
      video_model,
      words_per_clip,
      face_visibility,
      enable_tts,
      enable_glabs,
      enable_ffmpeg,
      enable_social_post,
      visual_mode,
      angle_multiplier,
      visual_overrides_json,
      tts_model_quality,
      target_language,
      visual_style,
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
    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'urls must be a non-empty array' }, { status: 400 });
    }

    await createReCampaign({
      id,
      campaign_name: campaign_name.trim(),
      status: status || 'running',
      aspect_ratio: aspect_ratio || '9:16',
      target_ai: target_ai || 'Google Veo (8s)',
      custom_instruction: custom_instruction || '',
      brand_profile_id: brand_profile_id || null,
      is_bridging_active: is_bridging_active ? 1 : 0,
      target_clips_count: target_clips_count || 5,
      bridge_at_clip: bridge_at_clip || 2,
      bridge_duration_clips: bridge_duration_clips !== undefined ? Number(bridge_duration_clips) : 0,
      bridging_mode: bridging_mode || 'select_existing',
      target_product_id: target_product_id || null,
      ephemeral_product_data: ephemeral_product_data || null,
      promotion_style: promotion_style || 'Softselling',
      narrative_mode: narrative_mode || 'Storytelling',
      post_youtube_draft: post_youtube_draft || 0,
      post_tiktok_draft: post_tiktok_draft || 0,
      post_facebook_draft: post_facebook_draft || 0,
      facebook_page_id: facebook_page_id || null,
      facebook_server_url: facebook_server_url || null,
      voice_provider: voice_provider || 'gemini',
      voice_persona: voice_persona || 'Kore',
      voice_speed: voice_speed !== undefined ? Number(voice_speed) : 1.0,
      voice_volume: voice_volume !== undefined ? Number(voice_volume) : 1.0,
      ffmpeg_sync_option: ffmpeg_sync_option || 'smart_sync',
      ffmpeg_video_scale: ffmpeg_video_scale !== undefined ? Number(ffmpeg_video_scale) : 1.0,
      ffmpeg_sfx_volume: ffmpeg_sfx_volume !== undefined ? Number(ffmpeg_sfx_volume) : 0.0,
      ffmpeg_bgm_volume: ffmpeg_bgm_volume !== undefined ? Number(ffmpeg_bgm_volume) : 0.15,
      video_model: video_model || 'veo_31_lite',
      words_per_clip: words_per_clip || '17-19 kata',
      tts_model_quality: tts_model_quality || 'speech-2.8-turbo',
      target_language: target_language || 'id-ID',
      face_visibility: face_visibility || 'Faceless',
      enable_tts: enable_tts !== undefined ? Number(enable_tts) : 1,
      enable_glabs: enable_glabs !== undefined ? Number(enable_glabs) : 0,
      enable_ffmpeg: enable_ffmpeg !== undefined ? Number(enable_ffmpeg) : 1,
      enable_social_post: enable_social_post !== undefined ? Number(enable_social_post) : 1,
      visual_mode: visual_mode || 'pure_t2v',
      product_ref_image_path: productRefImagePath,
      product_filename_declare: productFilenameDeclare,
      angle_multiplier: angle_multiplier !== undefined ? Number(angle_multiplier) : 0,
      visual_overrides_json: visual_overrides_json || null,
      visual_style: visual_style || 'Cinematic',
      nextcloud_parent_folder: nextcloud_parent_folder || 'MAKNA_Production_Final',
      fb_draft_mode: fb_draft_mode || 'auto',
      target_spreadsheet_id: extractSpreadsheetId(target_spreadsheet_id),
      sfx_setting: sfx_setting || 'without_sfx',
      enable_vo_audit: enable_vo_audit || 0,
      enable_audio_segment: enable_audio_segment || 0,
      target_demographic: target_demographic || null,
      target_demographic_custom: target_demographic_custom || null,
      ai_directive: ai_directive || null,
      mandatory_outro_line: mandatory_outro_line || null
    });
    await addReCampaignItems(id, urls);

    return NextResponse.json({ campaign: { id, campaign_name, status: status || 'running' } }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
