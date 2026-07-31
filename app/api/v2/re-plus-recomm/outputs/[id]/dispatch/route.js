import { NextResponse } from 'next/server';
import { getDb, createReCampaign, addReCampaignItems } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const db = getDb();

    // 1. Get recommendation details
    const output = await db.prepare('SELECT * FROM re_plus_recomm_outputs WHERE id = ?').get(id);
    if (!output) {
      return NextResponse.json({ success: false, error: 'Recommendation not found' }, { status: 404 });
    }

    // 2. Get parent job details
    const job = await db.prepare('SELECT * FROM re_plus_recomm_jobs WHERE id = ?').get(output.recomm_job_id);
    const parentCampaignName = job ? job.campaign_name : 'Recomm Job';

    // 3. Read body configuration options
    const body = await request.json();

    const campaignId = `campaign_${uuidv4()}`;
    const campaignName = body.campaign_name || `${parentCampaignName} - ${output.recommended_product_name}`;

    // 4. Construct campaign options matching the hybrid_lock double-pass pipeline requirements
    const campaignOptions = {
      id: campaignId,
      campaign_name: campaignName.trim(),
      aspect_ratio: body.aspect_ratio || '9:16',
      target_ai: body.target_ai || 'Google Veo (8s)',
      custom_instruction: body.custom_instruction || '',
      brand_profile_id: body.brand_profile_id || null,
      is_bridging_active: body.is_bridging_active !== undefined ? Number(body.is_bridging_active) : 1,
      target_clips_count: body.target_clips_count !== undefined ? Number(body.target_clips_count) : 5,
      bridge_at_clip: body.bridge_at_clip !== undefined ? Number(body.bridge_at_clip) : 3,
      bridging_mode: 'manual_input', // Set to manual_input to read from ephemeral_product_data
      target_product_id: null,
      ephemeral_product_data: JSON.stringify({
        product_name: output.recommended_product_name,
        product_description: output.short_description,
        unique_selling_point: output.unique_selling_point
      }),
      promotion_style: body.promotion_style || 'Softselling',
      post_youtube_draft: body.post_youtube_draft !== undefined ? Number(body.post_youtube_draft) : 0,
      post_tiktok_draft: body.post_tiktok_draft !== undefined ? Number(body.post_tiktok_draft) : 0,
      post_facebook_draft: body.post_facebook_draft !== undefined ? Number(body.post_facebook_draft) : 0,
      voice_provider: body.voice_provider || 'gemini',
      voice_persona: body.voice_persona || 'Kore',
      voice_speed: body.voice_speed !== undefined ? Number(body.voice_speed) : 1.0,
      voice_volume: body.voice_volume !== undefined ? Number(body.voice_volume) : 1.0,
      ffmpeg_sync_option: body.ffmpeg_sync_option || 'smart_sync',
      ffmpeg_video_scale: body.ffmpeg_video_scale !== undefined ? Number(body.ffmpeg_video_scale) : 1.0,
      ffmpeg_sfx_volume: body.ffmpeg_sfx_volume !== undefined ? Number(body.ffmpeg_sfx_volume) : 0.0,
      ffmpeg_bgm_volume: body.ffmpeg_bgm_volume !== undefined ? Number(body.ffmpeg_bgm_volume) : 0.15,
      video_model: body.video_model || 'veo_31_lite',
      words_per_clip: body.words_per_clip || '17-19 kata',
      face_visibility: body.face_visibility || 'Faceless',
      enable_tts: body.enable_tts !== undefined ? Number(body.enable_tts) : 1,
      enable_ffmpeg: body.enable_ffmpeg !== undefined ? Number(body.enable_ffmpeg) : 1,
      enable_social_post: body.enable_social_post !== undefined ? Number(body.enable_social_post) : 1,
      visual_mode: 'hybrid_lock', // Set to hybrid_lock double-pass image-to-video mode
      product_ref_image_path: output.local_image_path,
      product_filename_declare: output.recommended_product_name,
      tts_model_quality: body.tts_model_quality || 'speech-2.8-turbo'
    };

    // 5. Save the campaign record
    await createReCampaign(campaignOptions);

    // 6. Associate the competitor URL with the campaign
    await addReCampaignItems(campaignId, [output.source_url]);

    // 7. Fetch the campaign item ID
    const item = await db.prepare('SELECT id FROM re_campaign_items WHERE campaign_id = ? AND source_url = ? LIMIT 1')
      .get(campaignId, output.source_url);

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaignId,
        campaign_name: campaignName,
        status: 'running'
      }
    }, { status: 201 });
  } catch (error) {
    console.error('[API output dispatch POST] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
