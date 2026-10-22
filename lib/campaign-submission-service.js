import { generateCampaignId } from './id-generator.js';
import { getActiveTenantId } from './tenant-context.js';
import {
  createReCampaign,
  addReCampaignItems,
  createMultiplierBatchWithTasks,
  createRecipeCampaign,
  createRecipeItem
} from './db.js';
import { resolveVisualIdentitySubmission } from './visual-override-resolver.js';
import { pgQuery } from './db-pg.js';
import { createOrUpdateCampaignProductBinding } from './campaign-product-binding.js';

function extractSpreadsheetId(input) {
  if (!input) return null;
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : input.trim();
}

/**
 * Shared submit service for RE Campaigns.
 */
export async function submitReCampaign({ tenantId, payload, productRefImagePath = null }) {
  if (!tenantId) tenantId = getActiveTenantId() || 'default_tenant';

  const id = generateCampaignId('re');
  const urls = payload.urls || [];

  const rawIdentity = {
    preset_id: payload.visual_identity_preset_id,
    inline_config: payload.visual_identity_inline_config,
    visual_overrides_json: payload.visual_overrides_json
  };
  const identityResult = await resolveVisualIdentitySubmission(rawIdentity);

  let effectiveProvider = payload.voice_provider || 'minimax';
  let effectivePersona = payload.voice_persona;
  if (!effectivePersona) {
    effectivePersona = effectiveProvider === 'gemini' ? 'Kore' : 'Indonesian_casual_reporter_vv2';
  }

  await createReCampaign({
    id,
    campaign_name: payload.campaign_name || 'RE Campaign',
    status: payload.status || 'running',
    aspect_ratio: payload.aspect_ratio || '9:16',
    target_ai: payload.target_ai || 'Google Veo (8s)',
    custom_instruction: payload.custom_instruction,
    brand_profile_id: payload.brand_profile_id || null,
    is_bridging_active: payload.is_bridging_active ? 1 : 0,
    target_clips_count: payload.target_clips_count ? Number(payload.target_clips_count) : 5,
    bridge_at_clip: payload.bridge_at_clip ? Number(payload.bridge_at_clip) : 2,
    bridge_duration_clips: payload.bridge_duration_clips !== undefined ? Number(payload.bridge_duration_clips) : 0,
    bridging_mode: payload.bridging_mode || 'select_existing',
    target_product_id: payload.target_product_id || null,
    ephemeral_product_data: payload.ephemeral_product_data ? (typeof payload.ephemeral_product_data === 'string' ? payload.ephemeral_product_data : JSON.stringify(payload.ephemeral_product_data)) : null,
    promotion_style: payload.promotion_style || 'Softselling',
    narrative_mode: payload.narrative_mode || 'Storytelling',
    post_youtube_draft: payload.post_youtube_draft ? 1 : 0,
    post_tiktok_draft: payload.post_tiktok_draft ? 1 : 0,
    post_facebook_draft: payload.post_facebook_draft ? 1 : 0,
    facebook_page_id: payload.facebook_page_id || null,
    facebook_server_url: payload.facebook_server_url || null,
    voice_provider: effectiveProvider,
    voice_persona: effectivePersona,
    voice_speed: payload.voice_speed !== undefined ? Number(payload.voice_speed) : 1.0,
    voice_volume: payload.voice_volume !== undefined ? Number(payload.voice_volume) : 1.0,
    ffmpeg_sync_option: payload.ffmpeg_sync_option || 'smart_sync',
    ffmpeg_video_scale: payload.ffmpeg_video_scale !== undefined ? Number(payload.ffmpeg_video_scale) : 1.0,
    ffmpeg_sfx_volume: payload.ffmpeg_sfx_volume !== undefined ? Number(payload.ffmpeg_sfx_volume) : 0.0,
    ffmpeg_bgm_volume: payload.ffmpeg_bgm_volume !== undefined ? Number(payload.ffmpeg_bgm_volume) : 0.0,
    video_model: payload.video_model || 'veo_31_lite',
    clip_duration: payload.clip_duration ? Number(payload.clip_duration) : 8,
    words_per_clip: payload.words_per_clip || '17-19 kata',
    tts_model_quality: payload.tts_model_quality || 'speech-2.8-turbo',
    target_language: payload.target_language || 'id-ID',
    face_visibility: payload.face_visibility || 'Faceless',
    enable_tts: payload.enable_tts !== undefined ? Number(payload.enable_tts) : 1,
    enable_glabs: payload.enable_glabs !== undefined ? Number(payload.enable_glabs) : 0,
    enable_ffmpeg: payload.enable_ffmpeg !== undefined ? Number(payload.enable_ffmpeg) : 1,
    enable_social_post: payload.enable_social_post !== undefined ? Number(payload.enable_social_post) : 1,
    visual_mode: (payload.execution_mode === 'full_autopilot') ? 'pure_t2v' : (payload.visual_mode || 'hybrid_lock'),
    product_ref_image_path: productRefImagePath || payload.product_ref_image_path || null,
    product_filename_declare: payload.product_filename_declare || null,
    angle_multiplier: payload.angle_multiplier !== undefined ? Number(payload.angle_multiplier) : 0,
    visual_overrides_json: identityResult.snapshot ? JSON.stringify(identityResult.snapshot) : null,
    visual_identity_preset_id: identityResult.ref?.id || null,
    visual_identity_preset_version: identityResult.ref?.version || null,
    visual_style: payload.visual_style || 'Cinematic',
    nextcloud_parent_folder: payload.nextcloud_parent_folder || 'MAKNA_Production_Final',
    fb_draft_mode: payload.fb_draft_mode || 'auto',
    target_spreadsheet_id: extractSpreadsheetId(payload.target_spreadsheet_id),
    sfx_setting: payload.sfx_setting || 'without_sfx',
    enable_vo_audit: payload.enable_vo_audit !== undefined ? Number(payload.enable_vo_audit) : 0,
    enable_audio_segment: payload.enable_audio_segment !== undefined ? Number(payload.enable_audio_segment) : 0,
    target_demographic: payload.target_demographic || null,
    target_demographic_custom: payload.target_demographic_custom || null,
    ai_directive: payload.ai_directive || null,
    mandatory_outro_line: payload.mandatory_outro_line || null,
    generate_recipe: payload.generate_recipe ? 1 : 0
  });

  await addReCampaignItems(id, urls);

  if (payload.target_product_id) {
    try {
      const insertedItems = (await pgQuery(
        'SELECT id FROM re_campaign_items WHERE campaign_id = $1 ORDER BY id ASC',
        [id]
      )).rows;

      for (const item of insertedItems) {
        await createOrUpdateCampaignProductBinding({
          tenantId,
          sourceType: 're',
          sourceCampaignId: id,
          sourceItemId: item.id,
          brandProfileId: payload.brand_profile_id || null,
          productId: payload.target_product_id,
          explicitAffiliateOverride: null,
          affiliateRequired: false
        });
      }
    } catch (bindErr) {
      console.error('[RE Campaign Binding Warning]:', bindErr.message);
    }
  }

  return {
    campaign_id: id,
    campaign_name: payload.campaign_name,
    status: payload.status || 'running',
    total_items: urls.length
  };
}

