import { getPgPool, closePgPool } from '../lib/db-pg.js';
import { validateAndNormalizeVisualIdentity } from '../lib/visual-identity-contract.js';
import { resolveVisualIdentitySnapshot } from '../lib/visual-override-resolver.js';

const TENANT_ID = 'ptgim_sosmed';

const IDENTITIES = [
  {
    preset_id: 'ptgim_vi_solusi_thermal_v1',
    preset_key: 'solusi_thermal_id',
    label: 'Solusi Thermal ID (Reno)',
    description: 'Visual identity resmi Solusi Thermal ID: Karakter 3D Reno Thermal Engineer, sains perpindahan panas, atap pabrik/bangunan metal, simulasi inframerah panas vs ruangan sejuk 21°C.',
    universe: {
      id: 'ptgim_univ_solusi_thermal',
      slug: 'solusi-thermal-id',
      name: 'Solusi Thermal ID Universe',
      premise: 'Edukasi sains termal, radiasi atap metal, dan teknologi insulasi bangunan penahan panas matahari.',
      tone: 'Informative, Smart, Innovative, High-Tech',
      knowledge_domain: 'thermal_insulation_and_energy_efficiency'
    },
    character: {
      id: 'ptgim_char_reno',
      character_key: 'reno_thermal_engineer',
      name: 'Reno (Thermal Engineer)',
      role: 'protagonist',
      canonical_prompt: 'charming stylized 3D young male Thermal Engineer named Reno, friendly expressive smiling face with clear eyes, smart glasses, neat hair under electric blue safety helmet, dark navy jumpsuit with bright solar-orange thermal accents, holding futuristic infrared thermal scanner tablet'
    },
    location: {
      id: 'ptgim_loc_thermal_facility',
      location_key: 'industrial_thermal_warehouse',
      name: 'Pabrik & Gudang Atap Metal',
      visual_description: 'Large modern factory warehouse with corrugated metal roof and 3D cross-section insulation layers'
    },
    brand_profile: {
      id: 'ptgim_bp_solusi_thermal',
      brand_name: 'Solusi Thermal ID',
      tone_of_voice: 'Edukasi cerdas, solutif, berbasis data suhu, dan meyakinkan',
      visual_signature: 'Pixar-style 3D animation, Reno Thermal Specialist, atap metal, heatmap inframerah oranye vs ruangan biru sejuk 21°C',
      color_palette: 'Solar Orange (#FF6B35), Cool Azure (#0284C7), Industrial Metal (#64748B)',
      forbidden_elements: 'wajah realistis seram, kartun 2D gepeng, ruangan suram tanpa pencahayaan termal'
    },
    config: {
      schema_version: '2',
      label: 'Solusi Thermal ID (Reno)',
      description: 'Visual identity edukasi termal dan insulasi peredam panas atap bersama Reno Thermal Engineer.',
      subject: {
        kind: 'stylized_3d_character',
        faceless_mode: 'not_applicable',
        demographic_key: 'custom',
        custom_description: 'charming stylized 3D young male Thermal Engineer named Reno, friendly expressive face with clear eyes, smart glasses, neat hair under electric blue safety helmet, dark navy jumpsuit with bright solar-orange thermal accents',
        character_count: 1,
        population_mode: 'single',
        face_visibility: 'allowed'
      },
      visual_language: {
        primary_style: 'stylized_3d_character',
        supporting_styles: ['commercial_product_cinematic', 'isometric_society'],
        disabled_styles: ['editorial_graphic_novel', 'shadow_silhouette', 'clay_political_theater']
      },
      mode_routing: {
        hook: 'stylized_3d_character',
        context: 'stylized_3d_character',
        mechanism: 'isometric_society',
        consequence: 'commercial_product_cinematic',
        evidence_reveal: 'commercial_product_cinematic',
        conclusion: 'stylized_3d_character'
      },
      rendering: {
        geometry: 'simplified_semi_realistic',
        textures: ['clean_matte_3d', 'shiny_aluminum_foil', 'corrugated_metal_roof', 'thermal_insulation_foam'],
        shadow_style: 'soft_ambient',
        finish: 'soft_matte'
      },
      composition: {
        primary_idea_count: 1,
        primary_subject_count: 1,
        negative_space: 'required',
        safe_zone: 'vertical_social_ui'
      },
      metaphor_engine: {
        enabled: true,
        pattern: 'concept_to_object_to_action'
      },
      wardrobe: {
        mode: 'fixed',
        preset_key: 'custom',
        custom_description: 'dark navy technical jumpsuit with bright solar-orange thermo stripes, electric blue safety helmet, smart glasses',
        primary_color: '#0F172A',
        secondary_color: '#FF6B35',
        material: 'technical workwear fabric',
        sleeve_policy: 'not_applicable',
        accessories: ['smart tech glasses', 'infrared thermal tablet scanner']
      },
      environment: {
        preset_key: 'custom',
        custom_description: 'modern factory warehouse with corrugated metal roof, cross-section roof insulation diagram, bright warm sunbeams contrasting with cool blue conditioned interior',
        material_palette: ['corrugated zincalume metal', 'aluminum foil radiant barrier', 'structural steel beams'],
        props: ['infrared thermal tablet', 'digital temperature display', '3D cutaway roof model'],
        background_density: 'balanced'
      },
      lighting: {
        preset_key: 'custom',
        custom_description: 'vibrant 3D studio lighting with dual color temperature: blazing warm solar orange above roof and cool azure ambient glow beneath insulation',
        color_temperature: 'warm_neutral',
        contrast: 'high_contrast'
      },
      camera: {
        framing: 'editorial_wide',
        perspective: 'third_person',
        lens_look: 'natural_50mm',
        depth_of_field: 'shallow',
        movement: 'subtle_handheld'
      },
      style: {
        preset_key: 'stylized_3d_character',
        custom_description: 'Pixar and DreamWorks style charming 3D animation, crisp expressive character modeling, vibrant educational lighting, premium 3D render',
        aspect_ratio: '9:16'
      },
      guardrails: {
        face_visibility: 'allowed',
        reflection_face: 'allowed',
        unintended_people: 'prohibited',
        extra_people: 'prohibited',
        intentional_crowd: 'allowed_faceless',
        identity_drift: 'prohibited',
        wardrobe_drift: 'prohibited',
        required_negative_prompts: ['creepy realistic human face', 'uncanny valley photorealism', 'amateur 2D clipart', 'dark gloomy horror mood']
      }
    }
  },
  {
    preset_id: 'ptgim_vi_ruang_akustik_v1',
    preset_key: 'ruang_akustik_id',
    label: 'Ruang Akustik ID (Maya)',
    description: 'Visual identity resmi Ruang Akustik ID: Karakter 3D Maya Acoustic Architect, peredaman suara ruang, interior premium, dan visualisasi gelombang suara cyan lembut.',
    universe: {
      id: 'ptgim_univ_ruang_akustik',
      slug: 'ruang-akustik-id',
      name: 'Ruang Akustik ID Universe',
      premise: 'Edukasi peredaman gema, akustik ruang, dan kenyamanan audio interior arsitektural.',
      tone: 'Sophisticated, Elegant, Calm, Creative, Tech-Savvy',
      knowledge_domain: 'room_acoustics_and_soundproofing'
    },
    character: {
      id: 'ptgim_char_maya',
      character_key: 'maya_acoustic_architect',
      name: 'Maya (Acoustic Architect)',
      role: 'protagonist',
      canonical_prompt: 'charming stylized 3D stylish young female Acoustic Architect named Maya, beautiful expressive smiling face, chic dark bob haircut, high-tech studio headphones around neck, tailored navy blue blazer with glowing electric cyan accents, holding digital sound level analyzer'
    },
    location: {
      id: 'ptgim_loc_acoustic_studio',
      location_key: 'luxury_acoustic_conference_room',
      name: 'Ruang Meeting & Studio Akustik Modern',
      visual_description: 'Modern luxury conference room and audio studio with geometric acoustic dark wall panels and warm walnut wood diffusers'
    },
    brand_profile: {
      id: 'ptgim_bp_ruang_akustik',
      brand_name: 'Ruang Akustik ID',
      tone_of_voice: 'Elegan, inspiratif, solutif, estetik arsitektural, dan menenangkan',
      visual_signature: 'Pixar-style 3D animation, Maya Acoustic Designer, panel akustik geometris, bilah kayu walnut, gelombang suara cyan neon',
      color_palette: 'Cyber Cyan (#06B6D4), Electric Teal (#14B8A6), Acoustic Purple (#8B5CF6), Midnight Navy (#0F172A), Walnut Wood (#78350F)',
      forbidden_elements: 'ruangan kusam tanpa estetika, kartun 2D kasar, kebisingan visual berantakan'
    },
    config: {
      schema_version: '2',
      label: 'Ruang Akustik ID (Maya)',
      description: 'Visual identity edukasi akustik interior dan peredam gema bersama Maya Acoustic Architect.',
      subject: {
        kind: 'stylized_3d_character',
        faceless_mode: 'not_applicable',
        demographic_key: 'custom',
        custom_description: 'charming stylized 3D stylish young female Acoustic Architect named Maya, beautiful expressive face, chic dark bob haircut, high-tech studio headphones around neck, tailored navy blue blazer with glowing electric cyan accents',
        character_count: 1,
        population_mode: 'single',
        face_visibility: 'allowed'
      },
      visual_language: {
        primary_style: 'stylized_3d_character',
        supporting_styles: ['commercial_product_cinematic', 'symbolic_surrealism'],
        disabled_styles: ['editorial_graphic_novel', 'shadow_silhouette', 'clay_political_theater']
      },
      mode_routing: {
        hook: 'stylized_3d_character',
        context: 'stylized_3d_character',
        mechanism: 'symbolic_surrealism',
        consequence: 'commercial_product_cinematic',
        evidence_reveal: 'commercial_product_cinematic',
        conclusion: 'stylized_3d_character'
      },
      rendering: {
        geometry: 'simplified_semi_realistic',
        textures: ['clean_matte_3d', 'porous_acoustic_felt', 'slatted_walnut_wood', 'matte_dark_wall_panel'],
        shadow_style: 'soft_ambient',
        finish: 'soft_matte'
      },
      composition: {
        primary_idea_count: 1,
        primary_subject_count: 1,
        negative_space: 'required',
        safe_zone: 'vertical_social_ui'
      },
      metaphor_engine: {
        enabled: true,
        pattern: 'concept_to_object_to_action'
      },
      wardrobe: {
        mode: 'fixed',
        preset_key: 'custom',
        custom_description: 'smart-casual navy tailored blazer with glowing electric cyan accents, dark inner top, modern designer studio headphones around neck',
        primary_color: '#0F172A',
        secondary_color: '#06B6D4',
        material: 'premium matte tailored fabric',
        sleeve_policy: 'not_applicable',
        accessories: ['designer studio headphones', 'digital sound level analyzer']
      },
      environment: {
        preset_key: 'custom',
        custom_description: 'luxury modern conference room and acoustic studio with dark 3D geometric acoustic wall panels, vertical walnut wood slats, and peaceful ambient evening lighting',
        material_palette: ['dark acoustic felt panel', 'warm walnut wood', 'soundproof double-glazed glass'],
        props: ['digital decibel meter', 'holographic sound spectrum tablet', 'acoustic diffuser slats'],
        background_density: 'balanced'
      },
      lighting: {
        preset_key: 'custom',
        custom_description: 'warm ambient interior architectural lighting with subtle neon electric cyan accents highlighting acoustic wall textures',
        color_temperature: 'warm_neutral',
        contrast: 'soft'
      },
      camera: {
        framing: 'editorial_wide',
        perspective: 'third_person',
        lens_look: 'natural_50mm',
        depth_of_field: 'shallow',
        movement: 'subtle_handheld'
      },
      style: {
        preset_key: 'stylized_3d_character',
        custom_description: 'Pixar and DreamWorks style elegant 3D animation, charming expressive female character modeling, quiet luxury aesthetic lighting',
        aspect_ratio: '9:16'
      },
      guardrails: {
        face_visibility: 'allowed',
        reflection_face: 'allowed',
        unintended_people: 'prohibited',
        extra_people: 'prohibited',
        intentional_crowd: 'allowed_faceless',
        identity_drift: 'prohibited',
        wardrobe_drift: 'prohibited',
        required_negative_prompts: ['creepy realistic human face', 'uncanny valley photorealism', 'harsh cluttered background', 'amateur 2D clipart']
      }
    }
  },
  {
    preset_id: 'ptgim_vi_jasa_insulasi_v1',
    preset_key: 'jasa_insulasi_id',
    label: 'Jasa Insulasi ID (Bima)',
    description: 'Visual identity resmi Jasa Insulasi ID: Karakter 3D Bima Master Field Craftsman, SOP pemasangan presisi tanpa celah, survei laser rangka atap, dan garansi kualitas rapi.',
    universe: {
      id: 'ptgim_univ_jasa_insulasi',
      slug: 'jasa-insulasi-id',
      name: 'Jasa Insulasi ID Universe',
      premise: 'Edukasi standar instalasi fisik, survei struktur, kerapian pengerjaan airtight tanpa celah, dan integritas craftsmanship konstruksi.',
      tone: 'Reliable, Practical, High-Quality, Professional, Energetic',
      knowledge_domain: 'field_insulation_installation_and_contracting'
    },
    character: {
      id: 'ptgim_char_bima',
      character_key: 'bima_field_craftsman',
      name: 'Bima (Master Field Craftsman)',
      role: 'protagonist',
      canonical_prompt: 'charming stylized 3D athletic male Field Installation Master named Bima, confident friendly handsome face, safety orange hardhat, durable slate grey workwear with high-vis neon yellow reflective stripes, utility toolbelt, holding high-precision green laser distance meter'
    },
    location: {
      id: 'ptgim_loc_roof_construction',
      location_key: 'light_steel_roof_construction',
      name: 'Area Proyek Konstruksi Rangka Baja Ringan',
      visual_description: 'Modern architectural construction site with light steel roof truss structure and scaffolding under clear daylight'
    },
    brand_profile: {
      id: 'ptgim_bp_jasa_insulasi',
      brand_name: 'Jasa Insulasi ID',
      tone_of_voice: 'Praktis, tegas, meyakinkan, terpercaya, dan mengutamakan kualitas pengerjaan',
      visual_signature: 'Pixar-style 3D animation, Bima Lead Technician, rangka baja ringan, laser meteran hijau, close-up foil tape seamless, checklist Quality Passed',
      color_palette: 'Safety Orange (#F97316), High-Vis Yellow (#EAB308), Workwear Slate (#475569), Zinc Metal (#CBD5E1)',
      forbidden_elements: 'pengerjaan berantakan, sambungan insulasi bolong/terkelupas, kartun 2D gepeng'
    },
    config: {
      schema_version: '2',
      label: 'Jasa Insulasi ID (Bima)',
      description: 'Visual identity panduan instalasi insulasi presisi bersama Bima Master Field Craftsman.',
      subject: {
        kind: 'stylized_3d_character',
        faceless_mode: 'not_applicable',
        demographic_key: 'custom',
        custom_description: 'charming stylized 3D athletic male Field Installation Master named Bima, confident friendly handsome face, safety orange hardhat, durable slate grey workwear with high-vis neon yellow reflective stripes, utility toolbelt',
        character_count: 1,
        population_mode: 'single',
        face_visibility: 'allowed'
      },
      visual_language: {
        primary_style: 'stylized_3d_character',
        supporting_styles: ['commercial_product_cinematic', 'editorial_graphic_novel'],
        disabled_styles: ['shadow_silhouette', 'clay_political_theater']
      },
      mode_routing: {
        hook: 'stylized_3d_character',
        context: 'stylized_3d_character',
        mechanism: 'commercial_product_cinematic',
        consequence: 'commercial_product_cinematic',
        evidence_reveal: 'commercial_product_cinematic',
        conclusion: 'stylized_3d_character'
      },
      rendering: {
        geometry: 'simplified_semi_realistic',
        textures: ['clean_matte_3d', 'shiny_aluminum_foil_tape', 'galvalume_steel_truss', 'high_vis_fabric'],
        shadow_style: 'soft_ambient',
        finish: 'soft_matte'
      },
      composition: {
        primary_idea_count: 1,
        primary_subject_count: 1,
        negative_space: 'required',
        safe_zone: 'vertical_social_ui'
      },
      metaphor_engine: {
        enabled: true,
        pattern: 'concept_to_object_to_action'
      },
      wardrobe: {
        mode: 'fixed',
        preset_key: 'custom',
        custom_description: 'safety orange hard hat, durable slate grey workwear dungarees/vest with reflective neon stripes, heavy-duty leather gloves, leather tool belt',
        primary_color: '#F97316',
        secondary_color: '#475569',
        material: 'durable workwear canvas and high-vis reflective bands',
        sleeve_policy: 'not_applicable',
        accessories: ['laser distance meter', 'utility cutter', 'heavy-duty gloves', 'measuring tape']
      },
      environment: {
        preset_key: 'custom',
        custom_description: 'bright clear daylight construction site with light steel roof truss structure, scaffolding, and precision installation workspace',
        material_palette: ['light steel galvalume truss', 'silver foil insulation roll', 'aluminum tape', 'scaffolding steel'],
        props: ['green beam laser distance meter', 'floating digital blueprint checklist', 'insulation roll cutter'],
        background_density: 'balanced'
      },
      lighting: {
        preset_key: 'custom',
        custom_description: 'crisp natural daylight with soft studio bounce light, highlighting technical roof construction details and bright reflective safety vest',
        color_temperature: 'warm_neutral',
        contrast: 'medium'
      },
      camera: {
        framing: 'editorial_wide',
        perspective: 'third_person',
        lens_look: 'natural_50mm',
        depth_of_field: 'shallow',
        movement: 'subtle_handheld'
      },
      style: {
        preset_key: 'stylized_3d_character',
        custom_description: 'Pixar and DreamWorks style dynamic 3D animation, friendly athletic male character modeling, clear technical construction aesthetic',
        aspect_ratio: '9:16'
      },
      guardrails: {
        face_visibility: 'allowed',
        reflection_face: 'allowed',
        unintended_people: 'prohibited',
        extra_people: 'prohibited',
        intentional_crowd: 'allowed_faceless',
        identity_drift: 'prohibited',
        wardrobe_drift: 'prohibited',
        required_negative_prompts: ['creepy realistic human face', 'uncanny valley photorealism', 'shoddy broken installation', 'amateur 2D clipart']
      }
    }
  }
];

