import { getPgPool, pgQuery } from '../lib/db-pg.js';
import { tenantContext } from '../lib/tenant-context.js';
import {
  createUniverseProfile,
  createUniverseCharacter,
  createUniverseLocation,
  getUniverseProfileBySlug,
  updateUniverseProfile
} from '../lib/db.js';
import {
  createVisualIdentity,
  getVisualIdentity,
  updateVisualIdentity
} from '../lib/visual-identity-repository.js';

const TENANT_ID = 'tnt_sy-dodot_4ba27b';

async function seedKidsChannels() {
  console.log(`[Seed] Starting seed for tenant: ${TENANT_ID} (syd_admin)`);
  const pool = getPgPool();

  // =========================================================================
  // 1. VISUAL IDENTITY 1: Kio Wonders (3D Sci-Fi Animation)
  // =========================================================================
  const viKioKey = 'kio_wonders_3d_scifi';
  const viKioConfig = {
    schema_version: '2',
    label: 'Kio Wonders — 3D Sci-Fi Curiosity',
    description: 'Vibrant 3D family animation style for science curiosity, futuristic simulation portals, cosmic wonders, and colorful microscopic realms.',
    subject: {
      kind: 'stylized_3d_character',
      faceless_mode: 'not_applicable',
      universe_slug: 'kio-wonders',
      universe_name: 'Kio Wonders',
      character_keys: ['kio', 'bimo'],
      demographic_key: 'custom',
      custom_description: 'Expressive 3D animated boy explorer (Kio) with messy hair and goggles, accompanied by a cute floating AI robot (BIMO) with glowing cyan LED visor eyes.',
      character_count: 2,
      population_mode: 'group'
    },
    visual_language: {
      primary_style: 'stylized_3d_character',
      supporting_styles: ['isometric_society', 'symbolic_surrealism'],
      disabled_styles: ['shadow_silhouette', 'editorial_graphic_novel', 'paper_cutout_documentary', 'clay_political_theater']
    },
    rendering: {
      geometry: 'simplified_semi_realistic',
      textures: ['smooth_matte_plastic', 'glowing_hologram_glass', 'brushed_metal'],
      shadow_style: 'soft_ambient',
      finish: 'soft_matte'
    },
    composition: {
      primary_idea_count: 1,
      primary_subject_count: 2,
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
      custom_description: 'Bright orange and navy blue tech utility vest, graphic tee with atom/rocket insignia, comfortable cargo shorts, glowing high-top sneakers.',
      sleeve_policy: 'forearms_exposed',
      accessories: ['orange goggles on forehead', 'miniature gadget clip']
    },
    environment: {
      preset_key: 'custom',
      custom_description: 'WonderLab high-tech workshop, glowing cosmic simulation portals, neon planetary rings, microscopic quantum realms.',
      material_palette: ['matte polymer', 'holographic cyan glass', 'brushed aluminium', 'neon accents'],
      props: ['floating hologram screens', 'planet models', 'magnifying lenses'],
      background_density: 'balanced'
    },
    lighting: {
      preset_key: 'studio_softbox',
      custom_description: 'Vibrant three-point studio lighting with high-tech cyan/orange rim light accents and volumetric bloom.',
      color_temperature: 'warm_neutral',
      contrast: 'medium'
    },
    camera: {
      framing: 'editorial_wide',
      perspective: 'third_person',
      lens_look: 'wide_angle_24mm',
      depth_of_field: 'shallow',
      movement: 'subtle_handheld'
    },
    style: {
      preset_key: 'stylized_3d_character',
      custom_description: '3D Pixar-Illumination family animation aesthetic, vibrant saturated colors, smooth matte finishes, crisp lighting highlights, playful futuristic gadgetry.',
      aspect_ratio: '9:16'
    },
    guardrails: {
      face_visibility: 'allowed',
      reflection_face: 'allowed',
      unintended_people: 'prohibited',
      extra_people: 'prohibited',
      intentional_crowd: 'prohibited',
      identity_drift: 'prohibited',
      wardrobe_drift: 'prohibited',
      required_negative_prompts: ['photorealistic human face', 'gritty dark noir', 'low resolution 2d clipart', 'uncanny valley live action']
    }
  };

  const existingViKio = await getVisualIdentity(viKioKey);
  if (existingViKio && existingViKio.source === 'user') {
    await updateVisualIdentity(existingViKio.id, {
      label: viKioConfig.label,
      description: viKioConfig.description,
      config: viKioConfig
    }, 'system_seeder');
    console.log(`[Seed] Updated Visual Identity: ${viKioConfig.label} (${existingViKio.id})`);
  } else if (!existingViKio) {
    const created = await createVisualIdentity({
      preset_key: viKioKey,
      label: viKioConfig.label,
      description: viKioConfig.description,
      config: viKioConfig
    }, 'system_seeder');
    console.log(`[Seed] Created Visual Identity: ${created.label} (${created.id})`);
  }

  // =========================================================================
  // 2. VISUAL IDENTITY 2: WonderQuest Kids (3D Explorer Adventure)
  // =========================================================================
  const viWonderKey = 'wonderquest_kids_3d_adventure';
  const viWonderConfig = {
    schema_version: '2',
    label: 'WonderQuest Kids — 3D Explorer Adventure',
    description: 'Rich 3D cinematic family adventure style with golden warm lighting, lush global environments, historical wonders, and magical maps.',
    subject: {
      kind: 'stylized_3d_character',
      faceless_mode: 'not_applicable',
      universe_slug: 'wonderquest-kids',
      universe_name: 'WonderQuest Kids',
      character_keys: ['luna', 'miko'],
      demographic_key: 'custom',
      custom_description: 'Duo of intrepid young 3D explorers: Luna (adventurer girl with red bandana and magic map) and Miko (observant boy with safari hat, glasses, and explorer backpack).',
      character_count: 2,
      population_mode: 'group'
    },
    visual_language: {
      primary_style: 'stylized_3d_character',
      supporting_styles: ['isometric_society', 'paper_cutout_documentary'],
      disabled_styles: ['shadow_silhouette', 'editorial_graphic_novel', 'symbolic_surrealism', 'clay_political_theater']
    },
    rendering: {
      geometry: 'simplified_semi_realistic',
      textures: ['weathered_canvas', 'warm_leather', 'ancient_stone', 'glowing_gold_runes'],
      shadow_style: 'soft_ambient',
      finish: 'soft_matte'
    },
    composition: {
      primary_idea_count: 1,
      primary_subject_count: 2,
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
      custom_description: 'Khaki and emerald safari explorer jackets, sturdy leather belts with vintage compass pouch, field canteen, sturdy hiking boots, red bandana.',
      sleeve_policy: 'wrists_covered',
      accessories: ['leather compass pouch', 'magnifying glass', 'glowing magic parchment map']
    },
    environment: {
      preset_key: 'custom',
      custom_description: 'Sunlit Ancient Pyramids, deep vibrant Amazon rainforest canopy, mysterious bioluminescent ruins, cozy secret treehouse attic.',
      material_palette: ['sandstone', 'tropical flora', 'weathered parchment', 'ancient timber', 'warm brass'],
      props: ['ancient stone pillars', 'hanging vines', 'glowing parchment map', 'antique brass globes'],
      background_density: 'dense'
    },
    lighting: {
      preset_key: 'window_daylight',
      custom_description: 'Golden hour sunlight streaming through clouds/canopy, warm campfire amber glow, magical golden particle luminescence.',
      color_temperature: 'warm',
      contrast: 'medium'
    },
    camera: {
      framing: 'editorial_wide',
      perspective: 'third_person',
      lens_look: 'wide_angle_24mm',
      depth_of_field: 'shallow',
      movement: 'slow_pan'
    },
    style: {
      preset_key: 'stylized_3d_character',
      custom_description: '3D DreamWorks-Disney animated adventure aesthetic, warm cinematic lighting roll-off, rich organic environmental textures, awe-inspiring sense of scale.',
      aspect_ratio: '9:16'
    },
    guardrails: {
      face_visibility: 'allowed',
      reflection_face: 'allowed',
      unintended_people: 'prohibited',
      extra_people: 'prohibited',
      intentional_crowd: 'prohibited',
      identity_drift: 'prohibited',
      wardrobe_drift: 'prohibited',
      required_negative_prompts: ['photorealistic human face', 'gloomy horror lighting', 'flat 2D vector', 'cheap plastic look']
    }
  };

  const existingViWonder = await getVisualIdentity(viWonderKey);
  if (existingViWonder && existingViWonder.source === 'user') {
    await updateVisualIdentity(existingViWonder.id, {
      label: viWonderConfig.label,
      description: viWonderConfig.description,
      config: viWonderConfig
    }, 'system_seeder');
    console.log(`[Seed] Updated Visual Identity: ${viWonderConfig.label} (${existingViWonder.id})`);
  } else if (!existingViWonder) {
    const created = await createVisualIdentity({
      preset_key: viWonderKey,
      label: viWonderConfig.label,
      description: viWonderConfig.description,
      config: viWonderConfig
    }, 'system_seeder');
    console.log(`[Seed] Created Visual Identity: ${created.label} (${created.id})`);
  }

  // =========================================================================
  // 3. UNIVERSE MANAGER 1: Kio Wonders
  // =========================================================================
  const kioSlug = 'kio-wonders';
  let kioProfile = await getUniverseProfileBySlug(kioSlug);
  
  const kioProfileData = {
    name: 'Kio Wonders',
    slug: kioSlug,
    premise: 'Petualangan simulasi sains "What If?" yang memicu rasa ingin tahu anak-anak. Kio (anak super penasaran usia 8 tahun) bersama robot pendampingnya BIMO membuka portal simulasi interaktif untuk menjawab pertanyaan aneh dan menakjubkan seputar sains, alam semesta, tubuh manusia, dan teknologi.',
    tone: 'curious, energetic, fun, fast-paced, mind-blowing, educational',
    knowledge_domain: 'science_what_if_kids',
    human_presence: 'stylized_3d',
    default_visual_style: 'stylized_3d_character',
    default_aspect_ratio: '9:16',
    default_scene_count: 6,
    default_scene_duration: 7,
    default_story_template: 'question_simulation_wow_fact_7beat',
    cta_personality: 'Ajak anak bertanya hal ajaib di kolom komentar untuk petualangan simulasi berikutnya bersama Kio & BIMO.',
    default_pillars_json: [
      'What If Extreme Scenarios',
      'Space & Cosmic Mysteries',
      'Human Body & Microscopic Wonders',
      'Earth & Natural Phenomena',
      'Future Tech & Physics Fun'
    ],
    rules_json: {
      narrative_formula: 'Question -> Shocking What-If Event -> BIMO Simulation Portal -> Visual Discovery -> Wow Science Fact -> Next Curiosity Teaser',
      pacing: 'Fast, high energy, comedic yet accurate science',
      target_age: '7-12 years old',
      bimo_role: 'Interactive simulation generator & visual navigator',
      kio_role: 'Curious explorer experiencing the phenomenon first-hand',
      product_earliest_beat: 4
    },
    negative_prompts_json: [
      'photorealistic human',
      'gloomy noir',
      'boring textbook lecture',
      'live action footage',
      'drab muted colors'
    ],
    style_reference_path: '/universe-assets/kio-wonders/style/kio_wonders_visual_dna.png',
    status: 'active',
    version: 1,
    universe_type: 'character_driven',
    depiction_policy: 'stylized_3d_family'
  };

  if (kioProfile) {
    await updateUniverseProfile(kioProfile.id, kioProfileData);
    console.log(`[Seed] Updated Universe Profile: ${kioProfile.name} (${kioProfile.id})`);
  } else {
    kioProfile = await createUniverseProfile({
      id: `univ_kio_wonders_${Date.now().toString(36)}`,
      ...kioProfileData
    });
    console.log(`[Seed] Created Universe Profile: ${kioProfile.name} (${kioProfile.id})`);
  }

  // Characters for Kio Wonders
  const kioCharacters = [
    {
      universe_id: kioProfile.id,
      name: 'Kio',
      character_key: 'kio',
      role: 'main_character',
      species: 'Human (Stylized 3D Boy)',
      body_shape: 'Energetic 8-year-old boy, lean and expressive posture',
      fur_color: 'Messy dark brown spiky hair',
      eye_color: 'Bright warm hazel, wide expressive curious eyes',
      wardrobe: 'Orange and navy blue utility vest with gadget clips, white graphic t-shirt with atomic swirl logo, teal cargo shorts, bright orange sneakers, round orange-rimmed goggles pushed up onto forehead.',
      personality: 'Super curious, imaginative, energetic, asks endless "why" and "what if" questions, gets excited by giant planets and tiny atoms.',
      movement_style: 'Bouncy, dynamic gestures, expressive reactions, leaning in close with wonder.',
      canonical_prompt: 'Stylized 3D animated 8-year-old boy named Kio, messy dark brown spiky hair, bright warm hazel eyes with wide curious expression, round orange goggles on forehead, wearing orange and navy utility vest over white atomic-logo tee, teal cargo shorts, bright orange sneakers, smooth 3D Pixar-style render.',
      reference_image_path: '/universe-assets/kio-wonders/characters/kio/identity_anchor.png',
      depiction_mode: 'normal',
      reference_type: 'identity'
    },
    {
      universe_id: kioProfile.id,
      name: 'BIMO',
      character_key: 'bimo',
      role: 'co_host_companion',
      species: 'AI Companion Hover-Bot',
      body_shape: 'Spherical floating robot with smooth white matte chassis and magnetic floating hands',
      fur_color: 'Clean pearl white matte with cyan LED trim lines',
      eye_color: 'Glowing cyan blue LED digital visor that forms expressive emoticon eyes',
      wardrobe: 'Miniature spinning radar antenna on top, holographic projector lens on belly with soft cyan pulse.',
      personality: 'Smart, witty, protective, loves generating crazy visual simulations, beeps cheerfully when calculating mind-blowing facts.',
      movement_style: 'Smooth floating and hovering with gentle bobbing motion, spinning 360 degrees when excited.',
      canonical_prompt: 'Cute 3D animated companion hover-bot named BIMO, spherical smooth pearl-white chassis with glowing cyan neon trim, curved dark digital visor face displaying expressive glowing cyan emoticon eyes, tiny spinning antenna on head, belly hologram projector beam, smooth 3D animation style.',
      reference_image_path: '/universe-assets/kio-wonders/characters/bimo/identity_anchor.png',
      depiction_mode: 'normal',
      reference_type: 'identity'
    }
  ];

  for (const char of kioCharacters) {
    const existing = await pgQuery(
      'SELECT id FROM universe_characters WHERE universe_id = $1 AND character_key = $2',
      [kioProfile.id, char.character_key]
    );
    if (existing.rowCount > 0) {
      await pgQuery(
        `UPDATE universe_characters SET
          name = $1, role = $2, species = $3, body_shape = $4, fur_color = $5,
          eye_color = $6, wardrobe = $7, personality = $8, movement_style = $9,
          canonical_prompt = $10, reference_image_path = $11, updated_at = CURRENT_TIMESTAMP
         WHERE id = $12`,
        [
          char.name, char.role, char.species, char.body_shape, char.fur_color,
          char.eye_color, char.wardrobe, char.personality, char.movement_style,
          char.canonical_prompt, char.reference_image_path, existing.rows[0].id
        ]
      );
      console.log(`[Seed] Updated Character: ${char.name} (${char.character_key})`);
    } else {
      await createUniverseCharacter(char);
      console.log(`[Seed] Created Character: ${char.name} (${char.character_key})`);
    }
  }

  // Locations for Kio Wonders
  const kioLocations = [
    {
      universe_id: kioProfile.id,
      name: "Kio's WonderLab",
      location_key: 'kios_wonderlab',
      visual_description: "Bright cozy bedroom-workshop filled with glowing miniature planets, hanging rocket models, colorful whiteboard with funny science doodles, popup books, and BIMO's magnetic docking station.",
      lighting_default: 'Warm daylight mixed with colorful soft ambient neon glow from tech gadgets.',
      props: 'Hologram projector table, solar system mobile, giant magnifying glass, telescope by window, chalkboard with atoms.',
      reference_image_path: '/universe-assets/kio-wonders/locations/wonderlab.png',
      reference_type: 'location'
    },
    {
      universe_id: kioProfile.id,
      name: 'Cosmic Deep Space Simulation',
      location_key: 'cosmic_space_sim',
      visual_description: "A safe holographic pocket of outer space inside BIMO's simulation dome, surrounded by swirling purple nebulae, glittering starry clusters, and enormous rotating gas giants with glowing rings.",
      lighting_default: 'Deep vibrant cosmic purples, blues, and bright starlight rim glow.',
      props: 'Floating orbital rings, friendly asteroids, shimmering gravitational wave lines.',
      reference_image_path: '/universe-assets/kio-wonders/locations/cosmic_sim.png',
      reference_type: 'location'
    },
    {
      universe_id: kioProfile.id,
      name: 'Microscopic Quantum Realm',
      location_key: 'micro_quantum_realm',
      visual_description: 'Fantastical subatomic world where atoms and molecules float like translucent glowing neon jelly spheres with dancing magnetic energy ribbons.',
      lighting_default: 'Bioluminescent neon teal, magenta, and amber particle glow.',
      props: 'Bouncing water molecules, crystalline lattice structures, floating quantum particles.',
      reference_image_path: '/universe-assets/kio-wonders/locations/quantum_realm.png',
      reference_type: 'location'
    },
    {
      universe_id: kioProfile.id,
      name: 'Earth Core Simulation Room',
      location_key: 'earth_core_sim',
      visual_description: "Inside BIMO's thermal simulation: cross-section of Earth displaying glowing golden-orange liquid magma crystals, semi-transparent tectonic plates, and visible magnetic force shields.",
      lighting_default: 'Warm radiant golden-orange and deep ruby red lava glow.',
      props: 'Floating magma spheres, compass needle reacting wildly, geothermal energy lines.',
      reference_image_path: '/universe-assets/kio-wonders/locations/earth_core.png',
      reference_type: 'location'
    }
  ];

  for (const loc of kioLocations) {
    const existing = await pgQuery(
      'SELECT id FROM universe_locations WHERE universe_id = $1 AND location_key = $2',
      [kioProfile.id, loc.location_key]
    );
    if (existing.rowCount > 0) {
      await pgQuery(
        `UPDATE universe_locations SET
          name = $1, visual_description = $2, lighting_default = $3, props = $4,
          reference_image_path = $5, updated_at = CURRENT_TIMESTAMP
         WHERE id = $6`,
        [loc.name, loc.visual_description, loc.lighting_default, loc.props, loc.reference_image_path, existing.rows[0].id]
      );
      console.log(`[Seed] Updated Location: ${loc.name} (${loc.location_key})`);
    } else {
      await createUniverseLocation(loc);
      console.log(`[Seed] Created Location: ${loc.name} (${loc.location_key})`);
    }
  }

  // =========================================================================
  // 4. UNIVERSE MANAGER 2: WonderQuest Kids
  // =========================================================================
  const wonderSlug = 'wonderquest-kids';
  let wonderProfile = await getUniverseProfileBySlug(wonderSlug);

  const wonderProfileData = {
    name: 'WonderQuest Kids',
    slug: wonderSlug,
    premise: 'Serial petualangan kartun 3D mini ekspedisi penjelajah dunia bersama Luna (gadis cilik pemberani pembawa Magic Map kuno) dan Miko (anak laki-laki cermat pembawa ransel serbaguna). Setiap kali Magic Map terbuka, lantai berpendar dan WHOOSH! Mereka terlempar melintasi ruang dan waktu: dari Piramida Mesir Kuno, hutan Amazon, Samudra terdalam, hingga zaman Dinosaurus untuk memecahkan misteri sejarah dan alam semesta.',
    tone: 'adventurous, wondrous, inspiring, warm, heroic, educational',
    knowledge_domain: 'world_exploration_history_geography',
    human_presence: 'stylized_3d',
    default_visual_style: 'stylized_3d_character',
    default_aspect_ratio: '9:16',
    default_scene_count: 6,
    default_scene_duration: 7,
    default_story_template: 'magic_map_quest_discovery_7beat',
    cta_personality: 'Ajak anak menebak destinasi Magic Map berikutnya dan tinggalkan jejak petualang di kolom komentar.',
    default_pillars_json: [
      'Ancient Civilizations & History Wonders',
      'Wild Earth & Exotic Animals',
      'Extreme Geography & Oceans',
      'Prehistoric Era & Dinosaurs',
      'Global Cultures & Hidden Monuments'
    ],
    rules_json: {
      narrative_formula: 'Attic Discovery / Magic Map Glow -> Whoosh Portal Jump -> Arrival at Exotic Location -> Surprising Challenge/Mystery -> Historical/Geographical Fact Reveal -> Safe Return with Souvenir',
      pacing: 'Cinematic adventure rhythm, immersive atmosphere, entertainment first with embedded knowledge',
      target_age: '7-12 years old',
      magic_map_rule: 'Glows with golden runic cartography when a new destination is chosen',
      luna_role: 'Bold leader, navigator, holds the glowing Magic Map',
      miko_role: 'Observant strategist, sketchbook researcher, holds the utility explorer bag',
      product_earliest_beat: 4
    },
    negative_prompts_json: [
      'photorealistic human face',
      'violent dark battle',
      'modern city smog',
      'boring lecture slide',
      'flat 2D vector'
    ],
    style_reference_path: '/universe-assets/wonderquest-kids/style/wonderquest_visual_dna.png',
    status: 'active',
    version: 1,
    universe_type: 'character_driven',
    depiction_policy: 'stylized_3d_family'
  };

  if (wonderProfile) {
    await updateUniverseProfile(wonderProfile.id, wonderProfileData);
    console.log(`[Seed] Updated Universe Profile: ${wonderProfile.name} (${wonderProfile.id})`);
  } else {
    wonderProfile = await createUniverseProfile({
      id: `univ_wonderquest_${Date.now().toString(36)}`,
      ...wonderProfileData
    });
    console.log(`[Seed] Created Universe Profile: ${wonderProfile.name} (${wonderProfile.id})`);
  }

  // Characters for WonderQuest Kids
  const wonderCharacters = [
    {
      universe_id: wonderProfile.id,
      name: 'Luna',
      character_key: 'luna',
      role: 'main_character',
      species: 'Human (Stylized 3D Explorer Girl)',
      body_shape: 'Agile 9-year-old girl with confident explorer posture',
      fur_color: 'Dark wavy chestnut hair tied in a high ponytail',
      eye_color: 'Sparkling emerald green eyes full of brave determination',
      wardrobe: 'Classic adventurer khaki safari vest with brass buttons over warm coral-orange long-sleeve, crimson-red explorer bandana around neck, olive cargo trousers, sturdy leather hiking boots, holding the glowing Magic Map.',
      personality: 'Bold, fearless, decisive, quick-thinking, passionately curious about ancient secrets and lost temples.',
      movement_style: 'Athletic, swift leaps, pointing forward eagerly, unrolling the glowing map with flair.',
      canonical_prompt: 'Stylized 3D animated 9-year-old girl named Luna, dark wavy chestnut ponytail, sparkling emerald green eyes, red adventurer bandana around neck, khaki safari vest over coral shirt, olive cargo pants, leather boots, holding an ancient glowing parchment Magic Map, 3D animated adventure film aesthetic.',
      reference_image_path: '/universe-assets/wonderquest-kids/characters/luna/identity_anchor.png',
      depiction_mode: 'normal',
      reference_type: 'identity'
    },
    {
      universe_id: wonderProfile.id,
      name: 'Miko',
      character_key: 'miko',
      role: 'co_host_companion',
      species: 'Human (Stylized 3D Explorer Boy)',
      body_shape: 'Observant 8-year-old boy, slightly round friendly face',
      fur_color: 'Neat warm brown hair under safari explorer hat',
      eye_color: 'Warm chocolate brown eyes behind round tortoiseshell glasses',
      wardrobe: 'Safari sun hat with brass magnifying pin, forest green utility vest packed with sketchbooks and compasses, cream linen shirt, brown shorts, hiking boots, oversized vintage explorer backpack with rolled blanket.',
      personality: 'Gentle, thoughtful, observant, loves drawing wildlife sketches and deciphering ancient symbols, cautious but always loyal to Luna.',
      movement_style: 'Consulting sketchbooks, adjusting glasses, taking close looks at artifacts with magnifying lens.',
      canonical_prompt: 'Stylized 3D animated 8-year-old boy named Miko, safari explorer hat, round tortoiseshell glasses over warm chocolate brown eyes, forest green utility vest over cream shirt, oversized vintage brown explorer backpack, holding a brass magnifying glass, 3D animated adventure film style.',
      reference_image_path: '/universe-assets/wonderquest-kids/characters/miko/identity_anchor.png',
      depiction_mode: 'normal',
      reference_type: 'identity'
    }
  ];

  for (const char of wonderCharacters) {
    const existing = await pgQuery(
      'SELECT id FROM universe_characters WHERE universe_id = $1 AND character_key = $2',
      [wonderProfile.id, char.character_key]
    );
    if (existing.rowCount > 0) {
      await pgQuery(
        `UPDATE universe_characters SET
          name = $1, role = $2, species = $3, body_shape = $4, fur_color = $5,
          eye_color = $6, wardrobe = $7, personality = $8, movement_style = $9,
          canonical_prompt = $10, reference_image_path = $11, updated_at = CURRENT_TIMESTAMP
         WHERE id = $12`,
        [
          char.name, char.role, char.species, char.body_shape, char.fur_color,
          char.eye_color, char.wardrobe, char.personality, char.movement_style,
          char.canonical_prompt, char.reference_image_path, existing.rows[0].id
        ]
      );
      console.log(`[Seed] Updated Character: ${char.name} (${char.character_key})`);
    } else {
      await createUniverseCharacter(char);
      console.log(`[Seed] Created Character: ${char.name} (${char.character_key})`);
    }
  }

  // Locations for WonderQuest Kids
  const wonderLocations = [
    {
      universe_id: wonderProfile.id,
      name: 'The Secret Treehouse Attic',
      location_key: 'secret_treehouse_attic',
      visual_description: 'Cozy sunlit wooden attic at the top of a giant ancient banyan tree. Filled with brass globes, vintage leather-bound journals, warm glowing lanterns, and a large round oak table where the Magic Map is kept.',
      lighting_default: 'Warm golden afternoon sunbeam streaming through dusty window panes.',
      props: 'Antique brass astrolabe, magnifying glasses, map chest, compass, botanical sketches pinned on wooden wall.',
      reference_image_path: '/universe-assets/wonderquest-kids/locations/treehouse_attic.png',
      reference_type: 'location'
    },
    {
      universe_id: wonderProfile.id,
      name: 'Great Pyramids of Ancient Giza',
      location_key: 'ancient_giza_pyramids',
      visual_description: 'Awe-inspiring view of the Great Pyramids glistening with white limestone casing under a brilliant turquoise desert sky, with palm trees along the shimmering blue Nile River.',
      lighting_default: 'Bright radiant desert sunlight with warm amber sand reflections.',
      props: 'Golden limestone blocks, hieroglyphic stone tablets, wooden felucca boats on Nile.',
      reference_image_path: '/universe-assets/wonderquest-kids/locations/giza_pyramids.png',
      reference_type: 'location'
    },
    {
      universe_id: wonderProfile.id,
      name: 'Deep Amazon Rainforest Canopy',
      location_key: 'amazon_rainforest_canopy',
      visual_description: 'Lush emerald green jungle canopy high above the forest floor, connected by sturdy rope bridges, surrounded by gigantic dewy leaves, glowing exotic orchids, and colorful toucans flying past.',
      lighting_default: 'Filtered dappled green-golden sunlight streaming through jungle mist.',
      props: 'Rope bridges, ancient mossy vines, giant jungle flowers, wooden observation platform.',
      reference_image_path: '/universe-assets/wonderquest-kids/locations/amazon_canopy.png',
      reference_type: 'location'
    },
    {
      universe_id: wonderProfile.id,
      name: 'Lost City of Atlantis Coral Temple',
      location_key: 'atlantis_coral_temple',
      visual_description: 'Breathtaking underwater ancient marble ruins covered in vibrant bioluminescent sea anemones, glowing purple and cyan coral reefs, and gentle sea turtles swimming between ancient columns.',
      lighting_default: 'Deep ocean turquoise with shimmering sun rays caustic patterns and glowing bioluminescence.',
      props: 'Carved marble pillars, glowing pearl clams, ancient amphoras, schools of tropical fish.',
      reference_image_path: '/universe-assets/wonderquest-kids/locations/atlantis_temple.png',
      reference_type: 'location'
    }
  ];

  for (const loc of wonderLocations) {
    const existing = await pgQuery(
      'SELECT id FROM universe_locations WHERE universe_id = $1 AND location_key = $2',
      [wonderProfile.id, loc.location_key]
    );
    if (existing.rowCount > 0) {
      await pgQuery(
        `UPDATE universe_locations SET
          name = $1, visual_description = $2, lighting_default = $3, props = $4,
          reference_image_path = $5, updated_at = CURRENT_TIMESTAMP
         WHERE id = $6`,
        [loc.name, loc.visual_description, loc.lighting_default, loc.props, loc.reference_image_path, existing.rows[0].id]
      );
      console.log(`[Seed] Updated Location: ${loc.name} (${loc.location_key})`);
    } else {
      await createUniverseLocation(loc);
      console.log(`[Seed] Created Location: ${loc.name} (${loc.location_key})`);
    }
  }

  console.log('[Seed] All Visual Identities and Universes seeded successfully!');
  process.exit(0);
}

tenantContext.run(TENANT_ID, () => {
  seedKidsChannels().catch(err => {
    console.error('[Seed Error]', err);
    process.exit(1);
  });
});
