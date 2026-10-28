import { Pool } from 'pg';
import { validateAndNormalizeVisualIdentity } from '../lib/visual-identity-contract.js';

// ============================================================================
// 1. DAPUR BOTANI — FULL SCHEMA V2 (15/15 DOMAINS)
// ============================================================================
export const DAPUR_BOTANI_CONFIG = {
  schema_version: '2',
  label: 'Dapur Botani — Earthy Botanical Apothecary & 3D Bio-Cellular',
  description: 'Earthy Eastern botanical apothecary and 3D bio-cellular organ healing. 100% object-first faceless cinematography on rough black slate stone and amber glass dropper bottles.',
  subject: {
    kind: 'human',
    faceless_mode: 'hands_only',
    demographic_key: 'custom',
    custom_description: 'Faceless natural hands handling roots and botanicals, 100% focus on ingredients, slate stone, and 3D organ CGI, zero visible face or body.',
    character_count: 1,
    population_mode: 'single',
    universe_profile_id: null,
    universe_slug: null,
    universe_name: null,
    character_keys: []
  },
  visual_language: {
    primary_style: 'culinary_cinematic',
    supporting_styles: ['cinematic_realistic', 'symbolic_surrealism'],
    disabled_styles: ['editorial_graphic_novel', 'isometric_society', 'clay_political_theater', 'cozy_claymation']
  },
  mode_routing: {
    hook: 'culinary_cinematic',
    context: 'culinary_cinematic',
    mechanism: 'symbolic_surrealism',
    consequence: 'cinematic_realistic',
    evidence_reveal: 'culinary_cinematic',
    conclusion: 'culinary_cinematic'
  },
  rendering: {
    geometry: 'simplified_semi_realistic',
    textures: ['rough_black_slate_stone', 'dark_amber_glass_refraction', 'herbal_dew_droplets', '3d_cellular_translucency'],
    shadow_style: 'soft_ambient',
    finish: 'soft_matte'
  },
  composition: {
    primary_idea_count: 1,
    primary_subject_count: 1,
    negative_space: 'moderate',
    safe_zone: 'vertical_social_ui'
  },
  metaphor_engine: {
    enabled: true,
    pattern: 'concept_to_object_to_action'
  },
  wardrobe: {
    mode: 'fixed',
    preset_key: 'custom',
    custom_description: 'Earthy unbleached raw linen rolled sleeves, soft-blurred in creamy bokeh background',
    primary_color: 'earthy_raw_linen',
    secondary_color: 'olive_muted',
    material: 'natural_linen',
    sleeve_policy: 'forearms_exposed',
    accessories: []
  },
  environment: {
    preset_key: 'custom',
    custom_description: 'Artisanal apothecary studio, rough black slate stone workstation with glistening natural dew droplets, rustic granite mortar and pestle',
    material_palette: ['rough black slate stone', 'dark granite mortar and pestle', 'vintage amber glass dropper bottles', 'clear ribbed glass'],
    props: ['rustic granite pestle', 'amber glass dropper', 'dried medicinal botanicals', 'botanical extraction glassware'],
    background_density: 'minimal'
  },
  lighting: {
    preset_key: 'window_daylight',
    custom_description: 'Moody organic directional golden morning window light (3500K) with soft chiaroscuro shadows and warm amber reflections',
    color_temperature: 'warm',
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
    custom_description: 'Tactile macro botanical extraction combined with cinematic 3D medical CGI organ healing simulations when pathologies are discussed',
    aspect_ratio: '9:16'
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
      'human face',
      'syari dress',
      'human standing',
      'messy kitchen',
      'white marble veining',
      'bright synthetic colors'
    ]
  }
};

