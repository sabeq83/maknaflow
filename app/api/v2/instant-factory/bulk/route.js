import { NextResponse } from 'next/server';
import { createInstantCampaign, createInstantCampaignItem, getDb } from '@/lib/db';
import { generateCampaignId } from '@/lib/id-generator';

export async function POST(request) {
  try {
    const { campaign_name, global_settings, rows_data } = await request.json();

    if (!campaign_name?.trim()) {
      return NextResponse.json({ error: 'campaign_name is required' }, { status: 400 });
    }
    if (!rows_data || !Array.isArray(rows_data) || rows_data.length === 0) {
      return NextResponse.json({ error: 'rows_data must be a non-empty array' }, { status: 400 });
    }

    const campaignId = generateCampaignId('instant');
    const db = getDb();

    // 1. Create the parent instant campaign
    await createInstantCampaign({
      id: campaignId,
      product_name: `${campaign_name.trim()} (Mass Production)`,
      product_description: `Batch mass production campaign containing ${rows_data.length} items.`,
      product_source_type: 'text_only',
      product_media_path: null,
      product_url: '',
      status: global_settings.status || 'running',
      is_mass_production: 1,
      local_scheduler: 1,
      brand_profile_id: global_settings.brand_profile_id || null,
      enable_glabs: global_settings.enable_glabs ? 1 : 0,
      enable_tts: global_settings.enable_tts !== undefined ? (global_settings.enable_tts ? 1 : 0) : 1,
      enable_ffmpeg: global_settings.enable_ffmpeg !== undefined ? (global_settings.enable_ffmpeg ? 1 : 0) : 1,
      enable_social_post: global_settings.enable_social_post !== undefined ? (global_settings.enable_social_post ? 1 : 0) : 1,
      post_youtube_draft: global_settings.post_youtube_draft ? 1 : 0,
      post_tiktok_draft: global_settings.post_tiktok_draft ? 1 : 0,
      post_facebook_draft: global_settings.post_facebook_draft ? 1 : 0,
      is_bridging_active: global_settings.is_bridging_active ? 1 : 0,
      bridge_at_clip: parseInt(global_settings.bridge_at_clip || '2', 10),
      visual_mode: global_settings.visual_mode || 'hybrid_lock'
    }, {
      narrative_mode: global_settings.narrative_mode || 'Storytelling',
      visual_style: global_settings.visual_style || 'UGC',
      words_per_clip: parseInt(global_settings.words_per_clip || '12', 10),
      target_ai_engine: global_settings.target_ai_engine || 'Google Veo (8s)',
      face_visibility: global_settings.face_visibility || 'Faceless',
      aspect_ratio: global_settings.aspect_ratio || '9:16',
      total_clips: parseInt(global_settings.total_clips || '4', 10),
      voice_persona: global_settings.voice_persona || 'Aoede',
      speed_control: parseFloat(global_settings.speed_control || '2.5'),
      custom_instruction: global_settings.custom_instruction || '',
      target_language: global_settings.target_language || 'id-ID'
    });

    // 2. Insert items sequentially using SQLite transaction
    await db.transaction(async () => {
      for (let i = 0; i < rows_data.length; i++) {
        const row = rows_data[i];
        
        // JIT Sourcing check: if product_image_url starts with http:// or https://, set status to pending_sourcing
        const hasRemoteImage = row.product_image_url && 
          (row.product_image_url.startsWith('http://') || row.product_image_url.startsWith('https://'));
        const generation_status = hasRemoteImage ? 'pending_sourcing' : 'pending';

        const payload = {
          row_number: i + 1,
          product_name: row.product_name || '',
          product_desc: row.product_desc || '',
          product_image_url: row.product_image_url || '',
          custom_hook: row.custom_hook || '',
          visual_action_guideline: row.visual_action_guideline || '',
          custom_instruction: row.custom_instruction || '',
          product_ref_image_path: row.product_ref_image_path || null,
          product_filename_declare: row.product_filename_declare || null
        };

        await createInstantCampaignItem({
          campaign_id: campaignId,
          row_creative_payload: JSON.stringify(payload),
          generation_status
        });
      }
    })();

    // Auto-update the active scheduler state if running to pick up the new campaign
    return NextResponse.json({
      success: true,
      campaign_id: campaignId,
      total_items: rows_data.length
    }, { status: 201 });

  } catch (err) {
    console.error('[Bulk IFC Ingestion] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