/**
 * Shared submit service for Multiplier Campaigns.
 */
export async function submitMultiplierCampaign({ tenantId, payload, productRefImagePath = null }) {
  if (!tenantId) tenantId = getActiveTenantId() || 'default_tenant';

  const {
    rows,
    shared_config,
    campaign_name,
    campaignName,
    brand_profile_id,
    selectedBrandId,
    account_name,
    accountName,
    initial_status,
    status,
    vso_config_json,
    bridging_config_json,
    audio_config_json,
    enable_vo_audit,
    generate_recipe
  } = payload;

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    throw new Error('rows tidak boleh kosong');
  }

  let vsoConfig = {};
  let bridgingConfig = {};
  let audioConfig = {};
  try { vsoConfig = typeof vso_config_json === 'string' ? JSON.parse(vso_config_json) : (vso_config_json || {}); } catch(_) {}
  try { bridgingConfig = typeof bridging_config_json === 'string' ? JSON.parse(bridging_config_json) : (bridging_config_json || {}); } catch(_) {}
  try { audioConfig = typeof audio_config_json === 'string' ? JSON.parse(audio_config_json) : (audio_config_json || {}); } catch(_) {}

  if (productRefImagePath) {
    bridgingConfig.product_ref_image_path = productRefImagePath;
  }

  const batchId = generateCampaignId('mul');
  const targetInitialStatus = (initial_status === 'draft' || status === 'draft') ? 'draft' : 'pending_resolution';

  const effectiveCampaignName = campaign_name || campaignName || bridgingConfig.campaign_name || bridgingConfig.campaignName || audioConfig.campaignName || null;
  const effectiveBrandProfileId = brand_profile_id || selectedBrandId || bridgingConfig.brand_profile_id || audioConfig.brandProfileId || null;
  const effectiveAccountName = account_name || accountName || bridgingConfig.brandName || bridgingConfig.account_name || audioConfig.accountName || null;

  const batch = {
    batch_id: batchId,
    campaign_name: effectiveCampaignName,
    brand_profile_id: effectiveBrandProfileId,
    account_name: effectiveAccountName,
    shared_config: shared_config || { vso: vsoConfig, bridging: bridgingConfig, audio: audioConfig },
    enable_vo_audit: Number(enable_vo_audit !== undefined ? enable_vo_audit : 1),
    generate_recipe: Number(generate_recipe || 0),
    initial_status: targetInitialStatus,
    status: targetInitialStatus
  };

  await createMultiplierBatchWithTasks(batch, rows);

  return {
    batch_id: batchId,
    campaign_name: effectiveCampaignName,
    status: targetInitialStatus,
    total_tasks: rows.length
  };
}

