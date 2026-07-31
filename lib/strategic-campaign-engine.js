import { getDb } from './db.js';
import { getGeminiModel } from './gemini.js';
import { getCreativeGeneratorKB, getReviewerKB } from './kb-loader.js';
import { DEMOGRAPHIC_PRESETS, WARDROBE_PRESETS, LIGHTING_PRESETS, MASCOT_UNIVERSES, MASCOT_ART_STYLES, buildStrategicCampaignPrompt } from './prompts.js';
import { writeLogToFile } from './console-hook.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

function logStrategicLog(msg) {
  try {
    const logFile = path.join(process.cwd(), 'public', 'strategic_campaign_logs.txt');
    writeLogToFile(logFile, msg);
  } catch (_) {}
}

function cleanJsonResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

async function callGeminiJson(prompt, systemInstruction = '') {
  const model = await getGeminiModel();
  const fullPrompt = systemInstruction 
    ? `${systemInstruction}\n\n${prompt}`
    : prompt;
    
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    generationConfig: {
      temperature: 0.7,
      responseMimeType: "application/json"
    }
  });

  const responseText = result.response.text();
  const jsonStr = cleanJsonResponse(responseText);
  return JSON.parse(jsonStr);
}

/**
 * Sanitize VSO Configuration according to OPC SOT Rules:
 * If subject_demographic is a human demographic, visual_style_preset MUST be null.
 * Only mascot_universe_* demographics allow a visual_style_preset string.
 */
function sanitizeVsoConfig(vso = {}) {
  const isMascot = vso.subject_demographic && String(vso.subject_demographic).startsWith('mascot_universe_');
  let wardrobe = vso.wardrobe_style || 'amber_terracotta';
  if (wardrobe === 'random') {
    const keys = Object.keys(WARDROBE_PRESETS);
    wardrobe = keys[Math.floor(Math.random() * keys.length)];
  }
  return {
    is_vso_active: Boolean(vso.is_vso_active),
    character_concept: vso.character_concept || 'faceless',
    subject_demographic: vso.subject_demographic || 'syari_classic',
    wardrobe_style: wardrobe,
    lighting_style: vso.lighting_style || 'window_daylight',
    visual_style_preset: isMascot ? (vso.visual_style_preset || '3d_claymation_cozy') : null
  };
}

/**
 * Format VSO directives string for inclusion in AI prompt
 * Resolves full English DNA descriptions from DEMOGRAPHIC_PRESETS, WARDROBE_PRESETS, LIGHTING_PRESETS (identical to OPC)
 */
function formatVsoDirectives(vso) {
  if (!vso || !vso.is_vso_active) return '';
  
  const isMascot = vso.subject_demographic && String(vso.subject_demographic).startsWith('mascot_universe_');
  let demoText = vso.subject_demographic;
  if (isMascot) {
    const universe = MASCOT_UNIVERSES[vso.subject_demographic];
    const style = MASCOT_ART_STYLES[vso.visual_style_preset] || MASCOT_ART_STYLES['3d_claymation_cozy'];
    demoText = `${universe ? universe.name : vso.subject_demographic} (${style})`;
  } else {
    demoText = DEMOGRAPHIC_PRESETS[vso.subject_demographic] || vso.subject_demographic;
  }

  const wardrobeText = WARDROBE_PRESETS[vso.wardrobe_style] || vso.wardrobe_style;
  const lightingText = LIGHTING_PRESETS[vso.lighting_style] || vso.lighting_style;

  let text = `\n=== VISUAL SWAP OVERRIDES (VSO) DIRECTIVES ===\n`;
  text += `- Character Concept: ${vso.character_concept}\n`;
  text += `- Subject Demographic DNA: ${demoText}\n`;
  text += `- Wardrobe Style DNA: ${wardrobeText}\n`;
  text += `- MANDATORY WARDROBE LOCK: Every clip (Clips 1 to 5) for this campaign item MUST use the EXACT SAME wardrobe color, fabric, and pattern (${wardrobeText}). DO NOT change outfit or scarf color between scenes.\n`;
  text += `- Lighting Style DNA: ${lightingText}\n`;
  if (vso.visual_style_preset && isMascot) {
    text += `- Visual Style Preset: ${vso.visual_style_preset}\n`;
  } else {
    text += `- Style Constraint: MANDATORY Photorealistic / Cinematic. DO NOT inject 3D/Claymation style.\n`;
  }
  return text;
}

/**
 * Auto-sanitizer for Call 1 creative package:
 * Cleanses accidental product name mentions in voice_over and on_screen_text for scenes BEFORE bridgeAt.
 */
