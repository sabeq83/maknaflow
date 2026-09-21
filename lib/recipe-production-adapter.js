import { getDb, updatePillarCampaignItem } from './db.js';
import { getGeminiModel } from './gemini.js';
import { formatRecipeTextMarkdown, formatRecipeTextPlain, buildRecipeSocialPackage } from './recipe-social-package.js';
import { validateRecipeProductionPackage } from './recipe-campaign-contract.js';

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
  const productName         = payload.primary_product_name || item.target_prod_name || 'Produk Utama';
  const primaryProductId    = payload.primary_product_id || 'prod_01';
  const integrationStepHint = payload.integration_step_hint || '';
  const cta                 = payload.cta || campaign?.mandatory_outro_line || 'Coba sekarang!';

  let featuredProductsText = `  - ${productName} (product_id: "${primaryProductId}")`;
  if (Array.isArray(payload.featured_products) && payload.featured_products.length > 0) {
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

  const buildSceneNames = (n) => {
    if (n <= 4) return 'Hook, Preparation, Cooking Action, Plating & CTA';
    if (n <= 6) return 'Hook, Preparation, Step 1, Step 2, Plating, CTA';
    const steps = Array.from({ length: n - 2 }, (_, i) => `Cooking Step ${i + 1}`).join(', ');
    return `Hook, ${steps}, CTA`;
  };

  const systemInstruction = [
    `You are MAKNA Single-Pass Culinary Director.`,
    `Generate a complete, professional, viral production package for a ${aspectRatio} vertical social video for this recipe.`,
    ``,
    `REQUIREMENTS:`,
    `1. Structured canonical recipe: servings, prep_minutes, cook_minutes, exact ingredients with amount/unit/product_id, sequential numbered cooking steps, tips.`,
    `2. EXACTLY ${targetClips} video scenes (${buildSceneNames(targetClips)}):`,
    `   - Each scene: index, visual_action, voice_over (natural ${targetLanguage}), duration_seconds (target ${clipDuration}s), t2i_prompt, i2v_prompt, recipe_step_indices, product_ids.`,
    `   - CRITICAL: scenes array MUST have exactly ${targetClips} objects.`,
    `   - VO per scene: MAXIMUM ${wordsPerClip}.`,
    `   - FINAL scene MUST end with: "${mandatoryOutroLine || cta}"`,
    `3. 10-Parameter Video DNA: visual_style, color_grade, lighting, camera_angle, pacing, audio_energy, aspect_ratio ("${aspectRatio}").`,
    `4. Social Media Package: caption, cta, hashtags.`,
    ``,
    `Narrative Mode: ${narrativeMode}`,
    `AI Directive: ${aiDirective || promotionContext}`,
    ``,
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
    `    "index": 1, "duration_seconds": ${clipDuration},`,
    `    "visual_action": "...", "voice_over": "VO max ${wordsPerClip}",`,
    `    "t2i_prompt": "Photorealistic 8k...", "i2v_prompt": "Slow motion...",`,
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

  const finalPackage = {
    schema_version: 1,
    content_kind: 'recipe_campaign',
    recipe_revision: item.recipe_revision || payload.recipe_revision || 1,
    recipe: canonicalRecipe,
    recipe_text_markdown: mdText,
    recipe_text_plain: plainText,
    scenes: parsed.scenes || [],
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