// ============================================================================
// 2. NUTRIBAKE — FULL SCHEMA V2 (15/15 DOMAINS)
// ============================================================================
export const NUTRIBAKE_CONFIG = {
  schema_version: '2',
  label: 'Nutribake — Clean Modern Kitchen & Sensory Baking',
  description: 'ASMR sensory baking and sugar-free pastry craft set in a pristine modern kitchen. 100% object-first faceless cinematography anchored on seamless flat matte warm-grey quartz countertop.',
  subject: {
    kind: 'human',
    faceless_mode: 'hands_only',
    demographic_key: 'custom',
    custom_description: 'Minimalist out-of-focus hand movement in creamy background bokeh (f/1.4), keeping 100% visual focus on rich chocolate ganache, dough texture, and crumb fractures.',
    character_count: 1,
    population_mode: 'single',
    universe_profile_id: null,
    universe_slug: null,
    universe_name: null,
    character_keys: []
  },
  visual_language: {
    primary_style: 'culinary_cinematic',
    supporting_styles: ['commercial_product_cinematic'],
    disabled_styles: ['editorial_graphic_novel', 'isometric_society', 'clay_political_theater', 'cozy_claymation', 'symbolic_surrealism']
  },
  mode_routing: {
    hook: 'culinary_cinematic',
    context: 'culinary_cinematic',
    mechanism: 'culinary_cinematic',
    consequence: 'culinary_cinematic',
    evidence_reveal: 'commercial_product_cinematic',
    conclusion: 'culinary_cinematic'
  },
  rendering: {
    geometry: 'simplified_semi_realistic',
    textures: ['matte_warm_grey_quartz', 'glossy_chocolate_sheen', 'cake_crumb_micro_texture', 'floured_silicone_surface'],
    shadow_style: 'soft_ambient',
    finish: 'soft_matte'
  },
  composition: {
    primary_idea_count: 1,
    primary_subject_count: 1,
    negative_space: 'moderate',
    safe_zone: 'vertical_social_ui'
  },
  metaphor_engine: {
    enabled: true,
    pattern: 'concept_to_object_to_action'
  },
  wardrobe: {
    mode: 'fixed',
    preset_key: 'custom',
    custom_description: 'Clean oatmeal cotton rolled sleeves, soft-blurred in creamy bokeh background',
    primary_color: 'oatmeal_neutral',
    secondary_color: 'sand_cream',
    material: 'washed_cotton',
    sleeve_policy: 'forearms_exposed',
    accessories: []
  },
  environment: {
    preset_key: 'modern_kitchen',
    custom_description: 'Pristine modern kitchen island with seamless flat matte warm-grey quartz countertop, strictly zero marble veining, ultra-clean architectural minimalist setup',
    material_palette: ['seamless flat matte warm-grey quartz countertop', 'zero marble veining', 'matte stoneware ceramic bowls', 'copper fluted tart pans'],
    props: ['copper pastry tools', 'matte stoneware bowls', 'gold dessert fork', 'natural parchment paper'],
    background_density: 'minimal'
  },
  lighting: {
    preset_key: 'window_daylight',
    custom_description: 'Bright modern architectural morning daylight with soft even ambient fill, accentuating glossy chocolate ribbons and golden crumb micro-fractures',
    color_temperature: 'neutral',
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
    custom_description: 'Sensory ASMR macro pastry cinematography, fork cutting into velvety mousse cake with moist sheen, kinetic ganache pouring, and airy crumb cross-sections',
    aspect_ratio: '9:16'
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
      'human face',
      'syari dress',
      'white marble veining',
      'rough black slate',
      'herbal amber medicine bottles',
      'greasy surfaces'
    ]
  }
};