function sanitizeProductLeaksBeforeBridging(creativePackage, productName, bridgeAt) {
  if (!creativePackage || !Array.isArray(creativePackage.storyboard) || !productName) {
    return creativePackage;
  }

  const cleanProductName = productName.trim();
  const firstWord = cleanProductName.split(' ')[0];
  const brandKeywords = [cleanProductName];
  const genericWords = ['bubuk', 'kopi', 'susu', 'teh', 'baju', 'kaos', 'minuman', 'makanan', 'sabun', 'lotion'];
  if (firstWord && firstWord.length >= 3 && !genericWords.includes(firstWord.toLowerCase())) {
    brandKeywords.push(firstWord);
  }

  creativePackage.storyboard.forEach((scene) => {
    const sceneNum = scene.scene_number || 1;
    if (sceneNum < bridgeAt) {
      brandKeywords.forEach((kw) => {
        const regex = new RegExp(`\\b${kw}\\b`, 'gi');
        if (scene.voice_over) {
          scene.voice_over = scene.voice_over.replace(regex, 'bubuk murni');
        }
        if (scene.on_screen_text) {
          scene.on_screen_text = scene.on_screen_text.replace(regex, 'bahan murni');
        }
        if (Array.isArray(scene.voice_segments)) {
          scene.voice_segments.forEach((seg) => {
            if (seg.text) {
              seg.text = seg.text.replace(regex, 'bubuk murni');
            }
          });
        }
      });
    }
  });

  return creativePackage;
}

/**
 * Create a new Strategic Campaign (from Content Planner or Manual Input)
 */