async function registerVisualIdentities() {
  const pool = getPgPool();
  const schemas = ['staging', 'dev'];

  console.log(`========================================================================`);
  console.log(`🚀 STARTING PTGIM VISUAL IDENTITIES REGISTRATION (TENANT: ${TENANT_ID})`);
  console.log(`========================================================================\n`);

  for (const s of schemas) {
    console.log(`\n------------------------------------------------------------------------`);
    console.log(`📦 APPLYING TO SCHEMA: ${s}`);
    console.log(`------------------------------------------------------------------------`);

    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO ${s},public;`);
      await client.query('BEGIN');

      for (const item of IDENTITIES) {
        console.log(`\n🔹 Processing [${item.preset_key}] - ${item.label}...`);

        // Validate config against Schema v2
        const validatedConfig = validateAndNormalizeVisualIdentity(item.config);

        // 1. Upsert visual_identity_presets
        const viQuery = `
          INSERT INTO ${s}.visual_identity_presets (
            id, tenant_id, preset_key, label, description, status, version, config_json
          )
          VALUES ($1, $2, $3, $4, $5, 'active', 1, $6)
          ON CONFLICT (tenant_id, preset_key) DO UPDATE
          SET
            label = EXCLUDED.label,
            description = EXCLUDED.description,
            config_json = EXCLUDED.config_json,
            version = ${s}.visual_identity_presets.version + 1,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id, preset_key, label, version;
        `;
        const viRes = await client.query(viQuery, [
          item.preset_id,
          TENANT_ID,
          item.preset_key,
          item.label,
          item.description,
          JSON.stringify(validatedConfig)
        ]);
        console.log(`  ✅ Visual Identity Preset:`, viRes.rows[0]);

        // 2. Upsert universe_profiles
        const univ = item.universe;
        const univQuery = `
          INSERT INTO ${s}.universe_profiles (
            id, tenant_id, name, slug, premise, tone, knowledge_domain, human_presence,
            default_visual_style, default_aspect_ratio, status, version
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'stylized_3d_character', 'stylized_3d_character', '9:16', 'active', 1)
          ON CONFLICT (tenant_id, slug) DO UPDATE
          SET
            name = EXCLUDED.name,
            premise = EXCLUDED.premise,
            tone = EXCLUDED.tone,
            knowledge_domain = EXCLUDED.knowledge_domain,
            default_visual_style = EXCLUDED.default_visual_style,
            version = ${s}.universe_profiles.version + 1,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id, slug, name, version;
        `;
        const univRes = await client.query(univQuery, [
          univ.id,
          TENANT_ID,
          univ.name,
          univ.slug,
          univ.premise,
          univ.tone,
          univ.knowledge_domain
        ]);
        console.log(`  ✅ Universe Profile:`, univRes.rows[0]);

        // 3. Upsert universe_characters
        const char = item.character;
        const charQuery = `
          INSERT INTO ${s}.universe_characters (
            id, tenant_id, universe_id, name, character_key, role, canonical_prompt, version
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
          ON CONFLICT (universe_id, character_key) DO UPDATE
          SET
            name = EXCLUDED.name,
            role = EXCLUDED.role,
            canonical_prompt = EXCLUDED.canonical_prompt,
            version = ${s}.universe_characters.version + 1,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id, character_key, name, version;
        `;
        const charRes = await client.query(charQuery, [
          char.id,
          TENANT_ID,
          univRes.rows[0].id,
          char.name,
          char.character_key,
          char.role,
          char.canonical_prompt
        ]);
        console.log(`  ✅ Universe Character:`, charRes.rows[0]);

        // 4. Upsert universe_locations
        const loc = item.location;
        const locQuery = `
          INSERT INTO ${s}.universe_locations (
            id, tenant_id, universe_id, name, location_key, visual_description, version
          )
          VALUES ($1, $2, $3, $4, $5, $6, 1)
          ON CONFLICT DO NOTHING
          RETURNING id, location_key, name;
        `;
        const locRes = await client.query(locQuery, [
          loc.id,
          TENANT_ID,
          univRes.rows[0].id,
          loc.name,
          loc.location_key,
          loc.visual_description
        ]);
        if (locRes.rows.length > 0) {
          console.log(`  ✅ Universe Location:`, locRes.rows[0]);
        } else {
          console.log(`  ℹ️ Universe Location already registered.`);
        }

        // 5. Upsert brand_profiles
        const bp = item.brand_profile;
        const bpQuery = `
          INSERT INTO ${s}.brand_profiles (
            id, tenant_id, brand_name, tone_of_voice, visual_signature, color_palette, forbidden_elements
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE
          SET
            brand_name = EXCLUDED.brand_name,
            tone_of_voice = EXCLUDED.tone_of_voice,
            visual_signature = EXCLUDED.visual_signature,
            color_palette = EXCLUDED.color_palette,
            forbidden_elements = EXCLUDED.forbidden_elements
          RETURNING id, brand_name;
        `;
        const bpRes = await client.query(bpQuery, [
          bp.id,
          TENANT_ID,
          bp.brand_name,
          bp.tone_of_voice,
          bp.visual_signature,
          bp.color_palette,
          bp.forbidden_elements
        ]);
        console.log(`  ✅ Brand Profile:`, bpRes.rows[0]);
      }

      await client.query('COMMIT');
      console.log(`\n🎉 Schema [${s}] successfully committed.`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`❌ Error updating schema [${s}]:`, err);
      throw err;
    } finally {
      client.release();
    }
  }

  await closePgPool();
  console.log(`\n🏁 ALL IDENTITIES REGISTERED SUCCESSFULLY FOR TENANT [${TENANT_ID}]!`);
}

registerVisualIdentities().catch((err) => {
  console.error('Fatal registration error:', err);
  process.exit(1);
});
