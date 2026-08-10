import { getPgPool } from '../lib/db-pg.js';
import { tenantContext } from '../lib/tenant-context.js';
import {
  createUniverseProfile,
  createUniverseCharacter,
  createUniverseLocation,
  getUniverseProfileBySlug
} from '../lib/db.js';

async function seedKitchenTails() {
  const pool = getPgPool();

  const existingProfile = await getUniverseProfileBySlug('kitchentails');
  if (existingProfile) {
    console.log('KitchenTails already seeded, skipping.');
    process.exit(0);
  }

  const profileData = {
    id: 'univ_kitchentails_v1',
    name: 'KitchenTails Culinary Universe',
    slug: 'kitchentails',
    premise: 'Dunia dapur ajaib di mana para hewan koki berkreasi dengan resep-resep unik, menghadapi tantangan kuliner, dan menciptakan hidangan yang membuat seluruh kota terpukau.',
    tone: 'cheerful, comedic, warm, family-friendly',
    knowledge_domain: 'food_culinary',
    human_presence: 'none',
    default_visual_style: 'cinematic_3d_clay',
    default_aspect_ratio: '9:16',
    default_scene_count: 7,
    default_scene_duration: 8,
    default_story_template: 'pet_problem_solution_7beat',
    cta_personality: 'Ajakan santai ala koki tetangga. HANYA di Beat 7.',
    default_pillars_json: ['Kitchen Tools & Gadgets', 'Healthy Cooking', 'Quick Recipes', 'Food Presentation', 'Kitchen Safety'],
    rules_json: { no_humans: true, anthropomorphism: 'hind_legs_ok', product_earliest_beat: 4 },
    negative_prompts_json: ['human characters', 'human hands', 'photorealistic rendering'],
    status: 'active',
    version: 1
  };

  const profile = await createUniverseProfile(profileData);
  console.log(`Created Universe Profile: ${profile.name} (${profile.id})`);

  const characters = [
    {
      universe_id: profile.id,
      name: 'Chef Miso',
      character_key: 'chef_miso',
      role: 'main_character',
      species: 'Kucing (Scottish Fold)',
      fur_color: 'Orange fur',
      wardrobe: 'White chef hat, blue apron',
      canonical_prompt: 'Kucing Scottish Fold, orange fur, memakai topi koki putih (white chef hat) dan celemek biru (blue apron).',
      reference_image_path: '/universe-assets/kitchentails/characters/chef_miso/v1/identity-anchor.png'
    },
    {
      universe_id: profile.id,
      name: 'Pepper',
      character_key: 'pepper',
      role: 'supporting',
      species: 'Anjing (Dalmatian)',
      wardrobe: 'Red bandana, wooden spoon',
      canonical_prompt: 'Anjing Dalmatian, memakai bandana merah (red bandana) dan membawa sendok kayu (wooden spoon).',
      reference_image_path: '/universe-assets/kitchentails/characters/pepper/v1/identity-anchor.png'
    }
  ];

  for (const char of characters) {
    const createdChar = await createUniverseCharacter(char);
    console.log(`Created Character: ${createdChar.name}`);
  }

  const locations = [
    {
      universe_id: profile.id,
      name: "Miso's Kitchen",
      location_key: 'misos_kitchen',
      visual_description: 'Warm, wooden counters, copper pots'
    },
    {
      universe_id: profile.id,
      name: 'Market Alley',
      location_key: 'market_alley',
      visual_description: 'Colorful food stalls, awnings'
    }
  ];

  for (const loc of locations) {
    const createdLoc = await createUniverseLocation(loc);
    console.log(`Created Location: ${createdLoc.name}`);
  }

  console.log('Seeding KitchenTails completed successfully.');
  process.exit(0);
}

tenantContext.run('default_tenant', () => {
  seedKitchenTails().catch((err) => {
    console.error('Error seeding KitchenTails:', err);
    process.exit(1);
  });
});
