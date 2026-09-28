import { getPgPool, closePgPool } from '../lib/db-pg.js';
import { validateAndNormalizeVisualIdentity } from '../lib/visual-identity-contract.js';
import { resolveVisualIdentitySnapshot } from '../lib/visual-override-resolver.js';

const SASYAHOUSE_CONFIG = {
  schema_version: '2',
  label: 'SasyaHouse Modern Muslimah Lifestyle',
  description: 'Visual identity resmi SasyaHouse: Mahasiswi muslimah faceless hands-only, gaya hidup modern minimalis Gen Z, kuliner & hunian estetik di Sigura-gura Malang.',
  
  subject: {
    kind: 'human',
    faceless_mode: 'hands_only',
    demographic_key: 'syari_classic',
    custom_description: 'a graceful Southeast Asian Muslimah student, delicate female hands with smooth light skin, slender fingers, natural neat fingernails, strictly faceless framing, camera focused entirely on forearms and hands, cropped from elbow down, strictly omitting face, head, neck, and shoulders',
    character_count: 1,
    population_mode: 'single'
  },
  
  visual_language: {
    primary_style: 'culinary_cinematic',
    supporting_styles: ['commercial_product_cinematic', 'cinematic_realistic'],
    disabled_styles: ['editorial_graphic_novel', 'shadow_silhouette', 'clay_political_theater']
  },
  
  mode_routing: {
    hook: 'culinary_cinematic',
    context: 'commercial_product_cinematic',
    mechanism: 'culinary_cinematic',
    consequence: 'commercial_product_cinematic',
    evidence_reveal: 'commercial_product_cinematic',
    conclusion: 'culinary_cinematic'
  },
  
  rendering: {
    geometry: 'photorealistic_clean',
    textures: [
      'natural_skin_textures',
      'authentic_steam_and_moisture',
      'clean_matte_white_surface',
      'light_natural_oak_wood'
    ],
    shadow_style: 'soft_natural',
    finish: 'photorealistic_cinematic'
  },
  
  composition: {
    primary_idea_count: 1,
    primary_subject_count: 1,
    negative_space: 'required',
    safe_zone: 'vertical_social_ui'
  },
  
  metaphor_engine: {
    enabled: false,
    pattern: 'direct_visual_evidence'
  },
  
  wardrobe: {
    mode: 'fixed',
    preset_key: 'terracotta_amber',
    custom_description: 'modest long flowing sleeves in Amber Haze and Warm Terracotta tones covering the arms completely down to the wrists, clean neat fabric cuffs (strictly wrists covered)',
    primary_color: '#C86D51',
    secondary_color: '#E89A3C',
    material: 'breathable matte cotton fabric',
    sleeve_policy: 'wrists_covered',
    accessories: ['dainty minimalist silver wristwatch with slim strap']
  },
  
  environment: {
    preset_key: 'custom',
    custom_description: 'clean modern minimalist white study desk with light natural oak wood accents, aesthetic Korean-Scandinavian student room in Sigura-gura Malang, warm ambient lighting, laptop with high-speed internet charts, tidy pastel stationery, clean shared pantry and RO drinking station',
    material_palette: [
      'clean white matte laminate',
      'light natural oak wood',
      'smooth ceramic',
      'clear glass'
    ],
    props: [
      'modern laptop',
      'aesthetic pastel notebook',
      'ceramic mug with warm drink',
      'minimalist desk lamp',
      'mini potted succulent'
    ],
    background_density: 'balanced'
  },
  
  lighting: {
    preset_key: 'window_daylight',
    custom_description: 'illuminated by soft natural warm golden daylight coming from side window, gentle ambient glow, appetizing highlights on food and surfaces, realistic soft-shadow roll-off',
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
    custom_description: 'premium modern Gen Z student lifestyle and culinary cinematography, warm inviting ambience, clean 8k photorealism',
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
    required_negative_prompts: [
      'rustic wooden table',
      'worn-out rough wooden desk',
      'cluttered messy desk',
      'dark gloomy lighting',
      'political editorial illustration',
      'flat 2D vector clipart',
      'visible human face',
      'exposed arms',
      'bare skin above wrists',
      'unappetizing food'
    ]
  }
};

