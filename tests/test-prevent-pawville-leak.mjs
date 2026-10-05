import assert from 'node:assert/strict';
import { buildOrganicPillarPrompt } from '../lib/prompts.js';

console.log('🧪 Running Test: Zero PawVille Leakage for Kio Wonders...');

// Mock universe snapshot for Kio Wonders
const kioWondersUniverseSnapshot = {
  content_world: 'cartoon_universe',
  knowledge_domain: 'general',
  story_template: 'character_discovery_arc',
  universe_type: 'character_driven',
  human_presence: 'stylized_3d_avatar',
  visual_style: 'stylized_3d_character',
  scene_count: 8,
  manifest: {
    universe_profile: 'kio-wonders',
    version: 1,
    characters: {
      kio: {
        character_id: 'kio-wonders_kio_v1',
        display_name: 'Kio',
        species: 'Human 3D Stylized Boy',
        canonical_description: '7-year-old curious boy, stylized 3D animation style, big expressive dark eyes, tousled brown hair, vibrant orange utility vest with multiple pockets over a navy-blue long-sleeved shirt'
      },
      bimo: {
        character_id: 'kio-wonders_bimo_v1',
        display_name: 'BIMO',
        species: 'Smart Floating Companion Robot',
        canonical_description: 'Friendly floating orb companion robot, smooth glossy white matte finish with cyan glowing LED expressive visor face and small holographic projector antenna'
      }
    },
    locations: [
      {
        location_key: 'discovery_lab',
        name: 'Kio Discovery Lab',
        visual_description: 'Futuristic clean 3D playroom and science laboratory with floating holographic screens, interactive physical experiment tables, and gentle studio lighting'
      }
    ]
  }
};

const campaignData = {
  id: 'opc_261005_1t11n5',
  campaign_name: '[ OPC 20261005 ] - Kio Wonders - 20261005 - Test01',
  content_pillar: 'Animal Superpowers',
  narrative_mode: 'Storytelling',
  visual_style: 'stylized_3d_character',
  face_visibility: 'cartoon_face',
  target_clips_count: 8,
  content_world: 'cartoon_universe',
  universe_profile: 'kio-wonders',
  universe_snapshot_json: JSON.stringify(kioWondersUniverseSnapshot),
  _rowPayload: {
    row_number: 2,
    content_pillar: 'Animal Superpowers',
    content_subject: "Superpower Ekolokasi: Cara Kelelawar 'Melihat' Pakai Suara",
    main_character: 'Kio',
    supporting_characters: 'BIMO',
    story_premise: 'Kio memakai gelombang sonik buatan BIMO untuk memetakan ruangan gelap seperti kelelawar.',
    pet_problem: 'Bagaimana cara navigasi di tempat gelap gulita tanpa mata?'
  }
};

const visualOverrides = {
  subject_demographic: 'character_driven',
  wardrobe_color: 'Orange and Navy Blue',
  primary_style: 'stylized_3d_character',
  subject: {
    universe_slug: 'kio-wonders',
    universe_profile_id: 'univ_kio_wonders'
  }
};

const prompt = buildOrganicPillarPrompt([], campaignData, null, null, visualOverrides);

// 1. Verify NO PawVille characters leaked
assert.ok(!prompt.includes('grey British Shorthair cat'), 'Must NOT contain PawVille cat description');
assert.ok(!prompt.includes('Dr. Paw: tan Shiba Inu'), 'Must NOT contain Dr. Paw description');
assert.ok(!prompt.includes('forest-green scarf'), 'Must NOT contain green scarf');
assert.ok(!prompt.includes('Coco: brown-white Corgi'), 'Must NOT contain Coco');
assert.ok(!prompt.includes('Boba: cream-colored hamster'), 'Must NOT contain Boba');
assert.ok(!prompt.includes('DILARANG diagnosis medis'), 'Must NOT contain pet medical diagnosis restrictions for non-pet universe');

// 2. Verify Kio & BIMO are locked
assert.ok(prompt.includes('Kio: 7-year-old curious boy'), 'Must contain Kio canonical prompt');
assert.ok(prompt.includes('BIMO: Friendly floating orb companion robot'), 'Must contain BIMO canonical prompt');
assert.ok(prompt.includes('"kio"') && prompt.includes('"bimo"'), 'Must include kio and bimo in valid character list');

// 3. Verify Human Presence is permitted
assert.ok(prompt.includes('CHARACTER / HUMAN PRESENCE: Karakter 3D Stylized'), 'Must allow 3D character/human presence');
assert.ok(!prompt.includes('NO human characters, NO human hands, NO human face'), 'Negative prompt must NOT ban human characters for Kio Wonders');

console.log('✅ ALL TEST ASSERTIONS PASSED! Zero PawVille leak verified.');
