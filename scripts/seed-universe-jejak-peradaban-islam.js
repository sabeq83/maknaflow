/**
 * Seed Universe: Jejak Peradaban Islam
 * Tahap 3.5 — Human Claymation Universe Support
 * 
 * Run: node scripts/seed-universe-jejak-peradaban-islam.js
 */
import { getPgPool } from '../lib/db-pg.js';
import { tenantContext } from '../lib/tenant-context.js';
import {
  createUniverseProfile,
  createUniverseCharacter,
  createUniverseLocation,
  getUniverseProfileBySlug,
  dbGet
} from '../lib/db.js';

const UNIVERSE_ID = 'universe_jejak_peradaban_islam';
const SLUG = 'jejak-peradaban-islam';

const DEPICTION_POLICY = `Dilarang memvisualisasikan Nabi Muhammad ﷺ dan para nabi. Tokoh sensitif harus direpresentasikan melalui lingkungan, benda, jejak perjalanan, siluet dari belakang, atau narasi tanpa menampilkan wajah. Jangan membuat kutipan, dialog, atau peristiwa sejarah tanpa dasar sumber. Hindari anakronisme pakaian, arsitektur, benda, dan teknologi. Konflik tidak boleh ditampilkan secara sadis atau eksplisit.`;

async function seed() {
  console.log('[Seed] Starting: Jejak Peradaban Islam universe...');

  const existingProfile = await getUniverseProfileBySlug(SLUG);
  let profileId = UNIVERSE_ID;

  if (existingProfile) {
    console.log('[Seed] Universe already exists, skipping profile creation.');
    profileId = existingProfile.id;
  } else {
    const profileData = {
      id: UNIVERSE_ID,
      name: 'Jejak Peradaban Islam',
      slug: SLUG,
      premise: 'Serial dokumenter visual bergaya claymation yang menelusuri kisah-kisah dari peradaban Islam — perdagangan, keilmuan, arsitektur, dan kehidupan masyarakat dari abad ke-7 hingga abad ke-15.',
      tone: 'Hangat, reflektif, edukatif, tidak sensasional',
      knowledge_domain: 'islamic_history',
      human_presence: 'allowed',
      universe_type: 'human',
      depiction_policy: DEPICTION_POLICY,
      historical_period: 'Abad ke-7 sampai abad ke-15',
      default_visual_style: 'cinematic 3D claymation, handcrafted matte clay texture, warm historical lighting, respectful educational atmosphere',
      default_aspect_ratio: '9:16',
      default_scene_count: 7,
      default_scene_duration: 8,
      default_story_template: 'historical_explainer_7beat',
      cta_personality: 'Mengajak audiens mempelajari sejarah lebih lanjut — temukan kisah lengkapnya di link bio.',
      default_pillars_json: ['Peradaban & Kota Islam', 'Tokoh & Keilmuan', 'Perdagangan & Jalur Rempah', 'Arsitektur & Seni', 'Kehidupan Masyarakat'],
      rules_json: {},
      negative_prompts_json: ['no photorealistic rendering', 'no modern clothing or technology', 'no explicit violence', 'no visualization of Prophets'],
      status: 'active',
      version: 1
    };
    
    const profile = await createUniverseProfile(profileData);
    console.log(`[Seed] ✓ Universe profile created: ${profile.name} (${profile.id})`);
  }

  // Characters
  const chars = [
    {
      id: `${UNIVERSE_ID}_zaid_v1`,
      universe_id: profileId,
      name: 'Zaid',
      character_key: 'zaid',
      species: null,
      breed: null,
      body_shape: 'Pria muda bertubuh sedang, berpakaian jubah sederhana khas pedagang abad pertengahan Islam',
      fur_color: null,
      eye_color: 'Coklat gelap',
      wardrobe: 'Jubah wol coklat, ikat kepala putih, sandal sederhana, tas kulit kecil di pinggang',
      personality: 'Penasaran, cerdas, ramah, gemar belajar, sering bertanya kepada orang yang lebih bijak',
      movement_style: 'Energik, sering berjalan cepat sambil mengamati sekitar',
      relative_size: 'medium',
      role: 'main_character',
      canonical_prompt: 'Clay figurine young man, warm brown skin, simple medieval Islamic merchant robe in earthy brown, white head wrap, leather sandals, small leather pouch at waist, curious bright brown eyes, no specific famous person reference, generic historical Muslim merchant character',
      depiction_mode: 'normal',
      reference_type: 'identity',
      historical_period: 'Abad ke-7 sampai abad ke-15',
      forbidden_changes_json: ['Jangan ubah pakaian ke gaya modern', 'Jangan ubah menjadi karakter non-manusia'],
      reference_image_path: null,
      version: 1
    },
    {
      id: `${UNIVERSE_ID}_tokoh_historis_v1`,
      universe_id: profileId,
      name: 'Tokoh Historis (Representasi Umum)',
      character_key: 'tokoh_historis',
      species: null,
      breed: null,
      body_shape: 'Siluet dari belakang — tidak menampilkan wajah',
      fur_color: null,
      eye_color: null,
      wardrobe: 'Jubah panjang sesuai periode historis',
      personality: 'Bijaksana, tenang',
      movement_style: 'Pelan, penuh wibawa',
      relative_size: 'medium',
      role: 'supporting',
      canonical_prompt: 'Clay figurine silhouette from behind, long historical robe, no face visible, no identifiable features, respectful representation, historical Islamic period clothing',
      depiction_mode: 'faceless',
      reference_type: 'identity',
      historical_period: 'Abad ke-7 sampai abad ke-15',
      forbidden_changes_json: ['DILARANG menampilkan wajah', 'DILARANG mengidentifikasi sebagai tokoh nabi atau sahabat tertentu'],
      reference_image_path: null,
      version: 1
    }
  ];

  for (const char of chars) {
    const existingChar = await dbGet(
      `SELECT id FROM universe_characters WHERE id = ?`, [char.id]
    );
    if (existingChar) {
      console.log(`[Seed] Character ${char.name} already exists, skipping.`);
      continue;
    }
    const createdChar = await createUniverseCharacter(char);
    console.log(`[Seed] ✓ Character: ${createdChar.name}`);
  }

  // Locations
  const locs = [
    {
      id: `${UNIVERSE_ID}_masjid_bersejarah_v1`,
      universe_id: profileId,
      name: 'Masjid Bersejarah',
      location_key: 'masjid_bersejarah',
      visual_description: 'Masjid bergaya arsitektur Islam klasik — kubah besar, menara menjulang, halaman berbatu dengan air mancur kecil di tengah. Pencahayaan hangat dari lampu minyak. Dinding dihiasi kaligrafi.',
      lighting_default: 'Cahaya hangat kuning keemasan dari lentera minyak, bayangan lembut',
      props: 'Kaligrafi di dinding, karpet merah, lentera minyak, sumur air, buku kitab kuno',
      historical_period: 'Abad ke-7 sampai abad ke-15',
      reference_type: 'location',
      reference_image_path: null,
      version: 1
    },
    {
      id: `${UNIVERSE_ID}_pasar_kota_kuno_v1`,
      universe_id: profileId,
      name: 'Pasar Kota Kuno (Souq)',
      location_key: 'pasar_kota_kuno',
      visual_description: 'Pasar tradisional di kota Islam abad pertengahan — lorong-lorong sempit diatapi kain, lapak pedagang berjajar menjual rempah, kain, buku. Aroma rempah terasa dari warna-warni visual. Suasana ramai namun tertib.',
      lighting_default: 'Cahaya alami menembus kain atap, warna-warni pantulan rempah dan tekstil',
      props: 'Karung rempah, gulungan kain, buku-buku, timbangan, vas gerabah, lentera gantung',
      historical_period: 'Abad ke-7 sampai abad ke-15',
      reference_type: 'location',
      reference_image_path: null,
      version: 1
    }
  ];

  for (const loc of locs) {
    const existingLoc = await dbGet(
      `SELECT id FROM universe_locations WHERE id = ?`, [loc.id]
    );
    if (existingLoc) {
      console.log(`[Seed] Location ${loc.name} already exists, skipping.`);
      continue;
    }
    const createdLoc = await createUniverseLocation(loc);
    console.log(`[Seed] ✓ Location: ${createdLoc.name}`);
  }

  console.log('[Seed] Complete: Jejak Peradaban Islam universe seeded successfully.');
  process.exit(0);
}

tenantContext.run('default_tenant', () => {
  seed().catch(err => {
    console.error('[Seed] Error:', err);
    process.exit(1);
  });
});
