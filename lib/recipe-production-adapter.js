import { getDb, updatePillarCampaignItem } from './db.js';
import { getGeminiModel } from './gemini.js';
import { formatRecipeTextMarkdown, formatRecipeTextPlain, buildRecipeSocialPackage } from './recipe-social-package.js';
import { validateRecipeProductionPackage } from './recipe-campaign-contract.js';
import { resolveVisualOverrides } from './visual-override-resolver.js';

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

/**
 * Single-Pass Creative Generator for Recipe Campaign in OPC Pipeline
 */
export async function processRecipeCampaignCreative({ item, campaign, job }) {
  const db = getDb();
  let payload = {};
  try {
    payload = typeof item.row_creative_payload === 'string'
      ? JSON.parse(item.row_creative_payload || '{}')
      : (item.row_creative_payload || {});
  } catch (e) {
    payload = {};
  }

  // Kategori 1: Konten & Narasi
  const recipeTitle        = payload.title || item.custom_prompt_summary || 'Resep Kuliner Lezat';
  const hook               = payload.hook || payload.custom_hook || 'Rahasia resep kafe 3 menit di rumah!';
  const category           = payload.category || 'minuman';
  const targetAudience     = payload.target_audience || 'genz_casual';
  const promotionContext   = payload.promotion_context || campaign?.ai_directive || '';
  const customInstructions = payload.custom_instructions || '';
  const narrativeMode      = payload.narrative_mode || 'Educational Review';
  const aiDirective        = campaign?.ai_directive || payload.promotion_context || '';
  const mandatoryOutroLine = campaign?.mandatory_outro_line || '';
  const visualActionGuideline = payload.visual_action_guideline || payload.visual_highlight || '';

  // recipe_idea: pre-planned storyboard & steps from planner (AI reference baseline)
  let recipeIdeaText = '';
  if (payload.recipe_idea) {
    try {
      const ri = typeof payload.recipe_idea === 'string'
        ? JSON.parse(payload.recipe_idea)
        : payload.recipe_idea;
      const steps = Array.isArray(ri.steps)
        ? ri.steps.map(s => `  ${s.index}. ${s.instruction}`).join('\n')
        : '';
      const storyboardRef = Array.isArray(ri.storyboard)
        ? ri.storyboard.map(s => `  Scene ${s.index}: ${s.title} — VO: "${s.vo}" | Visual: "${s.visual}"`).join('\n')
        : '';
      const ingredientsList = Array.isArray(ri.ingredients)
        ? ri.ingredients.map(i => `  - ${i.amount} ${i.unit} ${i.name}`).join('\n')
        : '';
      recipeIdeaText = [
        ri.title ? `Resep: ${ri.title}` : '',
        ingredientsList ? `Bahan:\n${ingredientsList}` : '',
        steps ? `Langkah Memasak:\n${steps}` : '',
        ri.chef_tips?.length ? `Tips Chef: ${ri.chef_tips.join('; ')}` : '',
        storyboardRef ? `Referensi Storyboard Awal (kembangkan sesuai jumlah klip):\n${storyboardRef}` : '',
      ].filter(Boolean).join('\n');
    } catch (_) {}
  }

  // Kategori 2: Produk & Integrasi
  const isOrganicRecipe     = !payload.primary_product_id && (!payload.featured_products || payload.featured_products.length === 0);
  const productName         = isOrganicRecipe ? 'Resep Organik (Bahan Dapur Umum)' : (payload.primary_product_name || item.target_prod_name || 'Produk Utama');
  const primaryProductId    = payload.primary_product_id || null;
  const integrationStepHint = payload.integration_step_hint || '';
  const cta                 = payload.cta || campaign?.mandatory_outro_line || 'Simpan & recook resep ini!';

  let featuredProductsText = isOrganicRecipe
    ? '  - Resep Kuliner Organik (Tanpa produk sponsor khusus, gunakan bahan pantry & bumbu dapur umum).'
    : `  - ${productName} (product_id: "${primaryProductId || 'prod_01'}")`;
  if (!isOrganicRecipe && Array.isArray(payload.featured_products) && payload.featured_products.length > 0) {
    featuredProductsText = payload.featured_products.map((p, i) =>
      `  ${i + 1}. ${p.name} (role: ${p.role || 'ingredient'}, product_id: "${p.product_id || ''}")\n     => ${p.action_step || ''}`
    ).join('\n');
  }

  // Kategori 3: Visual & Technical
  const targetClips    = Number(campaign?.target_clips_count) || 4;
  const clipDuration   = Number(campaign?.clip_duration) || 4;
  const wordsPerClip   = campaign?.words_per_clip || '8-9 kata';
  const targetLanguage = campaign?.target_language || 'id-ID';
  const aspectRatio    = campaign?.aspect_ratio || '9:16';

  // Kategori 4: Visual Identity Resolution (VSO / Visual Overrides)
  let visualIdentity = null;
  if (campaign?.visual_overrides_json) {
    try {
      const rawVso = typeof campaign.visual_overrides_json === 'string'
        ? JSON.parse(campaign.visual_overrides_json)
        : campaign.visual_overrides_json;
      visualIdentity = resolveVisualOverrides({
        visualOverrides: rawVso,
        itemIndex: Math.max(0, Number(payload.row_number || 1) - 1),
        stableSeed: `${campaign.id}:${item.id}`,
        rowOverride: payload.wardrobe_color || ''
      });
    } catch (e) {
      console.warn('[Recipe Adapter] Failed to resolve visual_overrides_json:', e.message);
    }
  }

  const subjectAnchor = visualIdentity?.resolved?.subject_prompt
    || visualIdentity?.subject_demographic_custom
    || 'a graceful Southeast Asian Muslimah wearing modest long flowing sleeves covering the arms completely down to the wrists, strictly faceless framing, camera focused entirely on the forearms and hands, cropped from the elbow down to show only the forearms and hands, strictly omitting the face, head, neck, chest, and shoulders, showcasing precise hand actions and movements';

  const wardrobeLock = visualIdentity?.resolved?.wardrobe_prompt
    || visualIdentity?.wardrobe_style_custom
    || 'in Amber Haze & Terracotta tones, warm and earthy colors, showcasing a classy aura perfect on matte or flowing fabric texture';

  const environmentLock = visualIdentity?.resolved?.environment_prompt
    || 'in a modern bright Nordic style kitchen, featuring clean white marble countertops and light oak wood cabinets';

  const lightingLock = visualIdentity?.resolved?.lighting_prompt
    || 'illuminated by soft natural daylight coming from a side window, realistic soft-shadow roll-off, clean highlights';

  const isFaceless = visualIdentity?.structured?.guardrails?.face_visibility === 'prohibited'
    || visualIdentity?.character_concept === 'faceless'
    || visualIdentity?.structured?.subject?.faceless_mode === 'hands_only'
    || true; // Default faceless for culinary safety unless specified otherwise

  const buildSceneNames = (n) => {
    if (n <= 4) return 'Hook (Retention), Preparation, Cooking Action, Plating & CTA';
    if (n <= 6) return 'Hook, Preparation, Cooking Step 1, Cooking Step 2, Plating, CTA';
    const steps = Array.from({ length: n - 2 }, (_, i) => `Cooking Step ${i + 1}`).join(', ');
    return `Hook, ${steps}, CTA`;
  };

  const visualMandate = isFaceless ? [
    `STRICT FACELESS & VISUAL IDENTITY MANDATE (MANDATORY & CRITICAL):`,
    `- FACE VISIBILITY: PROHIBITED (DILARANG KERAS MENAMPILKAN WAJAH, KEPALA, MATA, MULUT, ATAU POTRET MANUSIA).`,
    `- FRAMING: Strictly cropped from the elbow down (forearms and hands only). Camera MUST focus exclusively on culinary hand movements, ingredients, and kitchen tools.`,
    `- INDONESIAN VISUAL ACTION (visual_action): Deskripsi aksi visual bahasa Indonesia WAJIB berfokus pada pergerakan tangan dan interaksi alat/bahan resep (contoh: "Tangan wanita berbalut manset terakota membuka tabung SAMONO juicer...", "Tangan menuangkan bubuk matcha ke dalam blender..."). DILARANG KERAS menulis aksi subjek wajah seperti "ibu tersenyum", "melihat timbangan", "menatap kamera".`,
    `- ANCHOR: ${subjectAnchor}`,
    `- WARDROBE (100% IDENTIK & KONSISTEN DI SELURUH KLIP): ${wardrobeLock}`,
    `- ENVIRONMENT: ${environmentLock}`,
    `- LIGHTING: ${lightingLock}`,
  ].join('\n') : [
    `VISUAL IDENTITY MANDATE:`,
    `- ANCHOR: ${subjectAnchor}`,
    `- WARDROBE (100% IDENTIK): ${wardrobeLock}`,
    `- ENVIRONMENT: ${environmentLock}`,
    `- LIGHTING: ${lightingLock}`,
  ].join('\n');

  const systemInstruction = [
    `You are MAKNA Single-Pass Culinary Director & Cinema Engine (V10 Optics Standard).`,
    `Generate a complete, high-end, viral culinary production package for a ${aspectRatio} vertical video.`,
    ``,
    visualMandate,
    ``,
    `REQUIREMENTS:`,
    `1. Canonical Recipe: servings, prep_minutes, cook_minutes, exact ingredients with amount/unit/product_id, sequential numbered cooking steps, tips.`,
    `2. EXACTLY ${targetClips} Video Scenes (${buildSceneNames(targetClips)}):`,
    `   - Each scene MUST contain: index, scene_function ("hook"|"cooking_step"|"product_spotlight"|"cta"), duration_seconds (${clipDuration}), visual_action (detailed Indonesian camera & action breakdown focusing on hands and tools), on_screen_text (short overlay graphic / measurement text), voice_over (natural ${targetLanguage}, max ${wordsPerClip}), sfx_prompt (culinary ambient sounds), t2i_prompt (English 4-Layer Optics System), i2v_prompt (English 3-Layer Micro-Pacing System), recipe_step_indices, product_ids.`,
    `   - Wardrobe Consistency: Unified attire and tone across all scenes.`,
    `   - MANDATORY T2I FORMAT (100% English): (VERTICAL 9:16) --ar 9:16 --no landscape [LAYER 1: OPTICS] (Shot on Phase One XF IQ4 (150MP), 100mm Macro Food Photography lens, soft appetizing shallow depth of field). [LAYER 2: SUBJECT & VISUAL TRUTH] (Anchor: ${subjectAnchor}), (Wardrobe: ${wardrobeLock}), (Product Truth: High fidelity photography of registered products, label geometry locked). [LAYER 3: SCENE & LIGHT] (Environment: ${environmentLock}), (Lighting: ${lightingLock}). [LAYER 4: KINETIC IMPLICATION] (Frozen Action: [Mid-action frozen motion]).`,
    `   - MANDATORY I2V FORMAT (100% English): (VERTICAL 9:16) --ar 9:16 --no landscape [LAYER 1: INPUT & TRUTH LOCK] (Start Frame Reference: CLIP_N_START_FRAME.png), (Consistency: MAX). [LAYER 2: MICRO-PACING & ACTION] 0.0s-2.0s: (Subtle cinematic push-in), 2.0s-${clipDuration}.0s: (Smooth micro-movement). [LAYER 3: SFX] [SFX: Sound effects].`,
    `   - FINAL scene MUST end with: "${mandatoryOutroLine || cta}"`,
    `3. 10-Parameter Video DNA: visual_style, color_grade, lighting, camera_angle, pacing, audio_energy, aspect_ratio ("${aspectRatio}").`,
    `4. Social Media Package: cta, hashtags.`,
    ``,
    `Narrative Mode: ${narrativeMode}`,
    `AI Directive: ${aiDirective || promotionContext}`,
    `Output MUST be strict JSON.`
  ].join('\n');

  const promptLines = [
    `RECIPE TARGET:`,
    `- Judul Resep: "${recipeTitle}"`,
    `- Kategori: "${category}"`,
    `- Hook: "${hook}"`,
    `- Target Demografi: "${targetAudience}"`,
    `- Konteks Promosi: "${promotionContext}"`,
    `- Panduan Visual Utama: "${visualActionGuideline}"`,
    `- Instruksi Tambahan: "${customInstructions}"`,
    `- CTA Wajib: "${cta}"`,
    ``,
    `PRODUK YANG DITAMPILKAN:`,
    featuredProductsText,
    ``,
    `PETUNJUK INTEGRASI PRODUK: ${integrationStepHint}`,
    ``,
  ];
  if (recipeIdeaText) {
    promptLines.push(`REFERENSI RESEP & STORYBOARD (gunakan sebagai baseline, kembangkan ke ${targetClips} klip):`);
    promptLines.push(recipeIdeaText);
    promptLines.push('');
  }
  promptLines.push(
    `JSON OUTPUT SCHEMA:`,
    `{`,
    `  "recipe": {`,
    `    "title": "${recipeTitle}",`,
    `    "servings": 1,`,
    `    "prep_minutes": 2,`,
    `    "cook_minutes": ${clipDuration},`,
    `    "ingredients": [{ "name": "${productName}", "amount": "150", "unit": "ml", "product_id": "${primaryProductId}" }],`,
    `    "steps": [{ "index": 1, "instruction": "Instruksi memasak", "visual_cue": "Visual cue" }],`,
    `    "tips": ["Tips chef 1"]`,
    `  },`,
    `  "scenes": [{`,
    `    "index": 1, "scene_function": "hook", "duration_seconds": ${clipDuration},`,
    `    "visual_action": "Deskripsi pergerakan kamera & aksi memasak rinci...",`,
    `    "on_screen_text": "Teks pop-up di layar...",`,
    `    "voice_over": "VO max ${wordsPerClip}",`,
    `    "sfx_prompt": "[SFX: Sound of blender motor whirling softly, gentle liquid splash]",`,
    `    "t2i_prompt": "(VERTICAL 9:16) --ar 9:16 --no landscape [LAYER 1: OPTICS] (Shot on Phase One XF IQ4 (150MP), 100mm Macro lens, shallow depth of field). [LAYER 2: SUBJECT & VISUAL TRUTH] (Anchor: ${subjectAnchor}), (Wardrobe: ${wardrobeLock}), (Product Truth: High fidelity photography of source product). [LAYER 3: SCENE & LIGHT] (Environment: ${environmentLock}), (Lighting: ${lightingLock}). [LAYER 4: KINETIC IMPLICATION] (Frozen Action: Pouring liquid in mid-air).",`,
    `    "i2v_prompt": "(VERTICAL 9:16) --ar 9:16 --no landscape [LAYER 1: INPUT & TRUTH LOCK] (Start Frame Reference: CLIP_1_START_FRAME.png), (Consistency: MAX). [LAYER 2: MICRO-PACING & ACTION] 0.0s-2.0s: (Slow cinematic push-in towards the product), 2.0s-${clipDuration}.0s: (Smooth continuous camera balance). [LAYER 3: SFX] [SFX: Soft whirling hum].",`,
    `    "recipe_step_indices": [1], "product_ids": ["${primaryProductId}"]`,
    `  }],`,
    `  "video_dna": { "visual_style": "photorealistic_culinary", "color_grade": "warm_appetizing", "lighting": "soft_morning_window", "camera_angle": "eye_level_macro", "pacing": "energetic_snappy", "aspect_ratio": "${aspectRatio}" },`,
    `  "social_media_package": { "cta": "${cta}", "hashtags": ["#ResepViral"] }`,
    `}`
  );
  const prompt = promptLines.join('\n');

  const model = await getGeminiModel();
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: `${systemInstruction}\n\n${prompt}` }] }],
    generationConfig: { temperature: 0.7, responseMimeType: 'application/json' }
  });

  const responseText = result.response.text();
  const parsed = JSON.parse(cleanJsonResponse(responseText));

  const canonicalRecipe = parsed.recipe || {
    title: recipeTitle, servings: 1, prep_minutes: 2, cook_minutes: 3,
    ingredients: [{ name: productName, amount: '150', unit: 'ml', product_id: primaryProductId }],
    steps: [{ index: 1, instruction: 'Campurkan bahan hingga merata.' }],
    tips: []
  };

  const mdText = formatRecipeTextMarkdown(canonicalRecipe);
  const plainText = formatRecipeTextPlain(canonicalRecipe);
  const socialPkg = buildRecipeSocialPackage(canonicalRecipe, {
    hook,
    cta: parsed.social_media_package?.cta || cta,
    hashtags: parsed.social_media_package?.hashtags
  });

  const scenesArray = parsed.scenes || [];
  const finalPackage = {
    schema_version: 1,
    content_kind: 'recipe_campaign',
    recipe_revision: item.recipe_revision || payload.recipe_revision || 1,
    recipe: canonicalRecipe,
    recipe_text_markdown: mdText,
    recipe_text_plain: plainText,
    caption: socialPkg.caption,
    universal_caption: socialPkg.caption,
    tiktok_caption: socialPkg.caption,
    ig_caption: socialPkg.caption,
    yt_title: canonicalRecipe.title || recipeTitle,
    yt_desc: socialPkg.caption,
    storyboard: scenesArray.map((scene, idx) => ({
      scene: scene.index || (idx + 1),
      scene_function: scene.scene_function || (idx === 0 ? 'hook' : idx === scenesArray.length - 1 ? 'cta' : 'cooking_step'),
      duration_seconds: scene.duration_seconds || clipDuration,
      visual_action: scene.visual_action || '',
      voice_over: scene.voice_over || '',
      on_screen_text: scene.on_screen_text || '',
      sfx_prompt: scene.sfx_prompt || '',
      t2i_prompt: scene.t2i_prompt || '',
      i2v_prompt: scene.i2v_prompt || '',
      recipe_step_indices: scene.recipe_step_indices || [],
      product_ids: scene.product_ids || []
    })),
    scenes: scenesArray,
    t2i_prompts: scenesArray.map((s, idx) => ({ clip: s.index || (idx + 1), prompt: s.t2i_prompt || '' })),
    i2v_prompts: scenesArray.map((s, idx) => ({ clip: s.index || (idx + 1), prompt: s.i2v_prompt || '' })),
    video_dna: parsed.video_dna || {},
    social_media_package: socialPkg
  };

  validateRecipeProductionPackage(finalPackage);

  // Map scenes to unified new_video_plan_json format (read by UI & TTS pipeline)
  const newVideoPlan = finalPackage.scenes.map((scene, idx) => ({
    clip_index: scene.index || (idx + 1),
    product_visible: (scene.product_ids || []).length > 0,
    requires_product_reference: (scene.product_ids || []).length > 0,
    visual_action: scene.visual_action || '',
    new_vo: scene.voice_over || '',
    voice_segments: null,
    t2i_prompt: scene.t2i_prompt || '',
    t2v_prompt: '',
    i2v_prompt: scene.i2v_prompt || ''
  }));

  // Update item in database
  await updatePillarCampaignItem(item.id, {
    generation_status: 'completed',
    content_kind: 'recipe_campaign',
    result_json: JSON.stringify(finalPackage),
    new_video_plan_json: JSON.stringify(newVideoPlan),
    video_dna_json: JSON.stringify(finalPackage.video_dna || {}),
    // recipe_data_json WAJIB diisi — campaign-scheduler guard memblokir TTS tanpa field ini
    recipe_data_json: JSON.stringify(canonicalRecipe),
    row_creative_payload: JSON.stringify({
      ...payload,
      content_kind: 'recipe_campaign',
      recipe_revision: finalPackage.recipe_revision
    })
  });

  return { success: true, item_id: item.id, package: finalPackage };
}
