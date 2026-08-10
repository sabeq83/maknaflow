/**
 * Universe Starter Presets — Tahap 3.6
 * System presets are immutable. Universe results of cloning are regular tenant records.
 */
import { v4 as uuidv4 } from 'uuid';

export const SYSTEM_PRESETS = [
  {
    key: 'pawville_pet_story',
    version: 1,
    label: 'PawVille Pet Story',
    icon: '🐾',
    description: 'Universe hewan peliharaan claymation. Cocok untuk konten produk pet supplies dengan format 7-beat storytelling.',
    profile: {
      premise: 'Sebuah dunia mandiri di mana hewan peliharaan hidup berdampingan, menghadapi masalah sehari-hari mereka sendiri, dan menemukan solusi cerdas untuk hidup yang lebih nyaman.',
      tone: 'warm, funny, light emotional, family-friendly',
      knowledge_domain: 'pet_supplies',
      universe_type: 'animal',
      human_presence: 'none',
      depiction_policy: null,
      historical_period: null,
      default_visual_style: 'cinematic_3d_clay',
      default_aspect_ratio: '9:16',
      default_scene_count: 7,
      default_scene_duration: 8,
      default_story_template: 'pet_problem_solution_7beat',
      cta_personality: 'Tidak boleh terasa seperti iklan langsung. CTA harus terasa seperti saran dari teman. HANYA di Beat 7.',
      default_pillars_json: ['Pet Hydration & Feeding', 'Pet Grooming & Hygiene', 'Pet Enrichment & Play', 'Pet Comfort & Wellness', 'Pet Travel & Safety'],
      rules_json: { no_humans: true, anthropomorphism: 'hind_legs_ok', product_earliest_beat: 4 },
      negative_prompts_json: ['human characters', 'human hands', 'human face', 'character morphing', 'wardrobe drift', 'style drift', 'photorealistic rendering'],
      style_reference_path: null,
    },
    characters: [
      {
        name: 'Mochi', character_key: 'mochi', species: 'Kucing (British Shorthair)', breed: null,
        body_shape: 'Bulat chubby, kaki pendek (short legs)', fur_color: 'Abu-abu tebal dan lembut (thick soft grey fur)', eye_color: 'Besar berwarna amber (Large amber)', wardrobe: 'Syal hijau (Green scarf)',
        personality: 'Penasaran, sedikit manja (slightly spoiled), lembut, takut pada hal-hal baru, sangat menyukai makanan dan kenyamanan.', movement_style: null, relative_size: 'medium',
        role: 'main_character', canonical_prompt: 'Kucing British Shorthair, bulat chubby, kaki pendek (short legs), bulu abu-abu tebal dan lembut (thick soft grey fur), mata besar berwarna amber (Large amber), hidung kecil berwarna pink, memakai syal hijau (Green scarf).',
        forbidden_changes_json: [],
        reference_image_path: null,
        version: 1,
        depiction_mode: 'normal', reference_type: 'identity', historical_period: null,
      },
      {
        name: 'Dr. Paw', character_key: 'dr_paw', species: 'Anjing (Shiba Inu)', breed: null,
        body_shape: null, fur_color: null, eye_color: null, wardrobe: 'Memakai jas dokter putih (white doctor coat) dan membawa tas medis coklat (brown medical bag)',
        personality: 'Tenang, pintar, sangat jeli (observant)', movement_style: null, relative_size: 'medium',
        role: 'observer', canonical_prompt: 'Anjing Shiba Inu, memakai jas dokter putih (white doctor coat) dan membawa tas medis coklat (brown medical bag).',
        forbidden_changes_json: [],
        reference_image_path: null,
        version: 1,
        depiction_mode: 'normal', reference_type: 'identity', historical_period: null,
      },
      {
        name: 'Coco', character_key: 'coco', species: 'Anjing (Corgi coklat-putih)', breed: null,
        body_shape: null, fur_color: null, eye_color: null, wardrobe: 'Memakai tas selempang kecil (tiny sling bag)',
        personality: 'Aktif, ceria, suka menolong (helpful)', movement_style: null, relative_size: 'medium',
        role: 'first_observer', canonical_prompt: 'Anjing Corgi coklat-putih, memakai tas selempang kecil (tiny sling bag).',
        forbidden_changes_json: [],
        reference_image_path: null,
        version: 1,
        depiction_mode: 'normal', reference_type: 'identity', historical_period: null,
      }
    ],
    locations: [
      {
        name: 'PawVille Town Square', location_key: 'pawville_town_square', visual_description: 'Pusat kota yang cerah dengan jalan berbatu, air mancur kecil berbentuk tulang, dan banyak bangku taman tempat para hewan bersosialisasi.',
        lighting_default: null, props: null,
        reference_image_path: null, version: 1,
        historical_period: null, reference_type: 'location',
      },
      {
        name: "Mochi's Home", location_key: 'mochis_home', visual_description: 'Rumah yang sangat cozy, penuh dengan bantal empuk, karpet berbulu, dan sudut-sudut nyaman yang hangat oleh sinar matahari.',
        lighting_default: null, props: null,
        reference_image_path: null, version: 1,
        historical_period: null, reference_type: 'location',
      },
      {
        name: "Dr. Paw's Clinic", location_key: 'dr_paws_clinic', visual_description: 'Ruangan rapi yang lebih menyerupai bengkel penemuan atau laboratorium ramah dengan papan tulis penuh cetak biru (blueprint) produk, bukan rumah sakit yang menakutkan.',
        lighting_default: null, props: null,
        reference_image_path: null, version: 1,
        historical_period: null, reference_type: 'location',
      }
    ],
  },
  {
    key: 'herbal_grove',
    version: 1,
    label: 'Herbal Grove',
    icon: '🌿',
    description: 'Universe maskot tanaman herbal edukatif. Cocok untuk brand herbal dan jamu tradisional Indonesia.',
    profile: {
      premise: 'Taman herbal magis di mana rempah-rempah dan tanaman obat tradisional Indonesia hidup sebagai karakter maskot yang bijaksana dan ramah.',
      tone: 'hangat, edukatif, penuh kearifan lokal, family-friendly',
      knowledge_domain: 'herbal',
      universe_type: 'mascot_object',
      human_presence: 'none',
      depiction_policy: null,
      historical_period: null,
      default_visual_style: 'cinematic_3d_clay, warm earthy tones, natural garden lighting',
      default_aspect_ratio: '9:16',
      default_scene_count: 7,
      default_scene_duration: 8,
      default_story_template: 'educational_discovery_7beat',
      cta_personality: 'Ajakan lembut untuk mengenal lebih jauh tentang herbal — temukan di link bio.',
      default_pillars_json: ['Tanaman Herbal Dapur', 'Rempah Tradisional', 'Jamu & Ramuan', 'Khasiat Tanaman', 'Cara Penyeduhan'],
      rules_json: { no_medical_claims: true, educational_framing: true },
      negative_prompts_json: ['medical diagnosis', 'cure claims', 'photorealistic rendering', 'human characters', 'modern medical setting'],
      style_reference_path: null,
    },
    characters: [
      {
        name: 'Jahe Guardian', character_key: 'ginger_guardian', species: null, breed: null,
        body_shape: 'Berotot, lengan dan kaki tanah liat mungil', fur_color: null, eye_color: null, wardrobe: null,
        personality: 'Percaya diri, bangga, tangguh', movement_style: 'Berdiri tegak dengan postur melindungi', relative_size: 'medium',
        role: 'main_character', canonical_prompt: 'a cute 3D stylized ginger root character, muscular tiny clay arms and legs, soft organic brown ginger clay texture, confident proud smile, standing upright',
        forbidden_changes_json: [], reference_image_path: null, version: 1, depiction_mode: 'normal', reference_type: 'identity', historical_period: null
      },
      {
        name: 'Kunyit Wisdom', character_key: 'turmeric_wisdom', species: null, breed: null,
        body_shape: 'Tubuh akar kuning keemasan', fur_color: null, eye_color: 'Mata tenang dan bijak', wardrobe: 'Membawa tongkat kayu kecil',
        personality: 'Hangat, bijaksana, tenang', movement_style: 'Pergerakan perlahan dan penuh wibawa', relative_size: 'medium',
        role: 'supporting', canonical_prompt: 'a cute 3D stylized turmeric root character, golden-yellow clay body, warm wise calm eyes, carrying a tiny wooden stick',
        forbidden_changes_json: [], reference_image_path: null, version: 1, depiction_mode: 'normal', reference_type: 'identity', historical_period: null
      },
      {
        name: 'Mint Breeze', character_key: 'mint_breeze', species: null, breed: null,
        body_shape: 'Tubuh daun yang lentur dan elastis', fur_color: null, eye_color: null, wardrobe: null,
        personality: 'Segar, keren, penuh semangat', movement_style: 'Lincah, memantul-mantul', relative_size: 'small',
        role: 'supporting', canonical_prompt: 'a cute 3D stylized green mint leaf character, bouncy elastic clay body, fresh cool vibrant pose, bringing refreshing vibes',
        forbidden_changes_json: [], reference_image_path: null, version: 1, depiction_mode: 'normal', reference_type: 'identity', historical_period: null
      }
    ],
    locations: [
      { name: 'Herbal Garden', location_key: 'herbal_garden', visual_description: 'Taman lush dipenuhi tanaman herbal berbagai ukuran...', lighting_default: 'golden hour natural light', props: 'pots, soil, watering can, herb labels', reference_image_path: null, version: 1, historical_period: null, reference_type: 'location' },
      { name: 'Rumah Seduh', location_key: 'rumah_seduh', visual_description: 'Rumah teh tradisional dengan meja kayu, cangkir tanah liat...', lighting_default: 'warm indoor lamp light', props: 'clay cups, wooden table, dried herbs hanging', reference_image_path: null, version: 1, historical_period: null, reference_type: 'location' },
      { name: 'Pasar Herbal', location_key: 'pasar_herbal', visual_description: 'Pasar tradisional penuh karung rempah berwarna-warni...', lighting_default: 'bright market daylight', props: 'spice sacks, scales, baskets, colorful awnings', reference_image_path: null, version: 1, historical_period: null, reference_type: 'location' },
    ],
  },
  {
    key: 'kitchen_town',
    version: 1,
    label: 'Kitchen Town',
    icon: '🍳',
    description: 'Universe maskot peralatan dapur. Cocok untuk konten alat masak, organisasi dapur, dan tips memasak — BUKAN resep.',
    profile: {
      premise: 'Kota dapur ajaib di mana peralatan masak menjadi karakter maskot yang hidup dan saling membantu menyelesaikan masalah dapur.',
      tone: 'ceria, humor ringan, problem-solving, family-friendly',
      knowledge_domain: 'kitchen',
      universe_type: 'mascot_object',
      human_presence: 'none',
      depiction_policy: null,
      historical_period: null,
      default_visual_style: 'cinematic_3d_clay, bright kitchen colors, warm soft lighting',
      default_aspect_ratio: '9:16',
      default_scene_count: 7,
      default_scene_duration: 8,
      default_story_template: 'problem_solution_7beat',
      cta_personality: 'Ajakan praktis ala tetangga yang suka berbagi tips dapur.',
      default_pillars_json: ['Kitchen Tools & Gadgets', 'Dapur Bersih Terorganisir', 'Tips Memasak Efisien', 'Keselamatan Dapur', 'Penyimpanan Bahan'],
      rules_json: { no_full_recipes: true, focus_on_tools: true },
      negative_prompts_json: ['photorealistic rendering', 'human characters', 'full recipe steps', 'nutritional claims'],
      style_reference_path: null,
    },
    characters: [
      {
        name: 'Pan Guardian', character_key: 'pan_guardian', species: null, breed: null,
        body_shape: 'Wajan keramik krem dengan finishing matte, lengan gagang kayu mungil', fur_color: null, eye_color: null, wardrobe: null,
        personality: 'Ramah, melindungi, dapat diandalkan', movement_style: 'Kokoh dan mantap', relative_size: 'medium',
        role: 'main_character', canonical_prompt: 'a cute 3D stylized cream ceramic pan character, matte doff finish, tiny wooden handle arms, warmly smiling face',
        forbidden_changes_json: [], reference_image_path: null, version: 1, depiction_mode: 'normal', reference_type: 'identity', historical_period: null
      },
      {
        name: 'Blender Tornado', character_key: 'blender_tornado', species: null, breed: null,
        body_shape: 'Tubuh transparan, memutar smoothie buah pastel di dalamnya', fur_color: null, eye_color: null, wardrobe: null,
        personality: 'Energetik, bersemangat, selalu bergerak', movement_style: 'Berputar cepat seperti tornado', relative_size: 'medium',
        role: 'supporting', canonical_prompt: 'a cute 3D stylized transparent blender character, swirling pastel fruit smoothies spinning inside its clay body, energetic face',
        forbidden_changes_json: [], reference_image_path: null, version: 1, depiction_mode: 'normal', reference_type: 'identity', historical_period: null
      },
      {
        name: 'Spatula Flex', character_key: 'spatula_flex', species: null, breed: null,
        body_shape: 'Spatula silikon krem yang sangat fleksibel, kaki bertekstur kayu', fur_color: null, eye_color: null, wardrobe: null,
        personality: 'Lentur, mudah beradaptasi, ceria', movement_style: 'Menari dan meliuk-liuk dengan anggun', relative_size: 'medium',
        role: 'supporting', canonical_prompt: 'a cute 3D stylized cream silicone spatula character, highly flexible bendy body, wood-textured legs, dancing pose',
        forbidden_changes_json: [], reference_image_path: null, version: 1, depiction_mode: 'normal', reference_type: 'identity', historical_period: null
      }
    ],
    locations: [
      { name: 'Cozy Kitchen', location_key: 'cozy_kitchen', visual_description: 'Dapur nyaman dengan countertop kayu dan peralatan tertata rapi...', lighting_default: 'warm ceiling light with window side light', props: 'cookware, cutting board, herb garden, organized shelves', reference_image_path: null, version: 1, historical_period: null, reference_type: 'location' },
      { name: 'Preparation Table', location_key: 'preparation_table', visual_description: 'Meja persiapan masak luas dengan bahan-bahan segar...', lighting_default: 'bright task lighting', props: 'ingredients, prep tools, mixing bowls', reference_image_path: null, version: 1, historical_period: null, reference_type: 'location' },
      { name: 'Kitchen Cabinet', location_key: 'kitchen_cabinet', visual_description: 'Lemari dapur dengan rak-rak terorganisir berisi berbagai peralatan...', lighting_default: 'inside cabinet warm light', props: 'neatly arranged tools, spice jars, labeled containers', reference_image_path: null, version: 1, historical_period: null, reference_type: 'location' },
    ],
  },
  {
    key: 'rumah_rapi',
    version: 1,
    label: 'Rumah Rapi',
    icon: '🏠',
    description: 'Universe maskot alat kebersihan dan penataan rumah. Cocok untuk konten produk rumah tangga, kebersihan, dan organisasi.',
    profile: {
      premise: 'Sebuah rumah yang hidup di mana alat-alat kebersihan dan penataan rumah menjadi karakter maskot pahlawan yang menjaga rumah tetap rapi dan nyaman.',
      tone: 'energetik, motivatif, solution-focused, family-friendly',
      knowledge_domain: 'home_improvement',
      universe_type: 'mascot_object',
      human_presence: 'none',
      depiction_policy: null,
      historical_period: null,
      default_visual_style: 'cinematic_3d_clay, clean bright interiors, satisfying transformation visuals',
      default_aspect_ratio: '9:16',
      default_scene_count: 7,
      default_scene_duration: 8,
      default_story_template: 'problem_solution_7beat',
      cta_personality: 'Motivasi untuk hidup lebih teratur — temukan produknya di link bio.',
      default_pillars_json: ['Kebersihan Harian', 'Penataan Ruangan', 'Penyimpanan Cerdas', 'Perawatan Furnitur', 'Rutinitas Bersih'],
      rules_json: { no_dangerous_electrical: true, professional_referral_required: true },
      negative_prompts_json: ['photorealistic rendering', 'human characters', 'electrical work without warning', 'structural work'],
      style_reference_path: null,
    },
    characters: [
      { name: 'Vacuum Hunter', character_key: 'vacuum_hunter', species: null, breed: null, body_shape: 'Penyedot debu compact berwarna biru-putih dengan mata besar ekspresif dan corong yang bisa bergerak seperti tangan', fur_color: null, eye_color: 'Biru cerah', wardrobe: 'Cape merah kecil di punggung', personality: 'Penuh semangat, pantang menyerah, selalu siap beraksi', movement_style: 'Bergerak cepat dan lincah, melayang sedikit di atas lantai', relative_size: 'medium', role: 'main_character', canonical_prompt: 'Clay mascot compact vacuum cleaner character, bright blue and white body, large expressive eyes, flexible nozzle arms, small red cape, clean 3D claymation style, energetic hero pose', forbidden_changes_json: ['Jangan ubah warna ke abu-abu atau hitam', 'Jangan ubah cape'], reference_image_path: null, version: 1, depiction_mode: 'normal', reference_type: 'identity', historical_period: null },
      { name: 'Broom Sweeper', character_key: 'broom_sweeper', species: null, breed: null, body_shape: 'Sapu ijuk ramping dengan kepala yang tersenyum dan tubuh bergerak elegan', fur_color: null, eye_color: 'Coklat hangat', wardrobe: 'Pita hijau di gagangnya', personality: 'Tenang, metodis, sangat teliti', movement_style: 'Gerakan menyapu yang anggun dan ritmis', relative_size: 'medium', role: 'supporting', canonical_prompt: 'Clay mascot broom character, natural straw bristles, slim wooden handle, warm brown eyes, green ribbon accent, gentle smile, sweeping pose, 3D claymation style', forbidden_changes_json: ['Jangan ubah bahan ijuk menjadi plastik'], reference_image_path: null, version: 1, depiction_mode: 'normal', reference_type: 'identity', historical_period: null },
      { name: 'Storage Box Keeper', character_key: 'storage_box_keeper', species: null, breed: null, body_shape: 'Kotak penyimpanan persegi dengan tutup yang bisa membuka-tutup seperti mulut dan pegangan yang berfungsi sebagai tangan', fur_color: null, eye_color: 'Abu-abu bijaksana', wardrobe: 'Label nama di dadanya', personality: 'Bijaksana, terorganisir, selalu tahu di mana setiap barang berada', movement_style: 'Bergerak hati-hati dan terukur', relative_size: 'medium', role: 'supporting', canonical_prompt: 'Clay mascot storage box character, clean white stackable box form, hinged lid as expressive mouth, handle arms, wise grey eyes, name label on chest, organized and calm expression, 3D claymation style', forbidden_changes_json: ['Jangan ubah warna putih bersih'], reference_image_path: null, version: 1, depiction_mode: 'normal', reference_type: 'identity', historical_period: null },
    ],
    locations: [
      { name: 'Living Room', location_key: 'living_room', visual_description: 'Ruang keluarga nyaman dengan sofa, karpet, dan rak buku — kadang berantakan, kadang rapi setelah aksi karakter', lighting_default: 'warm natural window light', props: 'sofa, coffee table, carpet, bookshelf, scattered items pre-clean', reference_image_path: null, version: 1, historical_period: null, reference_type: 'location' },
      { name: 'Storage Room', location_key: 'storage_room', visual_description: 'Gudang rumah yang penuh kotak dan rak penyimpanan — domain Storage Box Keeper', lighting_default: 'overhead utility lighting', props: 'stacked boxes, labeled shelves, storage bins', reference_image_path: null, version: 1, historical_period: null, reference_type: 'location' },
      { name: 'Laundry Area', location_key: 'laundry_area', visual_description: 'Area laundri dengan mesin cuci, jemuran, dan rak penyimpanan detergen', lighting_default: 'bright functional lighting', props: 'washing machine, drying rack, detergent shelf, laundry baskets', reference_image_path: null, version: 1, historical_period: null, reference_type: 'location' },
    ],
  },
  {
    key: 'jejak_peradaban_islam',
    version: 1,
    label: 'Jejak Peradaban Islam',
    icon: '🕌',
    description: 'Universe human claymation edukatif tentang peradaban Islam abad ke-7 hingga ke-15. Dengan depiction policy ketat.',
    profile: {
      premise: 'Serial dokumenter visual bergaya claymation yang menelusuri kisah-kisah dari peradaban Islam — perdagangan, keilmuan, arsitektur, dan kehidupan masyarakat dari abad ke-7 hingga abad ke-15.',
      tone: 'hangat, reflektif, edukatif, tidak sensasional, penuh rasa hormat',
      knowledge_domain: 'islamic_history',
      universe_type: 'human',
      human_presence: 'allowed',
      depiction_policy: 'Dilarang memvisualisasikan Nabi Muhammad \u{fdfa} dan para nabi. Tokoh sensitif harus direpresentasikan melalui lingkungan, benda, jejak perjalanan, siluet dari belakang, atau narasi tanpa menampilkan wajah. Jangan membuat kutipan, dialog, atau peristiwa sejarah tanpa dasar sumber. Hindari anakronisme pakaian, arsitektur, benda, dan teknologi. Konflik tidak boleh ditampilkan secara sadis atau eksplisit.',
      historical_period: 'Abad ke-7 sampai abad ke-15',
      default_visual_style: 'cinematic 3D claymation, handcrafted matte clay texture, warm historical lighting, respectful educational atmosphere',
      default_aspect_ratio: '9:16',
      default_scene_count: 7,
      default_scene_duration: 8,
      default_story_template: 'historical_explainer_7beat',
      cta_personality: 'Mengajak audiens mempelajari sejarah lebih lanjut — temukan kisah lengkapnya di link bio.',
      default_pillars_json: ['Peradaban & Kota Islam', 'Tokoh & Keilmuan', 'Perdagangan & Jalur Rempah', 'Arsitektur & Seni', 'Kehidupan Masyarakat'],
      rules_json: { no_prophet_depiction: true, source_required: true, no_anachronism: true },
      negative_prompts_json: ['no photorealistic rendering', 'no modern clothing or technology', 'no explicit violence', 'no visualization of Prophets'],
      style_reference_path: null,
    },
    characters: [
      { name: 'Zaid', character_key: 'zaid', species: null, breed: null, body_shape: 'Pria muda bertubuh sedang, berpakaian jubah sederhana khas pedagang abad pertengahan Islam', fur_color: null, eye_color: 'Coklat gelap', wardrobe: 'Jubah wol coklat, ikat kepala putih, sandal sederhana, tas kulit kecil di pinggang', personality: 'Penasaran, cerdas, ramah, gemar belajar', movement_style: 'Energik, sering berjalan cepat sambil mengamati sekitar', relative_size: 'medium', role: 'main_character', canonical_prompt: 'Clay figurine young man, warm brown skin, simple medieval Islamic merchant robe in earthy brown, white head wrap, leather sandals, small leather pouch at waist, curious bright brown eyes, no specific famous person reference, generic historical Muslim merchant character, 3D claymation style', forbidden_changes_json: ['Jangan ubah pakaian ke gaya modern', 'Jangan ubah menjadi karakter non-manusia'], reference_image_path: null, version: 1, depiction_mode: 'normal', reference_type: 'identity', historical_period: 'Abad ke-7 sampai abad ke-15' },
      { name: 'Tokoh Historis (Representasi Umum)', character_key: 'tokoh_historis', species: null, breed: null, body_shape: 'Siluet dari belakang — tidak menampilkan wajah', fur_color: null, eye_color: null, wardrobe: 'Jubah panjang sesuai periode historis', personality: 'Bijaksana, tenang', movement_style: 'Pelan, penuh wibawa', relative_size: 'medium', role: 'supporting', canonical_prompt: 'Clay figurine silhouette from behind, long historical robe, no face visible, no identifiable features, respectful representation, historical Islamic period clothing, 3D claymation style', forbidden_changes_json: ['DILARANG menampilkan wajah', 'DILARANG mengidentifikasi sebagai tokoh nabi atau sahabat tertentu'], reference_image_path: null, version: 1, depiction_mode: 'faceless', reference_type: 'identity', historical_period: 'Abad ke-7 sampai abad ke-15' },
    ],
    locations: [
      { name: 'Baghdad Abbasiyah', location_key: 'baghdad_abbasiyah', visual_description: 'Pusat kota Baghdad era Abbasiyah — istana megah, Bayt al-Hikmah (Rumah Kebijaksanaan), pasar ramai, jembatan melengkung di atas Sungai Tigris', lighting_default: 'warm golden Middle Eastern sunlight', props: 'manuscripts, trade goods, architectural arches, palm trees, flowing river', reference_image_path: null, version: 1, historical_period: 'Abad ke-8 sampai ke-13', reference_type: 'location' },
      { name: 'Andalusia', location_key: 'andalusia', visual_description: 'Kota-kota Andalusia (Al-Andalus) dengan arsitektur Moorish — lengkungan tapal kuda, taman dengan air mancur, perpustakaan besar, suasana koeksistensi budaya', lighting_default: 'Mediterranean warm light', props: 'mosaic tiles, orange trees, fountains, books, astronomical instruments', reference_image_path: null, version: 1, historical_period: 'Abad ke-8 sampai ke-15', reference_type: 'location' },
    ],
  },
  {
    key: 'general_clay_story',
    version: 1,
    label: 'General Clay Story',
    icon: '🎨',
    description: 'Starting point fleksibel untuk universe manusia claymation non-sejarah. Mulai dari blank dan tambahkan karakter sendiri.',
    profile: {
      premise: 'Universe claymation manusia yang fleksibel — siap untuk dikustomisasi dengan karakter, lokasi, dan cerita sesuai kebutuhan brand.',
      tone: 'adaptable, modern, warm, engaging',
      knowledge_domain: 'general',
      universe_type: 'human',
      human_presence: 'allowed',
      depiction_policy: null,
      historical_period: null,
      default_visual_style: 'cinematic 3D claymation, modern setting, clean lighting',
      default_aspect_ratio: '9:16',
      default_scene_count: 7,
      default_scene_duration: 8,
      default_story_template: 'general_story_7beat',
      cta_personality: 'Ajakan natural sesuai brand personality.',
      default_pillars_json: [],
      rules_json: {},
      negative_prompts_json: ['photorealistic rendering', 'no wardrobe drift', 'no style drift'],
      style_reference_path: null,
    },
    characters: [],
    locations: [],
  },
];

export function getPreset(key) {
  return SYSTEM_PRESETS.find(p => p.key === key) || null;
}

export function listPresets() {
  return SYSTEM_PRESETS.map(({ key, version, label, icon, description, profile, characters, locations }) => ({
    key, version, label, icon, description,
    universe_type: profile.universe_type,
    knowledge_domain: profile.knowledge_domain,
    story_template: profile.default_story_template,
    character_count: characters.length,
    location_count: locations.length,
    has_depiction_policy: !!profile.depiction_policy,
    historical_period: profile.historical_period,
  }));
}

export function getPresetKeys() {
  return SYSTEM_PRESETS.map(p => p.key);
}