async function executeSetup() {
  const pool = getPgPool();
  const validatedConfig = validateAndNormalizeVisualIdentity(SASYAHOUSE_CONFIG);
  const schemas = ['staging', 'dev'];

  for (const s of schemas) {
    console.log(`\n========================================================================`);
    console.log(`🚀 APPLYING SASYAHOUSE VISUAL IDENTITY TO SCHEMA: ${s}`);
    console.log(`========================================================================`);

    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO ${s},public;`);
      await client.query('BEGIN');

      // 1. Upsert visual_identity_presets
      const presetId = `vi_sasya_${Date.now().toString(36)}`;
      const presetQuery = `
        INSERT INTO ${s}.visual_identity_presets (id, tenant_id, preset_key, label, description, status, version, config_json)
        VALUES ($1, 'default_tenant', $2, $3, $4, 'active', 1, $5)
        ON CONFLICT (tenant_id, preset_key) DO UPDATE
        SET 
          label = EXCLUDED.label,
          description = EXCLUDED.description,
          config_json = EXCLUDED.config_json,
          version = ${s}.visual_identity_presets.version + 1,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, preset_key, label, version;
      `;

      const presetRes = await client.query(presetQuery, [
        presetId,
        'sasyahouse_modern_muslimah_lifestyle',
        'SasyaHouse Modern Muslimah Lifestyle',
        'Visual identity resmi SasyaHouse: Mahasiswi muslimah faceless hands-only, gaya hidup modern minimalis Gen Z, kuliner & hunian estetik di Sigura-gura Malang.',
        JSON.stringify(validatedConfig)
      ]);

      console.log(`✅ [${s}] Visual Identity Preset saved:`, presetRes.rows[0]);

      // 2. Update brand_profiles for sasyahouse
      const bpQuery = `
        UPDATE ${s}.brand_profiles
        SET
          visual_signature = 'Modern Gen Z minimalist aesthetic, clean white study desk with light oak accents, cozy air-conditioned bedroom with warm ambient glow, clean modern pantry, photorealistic lifestyle cinematography.',
          color_palette = 'Amber Haze (#E89A3C), Terracotta (#C86D51), Clean Matte White, Light Natural Oak Wood, Warm Pastel Beige',
          forbidden_elements = 'rustic wooden table, worn-out rough furniture, dim dark gloomy room, political editorial illustration, flat vector clipart, visible human faces, bare skin above wrists'
        WHERE brand_name ILIKE '%sasya%' OR id::text = 'bce49806-4e43-4360-90ea-9aa083b807e8'
        RETURNING id, brand_name, visual_signature, color_palette, forbidden_elements;
      `;

      const bpRes = await client.query(bpQuery);
      if (bpRes.rows.length > 0) {
        console.log(`✅ [${s}] Brand Profile sasyahouse updated:`, bpRes.rows[0]);
      } else {
        console.log(`ℹ️ [${s}] Brand Profile sasyahouse not found in this schema.`);
      }

      // 3. Sanitize rustic occurrences in campaign opc_260928_kllhub if present
      const campCheck = await client.query(`SELECT id, visual_overrides_json FROM ${s}.pillar_campaigns WHERE id = 'opc_260928_kllhub'`);
      if (campCheck.rows.length > 0) {
        console.log(`\n🧹 [${s}] Sanitizing rustic occurrences in campaign opc_260928_kllhub...`);

        // Resolve snapshot
        const resolvedSnapshot = resolveVisualIdentitySnapshot({
          schema_version: 'visual_identity_snapshot_v1',
          structured: validatedConfig
        }, { narrative_function: 'hook' });

        resolvedSnapshot.resolved.negative_prompt = 'rustic wooden table, worn-out rough wooden desk, cluttered messy desk, dark gloomy lighting, political editorial illustration, flat 2D vector clipart, visible human face, exposed arms, bare skin above wrists, unappetizing food, oversaturated cartoon, blurry distorted hands, bad anatomy, extra fingers';

        const payload = {
          schema_version: 'visual_identity_snapshot_v1',
          identity_ref: {
            id: presetRes.rows[0].id,
            key: 'sasyahouse_modern_muslimah_lifestyle',
            version: presetRes.rows[0].version,
            source: 'tenant'
          },
          structured: validatedConfig,
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

        await client.query(`
          UPDATE ${s}.pillar_campaigns
          SET visual_style = 'Culinary Cinematic', visual_overrides_json = $1
          WHERE id = 'opc_260928_kllhub'
        `, [JSON.stringify(payload)]);

        console.log(`✅ [${s}] Master pillar_campaigns opc_260928_kllhub sanitized.`);

        // Sanitize all items
        const itemsRes = await client.query(`
          SELECT id, result_json, new_video_plan_json 
          FROM ${s}.pillar_campaign_items 
          WHERE campaign_id = 'opc_260928_kllhub'
          ORDER BY id ASC
        `);

        for (const row of itemsRes.rows) {
          let resultJsonStr = row.result_json || '{}';
          let planJsonStr = row.new_video_plan_json || '{}';

          const rusticReplacements = [
            [/rustic wooden student study desk surface/gi, 'clean modern minimalist white study desk with light oak wood accents'],
            [/rustic table surface toward a waiting plate/gi, 'sleek modern minimalist tabletop toward a waiting plate'],
            [/rustic table surface/gi, 'sleek modern minimalist tabletop with smooth matte finish'],
            [/authentic rustic wooden table/gi, 'clean aesthetic cafe tabletop with warm neutral lighting'],
            [/rustic wooden table/gi, 'clean modern minimalist study desk'],
            [/canteen wooden table surface/gi, 'modern minimalist dining table with clean ceramic tableware'],
            [/canteen wooden table/gi, 'modern minimalist dining table']
          ];

          for (const [pattern, repl] of rusticReplacements) {
            resultJsonStr = resultJsonStr.replace(pattern, repl);
            planJsonStr = planJsonStr.replace(pattern, repl);
          }

          const resultObj = JSON.parse(resultJsonStr);
          const planObj = JSON.parse(planJsonStr);
          resultObj.resolved_visual_overrides = resolvedSnapshot.resolved;

          await client.query(`
            UPDATE ${s}.pillar_campaign_items
            SET result_json = $1, new_video_plan_json = $2
            WHERE id = $3
          `, [JSON.stringify(resultObj), JSON.stringify(planObj), row.id]);

          console.log(`✅ [${s}] Item ${row.id} sanitized.`);
        }
      }

      await client.query('COMMIT');
      console.log(`🎉 [${s}] ALL CHANGES COMMITTED SUCCESSFULLY.`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`❌ [${s}] Setup failed and rolled back:`, err);
      throw err;
    } finally {
      client.release();
    }
  }

  await closePgPool();
}

executeSetup().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