// ============================================================================
// 3. SIASAT SEHAT — FULL SCHEMA V2 (15/15 DOMAINS)
// ============================================================================
export const SIASAT_SEHAT_CONFIG = {
  schema_version: '2',
  label: 'Siasat Sehat — Clinical Biohacking & 3D High-Tech Anatomy',
  description: 'Evidence-based clinical biohacking and futuristic 3D biomedical anatomical visualization. 100% object-first faceless cinematography on matte charcoal micro-cement with borosilicate lab beakers and titanium gear.',
  subject: {
    kind: 'human',
    faceless_mode: 'hands_only',
    demographic_key: 'custom',
    custom_description: '100% object-centric clinical biohacking cinematography focusing on precision laboratory glassware, magnetic vortex stirrers, and 3D biomedical CGI anatomy, zero human face.',
    character_count: 1,
    population_mode: 'single',
    universe_profile_id: null,
    universe_slug: null,
    universe_name: null,
    character_keys: []
  },
  visual_language: {
    primary_style: 'commercial_product_cinematic',
    supporting_styles: ['cinematic_realistic', 'symbolic_surrealism'],
    disabled_styles: ['editorial_graphic_novel', 'isometric_society', 'clay_political_theater', 'cozy_claymation']
  },
  mode_routing: {
    hook: 'commercial_product_cinematic',
    context: 'commercial_product_cinematic',
    mechanism: 'symbolic_surrealism',
    consequence: 'cinematic_realistic',
    evidence_reveal: 'commercial_product_cinematic',
    conclusion: 'commercial_product_cinematic'
  },
  rendering: {
    geometry: 'simplified_semi_realistic',
    textures: ['matte_charcoal_micro_cement', 'borosilicate_clear_glass', 'brushed_titanium_metal', 'biomedical_glowing_synapses'],
    shadow_style: 'strong_geometric',
    finish: 'matte_editorial'
  },
  composition: {
    primary_idea_count: 1,
    primary_subject_count: 1,
    negative_space: 'moderate',
    safe_zone: 'vertical_social_ui'
  },
  metaphor_engine: {
    enabled: true,
    pattern: 'concept_to_object_to_action'
  },
  wardrobe: {
    mode: 'fixed',
    preset_key: 'custom',
    custom_description: 'Technical matte charcoal performance weave sleeves, minimalist and crisp, soft-blurred in background',
    primary_color: 'technical_charcoal',
    secondary_color: 'slate_grey',
    material: 'technical_performance_weave',
    sleeve_policy: 'forearms_exposed',
    accessories: ['minimalist titanium smart ring']
  },
  environment: {
    preset_key: 'custom',
    custom_description: 'High-tech functional medicine studio and biohacking laboratory workstation, matte charcoal micro-cement surface, precision borosilicate glassware and minimalist titanium instruments',
    material_palette: ['matte charcoal micro-cement countertop', 'borosilicate glass beakers', 'brushed titanium smart accessories', 'magnetic stirrer vortex'],
    props: ['magnetic vortex mixer', 'borosilicate graduated cylinder', 'clinical micropipette', 'titanium formulation capsule'],
    background_density: 'minimal'
  },
  lighting: {
    preset_key: 'window_daylight',
    custom_description: 'Crisp neutral 5500K clinical daylight with subtle electric cyan and amber bioluminescence accents, high digital definition, sharp geometric shadows',
    color_temperature: 'cool',
    contrast: 'medium'
  },
  camera: {
    framing: 'hands_closeup',
    perspective: 'third_person',
    lens_look: 'macro_closeup',
    depth_of_field: 'shallow',
    movement: 'subtle_handheld'
  },
  style: {
    preset_key: 'commercial_product_cinematic',
    custom_description: 'High-tech 3D biomedical CGI simulation of translucent anatomy, cellular ATP energy, and neural synapses combined with clean precision biohacking macro object cinematography',
    aspect_ratio: '9:16'
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
      'caucasian male',
      'human portrait',
      'person standing',
      'messy home kitchen',
      'rustic wood',
      'clay pottery',
      'white marble'
    ]
  }
};