export async function createStrategicCampaign(params) {
  const {
    campaign_name,
    source_planner_id = null,
    selected_row_ids = [],
    input_mode = 'manual',
    product_name,
    product_description,
    product_usp,
    product_ref_image = null,
    vso_config = {},
    workflow_config = {},
    items = [] // If manual items provided
  } = params;

  const db = getDb();
  const campaignId = `cmp_${uuidv4().substring(0, 8)}`;
  const sanitizedVso = sanitizeVsoConfig(vso_config);

  // Resolve Studio Photo Path & Filename Declare from Product Database (Priority: Studio generated_photo_url -> cleaned_photo_url -> clean_photo_url -> photo_url)
  let resolvedProductRefImagePath = workflow_config.product_ref_image_path || null;
  let resolvedProductFilenameDeclare = workflow_config.product_filename_declare || null;

  const targetProdId = workflow_config.target_product_id || (source_planner_id ? await db.prepare('SELECT product_id FROM content_planners WHERE id = ?').get(source_planner_id)?.product_id : null);

  let resolvedProductTruth = null;
  let resolvedGeometricTruth = null;

  if (targetProdId) {
    try {
      const prod = await db.prepare('SELECT photo_url, active_photo, clean_photo_url, cleaned_photo_url, generated_photo_url, product_truth, geometric_truth FROM product_extractions WHERE id = ?').get(targetProdId);
      if (prod) {
        resolvedProductTruth = prod.product_truth || null;
        resolvedGeometricTruth = prod.geometric_truth || null;
        const photoPath = prod.generated_photo_url || prod.cleaned_photo_url || prod.clean_photo_url || prod.photo_url || '';
        if (photoPath) {
          resolvedProductRefImagePath = photoPath;
          resolvedProductFilenameDeclare = path.basename(photoPath);
        }
      }
    } catch (_) {}
  }

  const plannerObj = source_planner_id ? await db.prepare('SELECT account_name, google_sheet_id, brand_id FROM content_planners WHERE id = ?').get(source_planner_id) : null;
  const resolvedAccountName = params.account_name || workflow_config.account_name || plannerObj?.account_name || null;
  const resolvedBrandProfileId = params.brand_profile_id || params.brand_id || workflow_config.brand_profile_id || plannerObj?.brand_id || null;
  const resolvedSpreadsheetId = params.target_spreadsheet_id || workflow_config.target_spreadsheet_id || plannerObj?.google_sheet_id || null;
  const resolvedNextcloudParentFolder = params.nextcloud_parent_folder || workflow_config.nextcloud_parent_folder || 'MAKNA_Strategic_Campaigns';

  const defaultWorkflow = {
    target_language: workflow_config.target_language || 'id-ID',
    target_clips_count: workflow_config.target_clips_count || 4,
    is_bridging_active: workflow_config.is_bridging_active !== undefined ? Number(workflow_config.is_bridging_active) : 1,
    bridge_at_clip: workflow_config.bridge_at_clip || 2,
    bridge_duration_clips: workflow_config.bridge_duration_clips || 1,
    promotion_style: workflow_config.promotion_style || 'Softselling',
    bridging_mode: workflow_config.bridging_mode || 'manual_input',
    target_product_id: targetProdId || workflow_config.target_product_id || null,
    manual_product_name: workflow_config.manual_product_name || product_name || '',
    manual_product_desc: workflow_config.manual_product_desc || product_description || '',
    manual_product_usp: workflow_config.manual_product_usp || product_usp || '',
    product_truth: resolvedProductTruth,
    geometric_truth: resolvedGeometricTruth,
    product_url: workflow_config.product_url || '',
    product_ref_image_path: resolvedProductRefImagePath,
    product_filename_declare: resolvedProductFilenameDeclare,
    narrative_mode: workflow_config.narrative_mode || 'Storytelling',
    aspect_ratio: workflow_config.aspect_ratio || '9:16',
    target_ai: workflow_config.target_ai || 'Google Veo (8s)',
    video_model: workflow_config.video_model || 'veo_31_lite',
    face_visibility: workflow_config.face_visibility || 'Faceless',
    words_per_clip: workflow_config.words_per_clip || '15-16 kata',
    visual_style: workflow_config.visual_style || 'Cinematic',
    visual_mode: workflow_config.visual_mode || 'hybrid_lock',
    enable_tts: workflow_config.enable_tts !== undefined ? workflow_config.enable_tts : 1,
    voice_provider: workflow_config.voice_provider || 'minimax',
    voice_persona: workflow_config.voice_persona || 'Indonesian_casual_reporter_vv2',
    voice_speed: workflow_config.voice_speed || 1.0,
    sfx_setting: workflow_config.sfx_setting || 'without_sfx',
    enable_vo_audit: workflow_config.enable_vo_audit !== undefined ? Number(workflow_config.enable_vo_audit) : 0,
    custom_instruction: workflow_config.custom_instruction || '',
    enable_glabs: workflow_config.enable_glabs !== undefined ? workflow_config.enable_glabs : 1,
    enable_ffmpeg: workflow_config.enable_ffmpeg !== undefined ? workflow_config.enable_ffmpeg : 1,
    enable_social_post: workflow_config.enable_social_post !== undefined ? workflow_config.enable_social_post : 0,
    account_name: resolvedAccountName,
    brand_profile_id: resolvedBrandProfileId,
    target_spreadsheet_id: resolvedSpreadsheetId,
    nextcloud_parent_folder: resolvedNextcloudParentFolder
  };

  await db.prepare(`
    INSERT INTO strategic_campaigns (
      id, campaign_name, source_planner_id, input_mode, product_name, product_description, product_usp, product_ref_image, status, vso_config_json, workflow_config_json, target_spreadsheet_id, nextcloud_parent_folder, account_name, brand_profile_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    campaignId,
    campaign_name || `Strategic Campaign - ${product_name}`,
    source_planner_id,
    input_mode,
    product_name,
    product_description,
    product_usp,
    product_ref_image,
    'draft',
    JSON.stringify(sanitizedVso),
    JSON.stringify(defaultWorkflow),
    resolvedSpreadsheetId,
    resolvedNextcloudParentFolder,
    resolvedAccountName,
    resolvedBrandProfileId
  );

  let itemsToInsert = [];

  // Case A: Import from Content Planner Rows
  if (source_planner_id && selected_row_ids.length > 0) {
    const placeholders = selected_row_ids.map(() => '?').join(',');
    const plannerRows = await db.prepare(`SELECT * FROM content_planner_rows WHERE id IN (${placeholders}) ORDER BY sequence ASC`).all(...selected_row_ids);
    
    itemsToInsert = plannerRows.map((r, idx) => ({
      planner_row_id: r.id,
      sequence: idx + 1,
      video_id: r.video_id || null,
      pillar: r.pillar,
      category_cep: r.category_cep,
      ws_matrix: r.ws_matrix,
      context: r.context,
      vfo: r.vfo,
      strategic_angle: r.strategic_angle,
      hook: r.hook,
      visual_action: r.visual_action,
      product: r.product || product_name,
      target_clips_count: defaultWorkflow.target_clips_count
    }));
  } 
  // Case B: Direct Manual / Provided items
  else if (items && items.length > 0) {
    itemsToInsert = items.map((it, idx) => ({
      planner_row_id: null,
      sequence: idx + 1,
      video_id: it.video_id || null,
      pillar: it.pillar || 'Edukasi Produk',
      category_cep: it.category_cep || 'Problem-Solution Based',
      ws_matrix: it.ws_matrix || 'When + While Doing What',
      context: it.context || 'Situasi harian',
      vfo: it.vfo || 'Concrete',
      strategic_angle: it.strategic_angle || 'The Life Hack',
      hook: it.hook || `Pengen solusikan masalah dengan ${product_name}?`,
      visual_action: it.visual_action || `Visual aksi produk ${product_name}`,
      product: product_name,
      target_clips_count: it.target_clips_count || defaultWorkflow.target_clips_count
    }));
  } else {
    // Default 1 item if empty
    itemsToInsert.push({
      planner_row_id: null,
      sequence: 1,
      video_id: null,
      pillar: 'Edukasi Utama',
      category_cep: 'Problem-Solution Based',
      ws_matrix: 'When + While Doing What',
      context: 'Momen harian audiens',
      vfo: 'Concrete',
      strategic_angle: 'The Life Hack',
      hook: `Solusi praktis dengan ${product_name}`,
      visual_action: `Visual adegan penggunaan ${product_name}`,
      product: product_name,
      target_clips_count: defaultWorkflow.target_clips_count
    });
  }

  const insertItemStmt = await db.prepare(`
    INSERT INTO strategic_campaign_items (
      id, campaign_id, planner_row_id, sequence, video_id, pillar, category_cep, ws_matrix, context, vfo, strategic_angle, hook, visual_action, product, target_clips_count, workflow_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertedItems = [];
  itemsToInsert.forEach(it => {
    const itemId = `cmp_item_${uuidv4().substring(0, 8)}`;
    insertItemStmt.run(
      itemId,
      campaignId,
      it.planner_row_id,
      it.sequence,
      it.video_id,
      it.pillar,
      it.category_cep,
      it.ws_matrix,
      it.context,
      it.vfo,
      it.strategic_angle,
      it.hook,
      it.visual_action,
      it.product,
      it.target_clips_count,
      'ready_for_call_1'
    );
    insertedItems.push({ id: itemId, ...it, workflow_status: 'ready_for_call_1' });
  });

  return {
    success: true,
    campaign_id: campaignId,
    items: insertedItems
  };
}

/**
 * Execute CALL 1: Creative Production Engine
 * Generates Storyboard (dynamically matching target_clips_count), Master VO, T2I/I2V prompts, Continuity
 */
export async function executeCall1CreativeEngine(campaignItemId) {
  const db = getDb();
  const item = await db.prepare('SELECT * FROM strategic_campaign_items WHERE id = ?').get(campaignItemId);
  if (!item) throw new Error('Item kampanye tidak ditemukan.');

  const campaign = await db.prepare('SELECT * FROM strategic_campaigns WHERE id = ?').get(item.campaign_id);
  if (!campaign) throw new Error('Kampanye tidak ditemukan.');

  const vso = JSON.parse(campaign.vso_config_json || '{}');
  const workflow = JSON.parse(campaign.workflow_config_json || '{}');
  const clipCount = item.target_clips_count || workflow.target_clips_count || 4;

  const creativeKb = getCreativeGeneratorKB();
  const vsoDirectives = formatVsoDirectives(vso);

  const langLabel = workflow.target_language === 'en-US' ? 'English (Global / US Market)' : 'Bahasa Indonesia (Lokal)';
  const audioSegDirective = workflow.enable_audio_segment 
    ? 'Diaktifkan. Setiap adegan WAJIB menyertakan array "voice_segments" berisi pembagian naskah dialog per beat (2-4 detik).' 
    : 'Disabled (Voiceover narasi tunggal per adegan)';
  const sfxDirective = workflow.sfx_setting === 'with_sfx' 
    ? 'Diaktifkan. Setiap adegan WAJIB menyertakan field "sfx_prompt" yang merinci efek suara sinematik pencetus emosi (misal: [SFX: Soft camera click, gentle swoosh, warm riser]).' 
    : 'Tanpa SFX (without_sfx)';

  const bridgeAt = Math.min(Math.max(2, workflow.bridge_at_clip || 2), clipCount);
  const bridgeDur = workflow.bridge_duration_clips !== undefined ? parseInt(workflow.bridge_duration_clips, 10) : 1;
  const bridgeEnd = bridgeDur === 0 ? clipCount : Math.min(clipCount, bridgeAt + bridgeDur - 1);
  const bridgeRangeText = bridgeAt === bridgeEnd ? `klip ke-${bridgeAt}` : `klip ke-${bridgeAt} s/d klip ke-${bridgeEnd}`;

  const bridgingDirective = workflow.is_bridging_active 
    ? `Aktif (Sandwich Protocol). Sisipkan transisi produk pada ${bridgeRangeText} dari total ${clipCount} klip dengan Gaya Promosi "${workflow.promotion_style || 'Softselling'}".` 
    : 'Tidak Aktif (Murni Edukasi / Storytelling)';

  const isolationMandate = workflow.is_bridging_active ? `
========================================================================
🚨 ISOLASI PEMBAHASAN PRODUK STRATEGIS (STRATEGIC PRODUCT PLACEMENT ISOLATION MANDATE)
========================================================================
- PADA KLIP DI LUAR RENTANG BRIDGING (Klip 1 hingga Klip ke-${bridgeAt - 1}${bridgeEnd < clipCount ? ` dan Klip ke-${bridgeEnd + 1} hingga Klip ke-${clipCount}` : ''}):
  * Naskah Voiceover ("voice_over") & On-Screen Text ("on_screen_text") DILARANG KERAS menyebutkan nama produk ("${item.product}"), merek, atau melakukan jualan. Naskah WAJIB 100% berfokus mengeksekusi fondasi strategi Content Planner: Hook ("${item.hook}"), Context ("${item.context}"), dan Strategic Angle ("${item.strategic_angle}") menggunakan istilah generik / anonim (misal: "bubuk cokelat murni", "bahan alami ini").
  * Prompt visual ("t2i_prompt" dan "i2v_prompt") DILARANG KERAS menggambarkan kemasan fisik produk target ("${workflow.product_filename_declare || 'foto_studio_terdaftar.png'}") atau menyertakan merek. Visual WAJIB 100% memvisualisasikan adegan aksi ("${item.visual_action}") dan esensi VFO ("${item.vfo}") secara estetik dan kontekstual tanpa menampilkan kemasan/label merek.

- HANYA PADA KLIP BRIDGING (Klip ke-${bridgeAt} hingga Klip ke-${bridgeEnd}):
  * Naskah Voiceover ("voice_over") WAJIB mentransisikan masalah/konteks strategi menjadi perkenalan produk "${item.product}" secara halus (Softselling Organik) dan USP ("${campaign.product_usp}").
  * Prompt visual ("t2i_prompt" dan "i2v_prompt") WAJIB secara eksplisit menampilkan dan mengunci visual foto studio terdaftar "${workflow.product_filename_declare || 'foto_studio_terdaftar.png'}".
========================================================================
` : '';

  const systemInstruction = buildStrategicCampaignPrompt(campaign, item, workflow, creativeKb, vsoDirectives, isolationMandate, bridgeRangeText);

  const prompt = `Hasikan Paket Produksi Kreatif & Caption Media Sosial Call 1 untuk ${clipCount} klip adegan sekarang.`;

  console.log(`[StrategicCampaignEngine] Executing 1-Call Creative Engine for item ${campaignItemId} (${clipCount} clips)...`);
  logStrategicLog(`[Call 1] 🚀 Memulai 1-Call Creative Engine untuk Item #${campaignItemId} (${item.pillar}) — Target ${clipCount} klip adegan...`);
  
  let creativePackage = await callGeminiJson(prompt, systemInstruction);

  if (workflow.is_bridging_active) {
    creativePackage = sanitizeProductLeaksBeforeBridging(creativePackage, item.product, bridgeAt);
  }

  const storyboard = creativePackage.storyboard || [];
  if (storyboard.length === 0) {
    logStrategicLog(`[Call 1 ERROR] Gagal menghasilkan storyboard dari Gemini AI untuk item ${campaignItemId}.`);
    throw new Error('Gagal menghasilkan storyboard dari AI Call 1.');
  }

  logStrategicLog(`[Call 1 SUCCESS] Gemini AI berhasil merancang ${storyboard.length} klip adegan & Social Media Package untuk item ${campaignItemId}.`);

  const videoDna = creativePackage.video_dna || {
    pilar_konten: item.pillar || 'Edukasi Produk',
    hook_type: 'Problem-Solving / Question Hook',
    visual_style: workflow.visual_style || 'Cinematic',
    signature_moment: 'Product Unboxing & Textural Focus',
    camera_pace: 'Dynamic Micro-Pacing (8s per clip)',
    primary_emotion: 'Curiosity & High Desire',
    affiliate_integration: workflow.is_bridging_active ? 'Softselling Product Placement' : 'None',
    affiliate_mention: workflow.is_bridging_active ? 'Both' : 'None',
    scene_count: clipCount,
    cta_type: 'Direct Purchase / Link in Bio'
  };

  // Clear existing scenes for this item if any
  await db.prepare('DELETE FROM strategic_campaign_scenes WHERE campaign_item_id = ?').run(campaignItemId);

  // Insert generated scenes into database
  const insertSceneStmt = await db.prepare(`
    INSERT INTO strategic_campaign_scenes (
      id, campaign_item_id, scene_number, duration_seconds, scene_function, visual_action, voice_over, on_screen_text, t2i_prompt, i2v_prompt, negative_prompt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  storyboard.forEach((sc, idx) => {
    const sceneId = `sc_${uuidv4().substring(0, 8)}`;
    
    let t2iStr = sc.t2i_prompt || '';
    if (typeof t2iStr === 'object') {
      t2iStr = JSON.stringify(t2iStr);
    }

    let i2vStr = sc.i2v_prompt || '';
    if (typeof i2vStr === 'object') {
      const timeline = i2vStr.micro_pacing_timeline || [];
      const formattedTimeline = timeline.map(t => `(${t.time_segment}): (Visual Action: ${t.visual_acting_beat || t.visual_action || ''})`).join(', ');
      i2vStr = `(VERTICAL 9:16) --ar 9:16 --no landscape [LAYER 1: INPUT & TRUTH LOCK] (Start Frame Reference: CLIP${idx + 1}_START_FRAME.png). [LAYER 2: MICRO-PACING & ACTION] ${formattedTimeline || JSON.stringify(i2vStr)}`;
    }

    insertSceneStmt.run(
      sceneId,
      campaignItemId,
      idx + 1,
      sc.duration_seconds || 8,
      sc.scene_function || (idx === 0 ? 'hook' : (idx === 1 ? 'bridging' : 'continuation')),
      sc.visual_action || item.visual_action,
      sc.voice_over || '',
      sc.on_screen_text || '',
      t2iStr,
      i2vStr,
      sc.negative_prompt || 'low quality, blurry, distorted'
    );
  });

  // Update item status & json (Save publishing_package_json directly for Single-Pass Engine)
  const socialPkg = creativePackage.social_media_package || null;
  await db.prepare(`
    UPDATE strategic_campaign_items
    SET creative_package_json = ?, publishing_package_json = ?, video_dna_json = ?, workflow_status = 'ready_for_review', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    JSON.stringify(creativePackage),
    socialPkg ? JSON.stringify(socialPkg) : null,
    JSON.stringify(videoDna),
    campaignItemId
  );

  // === TIKTOK COMPLIANCE GATE MIDDLEWARE (POST CALL 1) ===
  let complianceReview = null;
  try {
    const { reviewCreative, rewriteUnsafeFields } = await import('./tiktok-compliance-service.js');
    complianceReview = await reviewCreative(item, creativePackage, {});
    
    const reviewId = `rev_${uuidv4().substring(0, 8)}`;
    await db.prepare(`
      INSERT INTO content_compliance_reviews (
        id, campaign_item_id, creative_content_package_id, platform, review_stage, status, risk_level, detected_issues_json, safe_revisions_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      reviewId,
      campaignItemId,
      creativePackage.campaign_item_id || campaignItemId,
      'tiktok',
      'creative',
      complianceReview.status,
      complianceReview.risk_level,
      JSON.stringify(complianceReview.detected_issues || []),
      JSON.stringify(complianceReview.safe_revisions || {})
    );

    if (complianceReview.status === 'pass') {
      await db.prepare("UPDATE strategic_campaign_items SET workflow_status = 'ready_for_review' WHERE id = ?").run(campaignItemId);
    } else if (complianceReview.status === 'revise' && complianceReview.safe_revisions) {
      // Apply safe revisions to Creative Package & Scenes
      const revisedPackage = rewriteUnsafeFields(item, creativePackage, complianceReview.safe_revisions);
      
      if (Array.isArray(revisedPackage.storyboard)) {
        const updateSceneStmt = await db.prepare('UPDATE strategic_campaign_scenes SET voice_over = ?, on_screen_text = ? WHERE campaign_item_id = ? AND scene_number = ?');
        for (let idx = 0; idx < revisedPackage.storyboard.length; idx++) {
          const sc = revisedPackage.storyboard[idx];
          await updateSceneStmt.run(sc.voice_over || '', sc.on_screen_text || '', campaignItemId, idx + 1);
        }
      }

      await db.prepare(`
        UPDATE strategic_campaign_items
        SET creative_package_json = ?, hook = ?, workflow_status = 'ready_for_review', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        JSON.stringify(revisedPackage),
        revisedPackage.creative_direction?.final_hook || item.hook,
        campaignItemId
      );

      creativePackage = revisedPackage;
    } else if (complianceReview.status === 'block') {
      await db.prepare("UPDATE strategic_campaign_items SET workflow_status = 'compliance_blocked' WHERE id = ?").run(campaignItemId);
    } else if (complianceReview.status === 'human_review') {
      await db.prepare("UPDATE strategic_campaign_items SET workflow_status = 'human_review_required' WHERE id = ?").run(campaignItemId);
    }
  } catch (compErr) {
    console.warn('[StrategicCampaignEngine] Compliance Gate Post-Call 1 Warning:', compErr.message);
  }

  return {
    success: true,
    creative_package: creativePackage,
    compliance_review: complianceReview,
    scenes_count: storyboard.length
  };
}

/**
 * @deprecated UNIFIED INTO CALL 1 SINGLE-PASS ENGINE (V10.20.74).
 * Pipeline otomatis (processStrategicGenerator) kini memproduksi Storyboard + Social Media Package dalam 1x Call AI pada Call 1.
 * Fungsi Call 2 ini hanya dipertahankan sebagai legacy / manual fallback endpoint.
 *
 * Execute CALL 2: Publishing Engine (Manual Fallback Only)
 * Generates captions for TikTok, IG Reels, FB, YouTube Title/Desc, Hashtags, CTA, and SEO keywords
 */
export async function executeCall2PublishingEngine(campaignItemId) {
  const db = getDb();
  const item = await db.prepare('SELECT * FROM strategic_campaign_items WHERE id = ?').get(campaignItemId);
  if (!item || !item.creative_package_json) {
    throw new Error('Creative package (Call 1) belum dihasilkan atau disetujui.');
  }

  if (item.workflow_status === 'compliance_blocked') {
    throw new Error('Item ini diblokir oleh TikTok Compliance Gate. Perbaiki isu terlebih dahulu.');
  }

  const campaign = await db.prepare('SELECT * FROM strategic_campaigns WHERE id = ?').get(item.campaign_id);
  const creativePkg = JSON.parse(item.creative_package_json);
  const reviewerKb = getReviewerKB();

  const systemInstruction = `
Kamu adalah Publishing Engine MAKNA Engine.
Tugasmu adalah mentransformasikan Paket Kreatif yang telah disetujui menjadi Aset Penerbitan Spesifik Platform (TikTok, Instagram Reels, Facebook, YouTube).

KNOWLEDGE BASE PENERBITAN:
${reviewerKb}

KONTEKS KAMPANYE:
- Produk: ${item.product}
- Deskripsi: ${campaign.product_description}
- Final Hook: ${creativePkg.creative_direction?.final_hook || item.hook}
- Core Message: ${creativePkg.creative_direction?.core_message || ''}
- Master Voice Over: ${creativePkg.voice_over?.master_vo || ''}

Format Output WAJIB berupa JSON Object:
{
  "campaign_item_id": "${campaignItemId}",
  "publishing_assets": {
    "tiktok": {
      "caption": "...",
      "cta": "...",
      "hashtags": ["#...", "#..."]
    },
    "instagram": {
      "caption": "...",
      "cta": "...",
      "hashtags": ["#...", "#..."]
    },
    "facebook": {
      "caption": "...",
      "cta": "..."
    },
    "youtube": {
      "title": "...",
      "description": "...",
      "keywords": ["..."],
      "hashtags": ["#..."]
    }
  },
  "seo": {
    "primary_keyword": "...",
    "secondary_keywords": ["..."]
  }
}
`;

  const prompt = `Hasikan Aset Penerbitan Call 2 sekarang.`;

  console.log(`[StrategicCampaignEngine] Executing Call 2 for item ${campaignItemId}...`);
  const result = await callGeminiJson(prompt, systemInstruction);

  // Merge into Final Package
  const finalPackage = {
    campaign_item_id: campaignItemId,
    strategy: {
      pillar: item.pillar,
      cep_category: item.category_cep,
      ws_matrix: item.ws_matrix,
      context: item.context,
      vfo: item.vfo,
      strategic_angle: item.strategic_angle,
      hook: item.hook,
      visual_action: item.visual_action
    },
    creative_package: creativePkg,
    publishing_assets: result.publishing_assets,
    seo: result.seo
  };

  // === TIKTOK COMPLIANCE GATE MIDDLEWARE (POST CALL 2) ===
  let publishingComplianceReview = null;
  try {
    const { reviewPublishing } = await import('./tiktok-compliance-service.js');
    publishingComplianceReview = await reviewPublishing(item, creativePkg, result, {});
    
    const reviewId = `rev_${uuidv4().substring(0, 8)}`;
    await db.prepare(`
      INSERT INTO content_compliance_reviews (
        id, campaign_item_id, publishing_content_package_id, platform, review_stage, status, risk_level, detected_issues_json, safe_revisions_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      reviewId,
      campaignItemId,
      campaignItemId,
      'tiktok',
      'publishing',
      publishingComplianceReview.status,
      publishingComplianceReview.risk_level,
      JSON.stringify(publishingComplianceReview.detected_issues || []),
      JSON.stringify(publishingComplianceReview.safe_revisions || {})
    );
  } catch (pubCompErr) {
    console.warn('[StrategicCampaignEngine] Compliance Gate Post-Call 2 Warning:', pubCompErr.message);
  }

  await db.prepare(`
    UPDATE strategic_campaign_items
    SET publishing_package_json = ?, final_package_json = ?, workflow_status = 'publishing_compliance_passed', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(JSON.stringify(result), JSON.stringify(finalPackage), campaignItemId);

  return {
    success: true,
    publishing_package: result,
    publishing_compliance: publishingComplianceReview,
    final_package: finalPackage
  };
}

/**
 * Sync all completed items of a Strategic Campaign (Pillar/RE Campaign) to Content Flow Direct Ingestion API
 */
export async function syncStrategicCampaignToContentFlow(campaignId) {
  const db = getDb();
  let campaign = await db.prepare('SELECT * FROM pillar_campaigns WHERE id = ?').get(campaignId);
  let isPillar = true;
  if (!campaign) {
    campaign = await db.prepare('SELECT * FROM re_campaigns WHERE id = ?').get(campaignId);
    isPillar = false;
  }
  if (!campaign) {
    throw new Error('Kampanye tidak ditemukan.');
  }

  let items = [];
  if (isPillar) {
    items = await db.prepare('SELECT * FROM pillar_campaign_items WHERE campaign_id = ?').all(campaignId);
  } else {
    items = await db.prepare('SELECT * FROM re_campaign_items WHERE campaign_id = ?').all(campaignId);
  }

  if (!items || items.length === 0) {
    throw new Error('Belum ada item kampanye yang dapat disinkronkan.');
  }

  const accountName = campaign.account_name ? campaign.account_name.trim() : (campaign.campaign_name || 'Default Account');
  const todayStr = new Date().toISOString().split('T')[0];

  const payload = items.map(item => {
    const videoId = item.video_id || `${accountName.toLowerCase().replace(/[^a-z0-9_]/g, '_')}-${item.id}`;
    
    let caption = item.caption || item.hook || '';
    if (item.creative_package_json) {
      try {
        const creative = JSON.parse(item.creative_package_json);
        if (creative.social_package && creative.social_package.caption) {
          caption = creative.social_package.caption;
        }
      } catch (_) {}
    }

    const assetUrl = item.drive_link || item.video_url || item.url_asset || '';
    const singleLineCaption = caption ? caption.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim() : '';

    return {
      account_name: accountName,
      video_id: videoId,
      hook: item.hook || campaign.custom_hook || '',
      nama_produk: item.product_name || campaign.product_name || '',
      link_affiliate: campaign.affiliate_url || '',
      link_produk: campaign.product_url || '',
      url_asset: assetUrl,
      caption: singleLineCaption,
      pipeline_status: assetUrl ? 'Completed' : 'In Production',
      production_date: todayStr
    };
  });

  const { sendToContentFlow } = await import('./contentflow-client.js');
  const res = await sendToContentFlow(payload);

  return {
    success: true,
    campaign_id: campaignId,
    account_name: accountName,
    synced_count: payload.length,
    response: res.data
  };
}

/**
 * Auto sync a single finished campaign item to Content Flow API
 */
export async function syncCampaignItemToContentFlow(campaign, item, assetUrl) {
  try {
    const { sendToContentFlow } = await import('./contentflow-client.js');
    const accountName = campaign.account_name ? campaign.account_name.trim() : (campaign.campaign_name || 'Default Account');
    const todayStr = new Date().toISOString().split('T')[0];
    const videoId = item.video_id || `${accountName.toLowerCase().replace(/[^a-z0-9_]/g, '_')}-${item.id}`;

    let resObj = {};
    if (item.result_json) {
      try { resObj = typeof item.result_json === 'object' ? item.result_json : JSON.parse(item.result_json); } catch (_) {}
    }

    let caption = item.caption
      || resObj.tiktok_caption
      || resObj.ig_caption
      || (resObj.social_media_package && resObj.social_media_package.caption)
      || resObj.caption
      || item.hook
      || campaign.custom_hook
      || '';

    if (item.creative_package_json) {
      try {
        const creative = JSON.parse(item.creative_package_json);
        if (creative.social_package && creative.social_package.caption) {
          caption = creative.social_package.caption;
        }
      } catch (_) {}
    }

    const singleLineCaption = caption ? caption.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim() : '';

    const hook = item.hook
      || campaign.custom_hook
      || resObj.hook
      || (resObj.social_media_package && resObj.social_media_package.hook)
      || (resObj.new_video_plan && resObj.new_video_plan[0] ? resObj.new_video_plan[0].new_vo : '')
      || (resObj.voiceover && resObj.voiceover[0] ? resObj.voiceover[0].narration : '')
      || '';

    const payload = {
      account_name: accountName,
      video_id: videoId,
      hook: hook,
      nama_produk: item.product_name || campaign.product_name || '',
      link_affiliate: campaign.affiliate_url || '',
      link_produk: campaign.product_url || '',
      url_asset: assetUrl || '',
      caption: singleLineCaption,
      pipeline_status: assetUrl ? 'Completed' : 'In Production',
      production_date: todayStr
    };

    console.log(`[ContentFlowSync] Auto-ingesting item ${item.id} (video_id: ${videoId}) to Content Flow...`);
    await sendToContentFlow(payload);
    console.log(`[ContentFlowSync] Item ${item.id} auto-ingest successful.`);
  } catch (err) {
    console.warn(`[ContentFlowSync] Auto-ingest warning for item ${item.id}:`, err.message);
  }
}
