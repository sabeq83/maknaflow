import { getPgPool, closePgPool } from '../lib/db-pg.js';
import { resolveVisualIdentitySnapshot } from '../lib/visual-override-resolver.js';

async function updateCampaign() {
  const pool = getPgPool();

  const structuredConfig = {
    schema_version: '2',
    label: 'SasyaHouse Culinary & Student Lifestyle',
    description: 'Culinary cinematic & lifestyle faceless hands-only for SasyaHouse student campaign',
    subject: {
      kind: 'human',
      faceless_mode: 'hands_only',
      demographic_key: 'syari_classic',
      custom_description: '',
      character_count: 1,
      population_mode: 'single'
    },
    visual_language: {
      primary_style: 'culinary_cinematic',
      supporting_styles: [],
      disabled_styles: []
    },
    mode_routing: {
      hook: 'culinary_cinematic',
      context: 'culinary_cinematic',
      mechanism: 'culinary_cinematic',
      consequence: 'culinary_cinematic',
      evidence_reveal: 'culinary_cinematic',
      conclusion: 'culinary_cinematic'
    },
    rendering: {
      geometry: 'simplified_semi_realistic',
      textures: ['natural_skin', 'food_steam_and_moisture', 'warm_wood'],
      shadow_style: 'soft_natural',
      finish: 'photorealistic_cinematic'
    },
    composition: {
      primary_idea_count: 1,
      primary_subject_count: 1,
      negative_space: 'required',
      safe_zone: 'vertical_social_ui'
    },
    wardrobe: {
      mode: 'fixed',
      preset_key: 'terracotta_amber',
      custom_description: 'in Amber Haze & Terracotta tones, warm and earthy colors, modest long flowing sleeves covering the arms completely down to the wrists (wrists_covered)',
      sleeve_policy: 'wrists_covered'
    },
    environment: {
      preset_key: 'custom',
      custom_description: 'in a cozy vibrant local culinary eatery in Sigura-gura Malang with authentic rustic wooden table, ceramic plates, followed by a clean bright modern shared kitchenette, warm student lifestyle atmosphere',
      background_density: 'balanced'
    },
    lighting: {
      preset_key: 'window_daylight',
      custom_description: 'illuminated by soft natural warm golden daylight, appetizing highlights, realistic soft-shadow roll-off',
      color_temperature: 'warm_neutral',
      contrast: 'soft'
    },
    camera: {
      framing: 'forearms_and_hands',
      perspective: 'third_person',
      lens_look: 'natural_50mm',
      depth_of_field: 'shallow',
      movement: 'subtle_handheld'
    },
    style: {
      preset_key: 'culinary_cinematic',
      custom_description: '',
      aspect_ratio: '9:16'
    },
    guardrails: {
      face_visibility: 'prohibited',
      reflection_face: 'prohibited',
      unintended_people: 'prohibited',
      extra_people: 'prohibited',
      intentional_crowd: 'allowed_faceless',
      identity_drift: 'prohibited',
      wardrobe_drift: 'prohibited',
      required_negative_prompts: []
    }
  };

  const resolvedSnapshot = resolveVisualIdentitySnapshot({
    schema_version: 'visual_identity_snapshot_v1',
    structured: structuredConfig
  }, { narrative_function: 'hook' });
  
  // Custom culinary negative prompt
  resolvedSnapshot.resolved.negative_prompt = 'visible human face, eyes, nose, mouth, human portrait, unintended extra people, exposed arms, bare skin above wrists, editorial political illustration, flat 2D graphic novel, vector clipart, unappetizing food, cold stale lighting, oversaturated cartoon, blurry distorted hands, bad anatomy, extra fingers';

  const payload = {
    schema_version: 'visual_identity_snapshot_v1',
    identity_ref: {
      id: 'inline',
      key: 'inline',
      version: 1,
      source: 'inline'
    },
    structured: structuredConfig,
    reference_assets: [],
    resolved: resolvedSnapshot.resolved,
    legacy: {
      character_concept: 'faceless',
      subject_demographic: 'custom',
      subject_demographic_custom: resolvedSnapshot.resolved.subject_prompt,
      wardrobe_style: 'custom',
      wardrobe_style_custom: resolvedSnapshot.resolved.wardrobe_prompt,
      lighting_style: 'custom',
      lighting_style_custom: resolvedSnapshot.resolved.lighting_prompt,
      visual_style_preset: 'culinary_cinematic'
    }
  };

  const queryText = `
    UPDATE staging.pillar_campaigns
    SET visual_style = $1, visual_overrides_json = $2
    WHERE id = $3
    RETURNING id, campaign_name, visual_style, visual_overrides_json
  `;

  const res = await pool.query(queryText, ['Culinary Cinematic', JSON.stringify(payload), 'opc_260928_kllhub']);

  if (res.rows.length > 0) {
    console.log('✅ Campaign opc_260928_kllhub successfully updated in staging.pillar_campaigns!');
    console.log('ID:', res.rows[0].id);
    console.log('Campaign Name:', res.rows[0].campaign_name);
    console.log('Visual Style:', res.rows[0].visual_style);
    const parsed = JSON.parse(res.rows[0].visual_overrides_json);
    console.log('Primary Style:', parsed.structured?.visual_language?.primary_style);
    console.log('Active Visual Mode:', parsed.resolved?.active_visual_mode);
    console.log('Style Prompt:', parsed.resolved?.style_prompt);
    console.log('Negative Prompt:', parsed.resolved?.negative_prompt);
  } else {
    console.log('❌ Campaign not found in staging.pillar_campaigns');
  }

  await closePgPool();
}

updateCampaign().catch(err => {
  console.error('Update failed:', err);
  process.exit(1);
});
