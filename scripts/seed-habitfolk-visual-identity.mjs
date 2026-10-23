import { Pool } from 'pg';
import { validateAndNormalizeVisualIdentity } from '../lib/visual-identity-contract.js';

export const HABITFOLK_MACRO_CRAFT_CONFIG = {
  schema_version: '2',
  label: 'HabitFolk — Satisfying Macro Craft',
  description: 'Satisfying macro culinary sensory prep on white Carrara marble with heavily blurred Caucasian male arms in creamy bokeh background.',
  subject: {
    kind: 'human',
    faceless_mode: 'hands_only',
    demographic_key: 'caucasian_male',
    custom_description: 'Caucasian male chef with subtle out-of-focus motion, heavily blurred in creamy bokeh background (f/1.4), keeping 100% focus on ingredients and tools',
    character_count: 1,
    population_mode: 'single'
  },
  visual_language: {
    primary_style: 'culinary_cinematic',
    supporting_styles: [],
    disabled_styles: ['editorial_graphic_novel', 'isometric_society', 'symbolic_surrealism', 'clay_political_theater']
  },
  wardrobe: {
    mode: 'fixed',
    preset_key: 'male_charcoal',
    custom_description: 'Charcoal grey washed linen rolled sleeves, intentionally soft-blurred in background',
    sleeve_policy: 'forearms_exposed',
    accessories: []
  },
  environment: {
    preset_key: 'modern_kitchen',
    custom_description: 'Pristine polished white Carrara marble island countertop with delicate grey veining, minimal artisanal culinary setup',
    material_palette: ['white Carrara marble', 'subtle grey veining', 'natural wood cutting board', 'clear glass ramekins'],
    props: ['Damascus steel chef knife', 'clear glass blender jar', 'fresh whole ingredients', 'crystal ice glass'],
    background_density: 'minimal'
  },
  lighting: {
    preset_key: 'window_daylight',
    custom_description: 'Soft directional morning window daylight catching moisture droplets, pristine clean reflection on polished white marble',
    color_temperature: 'warm_neutral',
    contrast: 'soft'
  },
  camera: {
    framing: 'hands_closeup',
    perspective: 'third_person',
    lens_look: 'macro_closeup',
    depth_of_field: 'shallow',
    movement: 'subtle_handheld'
  },
  style: {
    preset_key: 'culinary_cinematic',
    custom_description: 'Extreme knife-edge macro culinary cinematography, razor-sharp focus on ingredients with heavily blurred soft bokeh background, high dopamine ASMR food prep',
    aspect_ratio: '9:16'
  },
  rendering: {
    geometry: 'simplified_semi_realistic',
    textures: ['clean_marble_reflection', 'fresh_produce_dew', 'knife_steel_grain'],
    shadow_style: 'soft_ambient',
    finish: 'soft_matte'
  },
  composition: {
    primary_idea_count: 1,
    primary_subject_count: 1,
    negative_space: 'moderate',
    safe_zone: 'vertical_social_ui'
  },
  guardrails: {
    face_visibility: 'prohibited',
    reflection_face: 'prohibited',
    unintended_people: 'prohibited',
    extra_people: 'prohibited',
    intentional_crowd: 'prohibited',
    identity_drift: 'prohibited',
    wardrobe_drift: 'prohibited',
    required_negative_prompts: [
      'sharp human body',
      'prominent arms',
      'sharp hands',
      'person standing',
      'facial features',
      'clutter',
      'messy surfaces',
      'warm yellow artificial cast',
      'plastic disposable packaging'
    ]
  }
};

export async function seedHabitFolkPreset(targetSchema = 'staging') {
  console.log(`\n🌱 [Seeder] Starting HabitFolk Visual Identity seeding for schema: "${targetSchema}"...`);

  const pool = new Pool({
    host: process.env.PGHOST || '100.78.186.123',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'makna_user',
    password: process.env.PGPASSWORD || 'maknagridpass',
    database: process.env.PGDATABASE || 'maknaflow_db',
    ssl: false
  });

  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO ${targetSchema}, public`);

    // 1. Validasi & normalisasi config lewat contract V2
    const normalizedConfig = validateAndNormalizeVisualIdentity(HABITFOLK_MACRO_CRAFT_CONFIG);

    const presetId = 'vi_habitfolk_macro_craft';
    const presetKey = 'habitfolk_satisfying_macro_craft';
    const tenantId = 'default_tenant';
    const label = normalizedConfig.label;
    const description = normalizedConfig.description;

    // 2. Upsert ke visual_identity_presets
    const upsertQuery = `
      INSERT INTO visual_identity_presets (
        id, tenant_id, preset_key, label, description, config_json, status, version, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'active', 1, CURRENT_TIMESTAMP)
      ON CONFLICT (tenant_id, preset_key) DO UPDATE SET
        label = EXCLUDED.label,
        description = EXCLUDED.description,
        config_json = EXCLUDED.config_json,
        status = 'active',
        version = visual_identity_presets.version + 1,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, tenant_id, preset_key, label, version;
    `;

    const res = await client.query(upsertQuery, [
      presetId,
      tenantId,
      presetKey,
      label,
      description,
      JSON.stringify(normalizedConfig)
    ]);
    console.log(`✅ [Success] Preset seeded/updated in "${targetSchema}":`, res.rows[0]);

    // 3. Update visual_signature & forbidden_elements di brand_profiles HabitFolk
    const updateBrandQuery = `
      UPDATE brand_profiles
      SET 
        visual_signature = 'Satisfying macro culinary sensory prep on white Carrara marble. Razor-sharp micro focus on ingredients and tools, with subtle blurred out-of-focus motion of a Caucasian male chef in creamy bokeh background. High sensory visual reward.',
        forbidden_elements = 'Sharp prominent human arms, visible facial features, human torso, cluttered messy counters, plastic packaging, artificial harsh studio glare.'
      WHERE tenant_id = $1 AND (brand_name ILIKE '%habitfolk%' OR id = '226f835a-1717-4c0f-b1ab-0b276130c839')
      RETURNING id, brand_name, visual_signature;
    `;
    const brandRes = await client.query(updateBrandQuery, [tenantId]);
    console.log(`✅ [Success] Brand Profile HabitFolk updated in "${targetSchema}":`, brandRes.rows);

    return { preset: res.rows[0], brand: brandRes.rows[0] };
  } finally {
    client.release();
    await pool.end();
  }
}

// Support direct CLI invocation
if (process.argv[1]?.endsWith('seed-habitfolk-visual-identity.mjs')) {
  const schemaArg = process.argv[2] || process.env.TARGET_SCHEMA || 'staging';
  seedHabitFolkPreset(schemaArg)
    .then(() => {
      console.log(`✨ Seeding completed successfully for ${schemaArg}.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Seeding error:', err);
      process.exit(1);
    });
}
