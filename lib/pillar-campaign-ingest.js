import { createPillarCampaignBundle, getDb } from './db.js';
import { generateCampaignId } from './id-generator.js';
import { startCampaignScheduler } from './campaign-scheduler.js';

export class PillarCampaignIngestError extends Error {
  constructor(message, status = 400, code = 'PILLAR_INGEST_VALIDATION') {
    super(message);
    this.name = 'PillarCampaignIngestError';
    this.status = status;
    this.code = code;
  }
}

function extractSpreadsheetId(input) {
  if (!input) return null;
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : input.trim();
}

function autoDetectNarrativeMode(row) {
  if (row.narrative_mode && row.narrative_mode !== 'Storytelling' && row.narrative_mode !== 'auto') {
    return row.narrative_mode;
  }
  const text = `${row.pillar || ''} ${row.category_cep || ''} ${row.vfo || ''} ${row.strategic_angle || ''}`.toLowerCase();
  if (['edukasi', 'tips', 'tutorial', 'review', 'pengetahuan'].some(term => text.includes(term))) {
    return 'Educational Review';
  }
  if (['promo', 'diskon', 'hard sell', 'hardsell', 'beli', 'penawaran'].some(term => text.includes(term))) {
    return 'Promo Hard Sell';
  }
  return 'Storytelling';
}

