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

  const recipeTitle = payload.title || item.custom_prompt_summary || 'Resep Kuliner Lezat';
  const hook = payload.hook || 'Rahasia resep kafe 3 menit di rumah!';
  const category = payload.category || 'minuman';
  const productName = payload.primary_product_name || item.target_prod_name || 'Produk Utama';
  const targetAudience = payload.target_audience || 'genz_casual';
  const promotionContext = payload.promotion_context || '';
  const customInstructions = payload.custom_instructions || '';

  const systemInstruction = `You are MAKNA Single-Pass Culinary Director.
Generate a complete, professional, viral production package for a 9:16 vertical social video for this recipe.

REQUIREMENTS:
1. Structured canonical recipe: servings, prep_minutes, cook_minutes, exact ingredients with amount/unit/product_id, sequential numbered cooking steps, tips.
2. 4 video scenes (Hook, Preparation, Cooking Action, Plating & CTA):
   - Each scene must have: index, visual_action, voice_over (natural Indonesian), duration_seconds (4-6s), t2i_prompt (photorealistic initial frame), i2v_prompt (fluid motion from approved frame), recipe_step_indices, product_ids.
3. 10-Parameter Video DNA: visual_style, color_grade, lighting, camera_angle, pacing, audio_energy, aspect_ratio ("9:16").
4. Social Media Package: short caption, call to action, and hashtags.

Output MUST be strict JSON.`;

  const prompt = `
RECIPE TARGET:
- Judul Resep: "${recipeTitle}"
- Kategori: "${category}"
- Hook: "${hook}"
- Produk Klien Terkait: "${productName}"
- Target Demografi: "${targetAudience}"
- Konteks Promosi: "${promotionContext}"
- Instruksi: "${customInstructions}"

JSON OUTPUT SCHEMA:
{
  "recipe": {
    "title": "${recipeTitle}",
    "servings": 1,
    "prep_minutes": 2,
    "cook_minutes": 3,
    "ingredients": [
      { "name": "${productName}", "amount": "150", "unit": "ml", "product_id": "${payload.primary_product_id || 'prod_01'}" },
      { "name": "Bahan Pelengkap 1", "amount": "1.5", "unit": "sdt", "product_id": null }
    ],
    "steps": [
      { "index": 1, "instruction": "Instruksi langkah 1 memasak", "visual_cue": "Visual cue" }
    ],
    "tips": ["Tips chef 1"]
  },
  "scenes": [
    {
      "index": 1,
      "duration_seconds": 4,
      "visual_action": "Beauty shot hidangan penarik perhatian",
      "voice_over": "VO hook narasi Bahasa Indonesia",
      "t2i_prompt": "Photorealistic 8k, extreme close up of...",
      "i2v_prompt": "Slow smooth motion, cinematic tilt down...",
      "recipe_step_indices": [1],
      "product_ids": ["${payload.primary_product_id || 'prod_01'}"]
    }
  ],
  "video_dna": {
    "visual_style": "photorealistic_culinary",
    "color_grade": "warm_appetizing",
    "lighting": "soft_morning_window",
    "camera_angle": "eye_level_macro",
    "pacing": "energetic_snappy",
    "aspect_ratio": "9:16"
  },
  "social_media_package": {
    "cta": "Simpan resep ini & coba di rumah!",
    "hashtags": ["#ResepViral", "#KulinerTikTok", "#ResepPraktis"]
  }
}`;

  const model = await getGeminiModel();
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: `${systemInstruction}\n\n${prompt}` }] }],
    generationConfig: {
      temperature: 0.7,
      responseMimeType: 'application/json'
    }
  });

  const responseText = result.response.text();
  const parsed = JSON.parse(cleanJsonResponse(responseText));

  const canonicalRecipe = parsed.recipe || {
    title: recipeTitle,
    servings: 1,
    prep_minutes: 2,
    cook_minutes: 3,
    ingredients: [{ name: productName, amount: '150', unit: 'ml', product_id: payload.primary_product_id }],
    steps: [{ index: 1, instruction: 'Campurkan bahan hingga merata.' }],
    tips: []
  };

  const mdText = formatRecipeTextMarkdown(canonicalRecipe);
  const plainText = formatRecipeTextPlain(canonicalRecipe);
  const socialPkg = buildRecipeSocialPackage(canonicalRecipe, {
    hook,
    cta: parsed.social_media_package?.cta || payload.cta,
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

  // Combine VO scripts for TTS audio rendering
  const fullVoScript = finalPackage.scenes.map(s => s.voice_over).filter(Boolean).join(' ');

  // Update item in database
  await updatePillarCampaignItem(item.id, {
    generation_status: 'completed',
    result_json: JSON.stringify(finalPackage),
    row_creative_payload: JSON.stringify({
      ...payload,
      content_kind: 'recipe_campaign',
      recipe_revision: finalPackage.recipe_revision
    })
  });

  return {
    success: true,
    item_id: item.id,
    package: finalPackage
  };
}