export const PRESET_DEFINITIONS = [
  {
    id: 'vi_dapurbotani_apothecary_3d',
    preset_key: 'dapurbotani_apothecary_3d',
    config: DAPUR_BOTANI_CONFIG,
    brandQuery: `
      UPDATE brand_profiles
      SET 
        visual_signature = 'Tactile macro botanical extraction on rough black slate stone with vintage amber dropper bottles and rustic granite mortar. Directional 3500K golden window chiaroscuro daylight. High-end 3D bio-cellular CGI simulations of soft organ tissue healing during pathology mechanisms. 100% faceless object-first cinematography.',
        forbidden_elements = 'Human face, syari dress, human body standing, messy kitchen, white marble veining, bright synthetic colors.'
      WHERE tenant_id = $1 AND (brand_name ILIKE '%botani%' OR id = 'df382ce8-2145-4464-ae63-79375ff3aff2')
      RETURNING id, brand_name, visual_signature;
    `
  },
  {
    id: 'vi_nutribake_modern_pastry',
    preset_key: 'nutribake_modern_pastry',
    config: NUTRIBAKE_CONFIG,
    brandQuery: `
      UPDATE brand_profiles
      SET 
        visual_signature = 'Sensory ASMR pastry craft and sugar-free baking cinematography anchored strictly on seamless flat matte warm-grey quartz countertop with zero marble veining. Clean modern architectural morning daylight. Rich chocolate ganache cascades, kinetic fork cutting into moist crumb fractures, and fluted copper tart pans. 100% faceless hands-only movement.',
        forbidden_elements = 'Human face, syari dress, white marble veining, rough black slate stone, amber herbal medicine bottles, greasy surfaces.'
      WHERE tenant_id = $1 AND (brand_name ILIKE '%nutribake%' OR id = '940e766b-76d0-49b7-b6d5-01dfb0041d40')
      RETURNING id, brand_name, visual_signature;
    `
  },
  {
    id: 'vi_siasatsehat_clinical_biohack_3d',
    preset_key: 'siasatsehat_clinical_biohack_3d',
    config: SIASAT_SEHAT_CONFIG,
    brandQuery: `
      UPDATE brand_profiles
      SET 
        visual_signature = 'Clinical biohacking and evidence-based functional health cinematography anchored on matte charcoal micro-cement surface with borosilicate laboratory beakers, magnetic vortex stirrers, and titanium gear. Crisp 5500K clinical daylight with subtle cyan bioluminescence accents. High-tech 3D biomedical CGI simulations of cellular ATP energy, neural synapses, and insulin receptors. 100% faceless object-first cinematography.',
        forbidden_elements = 'Caucasian male, human portrait, human body standing, messy home kitchen, rustic wood, clay pottery, white marble.'
      WHERE tenant_id = $1 AND (brand_name ILIKE '%siasat%' OR id = 'dc6098cc-e74c-4ec1-9a67-658edc7c710b')
      RETURNING id, brand_name, visual_signature;
    `
  }
];

export async function seedBrandVisualIdentities(targetSchema = 'staging') {
  console.log(`\n🌱 [Seeder] Starting Visual Identity Presets seeding for schema: "${targetSchema}"...`);

  const pool = new Pool({
    host: process.env.PGHOST || '100.78.186.123',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'makna_user',
    password: process.env.PGPASSWORD || 'maknagridpass',
    database: process.env.PGDATABASE || 'maknaflow_db',
    ssl: false
  });

  const client = await pool.connect();
  const tenantId = 'default_tenant';

  try {
    await client.query(`SET search_path TO ${targetSchema}, public`);

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

    const seededPresets = [];
    const updatedBrands = [];

    for (const item of PRESET_DEFINITIONS) {
      const normalized = validateAndNormalizeVisualIdentity(item.config);

      const res = await client.query(upsertQuery, [
        item.id,
        tenantId,
        item.preset_key,
        normalized.label,
        normalized.description,
        JSON.stringify(normalized)
      ]);
      console.log(`  ✅ [Preset] Upserted "${normalized.label}" (key: ${item.preset_key})`);
      seededPresets.push(res.rows[0]);

      if (item.brandQuery) {
        const brandRes = await client.query(item.brandQuery, [tenantId]);
        if (brandRes.rows.length > 0) {
          console.log(`  🏷️  [Brand] Updated brand profile for "${brandRes.rows[0].brand_name}"`);
          updatedBrands.push(brandRes.rows[0]);
        }
      }
    }

    console.log(`✨ [Finished] Seeding complete for "${targetSchema}". Total presets: ${seededPresets.length}, Brands updated: ${updatedBrands.length}`);
    return { seededPresets, updatedBrands };
  } finally {
    client.release();
    await pool.end();
  }
}

// Support direct CLI invocation
if (process.argv[1]?.endsWith('seed-brand-visual-identities.mjs')) {
  const schemaArg = process.argv[2] || process.env.TARGET_SCHEMA || 'both';
  
  const run = async () => {
    if (schemaArg === 'both') {
      await seedBrandVisualIdentities('staging');
      await seedBrandVisualIdentities('dev');
    } else {
      await seedBrandVisualIdentities(schemaArg);
    }
  };

  run()
    .then(() => {
      console.log('\n🎉 All seeding tasks finished successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Seeding error:', err);
      process.exit(1);
    });
}