/**
 * Shared submit service for Recipe Labs Campaigns.
 */
export async function submitRecipeCampaign({ tenantId, payload }) {
  if (!tenantId) tenantId = getActiveTenantId() || 'default_tenant';

  const {
    category,
    custom_category,
    visual_style,
    nextcloud_parent_folder,
    post_to_facebook,
    enable_glabs,
    target_recipe_count,
    campaign_type,
    brand_profile_id,
    spreadsheet_id,
    config_json,
    images_per_recipe,
    selected_layout_id,
    grid_gap_size,
    grid_border_radius,
    grid_outer_padding,
    grid_bg_color,
    source_deconstruct_asset_id
  } = payload;

  if (!category) {
    throw new Error('Kategori resep wajib diisi.');
  }

  const campaignId = generateCampaignId('recipe');
  const count = Math.max(1, Math.min(20, Number(target_recipe_count) || 1));

  await createRecipeCampaign({
    id: campaignId,
    tenant_id: tenantId,
    category,
    custom_category: category === 'Custom Input' ? custom_category : null,
    visual_style: visual_style || 'Food Porn',
    nextcloud_parent_folder: nextcloud_parent_folder ? nextcloud_parent_folder.trim() : 'MAKNA_Recipes',
    post_to_facebook: post_to_facebook !== undefined ? (post_to_facebook ? 1 : 0) : 0,
    enable_glabs: enable_glabs !== undefined ? (enable_glabs ? 1 : 0) : 1,
    target_recipe_count: count,
    images_per_recipe: images_per_recipe !== undefined ? Number(images_per_recipe) : 4,
    selected_layout_id: selected_layout_id || '4_editorial_split',
    grid_gap_size: grid_gap_size !== undefined ? Number(grid_gap_size) : 12,
    grid_border_radius: grid_border_radius !== undefined ? Number(grid_border_radius) : 16,
    grid_outer_padding: grid_outer_padding !== undefined ? Number(grid_outer_padding) : 16,
    grid_bg_color: grid_bg_color || '#0d0d12',
    status: 'processing',
    campaign_type: campaign_type || 'static',
    brand_profile_id: brand_profile_id || null,
    spreadsheet_id: spreadsheet_id || null,
    config_json: config_json ? (typeof config_json === 'string' ? config_json : JSON.stringify(config_json)) : null,
    source_deconstruct_asset_id: source_deconstruct_asset_id || null
  });

  const createdItemIds = [];
  for (let i = 0; i < count; i++) {
    const itemId = `rcitem_${campaignId}_${i + 1}`;
    await createRecipeItem({
      id: itemId,
      campaign_id: campaignId,
      tenant_id: tenantId,
      status: 'pending_gemini'
    });
    createdItemIds.push(itemId);
  }

  const rawProductId = payload.product_id || payload.target_product_id;
  let recipeProductId = rawProductId || null;
  if (!recipeProductId && config_json) {
    try {
      const cfg = typeof config_json === 'string' ? JSON.parse(config_json) : config_json;
      recipeProductId = cfg?.product_id || cfg?.target_product_id || null;
    } catch (_) {}
  }

  if (recipeProductId) {
    try {
      await createOrUpdateCampaignProductBinding({
        tenantId,
        sourceType: 'recipe',
        sourceCampaignId: campaignId,
        sourceItemId: null,
        brandProfileId: brand_profile_id || null,
        productId: recipeProductId,
        explicitAffiliateOverride: null,
        affiliateRequired: false
      });
    } catch (bindErr) {
      console.error('[Recipe Ingest Binding Warning]:', bindErr.message);
    }
  }

  return {
    campaign_id: campaignId,
    total_items: count,
    item_ids: createdItemIds
  };
}
