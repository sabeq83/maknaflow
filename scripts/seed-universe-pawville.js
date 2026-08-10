import { getPgPool } from '../lib/db-pg.js';
import { tenantContext } from '../lib/tenant-context.js';
import {
  createUniverseProfile,
  createUniverseCharacter,
  createUniverseLocation,
  getUniverseProfileBySlug
} from '../lib/db.js';

async function seedPawVille() {
  const pool = getPgPool();

  const existingProfile = await getUniverseProfileBySlug('pawville');
  if (existingProfile) {
    console.log('PawVille already seeded, skipping.');
    process.exit(0);
  }

  const profileData = {
    id: 'univ_pawville_v1',
    name: 'PawVille Pet Universe',
    slug: 'pawville',
    premise: 'Sebuah dunia mandiri di mana hewan peliharaan hidup berdampingan, menghadapi masalah sehari-hari mereka sendiri, dan menemukan solusi cerdas untuk hidup yang lebih nyaman.',
    tone: 'warm, funny, light emotional, family-friendly',
    knowledge_domain: 'pet_supplies',
    human_presence: 'none',
    default_visual_style: 'cinematic_3d_clay',
    default_aspect_ratio: '9:16',
    default_scene_count: 7,
    default_scene_duration: 8,
    default_story_template: 'pet_problem_solution_7beat',
    cta_personality: 'Tidak boleh terasa seperti iklan langsung. CTA harus terasa seperti saran dari teman. HANYA di Beat 7.',
    default_pillars_json: ['Pet Hydration & Feeding', 'Pet Grooming & Hygiene', 'Pet Enrichment & Play', 'Pet Comfort & Wellness', 'Pet Travel & Safety'],
    rules_json: { no_humans: true, anthropomorphism: 'hind_legs_ok', product_earliest_beat: 4 },
    negative_prompts_json: ['human characters', 'human hands', 'human face', 'character morphing', 'wardrobe drift', 'style drift', 'photorealistic rendering'],
    style_reference_path: '/universe-assets/pawville/style/visual-style-reference.png',
    status: 'active',
    version: 1
  };

  const profile = await createUniverseProfile(profileData);
  console.log(`Created Universe Profile: ${profile.name} (${profile.id})`);

  const characters = [
    {
      universe_id: profile.id,
      name: 'Mochi',
      character_key: 'mochi',
      role: 'main_character',
      species: 'Kucing (British Shorthair)',
      body_shape: 'Bulat chubby, kaki pendek (short legs)',
      fur_color: 'Abu-abu tebal dan lembut (thick soft grey fur)',
      eye_color: 'Besar berwarna amber (Large amber)',
      wardrobe: 'Syal hijau (Green scarf)',
      personality: 'Penasaran, sedikit manja (slightly spoiled), lembut, takut pada hal-hal baru, sangat menyukai makanan dan kenyamanan.',
      canonical_prompt: 'Kucing British Shorthair, bulat chubby, kaki pendek (short legs), bulu abu-abu tebal dan lembut (thick soft grey fur), mata besar berwarna amber (Large amber), hidung kecil berwarna pink, memakai syal hijau (Green scarf).',
      reference_image_path: '/universe-assets/pawville/characters/mochi/v1/identity-anchor.png'
    },
    {
      universe_id: profile.id,
      name: 'Dr. Paw',
      character_key: 'dr_paw',
      role: 'observer/problem_solver',
      species: 'Anjing (Shiba Inu)',
      wardrobe: 'Memakai jas dokter putih (white doctor coat) dan membawa tas medis coklat (brown medical bag)',
      personality: 'Tenang, pintar, sangat jeli (observant)',
      canonical_prompt: 'Anjing Shiba Inu, memakai jas dokter putih (white doctor coat) dan membawa tas medis coklat (brown medical bag).',
      reference_image_path: '/universe-assets/pawville/characters/dr_paw/v1/identity-anchor.png'
    },
    {
      universe_id: profile.id,
      name: 'Coco',
      character_key: 'coco',
      role: 'first_observer',
      species: 'Anjing (Corgi coklat-putih)',
      wardrobe: 'Memakai tas selempang kecil (tiny sling bag)',
      personality: 'Aktif, ceria, suka menolong (helpful)',
      canonical_prompt: 'Anjing Corgi coklat-putih, memakai tas selempang kecil (tiny sling bag).',
      reference_image_path: '/universe-assets/pawville/characters/coco/v1/identity-anchor.png'
    },
    {
      universe_id: profile.id,
      name: 'Boba',
      character_key: 'boba',
      role: 'builder_helper',
      species: 'Hamster (warna krem / cream-colored)',
      body_shape: 'Pipi besar yang mengembung (big puffy cheeks)',
      movement_style: 'bergerak dengan sangat cepat',
      canonical_prompt: 'Hamster (warna krem / cream-colored), pipi besar yang mengembung (big puffy cheeks).',
      reference_image_path: '/universe-assets/pawville/characters/boba/v1/identity-anchor.png'
    },
    {
      universe_id: profile.id,
      name: 'Tofu',
      character_key: 'tofu',
      role: 'assembler_helper',
      species: 'Kelinci (Putih)',
      wardrobe: 'Memakai celemek hijau (green apron)',
      personality: 'Teliti (meticulous), lincah (agile), sangat kreatif',
      canonical_prompt: 'Kelinci Putih, memakai celemek hijau (green apron).',
      reference_image_path: '/universe-assets/pawville/characters/tofu/v1/identity-anchor.png'
    }
  ];

  for (const char of characters) {
    const createdChar = await createUniverseCharacter(char);
    console.log(`Created Character: ${createdChar.name}`);
  }

  const locations = [
    {
      universe_id: profile.id,
      name: 'PawVille Town Square',
      location_key: 'pawville_town_square',
      visual_description: 'Pusat kota yang cerah dengan jalan berbatu, air mancur kecil berbentuk tulang, dan banyak bangku taman tempat para hewan bersosialisasi.'
    },
    {
      universe_id: profile.id,
      name: "Mochi's Home",
      location_key: 'mochis_home',
      visual_description: 'Rumah yang sangat cozy, penuh dengan bantal empuk, karpet berbulu, dan sudut-sudut nyaman yang hangat oleh sinar matahari.'
    },
    {
      universe_id: profile.id,
      name: "Dr. Paw's Clinic",
      location_key: 'dr_paws_clinic',
      visual_description: 'Ruangan rapi yang lebih menyerupai bengkel penemuan atau laboratorium ramah dengan papan tulis penuh cetak biru (blueprint) produk, bukan rumah sakit yang menakutkan.'
    },
    {
      universe_id: profile.id,
      name: 'PawVille Park',
      location_key: 'pawville_park',
      visual_description: 'Taman hijau luas dengan banyak pohon rindang, jalur berlari, dan tempat bermain ketangkasan untuk hewan.'
    },
    {
      universe_id: profile.id,
      name: 'PawVille Market',
      location_key: 'pawville_market',
      visual_description: 'Pasar terbuka yang sibuk di mana hewan-hewan mencari barang-barang kebutuhan sehari-hari dengan tenda-tenda berwarna-warni.'
    }
  ];

  for (const loc of locations) {
    const createdLoc = await createUniverseLocation(loc);
    console.log(`Created Location: ${createdLoc.name}`);
  }

  console.log('Seeding PawVille completed successfully.');
  process.exit(0);
}

tenantContext.run('default_tenant', () => {
  seedPawVille().catch((err) => {
    console.error('Error seeding PawVille:', err);
    process.exit(1);
  });
});