export async function ingestPlannerToPillarCampaign({
  plannerId,
  selectedRowIds = [],
  campaignName,
  globalSettings = {},
  campaignId: requestedCampaignId = null
}) {
  if (!plannerId) throw new PillarCampaignIngestError('planner_id wajib diisi');
  const db = getDb();
  const planner = await db.prepare('SELECT * FROM content_planners WHERE id = ?').get(plannerId);
  if (!planner) throw new PillarCampaignIngestError('Content Planner tidak ditemukan', 404, 'PLANNER_NOT_FOUND');

  let rows;
  if (Array.isArray(selectedRowIds) && selectedRowIds.length > 0) {
    const placeholders = selectedRowIds.map(() => '?').join(',');
    rows = await db.prepare(`SELECT * FROM content_planner_rows WHERE planner_id = ? AND id IN (${placeholders}) ORDER BY sequence ASC`).all(plannerId, ...selectedRowIds);
  } else {
    rows = await db.prepare('SELECT * FROM content_planner_rows WHERE planner_id = ? ORDER BY sequence ASC').all(plannerId);
  }
  if (!rows?.length) throw new PillarCampaignIngestError('Tidak ada baris strategi konten yang dapat di-ingest');
  if (selectedRowIds.length > 0 && rows.length !== new Set(selectedRowIds.map(String)).size) {
    throw new PillarCampaignIngestError('Sebagian row_ids tidak berasal dari planner ini.');
  }

  const isEditorial = planner.planner_focus === 'brand_editorial';
  const explicitProductId = globalSettings.target_product_id || null;
  const bridgingRequested = Boolean(globalSettings.is_bridging_active);
  if (isEditorial && bridgingRequested && !explicitProductId) {
    throw new PillarCampaignIngestError('Pilih produk secara eksplisit sebelum mengaktifkan Product Bridging pada Brand Editorial.');
  }

  // Auto-configure for cartoon universe (Tahap 2)
  const isCartoonUniverse = planner.content_world === 'cartoon_universe';
  const cartoonClipsDefault = isCartoonUniverse ? 7 : 4;
  const cartoonBridgeAt = isCartoonUniverse ? 4 : 2;
  const cartoonBridgeDuration = isCartoonUniverse ? 2 : 1;
  let universeStoryTemplate = null;
  if (isCartoonUniverse && planner.universe_config_json) {
    try { universeStoryTemplate = JSON.parse(planner.universe_config_json)?.story_template || 'pet_problem_solution_7beat'; } catch (_) { universeStoryTemplate = 'pet_problem_solution_7beat'; }
  }

  const campaignId = requestedCampaignId || generateCampaignId('opc');
  const finalCampaignName = campaignName?.trim() || `[OPC Planner] ${planner.title || planner.product_name}`;
  const existingCampaign = await db.prepare('SELECT id, campaign_name, status FROM pillar_campaigns WHERE id = ?').get(campaignId);
  if (existingCampaign) {
    const existingItems = await db.prepare('SELECT COUNT(*) AS count FROM pillar_campaign_items WHERE campaign_id = ?').get(campaignId);
    const existingCount = Number(existingItems?.count || 0);
    if (existingCount !== rows.length) {
      throw new PillarCampaignIngestError(
        `Campaign ${campaignId} tidak lengkap (${existingCount}/${rows.length} item). Jalankan repair sebelum mencoba kembali.`,
        409,
        'OPC_INCOMPLETE_CAMPAIGN'
      );
    }
    return {
      campaignId,
      campaignName: existingCampaign.campaign_name,
      ingestedCount: existingCount,
      status: existingCampaign.status,
      reused: true
    };
  }
  let refImage = globalSettings.product_ref_image_path || (!isEditorial ? (planner.product_ref_image || planner.product_photo_url) : null) || null;
  let targetProdId = explicitProductId || (!isEditorial ? planner.target_product_id : null) || null;

  try {
    let product = null;
    if (targetProdId) {
      product = await db.prepare('SELECT * FROM product_extractions WHERE id = ?').get(targetProdId);
    } else if (!isEditorial && planner.product_name) {
      product = await db.prepare('SELECT * FROM product_extractions WHERE LOWER(product_name) = LOWER(?) LIMIT 1').get(planner.product_name);
      if (!product) {
        const term = planner.product_name.split(' ')[0] || planner.product_name;
        product = await db.prepare('SELECT * FROM product_extractions WHERE product_name LIKE ? ORDER BY id DESC LIMIT 1').get(`%${term}%`);
      }
    }
    if (product) {
      if (!targetProdId) targetProdId = product.id;
      refImage = product.clean_photo_url || product.cleaned_photo_url || product.raw_photo_url || refImage;
    }
  } catch (_) {}

  const brandProfileId = globalSettings.brand_profile_id || planner.brand_id || null;
  let accountName = globalSettings.account_name || planner.account_name || null;
  if (brandProfileId) {
    const brandProfile = await db.prepare('SELECT id, brand_name FROM brand_profiles WHERE id = ?').get(brandProfileId);
    if (!brandProfile) {
      throw new PillarCampaignIngestError('Brand Account tidak ditemukan pada tenant aktif.', 400, 'BRAND_PROFILE_NOT_FOUND');
    }
    accountName = brandProfile.brand_name || accountName;
  }

  const campaignStatus = globalSettings.status || 'running';

  let universeSnapshot = null;
  if (isCartoonUniverse) {
    const { getUniverseManifest } = require('./universe-manifests.js');
    const { getUniverseDefaults } = require('./content-world-contract.js');
    const manifest = getUniverseManifest(planner.universe_profile || 'pawville');
    const defaults = getUniverseDefaults(planner.universe_profile || 'pawville') || {};

    universeSnapshot = {
      ...defaults,
      character_lock_enabled: true,
      character_lock_scope: "all_character_clips",
      require_character_references: true,
      require_t2i_start_frame: true,
      allow_pure_t2v_for_character_clips: false,
      manifest: manifest
    };
  }

  const campaignData = {
    id: campaignId,
    campaign_name: finalCampaignName,
    account_name: accountName,
    source_planner_id: planner.id,
    execution_mode: globalSettings.execution_mode || 'manual_review',
    status: campaignStatus,
    content_pillar: rows[0]?.pillar || 'Planner Content Pillar',
    custom_hook: rows[0]?.hook || 'Planner Hook',
    visual_action_guideline: rows[0]?.visual_action || 'Planner Visual Action',
    custom_instruction: globalSettings.custom_instruction || '',
    ai_directive: globalSettings.ai_directive || globalSettings.custom_instruction || (isEditorial ? planner.brand_context : planner.product_description) || '',
    mandatory_outro_line: globalSettings.mandatory_outro_line || '',
    brand_profile_id: brandProfileId,
    target_demographic: globalSettings.target_demographic || null,
    target_demographic_custom: globalSettings.target_demographic_custom || null,
    narrative_mode: globalSettings.narrative_mode || 'auto',
    visual_style: globalSettings.visual_style || 'Cinematic',
    face_visibility: globalSettings.face_visibility || 'Faceless',
    is_bridging_active: isEditorial ? (bridgingRequested ? 1 : 0) : (globalSettings.is_bridging_active !== undefined ? (globalSettings.is_bridging_active ? 1 : 0) : 1),
    // Universe metadata forwarding to campaign level (Tahap 2)
    content_world: planner.content_world || 'real_world',
    story_template: universeStoryTemplate,
    universe_profile: planner.universe_profile || null,
    universe_snapshot_json: universeSnapshot ? JSON.stringify(universeSnapshot) : (planner.universe_config_json || null),
    target_clips_count: globalSettings.target_clips_count ? Number(globalSettings.target_clips_count) : cartoonClipsDefault,
    bridge_at_clip: globalSettings.bridge_at_clip ? Number(globalSettings.bridge_at_clip) : cartoonBridgeAt,
    bridge_duration_clips: globalSettings.bridge_duration_clips !== undefined ? Number(globalSettings.bridge_duration_clips) : cartoonBridgeDuration,
    bridging_mode: globalSettings.bridging_mode || 'manual_input',
    target_product_id: targetProdId,
    ephemeral_product_data: isEditorial ? null : (planner.product_description || null),
    aspect_ratio: globalSettings.aspect_ratio || '9:16',
    target_ai: globalSettings.target_ai || 'Google Veo (8s)',
    video_model: globalSettings.video_model || 'veo_31_lite',
    visual_mode: isCartoonUniverse ? 'hybrid_lock' : ((globalSettings.execution_mode === 'full_autopilot') ? 'pure_t2v' : (globalSettings.visual_mode || 'pure_t2v')),
    product_ref_image_path: refImage,
    product_filename_declare: globalSettings.product_filename_declare || null,
    visual_overrides_json: globalSettings.visual_overrides_json || null,
    enable_tts: globalSettings.enable_tts !== undefined ? (globalSettings.enable_tts ? 1 : 0) : 1,
    enable_glabs: globalSettings.enable_glabs ? 1 : 0,
    enable_ffmpeg: globalSettings.enable_ffmpeg !== undefined ? (globalSettings.enable_ffmpeg ? 1 : 0) : 1,
    enable_social_post: globalSettings.enable_social_post ? 1 : 0,
    upload_markdown: globalSettings.upload_markdown !== undefined ? (globalSettings.upload_markdown ? 1 : 0) : 1,
    upload_spreadsheet: globalSettings.upload_spreadsheet !== undefined ? (globalSettings.upload_spreadsheet ? 1 : 0) : 1,
    target_spreadsheet_id: extractSpreadsheetId(globalSettings.target_spreadsheet_id || planner.google_sheet_id),
    voice_provider: globalSettings.voice_provider || 'minimax',
    voice_persona: globalSettings.voice_persona || 'Indonesian_casual_reporter_vv2',
    words_per_clip: globalSettings.words_per_clip || '20-22 kata',
    tts_model_quality: globalSettings.tts_model_quality || 'speech-2.8-turbo',
    voice_speed: globalSettings.voice_speed !== undefined ? Number(globalSettings.voice_speed) : 1,
    voice_volume: globalSettings.voice_volume !== undefined ? Number(globalSettings.voice_volume) : 1,
    target_language: globalSettings.target_language || 'id-ID',
    local_scheduler: globalSettings.local_scheduler !== undefined ? (globalSettings.local_scheduler ? 1 : 0) : 1,
    scheduler_pause_at: globalSettings.execution_mode === 'full_autopilot' ? null : (globalSettings.scheduler_pause_at || null),
    is_mass_production: 1,
    ffmpeg_sync_option: globalSettings.ffmpeg_sync_option || 'smart_sync',
    ffmpeg_video_scale: globalSettings.ffmpeg_video_scale !== undefined ? Number(globalSettings.ffmpeg_video_scale) : 1,
    ffmpeg_sfx_volume: globalSettings.ffmpeg_sfx_volume !== undefined ? Number(globalSettings.ffmpeg_sfx_volume) : 0,
    ffmpeg_bgm_volume: globalSettings.ffmpeg_bgm_volume !== undefined ? Number(globalSettings.ffmpeg_bgm_volume) : 0.15,
    nextcloud_parent_folder: globalSettings.nextcloud_parent_folder || '/MAKNA_Assets',
    fb_draft_mode: globalSettings.fb_draft_mode || 'auto',
    sfx_setting: globalSettings.sfx_setting || 'without_sfx',
    enable_vo_audit: globalSettings.enable_vo_audit !== undefined ? Number(globalSettings.enable_vo_audit) : 0,
    enable_audio_segment: globalSettings.enable_audio_segment ? 1 : 0,
    voice_cast_json: globalSettings.voice_cast_json || null
  };

  const campaignItems = rows.map((row, index) => {
      const hasUrl = !isEditorial && Boolean(planner.product_url?.trim());
      const hasImage = Boolean(refImage?.trim());
      const generationStatus = hasUrl && !hasImage ? 'pending_sourcing' : 'pending';
      const narrativeMode = !globalSettings.narrative_mode || globalSettings.narrative_mode === 'auto'
        ? autoDetectNarrativeMode(row)
        : globalSettings.narrative_mode;
      const payload = {
        row_number: index + 1,
        content_pillar: row.pillar || '',
        custom_hook: row.hook || '',
        visual_action_guideline: row.visual_action || '',
        source_product_url: isEditorial ? '' : (planner.product_url || ''),
        product_image_url: isEditorial ? '' : (planner.product_photo_url || ''),
        content_subject: row.content_subject || row.context || '',
        product_name: isEditorial ? (row.product_reference || '') : (row.product_reference || row.product || planner.product_name || ''),
        product_desc: isEditorial ? '' : (planner.product_description || ''),
        product_usp: isEditorial ? '' : (planner.product_usp || ''),
        product_ref_image_path: refImage,
        visual_mode: isCartoonUniverse ? 'hybrid_lock' : (globalSettings.visual_mode || 'hybrid_lock'),
        generation_status: generationStatus,
        narrative_mode: narrativeMode,
        // Universe metadata forwarding (Tahap 1 → Tahap 2)
        content_world: planner.content_world || 'real_world',
        story_template: universeStoryTemplate,
        main_character: row.main_character || null,
        supporting_characters: row.supporting_characters || null,
        story_premise: row.story_premise || null,
        pet_problem: row.pet_problem || null,
        product_role: row.product_role || null,
        product_reveal_beat: row.product_reveal_beat || null,
        universe_profile: row.universe_profile || null,
        universe_snapshot_json: universeSnapshot ? JSON.stringify(universeSnapshot) : null
      };
      return { campaign_id: campaignId, row_creative_payload: JSON.stringify(payload), generation_status: generationStatus };
  });

  await createPillarCampaignBundle({ campaign: campaignData, items: campaignItems });

  // Record episode memory for cartoon universe (Tahap 3 — anti-repetition)
  if (isCartoonUniverse && planner.universe_profile) {
    try {
      const { createUniverseEpisode, getUniverseProfileBySlug } = require('./db.js');
      const universeRecord = await getUniverseProfileBySlug(planner.universe_profile);
      if (universeRecord) {
        for (const row of rows) {
          await createUniverseEpisode({
            universe_id: universeRecord.id,
            planner_row_id: row.id || null,
            campaign_item_id: campaignId,
            product_used: isEditorial ? null : (planner.product_name || null),
            problem_used: row.pet_problem || null,
            main_character: row.main_character || null,
            supporting_characters: row.supporting_characters || null,
            location: null,
            hook_keywords: row.hook || row.content_title || null,
            resolution_pattern: row.story_premise || null,
            cta_used: row.cta || null
          });
        }
        console.log(`[Ingest] Recorded ${rows.length} episode(s) for universe "${planner.universe_profile}".`);
      }
    } catch (epErr) {
      console.warn('[Ingest] Episode memory recording failed (non-blocking):', epErr.message);
    }
  }

  if (campaignStatus !== 'draft') {
    try { startCampaignScheduler(); }
    catch (error) { console.warn('[Ingest Planner to OPC] Failed to auto-start scheduler:', error.message); }
  }
  return { campaignId, campaignName: finalCampaignName, ingestedCount: rows.length, status: campaignStatus };
}
