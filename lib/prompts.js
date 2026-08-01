import { sanitizeProductTitle, sanitizeProductUsp } from './product-sanitizer.js';

export function sanitizeCustomInstruction(val) {
  if (!val || typeof val !== 'string') return '';
  return val
    .replace(/^(akhiran\s+skrip\/voiceover\s*:\s*|custom\s+instruction\s*:\s*|instruksi\s+khusus\s*:\s*)/i, '')
    .trim();
}

export function buildProductTruthContractSection(productData, bridgeAtClip = 2, productEndClip = 3) {
  const pTruth = productData?.product_truth || productData?.clean_photo_t2i_prompt || productData?.t2i_prompt || "";
  const gTruth = productData?.geometric_truth || productData?.i2v_action_prompt || productData?.packaging_type || "";
  const refFilename = productData?.product_filename_declare || (productData?.clean_photo_url ? productData.clean_photo_url.split('/').pop() : '') || (productData?.id ? `${productData.id}.png` : '');

  if (!pTruth && !gTruth) return '';

  return `
🚨 MANDATORY PRODUCT TRUTH, GEOMETRIC TRUTH & REFERENCE PHOTO CONTRACT:
You MUST use the exact verified product physics below for all bridging clips (Clip ${bridgeAtClip} to ${productEndClip}). DO NOT HALLUCINATE OR ALTER THE PACKAGING SHAPE:
- MANDATORY PRODUCT TRUTH (T2I Start Frame): "${pTruth || 'Official registered product packaging'}"
- MANDATORY GEOMETRIC TRUTH (I2V Motion): "${gTruth || 'Authentic container shape & surface physics'}"
${refFilename ? `- MANDATORY REFERENCE PHOTO FILENAME ANCHOR (T2I Prompt): You MUST explicitly declare and include: "(Product Reference File: '${refFilename}', exact high-fidelity visual design match with attached reference photo)" inside the T2I prompt for bridging clips.` : ''}
`;
}

export const UNIVERSAL_ZERO_TESTIMONY_MANDATE = `
========================================================================
🚨 MANDAT ETIKA & NARASI OBJEKTIF (STRICT ZERO-TESTIMONY MANDATE — ZERO TOLERANCE)
========================================================================
Dalam membuat naskah voiceover/narasi promosi atau cerita, Anda DILARANG KERAS menyusun klaim palsu/testimoni bohong fiktif:

1. ATURAN KATA GANTI ORANG PERTAMA (GLOBAL BAN):
   - DILARANG KERAS menggunakan kata ganti orang pertama ("aku", "saya", "gue", "kami", "moms", "bunda") untuk merujuk pada diri narator.
   - Gunakan sapaan pembaca/audiens ("kamu", "Bunda", "Moms") ATAU gunakan gaya narator observasional/objektif serba tahu.

2. ATURAN PENGALAMAN PERSONAL FIKTIF (ZERO FAKE PERSONAL HISTORY):
   - DILARANG KERAS membuat klaim penggunaan/pemakaian pribadi fiktif (seperti: "aku biasa nyeduh...", "saya selalu sedia...", "kemarin aku cobain...", "Moms selalu pakai tiap malam...").
   - DILARANG KERAS berpura-pura bahwa narator adalah pengguna langsung produk. Naskah WAJIB 100% JUJUR, EDUKATIF, & TRANSPARAN.

3. 3 FORMULA STORYTELLING OBJEKTIF & REALISTIS (GANTIKAN KARANGAN BOHONG):
   - Formula A (Observational Narrative): Pengamatan situasi nyata sehari-hari yang relatable (Contoh: "Pagi-pagi heboh ngurus rumah, tapi perut malah terasa begah? Situasi seperti ini memang sering membuat mood berantakan.").
   - Formula B (Process & Lifestyle Atmosphere): Melukiskan estetika kebiasaan sehat & suasana proses (Contoh: "Menjaga pencernaan tetap lancar bisa dimulai dari kebiasaan kecil sebelum tidur. Menyeduh cangkir teh herbal hangat membantu mengistirahatkan usus...").
   - Formula C (Fact-to-Solution Journey): Perjalanan dari masalah fisik ke fakta ilmiah & solusi produk (Contoh: "Daun jati cina dikenal efektif melancarkan pencernaan secara alami. Dengan Nezafit Teh Daun Jati Cina, menyeduh hangat sebelum tidur jadi jauh lebih praktis.").
4. ATURAN JANGKAR KEBENARAN MANFAAT PRODUK (PRIMARY PRODUCT TRUTH ANCHOR & ANTI-OVERCLAIM):
   - Data "Unique Selling Point" (USP) adalah JANGKAR UTAMA KEBENARAN MANFAAT PRODUK (Primary Product Truth Anchor).
   - DILARANG KERAS membaca atau mengutip deskripsi produk mentah e-commerce. HANYA gunakan data USP produk yang sah.

5. ATURAN KATEGORI MANFAAT TERIZIN (WHITELIST-ONLY BENEFIT CATEGORY MANDATE):
   - Narasi WAJIB HANYA MEMBAHAS MANFAAT EDUKASI & GAYA HIDUP KASUAL YANG TERIZIN (Whitelist): kemudahan rutinitas harian, kenyamanan penggunaan/konsumsi, rasa/aroma yang menyenangkan, kebugaran harian, dan kepraktisan kemasan.
   - DILARANG KERAS MEMBUAT KLAIM PERUBAHAN FISIK / MEDIS (Blacklist Kategori): penurunan berat badan, perubahan ukuran tubuh, detoksifikasi organ, kebersihan usus, pelunturan lemak, penyembuhkan/pencegahan penyakit, atau jaminan keselamatan tanpa efek samping.

6. 🚨 MANDATORY NEGATIVE LEXICON BLOCKER (STRICT BLOCKER WORDS):
   - DILARANG KERAS menggunakan kata atau turunan kata 'detox', 'detoks', 'detoksifikasi', 'usus kotor', 'usus bersih', 'pelangsing', 'peluntur lemak', 'luntur lemak', 'tanpa efek samping', 'tanpa ketergantungan' di dalam naskah voiceover maupun caption.
   - Gunakan frasa pengganti edukasi aman kasual seperti "menjaga kenyamanan pencernaan", "pencernaan terasa lega", "rutinitas bugar harian", "menyegarkan tubuh secara alami".
========================================================================
`;

// ============================================================================
// VISUAL SWAP OVERRIDES PRESETS & BUILDER (MAKNA V8.4.1)
// ============================================================================
export const WARDROBE_PRESETS = {
  // 1. Earth Tones & Warm Neutrals
  amber_terracotta: "in Amber Haze & Terracotta tones, warm and earthy colors, showcasing a classy aura perfect on matte or flowing fabric texture",
  mocca_caramel: "in Mocca, Taupe & Caramel Latte colors, timeless sophisticated neutral colors that are highly versatile and elegant",
  warm_grey: "in Warm Grey colors with a distinct warm undertone, modern and lively compared to classic grey",

  // 2. Muted Pastels (Pastel Refined)
  sage_muted: "in Sage Green Muted color, highly flexible elegant color blending beautifully with skin tones",
  lavender_lilac: "in Lavender Soft & Soft Lilac colors, offering a neat feminine touch perfect for textured or layered fabric",
  butter_yellow: "in Butter Yellow (Butter Cream) color, soft and fresh positive tone keeping a polite and modest look",

  // 3. Modern Cool & Deep Tones
  teal_navy: "in Transformative Teal & Navy Blue colors, deep dark blue and blue-green colors showing class and authority",
  olive_modern: "in Olive Green Modern color, authoritative and earthy tone",
  mahogany_maroon: "in Mahogany & Maroon colors, rich pekat red-brown, premium luxury textured modest clothing",

  // 4. Netral Klasik Modern
  cloud_dancer: "in Cloud Dancer (Off-White Modern) color, clean premium off-white highlighting fabric texture and sewing details",

  // 5. Pria Kaukasia (Casual to Formal)
  male_casual_flannel: "wearing a casual checkered flannel shirt with rolled up sleeves, showing clean male arms and hands",
  male_smart_oxford: "wearing a smart-casual long-sleeve Oxford cotton shirt with sleeves neatly rolled up, showing professional male hands",
  male_formal_suit: "wearing a formal dark charcoal wool suit sleeve and a clean white cuffs shirt sleeve, showing refined male hands",
  male_cozy_knit: "wearing a cozy thick cable-knit crewneck sweater, soft textured sleeve cuff showing warm male hands",
  male_casual_denim: "wearing a casual rugged blue denim shirt with sleeves rolled up to the forearms, showing strong male hands",
  male_sporty_hoodie: "wearing a comfortable modern athletic zipper hoodie with sleeves slightly pulled up, showing active male hands",
  male_linen_light: "wearing a lightweight breathable beige linen long-sleeve shirt with sleeves casually rolled, showing relaxed male hands",

  // 5b. Pria Kaukasia (Color-Specific Presets)
  male_terracotta: "wearing a casual Terracotta orange colored long-sleeve shirt with sleeves rolled up, showing clean male arms and hands",
  male_caramel: "wearing a sophisticated Caramel Latte brown crewneck sweater, showing warm male hands",
  male_khaki_tan: "wearing a classic Khaki Tan long-sleeve Oxford cotton shirt with sleeves neatly rolled, showing clean male hands",
  male_navy_blue: "wearing a deep Navy Blue long-sleeve shirt with sleeves rolled up to the forearms, showing clean male arms and hands",
  male_forest_green: "wearing a rich Forest Green knitted sweater, showing warm male hands",
  male_charcoal: "wearing a dark Charcoal Grey long-sleeve crewneck shirt, showing clean male hands",
  male_burgundy: "wearing a deep Burgundy maroon colored long-sleeve knit shirt, showing clean male hands",
  male_sage_muted: "wearing an elegant Sage Green long-sleeve linen shirt with sleeves rolled up, showing relaxed male hands",
  male_steel_blue: "wearing a modern Steel Blue long-sleeve casual shirt with sleeves neatly rolled, showing refined male hands",
  male_cloud_dancer: "wearing a premium Cloud Dancer off-white linen shirt with sleeves rolled up, showing relaxed male hands",

  // 6. 3D Stylized Muslimah
  "3d_fem_emerald": "wearing a rich emerald green abaya with a matching green khimar in smooth 3D clay texture",
  "3d_fem_pastel_pink": "wearing a soft pastel pink abaya with a matching pink khimar in smooth 3D clay texture",
  "3d_fem_jetblack": "wearing an elegant jet-black abaya with a matching black khimar in smooth 3D clay texture",
  "3d_fem_mocca": "wearing a mocca-caramel abaya with a taupe khimar in smooth 3D clay texture",

  // 7. 3D Stylized Male
  "3d_male_tan_knit": "wearing a warm tan beige cable-knit crewneck sweater in smooth 3D clay texture",
  "3d_male_sage_jacket": "wearing a muted sage green casual windbreaker jacket in smooth 3D clay texture",
  "3d_male_charcoal_tshirt": "wearing a clean dark charcoal cotton t-shirt in smooth 3D clay texture",
  "3d_male_terracotta_flannel": "wearing a terracotta orange checkered flannel shirt with rolled up sleeves in smooth 3D clay texture",

  // 8. 3D Stylized Duo (Coordinated Wardrobe)
  "3d_duo_earth": "the Muslim woman wearing a soft cream abaya and beige khimar, while the male wears a warm tan caramel crewneck sweater, both in smooth 3D clay textures, presenting a warm earthy color harmony",
  "3d_duo_contrast": "the Muslim woman wearing a muted sage green abaya and dark grey khimar, while the male wears a terracotta casual zipper jacket, both in smooth 3D clay textures, presenting a vibrant modern contrast",
  "3d_duo_monochrome": "the Muslim woman wearing an elegant jet-black abaya and black khimar, while the male wears a clean off-white short-sleeve t-shirt, both in smooth 3D clay textures, presenting a clean minimalist monochrome look",
  "3d_duo_pastel": "the Muslim woman wearing a soft lavender abaya and white khimar, while the male wears a light mint-green polo shirt, both in smooth 3D clay textures, presenting a gentle pastel color harmony",
  "3d_duo_cool": "the Muslim woman wearing a deep teal abaya and dark navy khimar, while the male wears a steel grey checkered flannel shirt, both in smooth 3D clay textures, presenting a professional cool-toned color harmony"
};

export const DEMOGRAPHIC_PRESETS = {
  syari_classic: "a graceful Southeast Asian Muslimah wearing modest long flowing sleeves covering the arms completely down to the wrists (strictly no short sleeves, strictly no bare arms, strictly no rolled-up sleeves), featuring delicate female hands with smooth light skin, slender fingers, and natural neat fingernails, strictly faceless framing, camera focused entirely on the forearms and hands, cropped from the elbow down to show only the forearms and hands, strictly omitting the face, head, neck, chest, and shoulders, showcasing precise hand actions and movements",
  caucasian_male: "a Caucasian man wearing clean casual long-sleeve attire covering the forearms, featuring clean male hands with smooth skin, natural neat fingernails, and a subtle wristwatch, strictly faceless framing, camera focused on the forearms, hands, and product workspace, cropped from the elbow down to show only the forearms and hands interacting naturally with the product, strictly omitting the face, head, neck, chest, and shoulders, showcasing precise hand actions",
  stylized_3d_muslimah: "a 3D stylized Muslim woman with a completely blank faceless smooth head (no eyes, nose, or mouth), dressed in an elegant loose-fitting modest abaya and a wide khimar covering her chest, smooth clay-like 3D render style, bare hands visible",
  stylized_3d_male: "a 3D stylized young male with a completely blank faceless smooth head (no eyes, nose, or mouth) and detailed short hair, dressed in clean casual attire, smooth clay-like 3D render style, bare hands visible",
  stylized_3d_duo: "two 3D stylized characters in the same scene, consisting of a Muslim woman dressed in modest clothing and a young male dressed in clean casual attire, both having completely blank faceless smooth heads (no eyes, nose, or mouth) in a smooth clay-like 3D render style, bare hands visible, showing clear interaction"
};

export const TONE_DEMOGRAPHIC_INSTRUCTIONS = {
  genz_casual: "Target Audiens: Gen-Z & Milenial Muda. Gunakan nada bicara santai, gaul, akrab (relatable), dengan sapaan 'kamu' atau 'lo'. Gunakan diksi modern yang kasual tanpa berlebihan, hindari bahasa baku kaku.",
  ibu_rumah_tangga: "Target Audiens: Ibu Rumah Tangga & Keluarga. Gunakan nada bicara hangat, ramah, mengayomi, solutif, dengan sapaan 'Bunda', 'Moms', atau 'Kamu'. Utamakan penjelasan efisiensi waktu, kemudahan penggunaan, dan keamanan keluarga.",
  professional_executive: "Target Audiens: Profesional & Pekerja Kantoran. Gunakan nada bicara lugas, berbobot, cerdas, refined, dengan sapaan 'Anda' atau 'Kamu'. Fokus pada kualitas, efisiensi kerja, dan nilai hasil konkret.",
  hijab_syari_family: "Target Audiens: Komunitas Syari & Keluarga Hijrah. Gunakan nada bicara santun, ramah, hangat, islami alami (seperti 'Bunda', 'Ukhti', 'Sahabat'), dengan pembawaan yang menenangkan dan bermanfaat.",
  fitness_health_enthusiast: "Target Audiens: Penggiat Olahraga & Kesehatan. Gunakan nada bicara motivatif, energik, informatif, menyertakan fakta nutrisi/kesehatan secara logis dan practical.",
  custom: (customText) => `Target Audiens Spesifik: ${customText}. Adaptasikan diksi, gaya bahasa, dan nada bicara secara presisi agar sangat relevan dengan audiens ini.`
};

export function getToneDemographicInstruction(key, customVal = '') {
  if (!key) return '';
  if (key === 'custom' && customVal) {
    return TONE_DEMOGRAPHIC_INSTRUCTIONS.custom(customVal);
  }
  return TONE_DEMOGRAPHIC_INSTRUCTIONS[key] || (key !== 'custom' ? `Target Audiens: ${key}` : '');
}

export const MANDATORY_TRUTH_NARRATIVE_RULE = `## MANDATORY TRUTH & OBJECTIVE NARRATIVE MANDATE (NO FALSE FIRST-PERSON ANECDOTES)
1. DILARANG KERAS menggunakan kata ganti "aku", "saya", "temen aku", "kakak aku" atau membuat pengalaman pribadi/cerita latar belakang fiktif (seperti "Kemarin aku cobain...", "Temen aku sempet ngeluh..."). Naskah WAJIB 100% JUJUR dan BEBAS BOHONG.
2. Gunakan sudut pandang Second-Person Direct Engagement ("Kamu" / "Lo") atau Objektif Edukatif/Solutif (misal: "Pernah ga sih ngerasa...", "Banyak orang ga sadar kalau...").
3. Fokuskan narasi pada penyelesaian pain point nyata penonton, instruksi praktis, dan keunggulan/fakta nyata produk tanpa rekayasa pribadi.`;

export const LIGHTING_PRESETS = {
  window_daylight: "illuminated by soft natural daylight coming from a side window, realistic soft-shadow roll-off, clean highlights",
  golden_hour: "drenched in cinematic warm sunset golden hour lighting, rich amber tones, long warm shadows, beautiful light flare",
  moody_shadow: "dramatic moody chiaroscuro lighting, deep cinematic shadows, sharp contrast, key light highlighting subject's silhouette",
  studio_softbox: "high-end studio three-point professional softbox lighting, clean studio photography style, zero harsh shadows",
  lab_cold: "clinical bright white daylight illumination, cold-tinted lighting, clean lab shadows",
  cyber_neon: "moody cyberpunk ambient glow, cyan and magenta pink neon light casting colorful reflections on the skin and surface",
  candle_warm: "warm dim candlelight ambiance, flicker of fire, highly intimate and cozy golden shadows"
};

// ============================================================================
// VSO MASCOT UNIVERSE ENGINE V9.4 — CHARACTER DATABASE & ART STYLES
// ============================================================================

export const MASCOT_UNIVERSES = {
  mascot_universe_herbal: {
    name: "Herbal Universe",
    mascots: {
      mascot_ginger_guardian:     "a cute 3D stylized ginger root character, muscular tiny clay arms and legs, soft organic brown ginger clay texture, confident proud smile, standing upright",
      mascot_turmeric_wisdom:     "a cute 3D stylized turmeric root character, golden-yellow clay body, warm wise calm eyes, carrying a tiny wooden stick",
      mascot_galangal_explorer:   "a cute 3D stylized galangal root character, rough textured clay body, wearing a tiny leaf backpack, curious adventurous face",
      mascot_fingerroot_inventor: "a cute 3D stylized fingerroot character, small chubby clay body, tiny leaf antennas as hair, excited inventor expression",
      mascot_garlic_genius:       "a cute 3D stylized garlic bulb character, round chubby white clay body, wearing tiny leaf glasses, intelligent bookworm face",
      mascot_shallot_artist:      "a cute 3D stylized shallot bulb character, bright purple-pink clay skin, creative artistic expression, holding a tiny petal paintbrush",
      mascot_mint_breeze:         "a cute 3D stylized green mint leaf character, bouncy elastic clay body, fresh cool vibrant pose, bringing refreshing vibes",
      mascot_pandan_dreamer:      "a cute 3D stylized long green pandan leaf character, flowing ribbon-like hair, calm peaceful dreamy face",
      mascot_basil_singer:        "a cute 3D stylized green basil leaf character, tiny clay body, wide open expressive singing face",
      mascot_moringa_helper:      "a cute 3D stylized green moringa leaf cluster character, tiny energetic clay body, enthusiastic helpful pose",
      mascot_lemongrass_runner:   "a cute 3D stylized lemongrass stalk character, tall slender clay body, wearing a tiny leaf headband, fastest runner pose",
      mascot_betel_guardian:      "a cute 3D stylized heart-shaped betel leaf character, green clay body, brave bold courageous expression",
      mascot_rosella_cheer:       "a cute 3D stylized red rosella flower character, vibrant crimson clay petals, extremely cheerful wide smile",
      mascot_chamomile_sleepy:    "a cute 3D stylized chamomile flower character, white clay petals with yellow clay center, sleepy half-closed relaxed eyes",
      mascot_clove_captain:       "a cute 3D stylized dark brown dried clove character, wearing a tiny captain hat, disciplined serious posture",
      mascot_saffron_queen:       "a cute 3D stylized deep red saffron thread character, elegant graceful pose, wearing a tiny golden crown",
      mascot_lemon_sunshine:      "a cute 3D stylized yellow lemon character, textured porous fresh skin, joyful optimistic wide smile",
      mascot_lime_spark:          "a cute 3D stylized green lime character, hyperactive bouncy pose, tiny round compact clay body",
      mascot_honey_lemon_duo:     "a cute 3D stylized lemon character with a golden honey drop dripping on its head, gentle loving face",
      mascot_tamarind_storyteller:"a cute 3D stylized brown tamarind pod character, warm wise storytelling expression, open narrating pose",
      mascot_honey_keeper:        "a cute 3D stylized golden honey drop character, semi-transparent golden clay body, tiny buzzing bee wings attached to back"
    }
  },
  mascot_universe_kitchen: {
    name: "Kitchen Universe",
    mascots: {
      mascot_pan_guardian:        "a cute 3D stylized cream ceramic pan character, matte doff finish, tiny wooden handle arms, warmly smiling face",
      mascot_pot_grandma:         "a cute 3D stylized white enamel pot character with a red lid as a hat, round loving grandma body",
      mascot_blender_tornado:     "a cute 3D stylized transparent blender character, swirling pastel fruit smoothies spinning inside its clay body, energetic face",
      mascot_spatula_flex:        "a cute 3D stylized cream silicone spatula character, highly flexible bendy body, wood-textured legs, dancing pose",
      mascot_whisk_dancer:        "a cute 3D stylized stainless steel whisk character, spinning gracefully on tiny elegant feet like a ballet dancer",
      mascot_knife_master:        "a cute 3D stylized premium chef knife character, sharp yet friendly reflective metallic clay body, disciplined precise stance",
      mascot_cuttingboard_giant:  "a cute 3D stylized oak wood cutting board character, wide calm flat sturdy body",
      mascot_ricecooker_chef:     "a cute 3D stylized minimal white rice cooker character, lid slightly open like a chef hat, expert cooking posture",
      mascot_airfryer_genius:     "a cute 3D stylized modern black air fryer character, highly confident proud robotic face, healthy cooking stance",
      mascot_kettle_steam:        "a cute 3D stylized white electric kettle character, puff of steam as fluffy hair, friendly welcoming face",
      mascot_egg_shy:             "a cute 3D stylized beige egg character, blushing rosy pink cheeks, extremely shy timid posture",
      mascot_tomato_cheer:        "a cute 3D stylized shiny red tomato character, perfectly round chubby body, cheerful energetic smile",
      mascot_carrot_runner:       "a cute 3D stylized orange carrot character, slender athletic clay body, fast sprint running stance",
      mascot_broccoli_professor:  "a cute 3D stylized green broccoli character, large puffy dark green head, intelligent scholarly face with tiny glasses",
      mascot_mushroom_sleepy:     "a cute 3D stylized white mushroom character, wearing a large puffy cap, sleepy droopy expression",
      mascot_bread_gentle:        "a cute 3D stylized soft bread loaf slice character, golden-brown edges, gentle warm nurturing face",
      mascot_milk_pure:           "a cute 3D stylized small glass milk bottle character, pure white liquid inside, innocent honest facial expression",
      mascot_bowl_happy:          "a cute 3D stylized white ceramic bowl character, happy smiling face on the front, welcoming open arms",
      mascot_timer_tick:          "a cute 3D stylized kitchen timer character, round face with ticking hands, disciplined punctual expression",
      mascot_measuringcup_precise:"a cute 3D stylized glass measuring cup character, pastel scale lines, perfectionist meticulous face",
      mascot_storagebox_neat:     "a cute 3D stylized clear food container character, green airtight lid, highly organized neat tidy look"
    }
  },
  mascot_universe_home_living: {
    name: "Home Living Universe",
    mascots: {
      mascot_vacuum_hunter:       "a cute 3D stylized modern white vacuum cleaner character, energetic glowing blue eyes, tiny rolling wheels, hunting dust pose",
      mascot_broom_sweeper:       "a cute 3D stylized wooden broom character, soft cream bristles, humble hard-working diligent posture",
      mascot_mop_dancer:          "a cute 3D stylized spin mop character, light-blue microfiber head spinning elegantly, graceful dancing pose",
      mascot_sponge_bubble:       "a cute 3D stylized yellow kitchen sponge character, surrounded by tiny floating soapy bubbles, cheerful bubbly face",
      mascot_storagebox_keeper:   "a cute 3D stylized sage green storage box character, neat organized tidy posture",
      mascot_basket_helper:       "a cute 3D stylized woven rattan basket character, warm natural wood textures, generous helpful arms",
      mascot_hanger_stretch:      "a cute 3D stylized premium wooden hanger character, flexible stretched arms, elegant fashion-forward stance",
      mascot_shoerack_manager:    "a cute 3D stylized multi-tier shoe rack character, neat disciplined structured look",
      mascot_sofa_hugger:         "a cute 3D stylized cozy cream sofa character, giant fluffy wide arms ready to hug everyone",
      mascot_pillow_sleepy:       "a cute 3D stylized soft white pillow character, sleepy half-closed eyes, wide yawning mouth",
      mascot_table_host:          "a cute 3D stylized oak wood dining table character, solid sturdy four legs, wise hospitable face",
      mascot_chair_support:       "a cute 3D stylized minimal wooden chair character, loyal dependable supportive posture",
      mascot_lamp_sunshine:       "a cute 3D stylized white desk lamp character, face glowing with warm bright yellow illumination when smiling",
      mascot_fan_breeze:          "a cute 3D stylized white electric desk fan character, slowly spinning blades, relaxed breezy look",
      mascot_humidifier_cloud:    "a cute 3D stylized white humidifier character, blowing a tiny cute fluffy cloud above its head",
      mascot_airpurifier_guardian:"a cute 3D stylized sleek modern white air purifier character, clean minimalist guardian face",
      mascot_trashbin_clean:      "a cute 3D stylized automatic white trash bin character, lid opening wide like a smiling mouth",
      mascot_laundrybasket_busy:  "a cute 3D stylized canvas laundry hamper character, always busy active overflowing with clothes expression",
      mascot_clothespin_twin:     "a pair of tiny cute 3D stylized wooden clothespins characters, inseparable best friend twins holding hands tightly",
      mascot_cableclip_neat:      "a cute 3D stylized pastel silicone cable clip character, super tidy perfectionist expression, organizing wires pose"
    }
  },
  mascot_universe_pet: {
    name: "Pet Universe",
    mascots: {
      mascot_oren_buddy:    "a cute 3D stylized ginger orange tabby cat character, round chubby face, sparkling curious black bead eyes",
      mascot_mochi_white:   "a cute 3D stylized fluffy snow-white cat character, soft like a mochi rice cake, peaceful sleeping expression",
      mascot_shadow_black:  "a cute 3D stylized sleek black cat character, glowing golden-yellow eyes, agile nimble mysterious posture",
      mascot_calico_sunshine:"a cute 3D stylized tri-color calico cat character, cheerful energetic happy face, playful pose",
      mascot_corgi_smile:   "a cute 3D stylized fluffy corgi dog character, extremely short stubby legs, giant wide open-mouth happy smile",
      mascot_shiba_proud:   "a cute 3D stylized tan shiba inu dog character, proud confident independent posture, gentle inner heart",
      mascot_poodle_gentle: "a cute 3D stylized white curly-haired poodle character, well-groomed clean look, polite refined expression",
      mascot_golden_helper: "a cute 3D stylized golden retriever dog character, warm golden fur, patient loyal loving eyes",
      mascot_bunny_hopper:  "a cute 3D stylized white rabbit character, long floppy ears, mid-air bouncy hopping pose",
      mascot_hammy_nibbles: "a cute 3D stylized chubby brown hamster character, stuffed chubby cheeks, cute food-gathering pose",
      mascot_guinea_cuddle: "a cute 3D stylized fluffy cream and white guinea pig character, shy adorable cuddly posture",
      mascot_hedgie_roll:   "a cute 3D stylized tiny hedgehog character, soft short spines, curling into a defensive ball when surprised",
      mascot_parrot_talkie: "a cute 3D stylized bright green parrot character, clever talkative excited expression, repeating words pose",
      mascot_canary_song:   "a cute 3D stylized bright yellow canary bird character, beautiful singing posture, joyful cheerful face",
      mascot_owl_professor: "a cute 3D stylized wise brown owl character, large round eyes, wearing tiny round leaf glasses",
      mascot_goldie_bubble: "a cute 3D stylized orange goldfish character, wide flowing tail fin, blowing tiny heart-shaped bubbles",
      mascot_betta_flash:   "a cute 3D stylized blue betta fish character, elegant wide flowing iridescent fins, confident royal posture",
      mascot_turtle_slowmo: "a cute 3D stylized green sea turtle character, smooth shiny dome shell, calm patient slow serene expression",
      mascot_pawbowl_kind:  "a cute 3D stylized pastel-colored pet food bowl character, paw icon on front, welcoming friendly face",
      mascot_ball_bouncer:  "a cute 3D stylized bright red bouncy toy ball character, hyperactive dynamic high-energy bouncing pose"
    }
  }
};

export const MASCOT_ART_STYLES = {
  "3d_claymation_cozy":  "in a highly detailed 3D claymation style, soft cozy clay-like textures, matte finish, warm drop shadows, reminiscent of modern vinyl art toys and Shaun the Sheep, cute cozy game aesthetic, octane render quality",
  "kawaii_flat_vector":  "in a clean flat vector kawaii anime illustration style, bold clean black outlines, simplified cute shapes, bright cheerful pastel color palette, minimalist design, zero gradients, Japanese kawaii aesthetic",
  "ghibli_watercolor":   "in a whimsical hand-drawn watercolor illustration style, soft textured paper grain, gentle brush strokes, magical warm natural lighting, nostalgic Studio Ghibli anime aesthetic"
};

export function getConceptInstruction(concept) {
  const c = (concept || 'faceless').toLowerCase();
  if (c === 'stylized_3d') {
    return "3D Stylized Claymation (3D cartoon clay-like model, blank faceless flat head without eyes, nose, or mouth. Full head and body are visible, but facial features are completely omitted for modesty compliance)";
  }
  if (c === 'cartoon_face') {
    return "3D Cartoon Character (Anthropomorphic character representing the product or ingredient. Full face visibility with expressive facial features such as big animated eyes, eyebrows, and a smiling mouth is REQUIRED. Disregard any faceless or hidden face constraints.)";
  }
  if (c === 'pov') {
    return "POV (First-person perspective, showcasing subject's hands from their own point of view)";
  }
  if (c === 'silhouette') {
    return "Silhouette (Moody shadow, showing subject's dark silhouette outline without facial details)";
  }
  return "faceless (Mandate 67 SYARIAT: Frame WAJIB dipotong dari SIKU ke bawah. Fokus pada area LENGAN hingga JARI TANGAN (forearm & hand close-up). DILARANG keras menampilkan wajah, kepala, leher, dada, atau bahu.)";
}

export function isFoodOrDrink(text) {
  if (!text) return false;
  const foodKeywords = [
    'makanan', 'minuman', 'kuliner', 'food', 'drink', 'beverage', 'snack', 'cemilan',
    'kopi', 'coffee', 'teh', 'tea', 'susu', 'milk', 'jus', 'juice', 'cokelat', 'chocolate',
    'keju', 'cheese', 'roti', 'bread', 'cake', 'kue', 'mie', 'noodle', 'nasi', 'rice',
    'daging', 'meat', 'ayam', 'chicken', 'sapi', 'beef', 'ikan', 'fish', 'buah', 'fruit',
    'sayur', 'vegetable', 'sambal', 'saus', 'sauce', 'bumbu', 'seasoning', 'resep', 'recipe',
    'madu', 'honey', 'sirup', 'syrup', 'cooking', 'masak', 'dapur', 'kitchen', 'baking',
    'kulineran', 'gastronomi', 'gastronomy', 'yummy', 'delicious', 'lezat', 'sedap',
    'piring', 'plate', 'gelas', 'glass', 'sendok', 'spoon', 'garpu', 'fork', 'mangkuk', 'bowl'
  ];
  const lowerText = text.toLowerCase();
  return foodKeywords.some(keyword => lowerText.includes(keyword));
}

export function detectFoodAndInjectKB(allowedKBs, ...textsToTest) {
  const combinedText = textsToTest.filter(Boolean).join(' ');
  if (isFoodOrDrink(combinedText)) {
    allowedKBs.push('Food Styling & Photography KB');
  }
}

export const MINIMAX_MICRO_ACTING_MANDATE = `
ATURAN MICRO-ACTING & PAUSE VOICEOVER (MANDATORY):  
Naskah yang Anda tulis akan disintesis oleh AI Voice. Untuk membuatnya terdengar 100% seperti manusia asli (UGC/Vlogger), Anda WAJIB menyisipkan tag interjeksi non-verbal pada tempat yang emosional.

Daftar tag yang diizinkan (Gunakan tanda kurung biasa):  
(breath) = Mengambil napas cepat  
(sighs) = Menghela napas panjang (Kelegaan / Frustrasi)  
(laughs) = Tertawa kecil  
(chuckle) = Terkekeh  
(emm) = Bergumam berpikir  
(lip-smacking) = Suara mengecap bibir (Cocok untuk video makanan/Food Porn)

TAG JEDA DRAMATIS (PAUSE CONTROL):
Jika Anda ingin memberikan jeda dramatis sebelum menyebutkan nama produk atau penawaran penting, gunakan tag <#detik#>, contoh:
"Dan solusinya adalah... <#1.0#> Sabun Cuci Muka Glowing!" (Ini akan menciptakan jeda hening tepat 1.0 detik).

CONTOH PENGGUNAAN YANG BENAR:  
"Gila sih (laughs), aku beneran gak nyangka hasilnya bakal secepat ini! Dulu tiap ngaca bawaannya pengen nangis (sighs). Tapi sekarang? (breath) Pori-pori auto mulus!"

DILARANG menggunakan tag secara berlebihan. Maksimal 1-2 tag interjeksi per naskah (8 detik).
`;

/**
 * Membangun prompt analisis video dengan penyaringan visual kustom (VSO V9.4)
 * V9.4: Mendukung Autonomous Mascot Universe Selection (Mandate 97)
 * V8.4.1: Logika manusia (faceless/stylized_3d) tetap dipertahankan
 */
export function buildVisualSwapOverridePrompt(originalVideoAnalysis, overrides, productData) {
  const isMascotUniverse = overrides.subject_demographic?.startsWith('mascot_universe_');

  // ── JALUR A: SEMESTA MASKOT OTONOM (V9.4) ──────────────────────────────────
  if (isMascotUniverse) {
    const universeKey  = overrides.subject_demographic;
    const universeData = MASCOT_UNIVERSES[universeKey];
    const targetStyle  = MASCOT_ART_STYLES[overrides.visual_style_preset] || MASCOT_ART_STYLES['3d_claymation_cozy'];

    // Format seluruh daftar karakter semesta sebagai instruksi referensi Gemini
    const characterListString = Object.entries(universeData.mascots)
      .map(([id, desc]) => `  - ID: [${id}] → Deskripsi DNA: ${desc}`)
      .join('\n');

    const targetLighting = overrides.lighting_style === 'custom'
      ? overrides.lighting_style_custom
      : (LIGHTING_PRESETS[overrides.lighting_style] || 'soft warm studio light');

    return `
Anda adalah Director of Animation dan Prompt Engineer senior di MAKNA Engine V9.4.
Tugas Anda: Lakukan rekonstruksi visual terhadap dekonstruksi video kompetitor di bawah ini menjadi video animasi kartun baru dengan karakter maskot otonom sesuai narasi cerita.

---
DEKONSTRUKSI VISUAL VIDEO ASLI:
${originalVideoAnalysis}

---
⚠️ MANDATE 97 — ATURAN MUTLAK SEMESTA MASKOT (${universeData.name}):
- DILARANG KERAS memunculkan model manusia, wajah manusia, jilbab, abaya, jas, atau organ tubuh manusia nyata di seluruh prompt klip baru!
- Semua klip WAJIB menggunakan karakter animasi kartun dari ${universeData.name}.
- Gaya visual dikunci sepenuhnya: ${targetStyle}
- Pencahayaan: ${targetLighting}

---
TUGAS PEMILIHAN KARAKTER OTONOM (AUTONOMOUS CHARACTER SELECTION):
Bacalah alur narasi/cerita dari dekonstruksi video di atas dengan seksama.
Kemudian pilih secara cerdas SATU atau DUA karakter yang PALING RELEVAN dan PALING MEREPRESENTASIKAN topik tersebut dari daftar ${universeData.name} berikut, ATAU Anda diizinkan secara "on-the-fly" menciptakan karakter maskot baru yang merepresentasikan bahan/produk cerita jika bahan tersebut belum ada dalam daftar (ikuti format ID: `[mascot_nama_bahan]` dan rancang DNA visual kartun yang senada):

${characterListString}

KRITERIA PEMILIHAN:
- Karakter harus RELEVAN dengan topik/bahan utama cerita (contoh: cerita tentang minuman anti-kembung → pilih mascot_ginger_guardian karena jahe identik dengan anti-kembung)
- Karakter harus mampu melakukan AKSI MEMASAK atau INTERAKSI LUCU yang sesuai konteks klip secara fisik
- Gunakan karakter yang SAMA secara konsisten di seluruh klip video untuk membangun brand identity maskot

---
FORMAT OUTPUT YANG DIHARAPKAN (JSON ARRAY VALID):
[
  {
    "clip_index": 1,
    "generation_mode": "T2V",
    "voiceover": "Naskah VO klip...",
    "selected_mascot_id": "[Tuliskan ID maskot yang Anda pilih, contoh: mascot_ginger_guardian]",
    "mascot_selection_reason": "Alasan singkat pemilihan karakter ini berdasarkan narasi",
    "t2v_prompt": "(VERTICAL 9:16) --ar 9:16 [LAYER 0: MASCOT TRUTH] (Character DNA: [Tuliskan deskripsi DNA karakter pilihan Anda secara lengkap di sini], ${targetStyle}), [LAYER 1: SCENE & ACTION] (Setting: [lokasi yang sesuai narasi]), (Action: [aksi lucu/memasak yang dilakukan karakter]), [LAYER 2: LIGHTING] (${targetLighting}), (Camera: medium shot, warm color grade, high detail clay render)"
  }
]
    `;
  }

  // ── JALUR B: MANUSIA — LOGIKA V8.4.1 (tidak berubah) ──────────────────────
  const targetConcept = overrides.character_concept || "faceless";

  const targetCharacter = overrides.subject_demographic === "custom"
    ? overrides.subject_demographic_custom
    : (DEMOGRAPHIC_PRESETS[overrides.subject_demographic] || "a graceful Muslimah");

  const targetWardrobe = overrides.wardrobe_style === "custom"
    ? overrides.wardrobe_style_custom
    : (WARDROBE_PRESETS[overrides.wardrobe_style] || "modest clothing");

  const targetLighting = overrides.lighting_style === "custom"
    ? overrides.lighting_style_custom
    : (LIGHTING_PRESETS[overrides.lighting_style] || "soft natural light");

  return `
Anda adalah Director of Photography (DoP) dan Prompt Engineer senior di MAKNA Engine V8.4.1.
Tugas Anda: Lakukan rekonstruksi visual terhadap dekonstruksi video kompetitor di bawah ini. Anda wajib mempertahankan alur pacing naskah dan emosi asli, namun mengganti seluruh estetika visual secara semantik sesuai dengan spesifikasi preset VSO berikut.

---
DEKONSTRUKSI VISUAL VIDEO ASLI:
${originalVideoAnalysis}

---
ATURAN KETAT VISUAL SWAP OVERRIDES (VSO PRESET):
Anda wajib membuang jauh-giat visual asli dan menimpanya dengan spesifikasi ini di seluruh klip video baru:
1. Konsep Karakter  : ${targetConcept} (${getConceptInstruction(targetConcept)})
2. Demografi Subjek : ${targetCharacter}
3. Warna Hijab (Wardrobe): ${targetWardrobe}
4. Pencahayaan/Light: ${targetLighting}

---
FORMAT OUTPUT YANG DIHARAPKAN (JSON ARRAY VALID):
[
  {
    "clip_index": 1,
    "generation_mode": "T2V",
    "voiceover": "Naskah VO...",
    "t2v_prompt": "(VERTICAL 9:16) --ar 9:16 [LAYER 0: VISUAL TRUTH] (Geometric Truth: ...), [LAYER 1: SCENE & OPTICS] (Subject: ${targetCharacter} ${targetWardrobe}), (Concept: ${targetConcept} Framing Cut elbow down, forearm and hand close-up only, strictly omitting the face, head, neck, chest, and shoulders)..."
  }
]
  `;
}

// ============================================================================
// STAGE 1: PRODUCT AGENT (Data Ingestion & Extractor)
// ============================================================================
export function buildProductAgentPrompt(inputSource, isUrl = false) {
  return `Kamu adalah "MAKNA v54.9" - STAGE 1: PRODUCT AGENT (DATA INGESTION).
Tugasmu adalah membedah dan mengekstrak *raw data* produk, baik dari URL halaman penjualan maupun teks/gambar manual yang diberikan oleh user.

[INPUT DATA]
- Sumber Data (${isUrl ? 'URL Scraping' : 'Manual Input'}): ${inputSource}

[TUGAS]
1. Ekstrak identitas produk (Nama, Fungsi Utama, USP).
   * PENTING: Ekstrak Unique Selling Proposition (USP) menjadi TEPAT 3 poin utama yang sangat menarik, persuasif, dan cocok untuk bahan naskah video TikTok. Setiap poin maksimal terdiri dari 10 kata. Format wajib berupa poin-poin bertanda hubung (-).
2. Tentukan 'Target Audiens' utama berdasarkan bahasa dan penawaran dari sumber data.
3. Ekstrak 'Key Visuals' (Gambar/Aset visual penting yang disebutkan/ditampilkan yang harus dikunci oleh Mandate 88).
4. Rumuskan 'Pain Point' utama yang diselesaikan oleh produk ini.
${isUrl ? '5. Temukan URL gambar utama produk dari daftar gambar yang terdeteksi di input (field: "scraped_image_url").' : ''}

[OUTPUT FORMAT - STRICT JSON]
{
  "product_data": {
    "product_name": "Nama Produk...",
    "product_description": "Deskripsi singkat dan tajam...",
    "unique_selling_point": "3 poin USP hasil ekstraksi bertanda hubung (-). Maksimal 10 kata per poin.",
    "target_audience": "Demografi dan Psikografi spesifik...",
    "pain_point_solved": "Masalah utama yang diselesaikan...",
    "key_visuals_extracted": ["Visual A", "Visual B"]${isUrl ? ',\n    "scraped_image_url": "URL gambar utama..."' : ''}
  }
}`;
}

// ============================================================================
// STAGE 2: IDEATION AGENT (Strategic Planner + Auto Hot Trend)
// ============================================================================
export function buildIdeationAgentPrompt(kbTexts, productData, config) {
  const allowedKBs = [
    'STRATEGIC_FRAMEWORKS',
    'CHARACTER_PSYCHOLOGY',
    'CHARACTER_ROLES'
  ];
  detectFoodAndInjectKB(
    allowedKBs,
    productData?.product_name,
    productData?.product_description,
    productData?.unique_selling_point,
    productData?.pain_point_solved,
    config?.topik
  );

  const kbCombined = kbTexts
    .filter(kb => allowedKBs.some(allowed => kb.name.includes(allowed)))
    .map(kb => `=== KB: ${kb.name} ===\n${kb.content}\n`)
    .join('\n');

  return `Kamu adalah "MAKNA v54.9" - STAGE 2: IDEATION AGENT (STRATEGIC PLANNER).
Tugasmu adalah menganalisis data produk dan merancang ide konten berdasarkan tren dan psikologi audiens.

[KNOWLEDGE BASE INJECTION]
${kbCombined}

[INPUT DATA (DARI STAGE 1)]
- Produk: ${productData.product_name}
- Deskripsi: ${productData.product_description || ''}
- USP & Pain Point: ${productData.unique_selling_point || ''} | ${productData.pain_point_solved || ''}
- Target Audiens: ${productData.target_audience || 'General public'}
- Jumlah Ide: ${config.jumlah_ide || 3}

[TUGAS KRITIS: AUTO HOT TREND DETECTION]
Kamu WAJIB menentukan 1-2 "Hot Trend" terkini yang PALING RELEVAN dengan produk ini dan target audiensnya.
Gunakan pengetahuanmu tentang tren viral terkini di Indonesia (TikTok, Reels, YouTube Shorts).
Contoh tren: "POV konten", "Storytelling gelap", "Unboxing ASMR", "Flexing culture", "Day in my life", dll.

[TUGAS & ATURAN]
1. Hasilkan ${config.jumlah_ide || 3} ide konten berdasarkan Mode A (Psychodrama) atau Mode B (Realist-Viral).
2. Terapkan [MANDATE TREN & ADAPTASI BUDAYA]: Ide HARUS dikontekstualisasikan dengan tren audiens lokal.
3. Tentukan 'Internal Enemy' (Mode A) atau 'Skeptic/Antagonist' (Mode B).
4. Gunakan CAVAC (Context, Advertised Value, Angle, Content) untuk membedah ide.

[OUTPUT FORMAT - STRICT JSON]
{
  "hot_trend_detected": "Tren viral terkini yang ditemukan dan digunakan...",
  "strategic_ideas": [
    {
      "id_ide": 1,
      "topik": "Judul Ide",
      "narrative_mode": "Mode A atau Mode B",
      "cavac_angle": "Angle Spesifik (misal: Relatable/Humor)",
      "core_conflict": "Deskripsi Konflik Utama (Internal/Eksternal)",
      "hook_strategy": "Konsep 3 detik pertama untuk Pattern Interrupt"
    }
  ]
}`;
}

// ============================================================================
// STAGE 3: NARRATION AGENT (Voiceover & Audio Blueprint)
// ============================================================================
export function buildNarrationAgentPrompt(kbTexts, selectedIdea, config) {
  const allowedKBs = [
    'NARRATIVE_STRUCTURE',
    'REALIST_VIRAL_NARRATIVE',
    'MAKNA_Config_v54.9'
  ];
  detectFoodAndInjectKB(
    allowedKBs,
    selectedIdea?.topik,
    selectedIdea?.core_conflict,
    selectedIdea?.hook_strategy,
    config?.product_name,
    config?.product_description
  );

  const kbCombined = kbTexts
    .filter(kb => allowedKBs.some(allowed => kb.name.includes(allowed)))
    .map(kb => `=== KB: ${kb.name} ===\n${kb.content}\n`)
    .join('\n');

  const microActingRules = config.tts_model_quality === 'speech-2.8-hd' ? MINIMAX_MICRO_ACTING_MANDATE : '';

  return `Kamu adalah "MAKNA v54.9" - STAGE 3: NARRATION AGENT.
Tugasmu adalah menulis naskah Voiceover murni yang sangat natural. Kamu harus mematuhi AUDIO PHYSICS PROTOCOL [MANDATE 71]!

[KNOWLEDGE BASE INJECTION]
${kbCombined}

${microActingRules}

[INPUT DATA (DARI STAGE 2)]
- Topik Terpilih: ${selectedIdea.topik}
- Narrative Mode: ${selectedIdea.narrative_mode || 'Mode B (Realist-Viral)'}
- Konflik & Hook: ${selectedIdea.core_conflict} | ${selectedIdea.hook_strategy}
- Target Platform (Durasi/Pacing Level): ${config.pacing_level || 'Level 2: Fast / Promo'}
- Jumlah Klip Target: ${config.jumlah_klip || 5}

[TUGAS & ATURAN KRITIS]
1. THE DOPAMINE LOOP: Gunakan struktur SEP (Setup-Escalation-Payoff) atau 5-Beat. Jangan jualan di awal!
2. VOCAL MATCHING [MANDATE 86]: Tentukan Voice ID dari Matrix (misal: 'Despina' untuk Fast Promo, 'Leda' untuk Parenting).
3. DURASI & PACING [MANDATE 71]: Jika Pacing Level 3, jumlah kata WAJIB 23-27 kata per klip 8 detik. HAPUS semua tanda koma (,) di script Level 3 agar TTS tidak mengambil napas panjang (Breathless Syntax).
4. BAHASA GAUL/LOKAL: Sesuaikan dengan audiens (Gue/Elo, Bunda, Kakak).
5. NATURAL & STORY-FIRST: Jangan memulai naskah dengan memuji produk. Mulai dengan MASALAH NYATA.

[OUTPUT FORMAT - STRICT JSON]
{
  "audio_blueprint": {
    "voice_id_selected": "Nama ID (e.g., Despina)",
    "global_mood": "Emosi Utama",
    "pacing_level": "${config.pacing_level || 'Level 2'}",
    "script_clips": [
      {
        "clip": 1,
        "time_segment": "[00:00-00:08]",
        "dialogue_line": "Teks Voiceover di sini! Gunakan tanda seru tanpa koma jika Level 3!",
        "word_count": 0,
        "sfx_direction": "Instruksi SFX (e.g., Record Scratch)"
      }
    ]
  }
}`;
}

// ============================================================================
// STAGE 4: VISUAL AGENT (Director & Kamera)
// ============================================================================
export function buildVisualAgentPrompt(kbTexts, audioBlueprint, productData, config) {
  const allowedKBs = [
    'VISUAL_STYLE_GUIDE',
    'LOCATION_GUIDE',
    'AUTEUR_GUIDE'
  ];
  detectFoodAndInjectKB(
    allowedKBs,
    productData?.product_name,
    productData?.product_description,
    productData?.unique_selling_point,
    productData?.pain_point_solved,
    config?.auteur_style,
    JSON.stringify(audioBlueprint)
  );

  const kbCombined = kbTexts
    .filter(kb => allowedKBs.some(allowed => kb.name.includes(allowed)))
    .map(kb => `=== KB: ${kb.name} ===\n${kb.content}\n`)
    .join('\n');

  return `Kamu adalah "MAKNA v54.9" - STAGE 4: VISUAL AGENT (DIRECTOR).
Tugasmu adalah merancang aksi visual, lokasi, dan pergerakan kamera yang SINKRON 100% dengan naskah audio.

[KNOWLEDGE BASE INJECTION]
${kbCombined}

[INPUT DATA (DARI STAGE 1 & 3)]
- Visual Key Produk: ${JSON.stringify(productData.key_visuals_extracted || [])}
- Audio Blueprint: ${JSON.stringify(audioBlueprint)}
- Aesthetic / Auteur Style: ${config.auteur_style || 'Hyper-Realist UGC'}
- Face Visibility: ${config.face_visibility || 'Faceless'} (Jika Faceless: frame WAJIB dipotong dari siku ke bawah, fokus pada lengan hingga pergelangan tangan dan jari (forearm & hand close-up), dilarang menampilkan wajah, kepala, leher, dada, atau bahu, aturan syariat)

[TUGAS & ATURAN]
1. CAMERA LOGIC GATE [MANDATE 86]: Kunci hardware kamera (misal: 'Phase One XF IQ4' untuk Macro/Produk, 'Sony A7S III' untuk UGC).
2. KINETIC DICTIONARY: Gunakan 42-Point Kinetic Library untuk pergerakan kamera (Whip Pan, Dolly, Snorricam). DILARANG menggunakan kata "Static".
3. LOCATION MODIFIER: Lokasi tidak boleh mati. Berikan modifier (misal: "Heat Wave Haze", "Neon Spill").
4. KOREOGRAFI KLIP: Setiap klip harus mencerminkan transisi adegan visual yang cocok dengan ketukan audio. Terapkan State of Matter Physics (Solid vs Liquid) pada interaksi produk.
5. KINETIC BRIDGE PROTOCOL: Deskripsi kamera antar klip harus menyambung (misal: Klip 1 ditutup Whip Pan Right → Klip 2 dibuka Whip Pan dari Kiri).

[OUTPUT FORMAT - STRICT JSON]
{
  "visual_storyboard": {
    "global_camera_locked": "Nama Kamera & Lensa...",
    "global_lighting": "Gaya Pencahayaan (e.g., High-Contrast Neon)...",
    "clips": [
      {
        "clip": 1,
        "location": "Detail Lokasi + Modifier...",
        "visual_action": "Aksi spesifik karakter/produk (e.g., Macro shot produk yang dilelehkan...)",
        "camera_movement": "Instruksi kamera dari 42-Point Library (e.g., Crash Zoom to Macro)",
        "face_visibility_note": "Patuhi aturan Face Visibility: ${config.face_visibility || 'Faceless'}"
      }
    ]
  }
}`;
}

// ============================================================================
// STAGE 5: PROMPT ENGINEER (T2I + I2V + T2V Translator)
// ============================================================================
export function buildPromptAgentPrompt(kbTexts, visualStoryboard, audioBlueprint, config) {
  const allowedKBs = [
    'PROMPT_SYSTEM',
    'MAKNA_Config_v54.9'
  ];
  detectFoodAndInjectKB(
    allowedKBs,
    config?.brand_profile?.brand_name,
    config?.brand_profile?.brand_description,
    JSON.stringify(visualStoryboard),
    JSON.stringify(audioBlueprint)
  );

  const kbCombined = kbTexts
    .filter(kb => allowedKBs.some(allowed => kb.name.includes(allowed)))
    .map(kb => `=== KB: ${kb.name} ===\n${kb.content}\n`)
    .join('\n');

  const isGeminiTts = config.voice_provider === 'gemini';
  const voiceCastJson = config.voice_cast ? (typeof config.voice_cast === 'string' ? config.voice_cast : JSON.stringify(config.voice_cast)) : '';
  const voiceCastDirective = voiceCastJson
    ? `\n\nCHARACTER VOICE CAST MAPPING CONFIGURATION:\n${voiceCastJson}\nUse this list to map character name/ID to the corresponding voice_id and google_technical_id in identity_layer when building structured JSON prompts.`
    : '';

  const i2vPromptSchema = isGeminiTts
    ? `{
        "project_metadata": {
          "clip_id": "CLIP 1",
          "generation_mode": "I2V (Image-to-Video)",
          "input_image_ref": "CROP_PANEL_1_FROM_GRID",
          "visual_reference_style": "[Visual reference style name from storyboard]",
          "duration_model": "8s",
          "aspect_ratio": "9:16"
        },
        "audio_design_stack": {
          "voice_engine_config": {
            "IMMUTABLE_CORE_DNA": {
              "identity_layer": {
                "voice_id": "[Selected Gemini voice_id (e.g. Kore, Fenrir, Aoede, Charon) matching the speaking character]",
                "google_technical_id": "[Matching Google TTS technical ID (e.g. id-ID-Neural2-A, id-ID-Wavenet-A) matching the character's voice_id]",
                "gender": "[Female/Male]",
                "biological_age": "[Age]",
                "origin": "[Origin]"
              },
              "acoustic_layer": {
                "timbre": "Clear & expressive",
                "pitch_floor": "Medium",
                "vocal_tract_length": "Standard",
                "breath_signature": "Audible inhale"
              },
              "sociological_layer": {
                "accent": "Standard",
                "class_code": "Standard"
              }
            }
          }
        },
        "visual_prompt_stack": {
          "subject_&_acting": {
            "core_subject": "High fidelity render of [Subject character visual description from start frame]",
            "micro_acting_key_phrase": "[Action verb like speaking, gesturing]",
            "consistency_lock": "High fidelity render of [Filename] - Do not alter geometry"
          },
          "lighting_&_atmosphere": {
            "lighting_geometry": "Studio soft light",
            "shadow_behavior": "Ray-Traced Soft Shadows"
          },
          "SCENE_MODULATION_LAYER": {
            "psychological_context": "cheerful",
            "performance_instruction": {
              "mood": "happy",
              "energy_level": "medium",
              "speed_multiplier": "1.0",
              "breath_acting": "Visible chest movement"
            },
            "script_content": "[Full dialogue script for this clip]"
          }
        },
        "micro_pacing_timeline": [
          {
            "time_segment": "[00:00-00:04]",
            "visual_acting_beat": "[Visual action for Character A speaking]",
            "audio_embed": "[Dialogue text spoken by Character A in first 4 seconds]",
            "sfx_cue": "[Ambient SFX]"
          },
          {
            "time_segment": "[00:04-00:08]",
            "visual_acting_beat": "[Visual action for Character B speaking/reacting]",
            "audio_embed": "[Dialogue text spoken by Character B in next 4 seconds]",
            "sfx_cue": "[Ambient SFX]"
          }
        ]
      }`
    : `"(VERTICAL 9:16) --ar 9:16 --no landscape [LAYER 1: INPUT & TRUTH LOCK] (Start Frame: [Filename]), (Consistency: MAX). (Geometric Truth: [MANDATE 50 - Shape & Material Extraction]). [LAYER 2: MICRO-PACING & ACTION (MANDATE 49)] ([00:00-00:04]): (Visual Action: [Aksi Character A], Audio Segment: \\"[Dialogue A]\\"), ([00:04-00:08]): (Visual Action: [Aksi Character B], Audio Segment: \\"[Dialogue B]\\"). [LAYER 3: SFX] SFX: [Insert SFX only - DILARANG naskah vokal/spoken words jika minimax!] "`;

  const outputSchema = `{
  "t2i_prompts": [
    {
      "clip": 1,
      "prompt": "(VERTICAL 9:16) --ar 9:16 --no landscape [LAYER 1: OPTICS] (Shot on [Camera], [Lens]), (Texture: [Film Physics]). [LAYER 2: SUBJECT & VISUAL TRUTH] (Anchor: [Subject Anchor]), (Wardrobe: [Wardrobe Lock]), (Product Truth: [Product Geometry] made of [Material Physics]). [LAYER 3: SCENE & LIGHT] (Environment: [Scene Lock]), (Lighting: [Lighting Mood]). [LAYER 4: KINETIC IMPLICATION] (Frozen Action: Subject is poised to [Action Verb]), (Micro-Expression: [Key Emotion])"
    }
  ],
  "i2v_prompts": [
    {
      "clip": 1,
      "prompt": ${isGeminiTts ? i2vPromptSchema : `"${i2vPromptSchema.replace(/"/g, '\\"')}"`}
    }
  ],
  "t2v_prompts": [
    {
      "clip": 1,
      "scenes_covered": "1",
      "duration": "8s",
      "prompt": "(VERTICAL 9:16) --ar 9:16 --no landscape [LAYER 0: VISUAL TRUTH & ANCHORS] (Geometric Truth: [MANDATE 50 - Shape & Material Extraction]), (Biometric Anchor: [MANDATE 29 - 3-Point Character Lock]). [LAYER 1: SCENE & OPTICS] (Location: [MANDATE 33 - Verbatim Scene Lock]), (Lens: [Camera Spec]), (Camera Move: [Insert Kinetic Logic]). [LAYER 2: MICRO-PACING & ACTION (MANDATE 49)] ([00:00-00:04]): (Visual Action: [Move]), ([00:04-00:08]): (Visual Action: [Move] + [TRANSITION LOCK]). [LAYER 3: SFX] SFX: [Insert SFX]"
    }
  ],
  "tiktok_caption": "Engaging TikTok caption with relevant hashtags (max 150 chars + hashtags). In Bahasa Indonesia.",
  "ig_caption": "Instagram caption with storytelling hook, value delivery, and CTA. Include hashtags. In Bahasa Indonesia.",
  "yt_title": "YouTube title - high CTR, curiosity-driven, clickable but honest. In Bahasa Indonesia.",
  "yt_desc": "YouTube description with SEO keywords, content summary, and links placeholder. In Bahasa Indonesia."
}`;

  const overridePromptRule = isGeminiTts
    ? `2. CRITICAL - GEMINI TTS STRUCTURE RULE: Khusus untuk "i2v_prompts", Anda WAJIB mengeluarkan nilai "prompt" sebagai objek JSON terstruktur (Structured JSON Object) secara utuh sesuai dengan skema TEMPLATE_2_I2V_HYBRID_KEYFRAME (bukan sebagai string biasa). Anda wajib mengisi "voice_id" dan "google_technical_id" di seksi identity_layer berdasarkan Matrix IX dan data CHARACTER VOICE CAST MAPPING yang disediakan. Untuk "t2i_prompts" dan "t2v_prompts", nilai "prompt" tetap berupa string polos (Plain Text).`
    : `2. OVERRIDE MANDATE 74 & MANDATE 79: Untuk "prompt" di dalam t2i_prompts, i2v_prompts, dan t2v_prompts, Anda WAJIB menyederhanakan output menjadi satu baris teks string polos (Plain Text / layered format) dengan struktur Layer [LAYER 1: ...] [LAYER 2: ...] dst.
       - DILARANG KERAS mengeluarkan "prompt" sebagai objek JSON terstruktur (seperti yang memiliki "project_metadata", "audio_design_stack", "visual_prompt_stack", dll.)!
       - DILARANG KERAS menginjeksikan daftar negative keywords yang sangat panjang (seperti Section III.B / Mandate 79) ke dalam nilai prompt, karena hal itu memboroskan token.`;

  const formatRule3 = isGeminiTts
    ? `3. Untuk "t2i_prompts" dan "t2v_prompts", nilai dari key "prompt" WAJIB berupa SATU STRING PANJANG tanpa line break. Sedangkan untuk "i2v_prompts", nilai "prompt" harus berupa objek JSON terstruktur penuh.`
    : `3. Nilai dari key "prompt" di dalam array WAJIB berupa SATU STRING PANJANG TANPA LINE BREAK (Plain Text, satu baris). Gabungkan semua Layer dalam satu baris terus-menerus, persis seperti contoh di OUTPUT FORMAT. DILARANG KERAS menjadikan "prompt" sebagai object atau array!`;

  const minimaxTtsRule = !isGeminiTts
    ? `\n11. CRITICAL MINIMAX VISUAL ONLY RULE: Karena penyedia suara adalah Minimax, maka di dalam prompt visual (t2v_prompts, i2v_prompts, t2i_prompts) Anda DILARANG KERAS menyertakan naskah suara vokal, dialog script, atau (Audio Segment: "..."). Prompt visual harus 100% steril dari suara vokal manusia. Bagian [LAYER 3: SFX] hanya boleh diisi efek suara ambient/fisik saja (seperti: "SFX: gentle sizzle, subtle background room tone") tanpa transkrip percakapan.`
    : '';

  const additionalRules = `ATURAN KRITIS TAMBAHAN:
1. OUTPUT WAJIB BERUPA JSON LENGKAP dengan semua key (t2i_prompts, i2v_prompts, t2v_prompts, tiktok_caption, dll). JANGAN MELEWATKAN KEY APAPUN!
${overridePromptRule}
${formatRule3}
4. DILARANG KERAS menggunakan newline (\\n), baris baru, atau Enter di dalam nilai "prompt" string polos. Jika ada transisi antar Layer, gunakan SPASI saja, bukan baris baru.
5. Ganti [Placeholder] dengan instruksi yang relevan dari Storyboard/Audio Blueprint.
6. Jumlah clip prompt HARUS SAMA PERSIS dengan jumlah klip di storyboard.
7. T2V prompts harus *self-contained* — bisa digunakan tanpa image reference.
8. CRITICAL: Semua nilai string HARUS valid JSON. Jangan gunakan *unescaped double quotes* (\\") atau karakter *newline* aktual di dalam *string value* yang dapat merusak struktur JSON!
9. CRITICAL: DILARANG KERAS menyertakan AUDIO SCRIPT atau naskah/narasi voiceover/spoken words di dalam t2v_prompts, i2v_prompts, atau t2i_prompts pada LAYER 3 atau seksi manapun. Prompt visual hanya boleh berisi visual action dan deskripsi efek suara/SFX fisik saja (seperti: "SFX: swoosh, sizzling sound"). DILARANG KERAS menuliskan kata "music", "background music", "BGM", atau musik latar instrumental apa pun.
10. CRITICAL SAFETY RULE: DILARANG KERAS menyertakan deskripsi efek suara vokal manusia non-verbal seperti helaan napas (sigh/gasp), erangan (moan/groan), atau desahan di dalam bagian [LAYER 3: SFX] atau seksi manapun karena akan memicu filter keamanan Veo (PUBLIC_ERROR_AUDIO_FILTERED). Gunakan hanya deskripsi efek suara ambient fisik (seperti: "SFX: gentle pouring sound, subtle kitchen ambiance, sizzling sound"). DILARANG KERAS menuliskan kata "music", "background music", atau "BGM".${minimaxTtsRule}`;


  return `Kamu adalah "MAKNA v54.9" - STAGE 5: PROMPT ENGINEER.
Tugasmu MURNI TEKNIS: Menerjemahkan Storyboard Visual dan Blueprint Audio menjadi output struktur Prompts T2I, I2V, dan T2V dalam BAHASA INGGRIS sesuai standar Mandate 90 (Atomic Output) dan 5-Layer Stack.

[KNOWLEDGE BASE INJECTION]
${kbCombined}

[INPUT DATA]
- Storyboard Visual: ${JSON.stringify(visualStoryboard)}
- Audio Script: ${JSON.stringify(audioBlueprint)}${voiceCastDirective}
- Aspect Ratio: ${config.aspect_ratio || '(VERTICAL 9:16) --ar 9:16'}
- Target AI Engine: ${config.target_ai || 'Google Veo (8s)'}

[TUGAS & ATURAN KRITIS]
1. BAHASA: Semua output prompt untuk mesin (T2I/I2V/T2V) WAJIB dalam Bahasa Inggris.
2. 5-LAYER STACK: Susun prompt secara linear (Optik, Subjek/Biometrik, Kinetik, Scene Lock, Lighting/Atmosfer).
3. PIXEL LOCK SUPREMACY [MANDATE 81 & 88]: Jika ada nama file produk, inject dengan sintaks: "High fidelity render of '{filename}'".
4. ATOMIC OUTPUT [MANDATE 90]: Jangan pisahkan T2I dan I2V. Hasilkan blok prompt siap *copy-paste* untuk setiap klip.
5. NO HALLUCINATION: Buka dan decode semua [BRACKET] seperti [MATRIX 9.10] menjadi teks deskriptif nyata.

[JENIS OUTPUT YANG HARUS DIHASILKAN]
A. T2I Prompts: Start Frame (gambar statis) untuk setiap klip — untuk digunakan sebagai anchor di I2V.
B. I2V Prompts: Image-to-Video motion prompt untuk setiap klip — menggunakan start frame sebagai input.
C. T2V Prompts: Self-contained Text-to-Video prompt untuk setiap klip — gabungan visual + audio SFX + micro-pacing dalam satu prompt panjang, siap copy-paste langsung ke AI video generator TANPA perlu image reference. Gunakan Micro-pacing timestamps (e.g. [00:00-00:02] Aksi A...). Sertakan AUDIO SFX di dalam prompt T2V.

[OUTPUT FORMAT - STRICT JSON]
${outputSchema}

${additionalRules}`;
}

// ============================================================================
// REVERSE ENGINEERING ENGINE (Standalone Tool — TIDAK BERUBAH)
// ============================================================================
export function buildReverseEngineeringPrompt(kbTexts, config) {
  const targetLanguage = config.target_language || 'id-ID';
  const languageName = targetLanguage === 'en-US' ? 'ENGLISH (US)' : 'INDONESIAN';
  const targetLanguageLabel = targetLanguage === 'en-US' ? 'English' : 'Bahasa Indonesia';
  const targetClips = config.target_clips_count || 5;
  // FILTER: Hanya ambil KB yang relevan untuk Reverse Engineering
  const allowedKBs = [
    'MAKNA_Config_v54.9',
    'REALIST_VIRAL_NARRATIVE',
    'STRATEGIC_FRAMEWORKS',
    'PROMPT_SYSTEM',
    'NARRATIVE_STRUCTURE'
  ];
  detectFoodAndInjectKB(
    allowedKBs,
    config?.product_name,
    config?.product_description,
    config?.brand_profile?.brand_name,
    config?.brand_profile?.brand_description,
    config?.visual_style
  );

  const kbCombined = kbTexts
    .filter(kb => allowedKBs.some(allowed => kb.name.includes(allowed)))
    .map((kb, i) => `=== KNOWLEDGE BASE ${i + 1}: ${kb.name} ===\n${kb.content}\n=== END KB ${i + 1} ===`)
    .join('\n\n');

  const visualMode = config.visual_mode || 'pure_t2v';
  const isPlainText = (config.prompt_output_format || 'plain_text') === 'plain_text';
  const isWithoutSfx = config?.sfx_setting === 'without_sfx';
  const isAudioSegmentEnabled = config?.enable_audio_segment === true;
  const isMascotMode = (config?.visual_overrides?.subject_demographic || '').startsWith('mascot_universe_');
  const voiceCastData = config?.voice_cast_json ? (typeof config.voice_cast_json === 'string' ? (() => { try { return JSON.parse(config.voice_cast_json); } catch(e) { return null; } })() : config.voice_cast_json) : null;
  const voiceCastList = voiceCastData?.characters?.length > 0
    ? `\n\nCHARACTER VOICE CAST (dikunci per kampanye ini, WAJIB konsisten):\n` + voiceCastData.characters.map(ch => `- character_id: "${ch.id}" | Nama: ${ch.name} | Suara: ${ch.gemini_voice_id || ch.minimax_voice_id}`).join('\n')
    : '';
  const i2vSfxTemplate = isWithoutSfx ? '' : (isAudioSegmentEnabled ? ' [LAYER 3: FULL SCRIPT REFERENCE] AUDIO SCRIPT: "[Full VO Text]" VOICE: [Character Voice — ANTI-ROBOT] SFX/MUSIC: [SFX + Music Direction]' : ' [LAYER 3: SFX] SFX: ...');
  const t2vSfxTemplate = isWithoutSfx ? '' : (isAudioSegmentEnabled ? ' [LAYER 3: FULL SCRIPT REFERENCE] AUDIO SCRIPT: "[Full VO Text]" VOICE: [Character Voice — ANTI-ROBOT] SFX/MUSIC: [SFX + Music Direction]' : ' [LAYER 3: SFX] SFX: [Insert SFX]');
  const audioSegmentMandate = isAudioSegmentEnabled ? `
6. AUDIO SEGMENT MANDATE [MANDATE 92 — AKTIF]: Rule #5 di atas DIGANTI oleh mandate ini. Kamu WAJIB menyertakan (Audio Segment: "[Kata yang diucapkan]") secara inline di SETIAP segmen waktu LAYER 2. FORMAT WAJIB LAYER 2 (i2v_prompt & t2v_prompt):
   ([00:00-00:02]): (Visual Action: [Aksi]), (Audio Segment: "[Script beat 1 — 25% naskah]"),
   ([00:02-00:04]): (Visual Action: [Aksi]), (Audio Segment: "[Script beat 2 — 25% naskah]"),
   ([00:04-00:06]): (Visual Action: [Aksi]), (Audio Segment: "[Script beat 3 — 25% naskah]"),
   ([00:06-00:08]): (Visual Action: [Aksi] + [TRANSITION LOCK]), (Audio Segment: "[Script beat 4 — 25% naskah]").
   Setelah LAYER 2, tambahkan: [LAYER 3: FULL SCRIPT REFERENCE] AUDIO SCRIPT: "[Teks VO lengkap]" VOICE: [Deskripsi Suara — ANTI-ROBOT] SFX/MUSIC: [SFX + Musik]
   DILARANG: Menempatkan seluruh naskah dalam 1 beat saja. Harus dibagi merata ke 4 beat.${isMascotMode ? `
   MASCOT VOICE MANDATE [MANDATE 93]: Subjek adalah karakter maskot. Suara WAJIB ekspresif/playful — BUKAN narrator manusia generik. LIP SYNC: ON. Pilih suara yang cocok dengan kepribadian maskot.` : ''}${voiceCastList ? `

MULTI-CHARACTER DIALOG MANDATE [MANDATE 94 v3.0 — AKTIF]:${voiceCastList}
ATURAN DIALOG (SANGAT KETAT):
- Setiap klip video (8 detik) WAJIB ada tepat 2 karakter berbeda dari CHARACTER VOICE CAST di atas yang saling berdialog/menjawab. Monolog atau klip berisi hanya 1 karakter/narator tunggal dilarang keras!
- Tentukan otonom kapan masing-masing berbicara: Karakter A berbicara selama 4 detik pertama ([00:00-00:04]), dibalas oleh Karakter B selama 4 detik berikutnya ([00:04-00:08]).
- Kombinasi karakter yang berbicara di klip yang berbeda WAJIB bervariasi (misal: klip 1: karakter A & B, klip 2: karakter C & D, klip 3: karakter A & C, dst) agar video dinamis.
- Di setiap klip, Anda WAJIB menyertakan field "voice_segments" dalam format array berisi tepat 2 dialog karakter:
  "voice_segments": [
    { "character_id": "[slug karakter X]", "text": "[Dialog X]" },
    { "character_id": "[slug karakter Y]", "text": "[Dialog Y]" }
  ]
- "narration" field TETAP diisi teks gabungan: "[KARAKTER_X]: text. [KARAKTER_Y]: text."
- character_id HARUS KONSISTEN di semua klip menggunakan slug dari cast di atas.
` : `

MULTI-CHARACTER DIALOG MANDATE [MANDATE 94 v3.0 — OTONOM]:
Kamu WAJIB secara OTONOM merancang dialog percakapan antar beberapa karakter maskot berbeda di sepanjang video.
ATURAN DIALOG (SANGAT KETAT):
- Setiap klip video (8 detik) WAJIB ada tepat 2 karakter berbeda yang saling berdialog/menjawab. Monolog atau klip berisi hanya 1 karakter/narator tunggal dilarang keras!
- Tentukan otonom kapan masing-masing berbicara: Karakter A berbicara selama 4 detik pertama ([00:00-00:04]), dibalas oleh Karakter B selama 4 detik berikutnya ([00:04-00:08]).
- Tentukan character_id unik (slug huruf kecil, misal: 'ginger', 'mint', 'kunyit', 'temulawak', 'host') secara konsisten di semua klip. Anda WAJIB memperkenalkan dan menggunakan minimal 3 hingga 4 karakter unik yang berbeda di seluruh video.
- Kombinasi karakter yang berbicara di klip yang berbeda WAJIB bervariasi (misal: klip 1: karakter A & B, klip 2: karakter C & D, klip 3: karakter A & C, dst) agar interaksi dinamis.
- Di setiap klip, Anda WAJIB menyertakan field "voice_segments" dalam format array berisi tepat 2 dialog karakter:
  "voice_segments": [
    { "character_id": "[slug karakter X]", "text": "[Dialog X]" },
    { "character_id": "[slug karakter Y]", "text": "[Dialog Y]" }
  ]
- "narration" field TETAP diisi teks gabungan: "[KARAKTER_X]: text. [KARAKTER_Y]: text."
- character_id HARUS KONSISTEN di semua klip.
`}` : '';

  const visualModeInstructions = visualMode === 'hybrid_lock'
    ? `## ATURAN VISUAL MODE: DOUBLE-PASS (T2I + I2V) UNTUK SEMUA KLIP
Demi konsistensi visual di seluruh video, seluruh adegan (Klip 1 hingga ${targetClips}) WAJIB dirancang menggunakan model Double-Pass (T2I + I2V). Oleh karena itu:
- Anda WAJIB menghasilkan nilai 't2i_prompt' (visual start frame statis dalam Bahasa Inggris) untuk SETIAP klip (Klip 1 sampai ${targetClips}). DILARANG keras mengosongkan 't2i_prompt' pada klip mana pun dengan dalih kesinambungan adegan! Setiap adegan yang berbeda wajib memiliki start frame tersendiri.
- Anda WAJIB menghasilkan nilai 'i2v_prompt' (visual camera motion/movement dalam Bahasa Inggris) untuk SETIAP klip (Klip 1 sampai ${targetClips}). DILARANG mengosongkan 'i2v_prompt' pada klip mana pun!
- Setiap klip dirender secara mandiri (standalone). Jangan berasumsi klip berikutnya bisa melanjutkan adegan sebelumnya tanpa start frame baru.
- Anda DILARANG mengisi key "t2v_prompt" (kosongkan key tersebut atau jangan diisi).`
    : `## ATURAN VISUAL MODE: PURE T2V
Karena kampanye ini dikonfigurasi dalam mode "pure_t2v", maka seluruh klip (Klip 1 hingga ${targetClips}) wajib menggunakan Text-to-Video. Oleh karena itu, isi array "t2v_prompt" untuk seluruh klip tersebut. Anda TIDAK perlu mengisi array "t2i_prompt" and "i2v_prompt".`;

  const voiceSegmentsField = isAudioSegmentEnabled
    ? `,\n      "voice_segments": [ { "character_id": "[slug_karakter_1]", "text": "[dialog 1]" }, { "character_id": "[slug_karakter_2]", "text": "[dialog 2]" } ] (atau null jika hanya ada 1 karakter/suara tunggal)`
    : '';

  let dynamicPlanFields = '';
  let dynamicImportantRules = '';

  if (visualMode === 'hybrid_lock') {
    dynamicPlanFields = `      "new_vo": "Naskah voiceover versi baru yang di-upgrade. Wajib dalam bahasa ${languageName} / ${targetLanguageLabel}.",
      "visual_action": "Deskripsi aksi visual versi baru dalam Bahasa Indonesia sebagai representasi manusiawi dari scene (misal: Kamera tracking mengikuti tangan menuangkan sirup ke gelas...)",
      "t2i_prompt": "(VERTICAL 9:16) --ar 9:16 --no landscape [LAYER 1: OPTICS] (Shot on [Camera/Lens specs]). [LAYER 2: SUBJECT & VISUAL TRUTH] (Biometric Anchor: [Demographic, features]), (Wardrobe: [Clothing/hijab details matching style guidelines]), (Face Visibility: [Details reflecting face_visibility constraint]). [LAYER 3: SCENE & LIGHT] (Location: [Environment/Background details]), (Lighting: [Light sources/spills]). [LAYER 4: KINETIC IMPLICATION] (Frozen Action: [Moment in time frozen, static start frame detail])",
      "i2v_prompt": "Prompt visual I2V (In English, plain text linear, no newlines) wajib mengikuti format terstruktur bertingkat (structured layer) ${isWithoutSfx ? '3' : '4'} segmen: (VERTICAL 9:16) --ar 9:16 --no landscape [LAYER 1: INPUT & TRUTH LOCK] (Start Frame Reference: ...). [LAYER 2: MICRO-PACING & ACTION] ${isAudioSegmentEnabled ? '([00:00-00:02]): (Visual Action: ...), (Audio Segment: \\"...\\\"), ([00:02-00:04]): (Visual Action: ...), (Audio Segment: \\"...\\\"), ([00:04-00:06]): (Visual Action: ...), (Audio Segment: \\"...\\\"), ([00:06-00:08]): (Visual Action: ...), (Audio Segment: \\"...\\\").' : '([00:00-00:02]): (Visual Action: ...), ([00:02-00:04]): (Visual Action: ...), ([00:04-00:06]): (Visual Action: ...), ([00:06-00:08]): (Visual Action: ...).'}${i2vSfxTemplate}"${voiceSegmentsField}`;
    dynamicImportantRules = `2. ALL visual prompts (t2i_prompt and i2v_prompt) MUST be written ENTIRELY in English. Naskah voiceover and caption/social metadata in ${targetLanguageLabel}.
3. CRITICAL: All visual prompts (t2i_prompt and i2v_prompt) MUST be a single plain text paragraph — copy-paste ready.
4. CRITICAL: Semua nilai string HARUS valid JSON. Jangan gunakan *unescaped double quotes* (\\") atau karakter *newline* aktual di dalam *string value* yang dapat merusak struktur JSON.
5. CRITICAL: DILARANG KERAS menyertakan AUDIO SCRIPT atau naskah/narasi voiceover/spoken words di dalam t2i_prompt atau i2v_prompt. ${isWithoutSfx ? 'Jangan menyertakan efek suara (SFX) apa pun.' : 'Prompt visual hanya boleh berisi visual action dan deskripsi efek suara/SFX fisik saja (seperti: "SFX: swoosh, sizzling sound"). DILARANG KERAS menuliskan kata "music", "background music", "BGM", atau musik latar instrumental apa pun.'}${isWithoutSfx ? '\n6. CRITICAL RULE: Kampanye ini dikonfigurasi dalam mode "Without SFX" (Tanpa SFX). Anda DILARANG KERAS menyertakan bagian atau segmen [LAYER 3: SFX] atau deskripsi efek suara (SFX) di dalam prompt visual (t2i_prompt atau i2v_prompt). Jangan menuliskan kata "SFX:" atau efek suara apa pun.' : ''}`;
  } else {
    dynamicPlanFields = `      "new_vo": "Naskah voiceover versi baru yang di-upgrade. Wajib dalam bahasa \\dots.",
      "visual_action": "Deskripsi aksi visual versi baru dalam Bahasa Indonesia sebagai representasi manusiawi dari scene",
      "t2v_prompt": "Prompt visual T2V dalam Bahasa Inggris (plain text linear, no newlines)"${voiceSegmentsField}`;
    dynamicImportantRules = `2. ALL visual prompts (t2v_prompt) MUST be written ENTIRELY in English. Naskah voiceover and caption/social metadata in ${targetLanguageLabel}.
3. CRITICAL: All visual prompts (t2v_prompt) MUST be a single plain text paragraph — copy-paste ready.
4. CRITICAL: Semua nilai string HARUS valid JSON. Jangan gunakan *unescaped double quotes* (\\") atau karakter *newline* aktual di dalam *string value* yang dapat merusak struktur JSON.
5. CRITICAL: DILARANG KERAS menyertakan AUDIO SCRIPT atau naskah/narasi voiceover/spoken words di dalam t2v_prompt. ${isWithoutSfx ? 'Jangan menyertakan efek suara (SFX) apa pun.' : 'Prompt visual hanya boleh berisi visual action dan deskripsi efek suara/SFX fisik saja (seperti: "SFX: swoosh, sizzling sound"). DILARANG KERAS menuliskan kata "music", "background music", "BGM", atau musik latar instrumental apa pun.'}${isWithoutSfx ? '\n6. CRITICAL RULE: Kampanye ini dikonfigurasi dalam mode "Without SFX" (Tanpa SFX). Anda DILARANG KERAS menyertakan bagian atau segmen [LAYER 3: SFX] atau deskripsi efek suara (SFX) di dalam prompt visual (t2v_prompt). Jangan menuliskan kata "SFX:" atau efek suara apa pun.' : ''}`;
  }

  const microActingRules = config.tts_model_quality === 'speech-2.8-hd' ? MINIMAX_MICRO_ACTING_MANDATE : '';


  const toneOfVoice = config.brand_profile?.tone_of_voice || '"Spoken Word" yang agresif, padat (Breathless Syntax)';

  const wordsPerClip = config.words_per_clip || '17-19 kata';
  let faceVisibility = config.face_visibility || 'Faceless';
  let vsoSection = '';

  if (config.visual_overrides) {
    const vo = config.visual_overrides;
    const targetConcept = vo.character_concept || "faceless";
    if (targetConcept.toLowerCase() === 'faceless') faceVisibility = 'Faceless';
    else if (targetConcept.toLowerCase() === 'pov') faceVisibility = 'POV';
    else if (targetConcept.toLowerCase() === 'silhouette') faceVisibility = 'Silhouette';
    else if (targetConcept.toLowerCase() === 'stylized_3d') faceVisibility = '3D Stylized Claymation';

    const isMascotUniverse = vo.subject_demographic?.startsWith('mascot_universe_');
    let targetCharacter = '';
    if (isMascotUniverse) {
      const universeKey = vo.subject_demographic;
      const universeData = MASCOT_UNIVERSES[universeKey];
      const targetStyle = MASCOT_ART_STYLES[vo.visual_style_preset] || MASCOT_ART_STYLES['3d_claymation_cozy'];
      const characterListString = Object.entries(universeData.mascots)
        .map(([id, desc]) => `  - ID: [${id}] → Deskripsi DNA: ${desc}`)
        .join('\n');
      targetCharacter = `semesta maskot ${universeData.name} (Gaya visual: ${targetStyle}).
Karakter yang tersedia dalam semesta ini (pilih secara otonom dari daftar di bawah, ATAU jika ada bahan/produk penting dalam cerita yang belum terdaftar, Anda sangat disarankan untuk menciptakan karakter maskot baru secara "on-the-fly" dengan format ID: [mascot_<nama_bahan>] beserta deskripsi DNA visual kartun yang senada):
${characterListString}
⚠️ ATURAN SEMESTA MASKOT:
- DILARANG KERAS memunculkan model manusia nyata, wajah manusia, jilbab, abaya, jas, atau organ tubuh manusia nyata di seluruh prompt klip baru!
- Semua klip WAJIB menggunakan karakter animasi kartun dari semesta ini.`;
    } else {
      targetCharacter = vo.subject_demographic === "custom"
        ? vo.subject_demographic_custom
        : (DEMOGRAPHIC_PRESETS[vo.subject_demographic] || "a graceful Muslimah");
    }

    const targetWardrobe = vo.wardrobe_style === "custom"
      ? vo.wardrobe_style_custom
      : (WARDROBE_PRESETS[vo.wardrobe_style] || "modest clothing");

    const targetLighting = vo.lighting_style === "custom"
      ? vo.lighting_style_custom
      : (LIGHTING_PRESETS[vo.lighting_style] || "soft natural light");

    vsoSection = `
========================================================================
🚨 VISUAL SWAP OVERRIDES (VSO PRESET) MANDATE
========================================================================
Anda WAJIB membuang jauh-jauh seluruh detail estetika visual asli dari video kompetitor dan menggantinya secara semantik dengan spesifikasi visual di bawah ini di seluruh klip storyboard maupun prompt visual T2V/T2I/I2V:
1. Konsep Karakter  : ${targetConcept} (${getConceptInstruction(targetConcept)})
2. Demografi Subjek : ${targetCharacter}
3. Warna Hijab (Wardrobe): ${targetWardrobe}
4. Pencahayaan/Light: ${targetLighting}
5. KONSISTENSI WARDROBE WAJIB: Warna, tekstur, dan pola dari gamis/wardrobe (${targetWardrobe}) HARUS IDENTIK di seluruh klip. Jangan mengganti warna atau motif pakaian subjek antar-klip. Setiap klip yang menampilkan subjek WAJIB menggunakan wardrobe dengan warna dan tekstur yang PERSIS SAMA.
6. KONSISTENSI LATAR/LOKASI WAJIB: Latar belakang (Environment/Location) dan suasana ruangan HARUS SELARAS di seluruh klip. Gunakan tema latar yang seragam (misalnya jika berlatar meja studio, pastikan semua klip berlatar meja studio serupa) dan dilarang berpindah lokasi secara ekstrem antar adegan.

Terapkan aturan visibilitas wajah dan konsep karakter secara konsisten di deskripsi visual storyboard maupun prompt T2V/T2I (tulis dalam Bahasa Inggris).
========================================================================
`;
  }

  return `Kamu adalah "MAKNA v54.9 INFINITE INDUSTRIAL ENGINE" - REVERSE ENGINEERING.
Tugasmu adalah merancang naskah voiceover dan storyboard visual sebanyak tepat ${targetClips} klip dengan melakukan dekonstruksi kreatif dari video referensi yang dianalisis dan menciptakan versi "UPGRADE" yang jauh lebih baik (Standard MAKNA).

## KNOWLEDGE BASE(S) INJECTION
${kbCombined}

${microActingRules}

${config.custom_instruction ? `## CUSTOM INSTRUCTIONS FROM USER\n${config.custom_instruction}\n` : ''}
${vsoSection}
${visualModeInstructions}

## ATURAN GAYA NARASI (NARRATIVE MODE MANDATE)
Anda wajib menyusun naskah voiceover baru ("new_vo") untuk versi UPGRADE sesuai dengan Narrative Mode: "${config.narrative_mode || 'Storytelling'}" dengan ketentuan berikut:
- **Storytelling (Bercerita / Daily-life)**:
  * Klip Pertama (Klip 1): Hook pembuka wajib menggunakan naskah hook dari video referensi/sistem secara utuh.
  * Klip Pertengahan (Klip 2 s/d N-1): Melukiskan suasana rutinitas harian secara visual dan detail prosesnya (kronologis, misalnya: dari ketenangan persiapan kulkas hari Minggu ke hari Senin pagi yang tenang/damai). DILARANG KERAS menggunakan kata ganti orang pertama ("aku/gue/kami/saya") dan tanpa tokoh fiktif ("Andi/Siti") untuk menghindari kesan berbohong. Fokus pada keindahan proses, estetika visual, dan ketenangan pikiran.
  * Klip Terakhir (Klip N): Penutup/kesimpulan yang hangat dari aktivitas rutin tersebut dan CTA yang relevan.
- **Problem-Solution (Masalah & Solusi)**:
  * Klip Pertama (Klip 1): Hook pembuka berupa keluhan/pertanyaan.
  * Klip Awal Eskalasi (Klip 2): Menekankan rasa lelah, keluhan, atau frustrasi penonton secara dramatis (pain point). Wajib diawali kata-kata emosional seperti: "Capek banget kan...", "Pasti sebel kalau...", "Berapa kali lo ngerasa...".
  * Klip Solusi (Klip 3 s/d N-1): Pivot/perkenalan cara baru atau langkah praktis sebagai penyelesaian masalah secara konkret. Fokus pada efisiensi waktu, kemudahan, dan nilai praktis.
  * Klip Terakhir (Klip N): Kesimpulan manfaat praktis (efisiensi waktu/tenaga) dan CTA rekomendasi tindakan.
- **Educational (Tutorial / Penjelasan Ilmiah)**:
  * Klip Pertama (Klip 1): Hook fakta mengejutkan/mitos salah kaprah.
  * Klip Edukasi Teoretis (Klip 2): Penjelasan ilmiah/biokimia/fakta gizi di balik topik secara teoretis. Wajib menyertakan kosa kata ilmiah seperti: "Secara ilmiah...", "kandungan nutrisi mikro...", "struktur selular...", "zat gizi".
  * Klip Detail Teknis/Penyimpanan (Klip 3 s/d N-1): Tips teknis dan mekanisme biologis/fisik praktis (seperti reaksi kimia, proses oksidasi udara, gas etilen, kelembaban, suhu kulkas, dll.) terkait topik. Gunakan bahasa informatif, logis, objektif, dan kredibel.
  * Klip Terakhir (Klip N): Ringkasan manfaat pengetahuan dan CTA edukasi/ilmu dapur lainnya.

## GAYA VISUAL TARGET (VISUAL STYLE)
Visual Style Target: ${config.visual_style || 'Cinematic'}
Terapkan gaya visual "${config.visual_style || 'Cinematic'}" secara konsisten di seluruh klip/prompt video. Pastikan pencahayaan, tonal warna, framing kamera, dan estetika adegan di seluruh visual prompt (T2V/T2I/I2V) merefleksikan gaya tersebut.

## REGULASI VISUAL (FACE VISIBILITY)
Untuk kehadiran wajah subjek manusia pada klip video, kamu WAJIB mematuhi opsi: "${faceVisibility}".

## THE DECONSTRUCTION & THE MAKNA UPGRADE
1. Analisis video asli: Apa Hook-nya? Apa kelemahannya? Tulis analisis singkat pada objek "analysis_summary".
2. Dekonstruksi asli: Tulis detail adegan per adegan dari video kompetitor asli pada array "original_deconstruction". Key "verbatim_audio_ori" berisi naskah asli kompetitor, "translated_audio_id" berisi terjemahan naskahnya.
3. Rencana video baru: Rancang rencana video upgrade yang baru sebanyak tepat ${targetClips} klip pada array "new_video_plan". Key "visual_action" berisi deskripsi aksi visual baru dalam Bahasa Indonesia (sebagai representasi manusiawi).
   - Tulis voiceover baru pada key "new_vo". Batasi jumlah kata: TEPAT ${wordsPerClip} per klip.
4. Video DNA: Isi metadata "video_dna" berdasarkan video kompetitor/produk yang dihasilkan menggunakan skema di bawah ini.
5. Aspect Ratio Target: ${config.aspect_ratio || '9:16'}.

## OUTPUT FORMAT
Return ONLY valid JSON (no markdown code blocks, no explanation). Use this exact structure:
{
  "analysis_summary": {
    "original_hook_analysis": "Analisis singkat hook asli",
    "weakness_identified": "Apa yang kurang dari video asli",
    "the_upgrade_strategy": "Strategi peningkatan di versi baru ini"
  },
  "original_deconstruction": [
    {
      "scene_number": 1,
      "verbatim_audio_ori": "Naskah voiceover kompetitor asli pada adegan ini",
      "translated_audio_id": "Terjemahan naskah voiceover dalam Bahasa Indonesia",
      "visual_action": "Aksi visual kompetitor asli pada adegan ini"
    }
  ],
  "new_video_plan": [
    {
      "clip_index": 1,
      ${dynamicPlanFields}
    }
  ],
  "video_dna": {
    "pilar_konten": "Minuman Sehat / Makanan Cepat / Diet (Tentukan kategori resep/konten)",
    "hook_type": "Pertanyaan / Mitos / Hasil Akhir (Faktor #1 penentu 3-second view)",
    "visual_style": "Faceless / Macro / Food Porn (Pilih satu visual style dominan)",
    "signature_moment": "Madu menetes / Smoothie pusaran / Taburan topping / dll (Adegan paling estetik/ASMR)",
    "camera_pace": "Static / Dynamic Tracking / Fast Cuts",
    "primary_emotion": "Menggugah Selera / Segar / Santai / Kagum / Penasaran",
    "affiliate_integration": "Natural Usage / Background / Problem Solver",
    "affiliate_mention": "Voice Over / Visual Only",
    "scene_count": ${targetClips},
    "cta_type": "Save Recipe / Share to Friend / Buy Now"
  },
  "social_media_package": {
    "caption": "Single Universal Caption (terdiri dari Hook menarik, Value delivery, CTA universal, dan Hashtags relevan). In ${targetLanguageLabel}."
  }
}

IMPORTANT RULES:
1. Scene count/Total Klip Output harus tepat ${targetClips} klip (tidak boleh kurang, tidak boleh lebih) agar alur logis terbagi secara seimbang.
${dynamicImportantRules}${audioSegmentMandate}
${isAudioSegmentEnabled ? '7' : '6'}. CRITICAL SAFETY RULE: DILARANG KERAS menyertakan deskripsi efek suara vokal manusia non-verbal seperti helaan napas (sigh/gasp), erangan (moan/groan), atau desahan di dalam bagian [LAYER 3: SFX] atau seksi manapun karena akan memicu filter keamanan Veo (PUBLIC_ERROR_AUDIO_FILTERED). Gunakan hanya deskripsi efek suara ambient fisik (seperti: "SFX: gentle pouring sound, subtle kitchen ambiance, sizzling sound"). DILARANG KERAS menuliskan kata "music", "background music", atau "BGM".`;
}

// ============================================================================
// REVERSE ENGINEERING ALIAS / BACKWARD COMPATIBILITY
// ============================================================================
export const buildIdeationPrompt = buildIdeationAgentPrompt;

export function buildProductionPrompt(kbTexts, idea, config) {
  const allowedKBs = ['PROMPT_SYSTEM', 'MAKNA_Config_v54.9'];
  detectFoodAndInjectKB(
    allowedKBs,
    idea?.topik,
    idea?.product_name,
    idea?.product_description
  );

  const kbCombined = kbTexts
    .filter(kb => allowedKBs.some(allowed => kb.name.includes(allowed)))
    .map(kb => `=== KB: ${kb.name} ===\n${kb.content}\n`)
    .join('\n');

  return `Kamu adalah MAKNA Production Agent.
Tugasmu: Buat aset produksi untuk ide ini: ${JSON.stringify(idea)}.

[KNOWLEDGE BASE]
${kbCombined}

ATURAN OTONOM & PENYEDERHANAAN (OVERRIDE MANDATE 74 & MANDATE 79):
1. Untuk "t2i_prompts", "i2v_prompts", dan "t2v_prompts", nilai dari key "prompt" WAJIB berupa SATU STRING PANJANG (Plain Text / layered format), BUKAN berupa objek JSON terstruktur (seperti yang memiliki "project_metadata", "audio_design_stack", dll.)!
2. DILARANG KERAS menginjeksikan daftar negative keywords yang sangat panjang (seperti yang ada di Mandate 79 / Section III.B) ke dalam prompt visual karena sangat memboroskan token.
3. Semua nilai string HARUS valid JSON.
4. CRITICAL: DILARANG KERAS menyertakan AUDIO SCRIPT atau naskah/narasi voiceover/spoken words di dalam t2v_prompts, i2v_prompts, atau t2i_prompts pada LAYER 3 atau seksi manapun. Prompt visual hanya boleh berisi visual action dan deskripsi efek suara/SFX fisik saja (seperti: "SFX: swoosh, sizzling sound"). DILARANG KERAS menuliskan kata "music", "background music", "BGM", atau musik latar instrumental apa pun.
5. CRITICAL SAFETY RULE: DILARANG KERAS menyertakan deskripsi efek suara vokal manusia non-verbal seperti helaan napas (sigh/gasp), erangan (moan/groan), atau desahan di dalam bagian [LAYER 3: SFX] atau seksi manapun karena akan memicu filter keamanan Veo (PUBLIC_ERROR_AUDIO_FILTERED). Gunakan hanya deskripsi efek suara ambient fisik (seperti: "SFX: gentle pouring sound, subtle kitchen ambiance, sizzling sound"). DILARANG KERAS menuliskan kata "music", "background music", atau "BGM".

Keluarkan output dalam format JSON strict dengan struktur berikut:
{
  "tiktok_caption": "...",
  "ig_caption": "...",
  "yt_title": "...",
  "yt_desc": "...",
  "storyboard": [ { "scene": 1, "narration": "...", "duration": "3s" } ],
  "t2i_prompts": [ { "clip": 1, "prompt": "..." } ],
  "i2v_prompts": [ { "clip": 1, "prompt": "..." } ],
  "t2v_prompts": [ { "clip": 1, "scenes_covered": "1", "duration": "3s", "prompt": "..." } ]
}`;
}

export function buildReverseEngineeringBridgePrompt(kbTexts, config) {
  const targetLanguage = config.target_language || 'id-ID';
  const languageName = targetLanguage === 'en-US' ? 'ENGLISH (US)' : 'INDONESIAN';
  const targetLanguageLabel = targetLanguage === 'en-US' ? 'English' : 'Bahasa Indonesia';
  const allowedKBs = [
    'REALIST_VIRAL_NARRATIVE',
    'STRATEGIC_FRAMEWORKS',
    'PROMPT_SYSTEM',
    'NARRATIVE_STRUCTURE',
    'VISUAL_STYLE_GUIDE',
    'BRAND_VOICE_GUIDE',
    'PLATFORM_COPYWRITING',
    'COMPLIANCE_GUIDE'
  ];
  detectFoodAndInjectKB(
    allowedKBs,
    config?.product_name,
    config?.product_description,
    config?.brand_profile?.brand_name,
    config?.brand_profile?.brand_description
  );

  const kbCombined = kbTexts
    .filter(kb => allowedKBs.some(allowed => kb.name.includes(allowed)))
    .map((kb, i) => `=== KNOWLEDGE BASE ${i + 1}: ${kb.name} ===\n${kb.content}\n=== END KB ${i + 1} ===`)
    .join('\n\n');

  const brandProfile = config.brand_profile || {};
  const productData = config.product_data || {};
  const targetClips = config.target_clips_count || 5;
  const bridgeAtClip = config.bridge_at_clip || 3;
  const bridgeDurationClips = config.bridge_duration_clips || 0;
  const visualMode = config.visual_mode || 'pure_t2v';
  const isWithoutSfx = config?.sfx_setting === 'without_sfx';
  const isAudioSegmentEnabled = config?.enable_audio_segment === true;
  const isMascotMode = (config?.visual_overrides?.subject_demographic || '').startsWith('mascot_universe_');
  const voiceCastData = config?.voice_cast_json ? (typeof config.voice_cast_json === 'string' ? (() => { try { return JSON.parse(config.voice_cast_json); } catch(e) { return null; } })() : config.voice_cast_json) : null;
  const voiceCastList = voiceCastData?.characters?.length > 0
    ? `\n\nCHARACTER VOICE CAST (dikunci per kampanye ini, WAJIB konsisten):\n` + voiceCastData.characters.map(ch => `- character_id: "${ch.id}" | Nama: ${ch.name} | Suara: ${ch.gemini_voice_id || ch.minimax_voice_id}`).join('\n')
    : '';
  const i2vSfxTemplate = isWithoutSfx ? '' : (isAudioSegmentEnabled ? ' [LAYER 3: FULL SCRIPT REFERENCE] AUDIO SCRIPT: "[Full VO Text]" VOICE: [Character Voice — ANTI-ROBOT] SFX/MUSIC: [SFX + Music Direction]' : ' [LAYER 3: SFX] SFX: ...');
  const t2vSfxTemplate = isWithoutSfx ? '' : (isAudioSegmentEnabled ? ' [LAYER 3: FULL SCRIPT REFERENCE] AUDIO SCRIPT: "[Full VO Text]" VOICE: [Character Voice — ANTI-ROBOT] SFX/MUSIC: [SFX + Music Direction]' : ' [LAYER 3: SFX] SFX: [Insert SFX]');
  const audioSegmentMandate = isAudioSegmentEnabled ? `
6. AUDIO SEGMENT MANDATE [MANDATE 92 — AKTIF]: Rule #5 di atas DIGANTI oleh mandate ini. Kamu WAJIB menyertakan (Audio Segment: "[Kata yang diucapkan]") secara inline di SETIAP segmen waktu LAYER 2. FORMAT WAJIB LAYER 2:
   ([00:00-00:02]): (Visual Action: [Aksi]), (Audio Segment: "[Script beat 1]"),
   ([00:02-00:04]): (Visual Action: [Aksi]), (Audio Segment: "[Script beat 2]"),
   ([00:04-00:06]): (Visual Action: [Aksi]), (Audio Segment: "[Script beat 3]"),
   ([00:06-00:08]): (Visual Action: [Aksi] + [TRANSITION LOCK]), (Audio Segment: "[Script beat 4]").
   Setelah LAYER 2: [LAYER 3: FULL SCRIPT REFERENCE] AUDIO SCRIPT: "[VO lengkap]" VOICE: [Deskripsi Suara] SFX/MUSIC: [SFX + Musik]${isMascotMode ? `
   MASCOT VOICE MANDATE [MANDATE 93]: Suara WAJIB ekspresif/playful karakter maskot. LIP SYNC: ON.` : ''}${voiceCastList ? `

MULTI-CHARACTER DIALOG MANDATE [MANDATE 94 v3.0]:${voiceCastList}
ATURAN DIALOG (SANGAT KETAT):
- Setiap klip video (8 detik) WAJIB ada tepat 2 karakter berbeda dari CHARACTER VOICE CAST di atas yang saling berdialog/menjawab. Monolog atau klip berisi hanya 1 karakter/narator tunggal dilarang keras!
- Tentukan otonom kapan masing-masing berbicara: Karakter A berbicara selama 4 detik pertama ([00:00-00:04]), dibalas oleh Karakter B selama 4 detik berikutnya ([00:04-00:08]).
- Kombinasi karakter yang berbicara di klip yang berbeda WAJIB bervariasi (misal: klip 1: karakter A & B, klip 2: karakter C & D, klip 3: karakter A & C, dst) agar video dinamis.
- Di setiap klip, Anda WAJIB menyertakan field "voice_segments" dalam format array berisi tepat 2 dialog karakter:
  "voice_segments": [
    { "character_id": "[slug karakter X]", "text": "[Dialog X]" },
    { "character_id": "[slug karakter Y]", "text": "[Dialog Y]" }
  ]
- "narration" field TETAP diisi teks gabungan: "[KARAKTER_X]: text. [KARAKTER_Y]: text."
- character_id HARUS KONSISTEN di semua klip menggunakan slug dari cast di atas.
` : ''}` : '';

  const brandName = brandProfile.brand_name || 'Generik';
  const toneOfVoice = brandProfile.tone_of_voice || 'Kasual/Gaul';
  const forbiddenElements = brandProfile.forbidden_elements || 'Tidak ada';
  const brandSloganOrCta = brandProfile.brand_slogan_or_cta || '';

  let faceVisibility = config.face_visibility || 'Faceless';
  let vsoSection = '';

  if (config.visual_overrides) {
    const vo = config.visual_overrides;
    const targetConcept = vo.character_concept || "faceless";
    if (targetConcept.toLowerCase() === 'faceless') faceVisibility = 'Faceless';
    else if (targetConcept.toLowerCase() === 'pov') faceVisibility = 'POV';
    else if (targetConcept.toLowerCase() === 'silhouette') faceVisibility = 'Silhouette';
    else if (targetConcept.toLowerCase() === 'stylized_3d') faceVisibility = '3D Stylized Claymation';

    const targetCharacter = vo.subject_demographic === "custom"
      ? vo.subject_demographic_custom
      : (DEMOGRAPHIC_PRESETS[vo.subject_demographic] || "a graceful Muslimah");

    const targetWardrobe = vo.wardrobe_style === "custom"
      ? vo.wardrobe_style_custom
      : (WARDROBE_PRESETS[vo.wardrobe_style] || "modest clothing");

    const targetLighting = vo.lighting_style === "custom"
      ? vo.lighting_style_custom
      : (LIGHTING_PRESETS[vo.lighting_style] || "soft natural light");

    vsoSection = `
========================================================================
🚨 VISUAL SWAP OVERRIDES (VSO PRESET) MANDATE
========================================================================
Anda WAJIB membuang jauh-jauh seluruh detail estetika visual asli dari video kompetitor dan menggantinya secara semantik dengan spesifikasi visual di bawah ini di seluruh klip storyboard maupun prompt visual T2V/T2I/I2V:
1. Konsep Karakter  : ${targetConcept} (${getConceptInstruction(targetConcept)})
2. Demografi Subjek : ${targetCharacter}
3. Warna Hijab (Wardrobe): ${targetWardrobe}
4. Pencahayaan/Light: ${targetLighting}
5. KONSISTENSI WARDROBE WAJIB: Warna, tekstur, dan pola dari gamis/wardrobe (${targetWardrobe}) HARUS IDENTIK di seluruh klip. Jangan mengganti warna atau motif pakaian subjek antar-klip. Setiap klip yang menampilkan subjek WAJIB menggunakan wardrobe dengan warna dan tekstur yang PERSIS SAMA.
6. KONSISTENSI LATAR/LOKASI WAJIB: Latar belakang (Environment/Location) dan suasana ruangan HARUS SELARAS di seluruh klip. Gunakan tema latar yang seragam (misalnya jika berlatar meja studio, pastikan semua klip berlatar meja studio serupa) dan dilarang berpindah lokasi secara ekstrem antar adegan.

Terapkan aturan visibilitas wajah dan konsep karakter secara konsisten di deskripsi visual storyboard maupun prompt T2V/T2I (tulis dalam Bahasa Inggris).
========================================================================
`;
  }

  const productEndClip = (bridgeDurationClips > 0) ? (bridgeAtClip + bridgeDurationClips - 1) : targetClips;

  // Resolusi nama file referensi visual produk
  const reRefFilename = productData?.product_filename_declare
    || (productData?.clean_photo_url ? productData.clean_photo_url.split('/').pop() : '')
    || '';
  const reRefFilenameTag = reRefFilename
    ? `, (Product Reference File: '${reRefFilename}', geometry_lock: EXACT FILENAME MATCH — high-fidelity visual must match the attached reference photo)`
    : '';

  const visualModeInstructions = visualMode === 'hybrid_lock'
    ? `## ATURAN VISUAL MODE: DOUBLE-PASS (T2I + I2V) UNTUK SEMUA KLIP
Demi konsistensi visual di seluruh video, seluruh adegan (Klip 1 hingga ${targetClips}) WAJIB dirancang menggunakan model Double-Pass (T2I + I2V). Oleh karena itu:
- Isi array "t2i_prompt" (visual start frame statis dalam Bahasa Inggris) untuk SETIAP klip.
- Isi array "i2v_prompt" (visual camera motion/movement dalam Bahasa Inggris) untuk SETIAP klip.
- Anda DILARANG mengisi key "t2v_prompt" (kosongkan key tersebut atau jangan diisi).`
    : `## ATURAN VISUAL MODE: PURE T2V
Karena kampanye ini dikonfigurasi dalam mode "pure_t2v", maka seluruh klip (Klip 1 hingga ${targetClips}) wajib menggunakan Text-to-Video. Oleh karena itu, isi array "t2v_prompt" untuk seluruh klip tersebut. Anda TIDAK perlu mengisi array "t2i_prompt" and "i2v_prompt".`;

  const voiceSegmentsField = isAudioSegmentEnabled
    ? `,\n      "voice_segments": [ { "character_id": "[slug_karakter_1]", "text": "[dialog 1]" }, { "character_id": "[slug_karakter_2]", "text": "[dialog 2]" } ] (atau null jika hanya ada 1 karakter/suara tunggal)`
    : '';

  let dynamicPlanFields = '';
  let dynamicImportantRules = '';

  if (visualMode === 'hybrid_lock') {
    dynamicPlanFields = `      "new_vo": "Naskah voiceover versi baru yang di-upgrade. Wajib dalam bahasa ${languageName} / ${targetLanguageLabel}.",
      "visual_action": "Deskripsi aksi visual versi baru dalam Bahasa Indonesia sebagai representasi manusiawi dari scene (misal: Kamera tracking mengikuti tangan menuangkan sirup ke gelas...)",
      "t2i_prompt": "(VERTICAL 9:16) --ar 9:16 --no landscape [LAYER 1: OPTICS] (Shot on [Camera/Lens specs]). [LAYER 2: SUBJECT & VISUAL TRUTH] (Biometric Anchor: [Demographic, features]), (Wardrobe: [Clothing/hijab details matching style guidelines]), (Face Visibility: [Details reflecting face_visibility constraint]), (Product Truth: [Product Geometry] made of [Material Physics])${reRefFilenameTag}. [LAYER 3: SCENE & LIGHT] (Location: [Environment/Background details]), (Lighting: [Light sources/spills]). [LAYER 4: KINETIC IMPLICATION] (Frozen Action: [Moment in time frozen, static start frame detail])",
      "i2v_prompt": "Prompt visual I2V (In English, plain text linear, no newlines) wajib mengikuti format terstruktur bertingkat (structured layer) ${isWithoutSfx ? '3' : '4'} segmen: (VERTICAL 9:16) --ar 9:16 --no landscape [LAYER 1: INPUT & TRUTH LOCK] (Start Frame Reference: ...). [LAYER 2: MICRO-PACING & ACTION] ${isAudioSegmentEnabled ? '([00:00-00:02]): (Visual Action: ...), (Audio Segment: \\"...\\\"), ([00:02-00:04]): (Visual Action: ...), (Audio Segment: \\"...\\\"), ([00:04-00:06]): (Visual Action: ...), (Audio Segment: \\"...\\\"), ([00:06-00:08]): (Visual Action: ...), (Audio Segment: \\"...\\\").' : '([00:00-00:02]): (Visual Action: ...), ([00:02-00:04]): (Visual Action: ...), ([00:04-00:06]): (Visual Action: ...), ([00:06-00:08]): (Visual Action: ...).'}${i2vSfxTemplate}"${voiceSegmentsField}`;
    dynamicImportantRules = `2. ALL visual prompts (t2i_prompt and i2v_prompt) MUST be written ENTIRELY in English. Naskah voiceover and caption/social metadata in ${targetLanguageLabel}.
3. CRITICAL: All visual prompts (t2i_prompt and i2v_prompt) MUST be a single plain text paragraph — copy-paste ready.
4. CRITICAL: Semua nilai string HARUS valid JSON. Jangan gunakan *unescaped double quotes* (\\") atau karakter *newline* aktual di dalam *string value* yang dapat merusak struktur JSON.
5. CRITICAL: DILARANG KERAS menyertakan AUDIO SCRIPT atau naskah/narasi voiceover/spoken words di dalam t2i_prompt atau i2v_prompt. ${isWithoutSfx ? 'Jangan menyertakan efek suara (SFX) apa pun.' : 'Prompt visual hanya boleh berisi visual action dan deskripsi efek suara/SFX fisik saja (seperti: "SFX: swoosh, sizzling sound"). DILARANG KERAS menuliskan kata "music", "background music", "BGM", atau musik latar instrumental apa pun.'}${isWithoutSfx ? '\n6. CRITICAL RULE: Kampanye ini dikonfigurasi dalam mode "Without SFX" (Tanpa SFX). Anda DILARANG KERAS menyertakan bagian atau segmen [LAYER 3: SFX] atau deskripsi efek suara (SFX) di dalam prompt visual (t2i_prompt atau i2v_prompt). Jangan menuliskan kata "SFX:" atau efek suara apa pun.' : ''}`;
  } else {
    dynamicPlanFields = `      "new_vo": "Naskah voiceover versi baru yang di-upgrade. Wajib dalam bahasa ${languageName} / ${targetLanguageLabel}.",
      "visual_action": "Deskripsi aksi visual versi baru dalam Bahasa Indonesia sebagai representasi manusiawi dari scene (misal: Kamera tracking mengikuti tangan menuangkan sirup ke gelas...)",
      "t2v_prompt": "Prompt visual T2V dalam Bahasa Inggris (plain text linear, no newlines)"${voiceSegmentsField}`;
    dynamicImportantRules = `2. ALL visual prompts (t2v_prompt) MUST be written ENTIRELY in English. Naskah voiceover and caption/social metadata in ${targetLanguageLabel}.
3. CRITICAL: All visual prompts (t2v_prompt) MUST be a single plain text paragraph — copy-paste ready.
4. CRITICAL: Semua nilai string HARUS valid JSON. Jangan gunakan *unescaped double quotes* (\\") atau karakter *newline* aktual di dalam *string value* yang dapat merusak struktur JSON.
5. CRITICAL: DILARANG KERAS menyertakan AUDIO SCRIPT atau naskah/narasi voiceover/spoken words di dalam t2v_prompt. ${isWithoutSfx ? 'Jangan menyertakan efek suara (SFX) apa pun.' : 'Prompt visual hanya boleh berisi visual action dan deskripsi efek suara/SFX fisik saja (seperti: "SFX: swoosh, sizzling sound"). DILARANG KERAS menuliskan kata "music", "background music", "BGM", atau musik latar instrumental apa pun.'}${isWithoutSfx ? '\n6. CRITICAL RULE: Kampanye ini dikonfigurasi dalam mode "Without SFX" (Tanpa SFX). Anda DILARANG KERAS menyertakan bagian atau segmen [LAYER 3: SFX] atau deskripsi efek suara (SFX) di dalam prompt visual (t2v_prompt). Jangan menuliskan kata "SFX:" atau efek suara apa pun.' : ''}`;
  }

  const microActingRules = config.tts_model_quality === 'speech-2.8-hd' ? MINIMAX_MICRO_ACTING_MANDATE : '';

  return `Kamu adalah "MAKNA v54.9 INFINITE INDUSTRIAL ENGINE" - REVERSE ENGINEERING + BRIDGING PROMOSI PRODUK.
Tugasmu adalah merancang naskah voiceover dan storyboard visual sebanyak tepat ${targetClips} klip dengan melakukan dekonstruksi kreatif dari video viral kompetitor yang diberikan (video yang diunggah), serta melakukan 'bridging' promosi produk target pada klip ke-${bridgeAtClip}.

## KNOWLEDGE BASE(S) INJECTION
${kbCombined}

${microActingRules}

${config.custom_instruction ? `## CUSTOM INSTRUCTIONS FROM USER\n${config.custom_instruction}\n` : ''}
${vsoSection}

## ATURAN GAYA NARASI (NARRATIVE MODE MANDATE)
Anda wajib menyusun naskah voiceover baru ("new_vo") untuk versi UPGRADE sesuai dengan Narrative Mode: "${config.narrative_mode || 'Storytelling'}" dengan ketentuan berikut:
- **Storytelling (Bercerita / Daily-life)**:
  * Klip Pertama (Klip 1): Hook pembuka wajib menggunakan naskah hook dari video referensi/sistem secara utuh.
  * Klip Pertengahan (Klip 2 s/d N-1): Melukiskan suasana rutinitas harian secara visual dan detail prosesnya (kronologis, misalnya: dari ketenangan persiapan kulkas hari Minggu ke hari Senin pagi yang tenang/damai). DILARANG KERAS menggunakan kata ganti orang pertama ("aku/gue/kami/saya") dan tanpa tokoh fiktif ("Andi/Siti") untuk menghindari kesan berbohong. Fokus pada keindahan proses, estetika visual, dan ketenangan pikiran.
  * Klip Terakhir (Klip N): Penutup/kesimpulan yang hangat dari aktivitas rutin tersebut dan CTA yang relevan.
- **Problem-Solution (Masalah & Solusi)**:
  * Klip Pertama (Klip 1): Hook pembuka berupa keluhan/pertanyaan.
  * Klip Awal Eskalasi (Klip 2): Menekankan rasa lelah, keluhan, atau frustrasi penonton secara dramatis (pain point). Wajib diawali kata-kata emosional seperti: "Capek banget kan...", "Pasti sebel kalau...", "Berapa kali lo ngerasa...".
  * Klip Solusi (Klip 3 s/d N-1): Pivot/perkenalan cara baru atau langkah praktis sebagai penyelesaian masalah secara konkret. Fokus pada efisiensi waktu, kemudahan, dan nilai praktis.
  * Klip Terakhir (Klip N): Kesimpulan manfaat praktis (efisiensi waktu/tenaga) dan CTA rekomendasi tindakan.
- **Educational (Tutorial / Penjelasan Ilmiah)**:
  * Klip Pertama (Klip 1): Hook fakta mengejutkan/mitos salah kaprah.
  * Klip Edukasi Teoretis (Klip 2): Penjelasan ilmiah/biokimia/fakta gizi di balik topik secara teoretis. Wajib menyertakan kosa kata ilmiah seperti: "Secara ilmiah...", "kandungan nutrisi mikro...", "struktur selular...", "zat gizi".
  * Klip Detail Teknis/Penyimpanan (Klip 3 s/d N-1): Tips teknis dan mekanisme biologis/fisik praktis (seperti reaksi kimia, proses oksidasi udara, gas etilen, kelembaban, suhu kulkas, dll.) terkait topik. Gunakan bahasa informatif, logis, objektif, dan kredibel.
  * Klip Terakhir (Klip N): Ringkasan manfaat pengetahuan dan CTA edukasi/ilmu dapur lainnya.

## GAYA VISUAL TARGET (VISUAL STYLE)
Gaya Visual (Visual Style): "${config.visual_style || 'Cinematic'}"
Terapkan gaya visual "${config.visual_style || 'Cinematic'}" secara konsisten di seluruh klip/prompt video. Pastikan pencahayaan, tonal warna, framing kamera, dan estetika adegan di seluruh visual prompt (T2V/T2I/I2V) merefleksikan gaya tersebut.

## SPESIFIKASI DAN ATURAN STRUKTUR (MANDATORY)
- Total Klip Output: Tepat ${targetClips} klip (tidak boleh kurang, tidak boleh lebih).
- Titik Transisi Promosi (Pivot Point): Klip ke-${bridgeAtClip}.
- Gaya Promosi (Promotion Style): "${config.promotion_style || 'Softselling'}" (Wajib dipatuhi pada Zona 3).
- Aturan Penjagaan Gaya Bahasa (Brand Profile):
  * Nama Brand/Profil: "${brandName}"
  * Tone of Voice: "${toneOfVoice}"
  * Kata Terlarang: [${forbiddenElements}]
- Data Produk Target yang akan diiklankan (DNA PRODUK):
  * Nama Produk: "${productData.product_name || ''}"
  * Deskripsi: "${productData.product_description || ''}"
  * Unique Selling Point (USP): "${typeof productData.unique_selling_point === 'string' ? productData.unique_selling_point : JSON.stringify(productData.unique_selling_point || '')}"
  * Bentuk Kemasan Fisik: "${productData.packaging_type || 'none'}" (Apakah di dalam kemasan: ${productData.is_in_packaging === 1 || productData.is_in_packaging === true ? 'Yes' : 'No'})
  * Referensi Visual T2I (Start Frame): "${productData.t2i_prompt || ''}"
  * Referensi Gerakan I2V: "${productData.i2v_action_prompt || ''}"${getPackagingInstruction(productData)}

${buildProductTruthContractSection(productData, bridgeAtClip, productEndClip)}
🚨 PRODUCT GEOMETRY MANDATE:
For target product clips (Clip ${bridgeAtClip} to ${productEndClip}), you MUST base the [Product geometry/label details] and [Material Physics] in your "t2i_prompt" strictly on the "Bentuk Kemasan Fisik" and "Referensi Visual T2I" provided above. Do not hallucinate different packaging types (e.g., if the packaging type is "Jar Plastik" or "plastic jar", describe it as a jar/cylinder, NOT a pouch or bag).

🚨 ISOLASI PEMBAHASAN PRODUK (PRODUCT PLACEMENT ISOLATION MANDATE):
- HANYA PADA KLIP KE-${bridgeAtClip}:
  * Naskah Voiceover (narration) WAJIB membahas produk "${productData.product_name || ''}" dan manfaatnya secara organik.
  * Prompt visual ("t2i_prompt" dan "i2v_prompt") WAJIB secara eksplisit menggambarkan visual produk "${productData.product_name || ''}" dengan bentuk kemasan "${productData.packaging_type || 'none'}" sesuai data spesifikasi di atas.
- PADA KLIP DI LUAR RENTANG TERSEBUT (Klip sebelum ke-${bridgeAtClip} atau sesudah ke-${productEndClip}):
  * Naskah Voiceover (narration) DILARANG KERAS menyebutkan nama produk, brand, atau melakukan penjualan.
  * Prompt visual ("t2i_prompt" dan "i2v_prompt") DILARANG KERAS menggambarkan produk target, kemasannya, atau menyertakan kata kunci produk tersebut (mereka harus fokus 100% pada cerita pilar organik atau aktivitas pilar non-produk).

${visualModeInstructions}

---
## DETAIL ATURAN PER ZONA SEGMENTASI

${(bridgeDurationClips === 1 || productEndClip <= bridgeAtClip)
      ? `[ZONA 1: RETENSI VIRAL] (Klip 1 hingga Klip ${bridgeAtClip - 1})
- Fokus 100% pada adaptasi hook dan alur cerita dari video viral kompetitor yang diunggah.
- JANGAN sebutkan nama produk, brand, atau melakukan jualan di zona ini demi menjaga retensi penonton di detik-detik awal.
- Gunakan emosi, intonasi, atau pembuka kontroversial dari kompetitor asli.

[ZONA 2: THE BRIDGE / PIVOT POINT] (Klip ke-${bridgeAtClip})
- Tulis narasi peralihan psikologis (cognitive bridge) yang sangat halus namun tak terhindarkan.
- Hubungkan topik viral di Zona 1 dengan masalah nyata yang diselesaikan oleh produk target.
- Perkenalkan produk target ("${productData.product_name || ''}") secara kasual.
- Gunakan transisi visual yang kontras atau gerakan kamera dinamis (seperti zooming/pan cepat) untuk mengalihkan pandangan penonton ke arah objek produk.

[ZONA 4: POST-BRIDGE / DECONSTRUCTION LOOP] (Klip ${bridgeAtClip + 1} hingga Klip ${targetClips})
- Kembali fokus sepenuhnya pada adaptasi konten, cerita, resep, atau tema dari video asli kompetitor (misal: menyajikan resep, cicipi masakan, atau kesimpulan penutup dari video asli).
- DILARANG KERAS menyebutkan nama produk target, brand target, atau melakukan jualan di zona ini. Buat penutup yang natural menyerupai video kompetitor asli.
- Akhiri klip terakhir dengan Call to Action (CTA) yang tajam sesuai karakter Brand Profile Anda (Slogan: "${brandSloganOrCta}").`
      : (bridgeDurationClips > 1 && productEndClip < targetClips)
        ? `[ZONA 1: RETENSI VIRAL] (Klip 1 hingga Klip ${bridgeAtClip - 1})
- Fokus 100% pada adaptasi hook dan alur cerita dari video viral kompetitor yang diunggah.
- JANGAN sebutkan nama produk, brand, atau melakukan jualan di zona ini demi menjaga retensi penonton di detik-detik awal.
- Gunakan emosi, intonasi, atau pembuka kontroversial dari kompetitor asli.

[ZONA 2: THE BRIDGE / PIVOT POINT] (Klip ke-${bridgeAtClip})
- Tulis narasi peralihan psikologis (cognitive bridge) yang sangat halus namun tak terhindarkan.
- Hubungkan topik viral di Zona 1 dengan masalah nyata yang diselesaikan oleh produk target.
- Perkenalkan produk target ("${productData.product_name || ''}") secara kasual.
- Gunakan transisi visual yang kontras atau gerakan kamera dinamis (seperti zooming/pan cepat) untuk mengalihkan pandangan penonton ke arah objek produk.

[ZONA 3: BRAND CONVERSION] (Klip ${bridgeAtClip + 1} hingga Klip ${productEndClip})
- Narasi beralih sepenuhnya ke promosi komersial produk target dengan gaya promosi: "${config.promotion_style || 'Softselling'}".
- Terapkan aturan gaya promosi berikut secara ketat:
  * **Hardsell:** Gaya bahasa langsung, persuasif, agresif, fokus langsung pada penawaran produk, diskon, kelangkaan (urgensi), dan CTA yang kuat. Jual produk secara langsung dan frontal.
  * **Softselling:** Gaya bahasa bercerita (storytelling), halus, berfokus pada solusi dari pain point tanpa kesan memaksa jualan di awal, menekankan kenyamanan/manfaat produk jangka panjang secara ramah.
  * **Education:** Gaya bahasa edukatif, informatif, berfokus pada data/fakta, menjelaskan cara kerja produk, kandungan/multigrain alami, dan manfaat kesehatan secara logis/ilmiah agar audiens paham mengapa mereka butuh produk ini.
- Menonjolkan USP produk dengan tetap mematuhi aturan "Tone of Voice" dari Brand Profile serta menghindari kata-kata terlarangnya.

[ZONA 4: POST-BRIDGE / DECONSTRUCTION LOOP] (Klip ${productEndClip + 1} hingga Klip ${targetClips})
- Kembali fokus sepenuhnya pada adaptasi konten, cerita, resep, atau tema dari video asli kompetitor (misal: menyajikan resep, cicipi masakan, atau kesimpulan penutup dari video asli).
- DILARANG KERAS menyebutkan nama produk target, brand target, atau melakukan jualan di zona ini. Buat penutup yang natural menyerupai video kompetitor asli.
- Akhiri klip terakhir dengan Call to Action (CTA) yang tajam sesuai karakter Brand Profile Anda (Slogan: "${brandSloganOrCta}").`
        : `[ZONA 1: RETENSI VIRAL] (Klip 1 hingga Klip ${bridgeAtClip - 1})
- Fokus 100% pada adaptasi hook dan alur cerita dari video viral kompetitor yang diunggah.
- JANGAN sebutkan nama produk, brand, atau melakukan jualan di zona ini demi menjaga retensi penonton di detik-detik awal.
- Gunakan emosi, intonasi, atau pembuka kontroversial dari kompetitor asli.

[ZONA 2: THE BRIDGE / PIVOT POINT] (Klip ke-${bridgeAtClip})
- Tulis narasi peralihan psikologis (cognitive bridge) yang sangat halus namun tak terhindarkan.
- Hubungkan topik viral di Zona 1 dengan masalah nyata yang diselesaikan oleh produk target.
- Perkenalkan produk target ("${productData.product_name || ''}") secara kasual.
- Gunakan transisi visual yang kontras atau gerakan kamera dinamis (seperti zooming/pan cepat) untuk mengalihkan pandangan penonton ke arah objek produk.

[ZONA 3: BRAND CONVERSION] (Klip ${bridgeAtClip + 1} hingga Klip ${targetClips})
- Narasi beralih sepenuhnya ke promosi komersial produk target dengan gaya promosi: "${config.promotion_style || 'Softselling'}".
- Terapkan aturan gaya promosi berikut secara ketat:
  * **Hardsell:** Gaya bahasa langsung, persuasif, agresif, fokus langsung pada penawaran produk, diskon, kelangkaan (urgensi), dan CTA yang kuat. Jual produk secara langsung dan frontal.
  * **Softselling:** Gaya bahasa bercerita (storytelling), halus, berfokus pada solusi dari pain point tanpa kesan memaksa jualan di awal, menekankan kenyamanan/manfaat produk jangka panjang secara ramah.
  * **Education:** Gaya bahasa edukatif, informatif, berfokus pada data/fakta, menjelaskan cara kerja produk, kandungan/multigrain alami, dan manfaat kesehatan secara logis/ilmiah agar audiens paham mengapa mereka butuh produk ini.
- Menonjolkan USP produk dengan tetap mematuhi aturan "Tone of Voice" dari Brand Profile serta menghindari kata-kata terlarangnya.
- Akhiri klip terakhir dengan Call to Action (CTA) yang tajam sesuai karakter Brand Profile Anda (Slogan: "${brandSloganOrCta}").`
    }

---
## REGULASI AUDIO DAN VISUAL (MANDATE LOCK)
${UNIVERSAL_ZERO_TESTIMONY_MANDATE}
- LANGUAGE MANDATE (SANGAT KETAT):
  * Jika target bahasa adalah ENGLISH (US): Naskah voiceover ("narration") wajib ditulis sepenuhnya dalam Bahasa Inggris yang natural (slang TikTok US jika cocok).
  * Jika target bahasa adalah INDONESIAN: Naskah voiceover ("narration") wajib ditulis sepenuhnya dalam Bahasa Indonesia.
  * PERINGATAN: Prompt visual ("t2v_prompts", "i2v_prompts", "t2i_prompts") wajib TETAP selalu ditulis dalam Bahasa Inggris.
- Visual wajib berupa cinematic photorealistic (Sesuai Mandate 50 & 51). Hindari animasi, kartun, atau 3D render murahan.
- REGULASI PACING SUARA (KATA PER KLIP): Setiap klip/scene naskah voiceover/narasi yang kamu hasilkan WAJIB mematuhi batasan jumlah kata ini: TEPAT ${config.words_per_clip || '17-19 kata'} per klip. Aturan ini sangat kritikal agar tempo pembacaan audio pas dengan klip video.
- REGULASI VISUAL (FACE VISIBILITY): Untuk kehadiran wajah subjek manusia pada klip video, kamu WAJIB mematuhi opsi: "${faceVisibility}".
  * Jika "Faceless": DILARANG keras menampilkan wajah manusia sama sekali. Untuk setiap scene yang menampilkan manusia, frame WAJIB dipotong dari siku ke bawah. Fokus utama pada area lengan hingga pergelangan tangan dan jari (forearm & hand close-up) saat memegang atau menggunakan produk. Hindari full-body shot. Ini adalah aturan syariat yang tidak boleh dilanggar.
  * Jika "POV": Gunakan visual bersudut pandang orang pertama (First-Person POV). Kamera bertindak sebagai mata subjek yang sedang berinteraksi.
  * Jika "Silhouette": Tampilkan subjek manusia hanya berupa siluet/bayangan gelap dengan pencahayaan latar (backlighting/rim light) yang dramatis, tanpa memperlihatkan fitur wajah sama sekali.
  Terapkan aturan visibilitas wajah ini secara konsisten di deskripsi visual storyboard maupun prompt T2V/T2I (tulis dalam Bahasa Inggris).
- Tulis visual prompt dalam bentuk deskripsi linear satu baris (Plain Text format) tanpa menyertakan enter/newline (\n) dan BEBAS dari tag 'NEGATIVE PROMPT'.
- Format output wajib berupa JSON terstruktur yang valid agar dapat ## OUTPUT FORMAT
Return ONLY valid JSON (no markdown code blocks, no explanation). Use this exact structure:
{
  "analysis_summary": {
    "original_hook_analysis": "Analisis singkat hook asli",
    "weakness_identified": "Apa yang kurang dari video asli",
    "the_upgrade_strategy": "Strategi peningkatan di versi baru ini"
  },
  "original_deconstruction": [
    {
      "scene_number": 1,
      "verbatim_audio_ori": "Naskah voiceover kompetitor asli pada adegan ini",
      "translated_audio_id": "Terjemahan naskah voiceover dalam Bahasa Indonesia",
      "visual_action": "Aksi visual kompetitor asli pada adegan ini"
    }
  ],
  "new_video_plan": [
    {
      "clip_index": 1,
      ${dynamicPlanFields}
    },
    {
      "clip_index": ${targetClips},
      ${dynamicPlanFields},
      "cta_facebook": "Alternatif Call to Action penutup khusus Facebook/Instagram (misal: 'klik link di bawah ya!'). Wajib dalam bahasa ${languageName} / ${targetLanguageLabel}.",
      "cta_tiktok": "Alternatif Call to Action penutup khusus TikTok (misal: 'produk ori di keranjang ya!'). Wajib dalam bahasa ${languageName} / ${targetLanguageLabel}."
    }
  ],
  "video_dna": {
    "pilar_konten": "Minuman Sehat / Makanan Cepat / Diet (Tentukan kategori resep/konten)",
    "hook_type": "Pertanyaan / Mitos / Hasil Akhir (Faktor #1 penentu 3-second view)",
    "visual_style": "Faceless / Macro / Food Porn (Pilih satu visual style dominan)",
    "signature_moment": "Madu menetes / Smoothie pusaran / Taburan topping / dll (Adegan paling estetik/ASMR)",
    "camera_pace": "Static / Dynamic Tracking / Fast Cuts",
    "primary_emotion": "Menggugah Selera / Segar / Santai / Kagum / Penasaran",
    "affiliate_integration": "Natural Usage / Background / Problem Solver",
    "affiliate_mention": "Voice Over / Visual Only",
    "scene_count": ${targetClips},
    "cta_type": "Save Recipe / Share to Friend / Buy Now"
  },
  "tiktok_caption": "Engaging TikTok caption with relevant hashtags (max 150 chars + hashtags). In ${targetLanguageLabel}.",
  "ig_caption": "Instagram caption with storytelling hook, value delivery, and CTA. Include hashtags. In ${targetLanguageLabel}.",
  "yt_title": "YouTube title - high CTR, curiosity-driven, clickable but honest. In ${targetLanguageLabel}.",
  "yt_desc": "YouTube description with SEO keywords, content summary, and links placeholder. In ${targetLanguageLabel}."
}

IMPORTANT RULES:
1. Scene/clip count MUST be exactly ${targetClips}.
${dynamicImportantRules}${audioSegmentMandate}
${isAudioSegmentEnabled ? '7' : '6'}. CRITICAL SAFETY RULE: DILARANG KERAS menyertakan deskripsi efek suara vokal manusia non-verbal seperti helaan napas (sigh/gasp), erangan (moan/groan), atau desahan di dalam bagian [LAYER 3: SFX] atau seksi manapun karena akan memicu filter keamanan Veo (PUBLIC_ERROR_AUDIO_FILTERED). Gunakan hanya deskripsi efek suara ambient fisik (seperti: "SFX: gentle pouring sound, subtle kitchen ambiance, sizzling sound"). DILARANG KERAS menuliskan kata "music", "background music", atau "BGM".
${isAudioSegmentEnabled ? '8' : '7'}. CRITICAL CTA VARIATIONS MANDATE: For the final clip (clip ${targetClips}) inside the 'new_video_plan' array, you MUST generate two additional fields inside the JSON object: 'cta_facebook' (a natural call to action targeted at Facebook/Instagram users, e.g. 'klik link di bawah ya!') and 'cta_tiktok' (a natural call to action targeted at TikTok users, e.g. 'produk ori di keranjang ya!'). Both CTAs must be in ${targetLanguageLabel} and match the style and flow of the narration.`;
}
// Force recompile after syntax restoration

export function buildProductDiscoveryPrompt(videoTranscript, recommendCount = 3) {
  return `Anda adalah Product Sourcing Agent & Trend Discovery Analyst senior untuk MAKNA Engine V8.2.  
Tugas Anda adalah membaca transkrip video kompetitor, lalu secara aktif menggunakan alat Google Search Grounding untuk menjelajahi internet (prioritaskan Shopee, Tokopedia, dan TikTok Shop di Indonesia) guna mencari tepat ${recommendCount} produk fisik rill yang sedang dijual dan sangat populer saat ini yang cocok sebagai solusi masalah di video tersebut.

---  
TRANSKRIP VIDEO VIRAL:  
"${videoTranscript}"

---  
ATURAN PENCARIAN & OUTPUT (SANGAT KETAT):  
1. Anda wajib mencari produk RILL yang benar-benar ada di e-commerce Indonesia saat ini. Dilarang mengarang nama produk atau brand!  
2. Untuk setiap produk rill yang ditemukan, Anda wajib menyertakan:  
   - "product_name": Nama lengkap produk komersial beserta brand-nya.  
   - "source_url": URL tautan halaman produk tersebut di Shopee/Tokopedia.  
   - "scraped_image_url": URL tautan gambar/foto produk yang valid dan bersih dari e-commerce tersebut (umumnya berakhiran .jpg, .png, atau dari CDN e-commerce).  
   - "short_description": Kegunaan utama produk.  
   - "unique_selling_point": USP kunci yang membuat produk ini laris manis di pasar.  
3. Output harus berupa JSON valid sesuai skema yang telah ditentukan, tanpa dibungkus markdown.

---  
STRUKTUR SCHEMA JSON WAJIB:  
{  
  "video_analysis": {  
    "detected_hook_strategy": "Analisis strategi penarik perhatian awal",  
    "primary_pain_point": "Masalah nyata yang diangkat oleh video kompetitor"  
  },  
  "recommendations": [  
    {  
      "product_name": "Skintific Symwhite 377 Dark Spot Eraser Serum",  
      "source_url": "https://shopee.co.id/Skintific-Symwhite-377",  
      "scraped_image_url": "https://cf.shopee.co.id/file/sg-11134201...",  
      "short_description": "Serum pencerah noda hitam wajah",  
      "unique_selling_point": "Mengandung Symwhite 377 untuk memudarkan noda hitam dalam 14 hari tanpa mengiritasi barier kulit"  
    }  
  ]  
}`;
}

/**  
 * Membangun prompt generasi multi-angle kognitif untuk Gemini  
 * @param {string} originalDeconstruction - Teks hasil dekonstruksi video asli  
 * @param {number} angleCount - Jumlah variasi sudut pandang (M)  
 * @param {Object} productData - Detail produk promosi (Nama, USP, dll)  
 * @param {string} trendContext - Konteks tren budaya lokal terhangat (Google Grounding)  
 */
export function buildMultiAngleMultiplierPrompt(originalDeconstruction, angleCount = 3, productData, trendContext = "", visualMode = 'pure_t2v', bridgeAtClip = 3, bridgeDurationClips = 0, enableTts = true, targetLanguage = 'id-ID') {
  const productName = productData?.product_name || "";
  const productUsp = productData?.unique_selling_point || "";

  const languageName = targetLanguage === 'en-US' ? 'ENGLISH (US)' : 'INDONESIAN';
  const targetLanguageLabel = targetLanguage === 'en-US' ? 'English' : 'Bahasa Indonesia';

  let productDirective = "";
  if (productName) {
    productDirective = `
---  
DATA PRODUK TARGET KAMI:  
- Nama Produk: "${productName}"  
- Keunggulan Utama (USP): "${productUsp}"
Tugas Anda adalah menjembatani (bridge) dekonstruksi video kompetitor di atas menjadi iklan yang mempromosikan Produk Target Kami ini.
`;
  } else {
    productDirective = `
---  
DATA PRODUK TARGET KAMI:
- SAMA PERSIS dengan resep, produk, bahan-bahan, kegunaan, atau penawaran yang dibahas di dalam dekonstruksi video kompetitor.
PENTING: Kami tidak mempromosikan produk luar yang berbeda. Tugas Anda adalah membuat variasi iklan yang mempromosikan resep, menu makanan, bahan-bahan, atau produk yang sama persis seperti pada video asli kompetitor (misalnya jika video asli membahas resep brownies ubi manis + selai kacang, maka seluruh ${angleCount} angle yang Anda hasilkan wajib membahas resep brownies ubi manis + selai kacang tersebut). Jangan mengubah bahan-bahan, kegunaan, atau nama resep aslinya! Hanya ubah sudut pandang kognitif penyampaian naskahnya sesuai taktik di bawah.
`;
  }

  const visualModeInstructions = visualMode === 'hybrid_lock'
    ? `
---
🚨 ATURAN KHUSUS VISUAL MODE: HYBRID LOCK (DOUBLE-PASS)
Karena kampanye ini dikonfigurasi dalam mode "hybrid_lock", maka:
- Untuk klip dalam rentang pembahasan produk target (Klip ke-${bridgeAtClip} hingga ${bridgeDurationClips > 0 ? `Klip ke-${bridgeAtClip + bridgeDurationClips - 1}` : 'Klip terakhir'}):
  * Di dalam objek klip, Anda WAJIB menyertakan field "t2i_prompt" (deskripsi gambar diam/start frame berisi produk dalam Bahasa Inggris) dan "i2v_prompt" (deskripsi gerakan kamera/aksi dari gambar tersebut dalam Bahasa Inggris).
- Untuk klip di luar rentang tersebut (seperti Klip 1 s.d. ${bridgeAtClip - 1}${bridgeDurationClips > 0 ? ` dan Klip ke-${bridgeAtClip + bridgeDurationClips} s.d. terakhir` : ''}):
  * Isi field "t2v_prompt" dengan prompt Text-to-Video seperti biasa dalam Bahasa Inggris. Kosongkan "t2i_prompt" and "i2v_prompt" (isi dengan "").
`
    : `
---
🚨 ATURAN KHUSUS VISUAL MODE: PURE T2V
Karena kampanye ini dikonfigurasi dalam mode "pure_t2v", maka untuk semua klip (1 hingga klip terakhir), isi field "t2v_prompt" dengan prompt Text-to-Video seperti biasa dalam Bahasa Inggris. Anda tidak perlu menyertakan "t2i_prompt" and "i2v_prompt" (isi dengan "").
`;

  const bridgingVoiceoverRules = `
---
🚨 ATURAN PEMBAGIAN ZONA NASKAH VOICEOVER (BRIDGING RULES):
Anda wajib membagi narasi suara ("voiceover") per klip berdasarkan konfigurasi bridging berikut:
1. Klip sebelum Klip ke-${bridgeAtClip} (Klip 1 s.d. ${bridgeAtClip - 1}): Fokus 100% pada adaptasi hook dan alur cerita konten dekonstruksi asli kompetitor. DILARANG KERAS menyebutkan nama produk target ("${productName}") atau brand target, atau melakukan jualan di sini.
2. Klip Pembahasan Produk (Klip ke-${bridgeAtClip} hingga ${bridgeDurationClips > 0 ? `Klip ke-${bridgeAtClip + bridgeDurationClips - 1}` : 'Klip terakhir'}):
   - Klip ke-${bridgeAtClip} bertindak sebagai Pivot Point: Buat jembatan kognitif (cognitive bridge) yang sangat halus dari konten asli ke pengenalan produk target ("${productName}").
   - Klip berikutnya di zona ini: Bahas keunggulan utama (USP) produk ("${productUsp}") untuk memicu konversi.
3. Klip setelah Pembahasan Produk (Klip ke-${bridgeAtClip + (bridgeDurationClips > 0 ? bridgeDurationClips : 999)} s.d. klip terakhir):
   - Jika rentang pembahasan produk selesai sebelum klip terakhir (karena durasi bridging diatur terbatas), maka untuk klip-klip sisa berikutnya, Anda WAJIB mengembalikan fokus narasi 100% pada kelanjutan konten/resep dekonstruksi asli (misalnya menyajikan resep, cicipi masakan, atau penutupan asli).
   - DILARANG KERAS menyebutkan nama produk target ("${productName}") atau melakukan promosi produk di klip sisa ini. Buat penutup yang natural menyerupai video kompetitor asli.
`;

  const mandate86Directive = enableTts
    ? `
---  
ATURAN MANDATE 86 VOICE PERSONA ROUTER:  
Anda wajib memetakan Angle yang Anda ciptakan dengan Voice Persona yang paling selaras:  
- Jika Angle bertipe Hype/Sales/Hard Sell -> Gunakan 'Despina' (Female) atau 'Algenib' (Male).  
- Jika Angle bertipe Relatable/UGC/Vlog/Friend -> Gunakan 'Aoede' (Female) atau 'Orus' (Male).  
- Jika Angle bertipe Drama/Emotional/Thriller -> Gunakan 'Erinome' (Female) atau 'Charon' (Male).  
- Jika Angle bertipe Expert/Scientific/Formal -> Gunakan 'Callirrhoe' (Female) atau 'Iapetus' (Male).
`
    : '';

  const languageMandate = `
---  
LANGUAGE MANDATE (SANGAT KETAT):  
Anda WAJIB menulis isi dari kolom "voiceover" (naskah suara) SEPENUHNYA dalam bahasa: **${languageName}**.  
- Jika bahasa adalah ENGLISH: Gunakan gaya bahasa natural, slang TikTok US, dan pastikan grammar sempurna.  
- Jika bahasa adalah INDONESIAN: Gunakan bahasa kasual/gaul atau formal sesuai Tone of Voice.
`;

  return `
Anda adalah Creative Director & Lead Copywriter di MAKNA Engine V8.3.  
Tugas Anda adalah membaca hasil bedah video kompetitor, lalu merancang ${angleCount} variasi sudut pandang kreatif (angles) iklan yang sangat kontras untuk mempromosikan produk kami.

---  
DATA DEKONSTRUKSI VIDEO ASLI:  
${originalDeconstruction}

${productDirective}

---  
KONTEKS TREN & BUDAYA LOKAL INDONESIA SAAT INI (KAHNEMAN REALISM FILTER):  
"${trendContext || 'Gunakan relevansi humor/relatabilitas urban lokal seperti tren "Pinjam Seratus" atau "Healing" jika cocok.'}"

---  
DOKUMEN SPESIFIKASI MANDATORI (30 INFINITE STRATEGIC ANGLE MATRIX):  
Anda WAJIB memilih taktik yang SANGAT BERBEDA untuk masing-masing ${angleCount} variasi angle dari matriks di bawah ini:

[SET A: STATUS & IDENTITY (The "Ego" Angles - Target: Aspirational Value / VFO)]  
1. "The Secret Club": Frame produk sebagai sesuatu yang dirahasiakan oleh 'mereka' (Insider Knowledge).  
2. "The Rebel Choice": Menggunakan produk ini sebagai bentuk penolakan terhadap aturan mainstream.  
3. "The Intellectual Flex": Hanya orang-orang kompeten/cerdas yang paham pentingnya produk ini.  
4. "The Taste Maker": Menjadi pionir sebelum produk ini viral di kalangan masyarakat umum.

[SET B: LOGIC & UTILITY (The "Brain" Angles - Target: Concrete/Uncharted Value / VFO)]  
5. "The Life Hack": Pintasan cerdas untuk mencurangi sistem secara legal (Efisiensi maksimal).  
6. "The Math Whiz": Perhitungan matematis rill: "Biaya Rp 50 ribu hari ini, menghemat Rp 1 Juta besok." (ROI).  
7. "The Scientific Proof": Pembuktian klinis, fokus 100% pada struktur bahan aktif dan cara kerja seluler.  
8. "The Stress Test": Menyiksa produk secara ekstrem untuk membuktikan daya tahan rill.

[SET C: EMOTION & SENSATION (The "Heart/Gut" Angles - Target: Instinctive Value / VFO)]  
9. "The Revenge": Tampil menawan dan sukses untuk membuat 'musuh/mantan' menyesal (Spite factor).  
10. "The Pure Relief": Visualisasi dan narasi katarsis saat rasa sakit/masalah fisik tiba-tiba berhenti.  
11. "The Safe Haven": Dunia luar sangat kacau dan berisik, produk ini adalah gelembung ketenangan Anda.  
12. "The Absurdity": Kekacauan visual murni/humor aneh khas internet untuk mengejutkan lalu mengonversi audiens.

${mandate86Directive}

${languageMandate}

${bridgingVoiceoverRules}

${visualModeInstructions}

---  
STRUKTUR SCHEMA JSON KELUARAN (DILARANG MENGGUNAKAN MARKDOWN WRAPPERS):  
[
  {
    "angle_name": "Nama Sudut Pandang Iklan",
    "angle_category": "Ego | Brain | Gut",
    "matrix_strategy_used": "Nama strategi dari daftar 30 Matrix",
    "system_targeting": "System 1 | System 2",
    "voice_persona_assigned": "${enableTts ? 'ID Voice Persona terpilih (Sesuai Mandate 86 Router)' : 'none'}",
    "angle_description": "Penjelasan taktik kognitif mengapa angle ini sangat kuat memicu konversi",
    "clips": [
      {
        "clip_index": 1,
        "voiceover": "Teks naskah suara yang wajib ditulis sepenuhnya dalam bahasa ${languageName} (Wajib patuhi Mandate 71, maks 25 kata per klip, ikuti ATURAN PEMBAGIAN ZONA NASKAH VOICEOVER)",
        "t2v_prompt": "Prompt visual T2V dalam bahasa Inggris yang mendetail (wajib diisi untuk klip sebelum ${bridgeAtClip}${bridgeDurationClips > 0 ? ` dan klip setelah ${bridgeAtClip + bridgeDurationClips - 1}` : ''}, atau jika dalam pure_t2v mode; kosongkan jika dalam hybrid_lock dan klip berada dalam rentang pembahasan produk)",
        "t2i_prompt": "Prompt visual T2I untuk start frame dalam bahasa Inggris (hanya diisi untuk klip dalam rentang pembahasan produk [klip ${bridgeAtClip} s.d. ${bridgeDurationClips > 0 ? bridgeAtClip + bridgeDurationClips - 1 : 'terakhir'}] jika visual_mode adalah hybrid_lock; selain itu kosongkan/\"\")",
        "i2v_prompt": "Prompt visual I2V untuk menggerakkan start frame dalam bahasa Inggris (hanya diisi untuk klip dalam rentang pembahasan produk [klip ${bridgeAtClip} s.d. ${bridgeDurationClips > 0 ? bridgeAtClip + bridgeDurationClips - 1 : 'terakhir'}] jika visual_mode adalah hybrid_lock; selain itu kosongkan/\"\")"
      }
    ]
  }
]
  `;
}

// ============================================================================
// V8.5: Organic Pillar Campaign (OPC) Prompt Builder
// ============================================================================
export function buildOrganicPillarPrompt(kbTexts, campaignData, productData, brandProfile, vsoData) {
  const targetLanguage = campaignData.target_language || 'id-ID';
  const languageName = targetLanguage === 'en-US' ? 'ENGLISH (US)' : 'INDONESIAN';
  const targetLanguageLabel = targetLanguage === 'en-US' ? 'English' : 'Bahasa Indonesia';
  const allowedKBs = [
    'REALIST_VIRAL_NARRATIVE',
    'STRATEGIC_FRAMEWORKS',
    'PROMPT_SYSTEM',
    'NARRATIVE_STRUCTURE',
    'VISUAL_STYLE_GUIDE',
    'BRAND_VOICE_GUIDE',
    'PLATFORM_COPYWRITING',
    'COMPLIANCE_GUIDE'
  ];
  detectFoodAndInjectKB(
    allowedKBs,
    productData?.product_name,
    productData?.product_description,
    campaignData?.campaign_name,
    campaignData?.campaign_objective,
    brandProfile?.brand_name,
    brandProfile?.brand_description
  );

  const kbCombined = kbTexts
    .filter(kb => allowedKBs.some(allowed => kb.name.includes(allowed)))
    .map((kb, i) => `=== KNOWLEDGE BASE ${i + 1}: ${kb.name} ===\n${kb.content}\n=== END KB ${i + 1} ===`)
    .join('\n\n');

  const targetClips = campaignData.target_clips_count || 4;
  const bridgeAtClip = campaignData.bridge_at_clip || 2;
  const visualMode = campaignData.visual_mode || 'hybrid_lock';
  const isWithoutSfx = campaignData.sfx_setting === 'without_sfx';
  const isAudioSegmentEnabled = campaignData.enable_audio_segment === true || campaignData.enable_audio_segment === 1;
  const isMascotMode = (campaignData.subject_demographic || '').startsWith('mascot_universe_');
  const voiceCastData = campaignData.voice_cast_json ? (typeof campaignData.voice_cast_json === 'string' ? (() => { try { return JSON.parse(campaignData.voice_cast_json); } catch(e) { return null; } })() : campaignData.voice_cast_json) : null;
  const voiceCastList = voiceCastData?.characters?.length > 0
    ? `\n\nCHARACTER VOICE CAST (dikunci per kampanye ini, WAJIB konsisten):\n` + voiceCastData.characters.map(ch => `- character_id: "${ch.id}" | Nama: ${ch.name} | Suara: ${ch.gemini_voice_id || ch.minimax_voice_id}`).join('\n')
    : '';
  const i2vSfxTemplate = isWithoutSfx ? '' : (isAudioSegmentEnabled ? ' [LAYER 3: FULL SCRIPT REFERENCE] AUDIO SCRIPT: "[Full VO Text]" VOICE: [Character Voice — ANTI-ROBOT] SFX/MUSIC: [SFX + Music]' : ' [LAYER 3: SFX] SFX: [Insert SFX]');
  const t2vSfxTemplate = isWithoutSfx ? '' : (isAudioSegmentEnabled ? ' [LAYER 3: FULL SCRIPT REFERENCE] AUDIO SCRIPT: "[Full VO Text]" VOICE: [Character Voice — ANTI-ROBOT] SFX/MUSIC: [SFX + Music]' : ' [LAYER 3: SFX] SFX: [Insert SFX]');
  const audioSegmentMandate = isAudioSegmentEnabled ? `
[AUDIO SEGMENT MODE: ENABLED — MANDATE 92]
Kamu WAJIB menyertakan (Audio Segment: "[Kata]") inline di SETIAP segmen LAYER 2 (i2v_prompts & t2v_prompts):
([00:00-00:02]): (Visual Action: [Aksi]), (Audio Segment: "[Beat 1]"),
([00:02-00:04]): (Visual Action: [Aksi]), (Audio Segment: "[Beat 2]"),
([00:04-00:06]): (Visual Action: [Aksi]), (Audio Segment: "[Beat 3]"),
([00:06-00:08]): (Visual Action: [Aksi] + [TRANSITION LOCK]), (Audio Segment: "[Beat 4]").
Setelah LAYER 2 tambahkan: [LAYER 3: FULL SCRIPT REFERENCE] AUDIO SCRIPT: "[VO]" VOICE: [Deskripsi] SFX/MUSIC: [SFX]
Rule DILARANG KERAS menyertakan audio script di bawah ini TIDAK BERLAKU — diganti mandate ini.${isMascotMode ? `
MASCOT VOICE MANDATE [MANDATE 93]: Suara WAJIB ekspresif/playful. LIP SYNC: ON.` : ''}${voiceCastList ? `

MULTI-CHARACTER DIALOG MANDATE [MANDATE 94 v3.0 — AKTIF]:${voiceCastList}
ATURAN DIALOG (SANGAT KETAT):
- Setiap klip video (8 detik) WAJIB ada tepat 2 karakter berbeda dari CHARACTER VOICE CAST di atas yang saling berdialog/menjawab. Monolog atau klip berisi hanya 1 karakter/narator tunggal dilarang keras!
- Tentukan otonom kapan masing-masing berbicara: Karakter A berbicara selama 4 detik pertama ([00:00-00:04]), dibalas oleh Karakter B selama 4 detik berikutnya ([00:04-00:08]).
- Kombinasi karakter yang berbicara di klip yang berbeda WAJIB bervariasi (misal: klip 1: karakter A & B, klip 2: karakter C & D, klip 3: karakter A & C, dst) agar video dinamis.
- Di setiap klip, Anda WAJIB menyertakan field "voice_segments" dalam format array berisi tepat 2 dialog karakter:
  "voice_segments": [
    { "character_id": "[slug karakter X]", "text": "[Dialog X]" },
    { "character_id": "[slug karakter Y]", "text": "[Dialog Y]" }
  ]
- "narration" field TETAP diisi teks gabungan: "[KARAKTER_X]: text. [KARAKTER_Y]: text."
- character_id HARUS KONSISTEN di semua klip menggunakan slug dari cast di atas.
` : `

MULTI-CHARACTER DIALOG MANDATE [MANDATE 94 v3.0 — OTONOM]:
Kamu WAJIB secara OTONOM merancang dialog percakapan antar beberapa karakter maskot berbeda di sepanjang video.
ATURAN DIALOG (SANGAT KETAT):
- Setiap klip video (8 detik) WAJIB ada tepat 2 karakter berbeda yang saling berdialog/menjawab. Monolog atau klip berisi hanya 1 karakter/narator tunggal dilarang keras!
- Tentukan otonom kapan masing-masing berbicara: Karakter A berbicara selama 4 detik pertama ([00:00-00:04]), dibalas oleh Karakter B selama 4 detik berikutnya ([00:04-00:08]).
- Tentukan character_id unik (slug huruf kecil, misal: 'ginger', 'mint', 'kunyit', 'temulawak', 'host') secara konsisten di semua klip. Anda WAJIB memperkenalkan dan menggunakan minimal 3 hingga 4 karakter unik yang berbeda di seluruh video.
- Kombinasi karakter yang berbicara di klip yang berbeda WAJIB bervariasi (misal: klip 1: karakter A & B, klip 2: karakter C & D, klip 3: karakter A & C, dst) agar interaksi dinamis.
- Di setiap klip, Anda WAJIB menyertakan field "voice_segments" dalam format array berisi tepat 2 dialog karakter:
  "voice_segments": [
    { "character_id": "[slug karakter X]", "text": "[Dialog X]" },
    { "character_id": "[slug karakter Y]", "text": "[Dialog Y]" }
  ]
- "narration" field TETAP diisi teks gabungan: "[KARAKTER_X]: text. [KARAKTER_Y]: text."
- character_id HARUS KONSISTEN di semua klip.
`}` : '';

  const brandName = brandProfile?.brand_name || 'Generik';
  const toneOfVoice = brandProfile?.tone_of_voice || 'Kasual/Gaul';
  const forbiddenElements = brandProfile?.forbidden_elements || 'Tidak ada';
  const brandSloganOrCta = brandProfile?.brand_slogan_or_cta || '';

  // [Fix v2.2.92] Filename anchor untuk T2I template — dipakai di contoh prompt agar AI
  // meniru format "(Product Reference File: 'namafile.jpg')" di bridging clip
  const opcRefFilename = campaignData.product_filename_declare
    || (productData?.clean_photo_url ? productData.clean_photo_url.split('/').pop() : '')
    || (productData?.product_filename_declare || '');
  const opcRefFilenameTag = opcRefFilename
    ? `, (Product Reference File: '${opcRefFilename}', geometry_lock: EXACT FILENAME MATCH — high-fidelity visual must match the attached reference photo)`
    : '';

  let faceVisibility = campaignData.face_visibility || 'Faceless';
  let vsoSection = '';

  if (vsoData) {
    const targetConcept = vsoData.character_concept || "faceless";
    if (targetConcept.toLowerCase() === 'faceless') faceVisibility = 'Faceless';
    else if (targetConcept.toLowerCase() === 'pov') faceVisibility = 'POV';
    else if (targetConcept.toLowerCase() === 'silhouette') faceVisibility = 'Silhouette';
    else if (targetConcept.toLowerCase() === 'stylized_3d') faceVisibility = '3D Stylized Claymation';

    const isMascotUniverse = vsoData.subject_demographic?.startsWith('mascot_universe_');
    let targetCharacter = '';
    if (isMascotUniverse) {
      const universeKey = vsoData.subject_demographic;
      const universeData = MASCOT_UNIVERSES[universeKey];
      const targetStyle = MASCOT_ART_STYLES[vsoData.visual_style_preset] || MASCOT_ART_STYLES['3d_claymation_cozy'];
      const characterListString = Object.entries(universeData.mascots)
        .map(([id, desc]) => `  - ID: [${id}] → Deskripsi DNA: ${desc}`)
        .join('\n');
      targetCharacter = `semesta maskot ${universeData.name} (Gaya visual: ${targetStyle}).
Karakter yang tersedia dalam semesta ini (pilih secara otonom dari daftar di bawah, ATAU jika ada bahan/produk penting dalam cerita yang belum terdaftar, Anda sangat disarankan untuk menciptakan karakter maskot baru secara "on-the-fly" dengan format ID: [mascot_<nama_bahan>] beserta deskripsi DNA visual kartun yang senada):
${characterListString}
⚠️ ATURAN SEMESTA MASKOT:
- DILARANG KERAS memunculkan model manusia nyata, wajah manusia, jilbab, abaya, jas, atau organ tubuh manusia nyata di seluruh prompt klip baru!
- Semua klip WAJIB menggunakan karakter animasi kartun dari semesta ini.`;
    } else {
      targetCharacter = vsoData.subject_demographic === "custom"
        ? vsoData.subject_demographic_custom
        : (DEMOGRAPHIC_PRESETS[vsoData.subject_demographic] || "a graceful Muslimah");
    }

    const targetWardrobe = vsoData.wardrobe_style === "custom"
      ? vsoData.wardrobe_style_custom
      : (WARDROBE_PRESETS[vsoData.wardrobe_style] || "modest clothing");

    const targetLighting = vsoData.lighting_style === "custom"
      ? vsoData.lighting_style_custom
      : (LIGHTING_PRESETS[vsoData.lighting_style] || "soft natural light");

    vsoSection = `
========================================================================
🚨 VISUAL SWAP OVERRIDES (VSO PRESET) MANDATE
========================================================================
Anda WAJIB menyesuaikan seluruh detail estetika visual video dengan spesifikasi visual di bawah ini di seluruh klip storyboard maupun prompt visual T2V/T2I/I2V:
1. Konsep Karakter  : ${targetConcept} (${getConceptInstruction(targetConcept)})
2. Demografi Subjek : ${targetCharacter}
3. Warna Hijab (Wardrobe): ${targetWardrobe}
4. Pencahayaan/Light: ${targetLighting}
5. KONSISTENSI WARDROBE WAJIB: Warna, tekstur, dan pola dari gamis/wardrobe (${targetWardrobe}) HARUS IDENTIK di seluruh klip. Jangan mengganti warna atau motif pakaian subjek antar-klip. Setiap klip yang menampilkan subjek WAJIB menggunakan wardrobe dengan warna dan tekstur yang PERSIS SAMA.
6. MANDAT STRUKTUR TUPLE PROMPT VISUAL (STRICT SEPARATE TAG MANDATE):
   - Di dalam "t2i_prompts" dan "i2v_prompts", Anda WAJIB menuliskan tuple "(Anchor: [Subject Anchor])" (memuat demografi & penutup lengan syar'i) dan tuple "(Wardrobe: [Wardrobe Lock])" (memuat spesifikasi warna & tekstur: "${targetWardrobe}") SECARA TERPISAH.
   - DILARANG KERAS MENGHAPUS ATAU MENGGABUNGKAN TAG "(Wardrobe: ...)" ke dalam Anchor!
7. KONSISTENSI LATAR/LOKASI WAJIB: Latar belakang (Environment/Location) dan suasana ruangan HARUS SELARAS di seluruh klip. Gunakan tema latar yang seragam (misalnya jika berlatar meja studio, pastikan semua klip berlatar meja studio serupa) dan dilarang berpindah lokasi secara ekstrem antar adegan.

Terapkan aturan visibilitas wajah dan konsep karakter secara konsisten di deskripsi visual storyboard maupun prompt T2V/T2I (tulis dalam Bahasa Inggris).
========================================================================
`;
  }

  const bridgeDurationClips = campaignData.bridge_duration_clips !== undefined ? Number(campaignData.bridge_duration_clips) : 1;
  const productEndClip = (bridgeDurationClips > 0) ? (bridgeAtClip + bridgeDurationClips - 1) : targetClips;

  let productInstruction = "";
  if (campaignData.is_bridging_active && productData) {
    const productName = sanitizeProductTitle(productData.product_name || "");
    const productDesc = sanitizeProductUsp(productData.product_description || "");
    const productUsp = sanitizeProductUsp(typeof productData.unique_selling_point === 'string' ? productData.unique_selling_point : JSON.stringify(productData.unique_selling_point || ""));
    const productPackagingType = productData.packaging_type || "Kemasan produk";
    const productIsInPackaging = productData.is_in_packaging === 1 || productData.is_in_packaging === true ? 'Ya' : 'Tidak';
    const productT2iRef = productData.t2i_prompt || "";
    const productI2vRef = productData.i2v_action_prompt || "";

    const bridgeRangeText = (bridgeDurationClips === 1 || productEndClip <= bridgeAtClip)
      ? `Pada KLIP KE-${bridgeAtClip}`
      : `Pada KLIP KE-${bridgeAtClip} hingga KLIP KE-${productEndClip}`;

    const sandwichReturnText = productEndClip >= targetClips ? "" : `PENTING (KEMBALI KE TOPIK UTAMA / SANDWICH RETURN):
Pada KLIP KE-${productEndClip + 1} hingga klip terakhir (${targetClips}), Anda DILARANG KERAS membahas atau mempromosikan produk lagi!
Narasi harus kembali fokus 100% membahas, memperdalam, dan menyimpulkan "Pilar Konten" utama agar penonton mendapatkan edukasi/nilai yang utuh.`;

    const conversionZoneText = (bridgeDurationClips === 1 || productEndClip <= bridgeAtClip)
      ? ""
      : `\n\n[ZONA 3: PRODUCT ENGAGEMENT] (Klip ke-${bridgeAtClip + 1} hingga KLIP KE-${productEndClip})
- Lanjutkan pembahasan produk secara halus. Jelaskan lebih detail mengenai USP produk ("${productUsp}") atau khasiatnya dalam mendukung rutinitas/aktivitas yang sedang dibahas.
- Gaya Bahasa: Gunakan gaya "${campaignData.promotion_style || 'Softselling'}".`;

    productInstruction = `
========================================================================
🚨 ATURAN PENYISIPAN PRODUK ORGANIK (SANDWICH PLACEMENT MANDATE)
========================================================================
${bridgeRangeText}, Anda WAJIB menyisipkan produk target secara kasual dan singkat (Soft-Selling Organik).
- Nama Produk: "${productName}"
- Unique Selling Point (USP): "${productUsp}" (JANGKAR UTAMA MANFAAT RESMI PRODUK)
- Bentuk Kemasan Fisik: "${productPackagingType}" (Apakah di dalam kemasan: ${productIsInPackaging})
- Referensi Visual T2I (Start Frame): "${productT2iRef}"
- Referensi Gerakan I2V: "${productI2vRef}"${getPackagingInstruction(productData)}

${buildProductTruthContractSection(productData, bridgeAtClip, productEndClip)}
PENTING (MANDAT GEOMETRI PRODUK KETAT):
Untuk klip target produk (Klip ke-${bridgeAtClip} hingga ${productEndClip}), Anda WAJIB menyesuaikan bentuk wadah/kemasan produk pada [Product Geometry] dan [Material Physics] di dalam "t2i_prompts" sesuai dengan "Bentuk Kemasan Fisik" di atas. Jangan berhalusinasi atau mengubah tipe wadah (misalnya jika bentuk kemasan adalah "Jar Plastik" / "plastic jar", maka tulis "cylindrical jar" atau "plastic jar", DILARANG menulis "pouch", "sachet", atau wadah lain yang tidak sesuai).

🚨 ISOLASI PEMBAHASAN PRODUK (PRODUCT PLACEMENT ISOLATION MANDATE):
- HANYA PADA KLIP KE-${bridgeAtClip} (dan klip ke-${bridgeAtClip} hingga ${productEndClip}):
  * Naskah Voiceover (narration) WAJIB membahas produk "${productName}" dan manfaatnya secara organik.
  * Prompt visual ("t2i_prompts" dan "i2v_prompts") WAJIB secara eksplisit menggambarkan visual produk "${productName}" dengan bentuk kemasan "${productPackagingType}" sesuai data spesifikasi di atas.
- PADA KLIP DI LUAR RENTANG TERSEBUT (Klip sebelum ke-${bridgeAtClip} atau sesudah ke-${productEndClip}):
  * Naskah Voiceover (narration) DILARANG KERAS menyebutkan nama produk, brand, atau melakukan penjualan.
  * Prompt visual ("t2i_prompts" dan "i2v_prompts") DILARANG KERAS menggambarkan produk target, kemasannya, atau menyertakan kata kunci produk tersebut (mereka harus fokus 100% pada cerita pilar organik atau aktivitas pilar non-produk).

[ZONA 2: THE ORGANIC COMPANION / PIVOT POINT] (Klip ke-${bridgeAtClip})
- Ini adalah titik transisi yang WAJIB terasa sangat masuk akal dan mengalir (smooth).
- ATURAN THE STORY-WEAVING (MANDATORY): Jangan langsung meneriakkan fitur/USP produk. Anda WAJIB menciptakan "Konteks Aktivitas" yang menghubungkan masalah di Klip 1 dengan penggunaan produk di Klip ke-${bridgeAtClip}.
- ATURAN ANTI-BROSUR: Anda DILARANG KERAS menyalin mentah-mentah USP dari data e-commerce. Jika USP kaku (misal: "Bahan kokoh kaca borosilikat, 5 in 1"), Anda WAJIB memparafrasenya menjadi bahasa percakapan sehari-hari yang menyatu dengan aktivitas.
- Logika Transisi: [Aktivitas Solusi] -> [Aktivitas dilakukan pakai Produk Target] -> [Parafrase USP menjadi Manfaat Kasual].
- CONTOH BENAR: (Masalah: Susah BAB. Produk: Teko Kaca 5 in 1) -> "Biar pencernaan tetap lancar, menyeduh air lemon hangat setiap pagi bisa jadi kebiasaan baik. Supaya proses menyeduh aman untuk sekeluarga, [Nama Teko] ini hadir dengan kapasitas besar dan kaca tahan panas."
- CONTOH SALAH (DILARANG): "Susah BAB? Makanya aku pakai [Nama Teko] ini. Kokoh, awet, desain cantik, hemat lagi dapat 5 in 1!" (Terlalu hard-sell, kaku, dan cerita terputus).

ATURAN NASKAH KLIP ${bridgeAtClip}:
- Sebutkan produk sebagai pelengkap aktivitas/rutinitas pilar menggunakan ATURAN JEMBATAN AKTIVITAS di atas. Dilarang hardsell kasar.
- Gaya Bahasa: Gunakan gaya "${campaignData.promotion_style || 'Softselling'}".

ATURAN VISUAL KLIP ${bridgeAtClip}:
- Fokus visual harus tertuju pada produk target.${conversionZoneText}

${sandwichReturnText}
========================================================================
`;
  }

  const visualStyleStr = String(campaignData.visual_style || 'Cinematic').toLowerCase();
  const isAnimationOr3d = visualStyleStr.includes('anime') || visualStyleStr.includes('cartoon') || visualStyleStr.includes('claymation') || visualStyleStr.includes('3d');
  const dynamicStyleNeg = isAnimationOr3d ? '' : ', CGI look, plastic skin, anime, cartoon';
  const customNegativePrompt = ` NEGATIVE PROMPT: text, subtitles, watermark, typography, facial features, head portrait, upper body, distorted face in background, extra limbs, third arm, floating thumb, morphing body parts, giant bottle, distorted scale${dynamicStyleNeg}, (Constraint: ANIMATE EXISTING LIMBS ONLY).`;

  const visualModeInstructions = visualMode === 'hybrid_lock'
    ? `## ATURAN KHUSUS VISUAL MODE: HYBRID LOCK (DOUBLE-PASS)
Karena kampanye ini dikonfigurasi dalam mode "hybrid_lock", maka seluruh klip (Klip 1 hingga Klip ${targetClips}) wajib menggunakan model Double-Pass (T2I + I2V) demi konsistensi detail visual yang sangat tinggi. Oleh karena itu:
1. Isi array "t2i_prompts" (visual start frame statis dalam Bahasa Inggris) untuk SETIAP klip dari Klip 1 hingga Klip ${targetClips}.
2. Isi array "i2v_prompts" (visual camera motion/movement dalam Bahasa Inggris) untuk SETIAP klip dari Klip 1 hingga Klip ${targetClips}.
3. Anda DILARANG mengisi array "t2v_prompts" untuk klip manapun (kosongkan key tersebut). Anda DILARANG KERAS menghasilkan key "t2v_prompts" di dalam JSON output.
`
    : `## ATURAN KHUSUS VISUAL MODE: PURE T2V
Karena kampanye ini dikonfigurasi dalam mode "pure_t2v", maka seluruh klip (Klip 1 hingga ${targetClips}) wajib menggunakan Text-to-Video. Oleh karena itu, isi array "t2v_prompts" untuk seluruh klip tersebut. Anda TIDAK perlu mengisi array "t2i_prompts" dan "i2v_prompts". Anda DILARANG KERAS menghasilkan key "t2i_prompts" atau "i2v_prompts" di dalam JSON output.`;

  let dynamicPromptFields = '';
  let dynamicImportantRules = '';

  if (visualMode === 'hybrid_lock') {
    dynamicPromptFields = `  "t2i_prompts": [
    {
      "clip": ${bridgeAtClip},
      "prompt": "(VERTICAL 9:16) --ar ${campaignData.aspect_ratio || '9:16'} --no landscape [LAYER 1: OPTICS] (Shot on [Camera], [Lens]), (Texture: [Film Physics]). [LAYER 2: SUBJECT & VISUAL TRUTH] (Anchor: [Subject Anchor]), (Wardrobe: [Wardrobe Lock]), (Product Truth: [Product Geometry] made of [Material Physics])${opcRefFilenameTag}. [LAYER 3: SCENE & LIGHT] (Environment: [Scene Lock]), (Lighting: [Lighting Mood]). [LAYER 4: KINETIC IMPLICATION] (Frozen Action: Subject is poised to [Action Verb]), (Micro-Expression: [Key Emotion]).${customNegativePrompt}"
    }
  ],
  "i2v_prompts": [
    {
      "clip": ${bridgeAtClip},
      "prompt": "(VERTICAL 9:16) --ar ${campaignData.aspect_ratio || '9:16'} --no landscape [LAYER 1: INPUT & TRUTH LOCK] (Start Frame: [Filename]), (Consistency: MAX). (Geometric Truth: [MANDATE 50 - Shape & Material Extraction]). [LAYER 2: MICRO-PACING & ACTION (MANDATE 49)] ${isAudioSegmentEnabled ? '([00:00-00:02]): (Visual Action: ...), (Audio Segment: \\"...\\\"), ([00:02-00:04]): (Visual Action: ...), (Audio Segment: \\"...\\\"), ([00:04-00:06]): (Visual Action: ...), (Audio Segment: \\"...\\\"), ([00:06-00:08]): (Visual Action: ...), (Audio Segment: \\"...\\\").' : '([00:00-00:02]): (Visual Action: [Move]), ([00:02-00:04]): (Visual Action: [Move]), ([00:04-00:06]): (Visual Action: [Move]), ([00:06-00:08]): (Visual Action: [Move] + [TRANSITION LOCK]).'}${i2vSfxTemplate}${customNegativePrompt}"
    }
  ],`;
    dynamicImportantRules = `2. ALL visual prompts (i2v_prompts and t2i_prompts) MUST be written ENTIRELY in English. Naskah voiceover and caption/social metadata in ${targetLanguageLabel}.
3. CRITICAL: I2V/T2I prompts MUST be a single plain text paragraph — copy-paste ready.
4. CRITICAL: Semua nilai string HARUS valid JSON. Jangan gunakan *unescaped double quotes* (") atau karakter *newline* aktual di dalam *string value* yang dapat merusak struktur JSON.
5. CRITICAL: DILARANG KERAS menyertakan AUDIO SCRIPT atau naskah/narasi voiceover/spoken words di dalam i2v_prompts atau t2i_prompts pada LAYER 3 atau seksi manapun. ${isWithoutSfx ? 'Jangan menyertakan efek suara (SFX) apa pun.' : 'Prompt visual hanya boleh berisi visual action dan deskripsi efek suara/SFX fisik saja (seperti: "SFX: swoosh, sizzling sound"). DILARANG KERAS menuliskan kata "music", "background music", "BGM", atau musik latar instrumental apa pun.'}${isWithoutSfx ? `\n6. CRITICAL RULE: Kampanye ini dikonfigurasi dalam mode "Without SFX" (Tanpa SFX). Anda DILARANG KERAS menyertakan bagian atau segmen [LAYER 3: SFX] atau deskripsi efek suara (SFX) di dalam prompt visual (t2i_prompts atau i2v_prompts). Jangan menuliskan kata "SFX:" atau efek suara apa pun.` : ''}
6. CRITICAL SAFETY RULE: DILARANG KERAS menyertakan kata-kata bertema suara/audio ke dalam bagian visual negative prompt (seperti: "moaning, wet sounds, squishing, sighing, heavy breathing"). Kata-kata ini akan membuat prompt otomatis ditolak.`;
  } else {
    dynamicPromptFields = `  "t2v_prompts": [
    {
      "clip": 1,
      "scenes_covered": "1",
      "duration": "8s",
      "prompt": "(VERTICAL 9:16) --ar ${campaignData.aspect_ratio || '9:16'} --no landscape [LAYER 0: VISUAL TRUTH & ANCHORS] (Geometric Truth: [MANDATE 50 - Shape & Material Extraction]), (Biometric Anchor: [MANDATE 29 - 3-Point Character Lock]), (Wardrobe: [Wardrobe Lock]). [LAYER 1: SCENE & OPTICS] (Location: [MANDATE 33 - Verbatim Scene Lock]), (Lens: [Camera Spec]), (Camera Move: [Insert Kinetic Logic]), (Lighting: [Lighting Mood]). [LAYER 2: MICRO-PACING & ACTION (MANDATE 49)] ${isAudioSegmentEnabled ? '([00:00-00:02]): (Visual Action: ...), (Audio Segment: \\"...\\\"), ([00:02-00:04]): (Visual Action: ...), (Audio Segment: \\"...\\\"), ([00:04-00:06]): (Visual Action: ...), (Audio Segment: \\"...\\\"), ([00:06-00:08]): (Visual Action: ...), (Audio Segment: \\"...\\\").' : '([00:00-00:02]): (Visual Action: [Move]), ([00:02-00:04]): (Visual Action: [Move]), ([00:04-00:06]): (Visual Action: [Move]), ([00:06-00:08]): (Visual Action: [Move] + [TRANSITION LOCK]).'}${t2vSfxTemplate}${customNegativePrompt}"
    }
  ],`;
    dynamicImportantRules = `2. ALL visual prompts (t2v_prompts) MUST be written ENTIRELY in English. Naskah voiceover and caption/social metadata in ${targetLanguageLabel}.
3. CRITICAL: T2V prompts MUST be a single plain text paragraph — copy-paste ready.
4. CRITICAL: Semua nilai string HARUS valid JSON. Jangan gunakan *unescaped double quotes* (") atau karakter *newline* aktual di dalam *string value* yang dapat merusak struktur JSON.
5. CRITICAL: DILARANG KERAS menyertakan AUDIO SCRIPT atau naskah/narasi voiceover/spoken words di dalam t2v_prompts pada LAYER 3 atau seksi manapun. ${isWithoutSfx ? 'Jangan menyertakan efek suara (SFX) apa pun.' : 'Prompt visual hanya boleh berisi visual action dan deskripsi efek suara/SFX fisik saja (seperti: "SFX: swoosh, sizzling sound"). DILARANG KERAS menuliskan kata "music", "background music", "BGM", atau musik latar instrumental apa pun.'}${isWithoutSfx ? `\n6. CRITICAL RULE: Kampanye ini dikonfigurasi dalam mode "Without SFX" (Tanpa SFX). Anda DILARANG KERAS menyertakan bagian atau segmen [LAYER 3: SFX] atau deskripsi efek suara (SFX) di dalam prompt visual (t2v_prompts). Jangan menuliskan kata "SFX:" atau efek suara apa pun.` : ''}
6. CRITICAL SAFETY RULE: DILARANG KERAS menyertakan kata-kata bertema suara/audio ke dalam bagian visual negative prompt (seperti: "moaning, wet sounds, squishing, sighing, heavy breathing"). Kata-kata ini akan membuat prompt otomatis ditolak.`;
  }

  const languageMandateVisualList = visualMode === 'hybrid_lock' ? '"i2v_prompts", "t2i_prompts"' : '"t2v_prompts"';
  const storytellingRule5 = visualMode === 'hybrid_lock'
    ? `5. Semua prompt visual (i2v_prompts dan t2i_prompts) WAJIB ditulis SEPENUHNYA dalam Bahasa Inggris. Naskah voiceover dan caption/social metadata dalam ${targetLanguageLabel}.`
    : `5. Semua prompt visual (t2v_prompts) WAJIB ditulis SEPENUHNYA dalam Bahasa Inggris. Naskah voiceover dan caption/social metadata dalam ${targetLanguageLabel}.`;

  const storytellingRule6 = isWithoutSfx
    ? `6. CRITICAL RULE: Kampanye ini dikonfigurasi dalam mode "Without SFX" (Tanpa SFX). Anda DILARANG KERAS menyertakan bagian atau segmen [LAYER 3: SFX] atau deskripsi efek suara (SFX) di dalam prompt visual (${visualMode === 'hybrid_lock' ? 't2i_prompts atau i2v_prompts' : 't2v_prompts'}). Jangan menuliskan kata "SFX:" atau efek suara apa pun.`
    : '';

  const storytellingRule7 = visualMode === 'hybrid_lock'
    ? `7. Anda DILARANG KERAS menghasilkan key "t2v_prompts" di dalam JSON output.`
    : `7. Anda DILARANG KERAS menghasilkan key "t2i_prompts" atau "i2v_prompts" di dalam JSON output.`;

  return `Kamu adalah "MAKNA v54.9" - ORGANIC PILLAR CAMPAIGN GENERATOR.
Tugasmu adalah membuat storyboard dan skrip voiceover sebanyak tepat ${targetClips} klip berdasarkan strategi pilar konten dari pengguna.

## KNOWLEDGE BASE(S) INJECTION
${kbCombined}

${campaignData.custom_instruction ? `## CUSTOM INSTRUCTIONS FROM USER\n${campaignData.custom_instruction}\n` : ''}
${vsoSection}
${productInstruction}
${UNIVERSAL_ZERO_TESTIMONY_MANDATE}
${visualModeInstructions}

## FONDASI KREATIF (CORE STRATEGY):
- Pilar Konten (Tema Utama): "${campaignData.content_pillar}"
- Naskah Hook (Klip 1 Wajib menggunakan ini): "${campaignData.custom_hook}"
- Panduan Aksi Visual Global: "${campaignData.visual_action_guideline}"
- Narrative Mode: ${campaignData.narrative_mode || 'Storytelling'}
- Visual Style: ${campaignData.visual_style || 'Cinematic'} (Aturan gaya: jika Cinematic, gunakan pencahayaan filmis/dramatis, komposisi estetik, shallow depth of field; jika UGC, gunakan gaya video kasual/handheld Vlog amatir realistis; jika Macrophotography, fokus sangat dekat/extreme close-up menonjolkan tekstur detail produk atau bahan baku secara tajam).
- Kerapatan Kata Audio: Batasi naskah tepat ${campaignData.words_per_clip || '17-19 kata'} per klip.
- Tampilan Wajah: ${faceVisibility}
- Aspek Rasio: ${campaignData.aspect_ratio || '9:16'}

---
## ATURAN BERCERITA (STORYTELLING RULES):
- LANGUAGE MANDATE (SANGAT KETAT):
  * Jika target bahasa adalah ENGLISH (US): Naskah voiceover ("narration") wajib ditulis sepenuhnya dalam Bahasa Inggris yang natural (slang TikTok US jika cocok).
  * Jika target bahasa adalah INDONESIAN: Naskah voiceover ("narration") wajib ditulis sepenuhnya dalam Bahasa Indonesia.
  * PERINGATAN: Prompt visual (${languageMandateVisualList}) wajib TETAP selalu ditulis dalam Bahasa Inggris.
1. Mulai video di Klip 1 menggunakan Naskah Hook secara persisten.
2. Jabarkan "Pilar Konten" menjadi cerita yang edukatif, menghibur, atau relatable sesuai Narrative Mode.
   🚨 DETAIL MANDAT NARRATIVE MODE ("${campaignData.narrative_mode || 'Storytelling'}"):
    - Jika "Storytelling":
      * Klip Pertama (Klip 1): Hook pembuka wajib menggunakan naskah hook dari sistem secara utuh.
      * Klip Pertengahan (Klip 2 s/d N-1): Melukiskan suasana rutinitas harian secara visual dan detail prosesnya (kronologis, misalnya: dari ketenangan persiapan kulkas hari Minggu ke hari Senin pagi yang tenang/damai). DILARANG KERAS menggunakan kata ganti orang pertama ("aku/gue/kami/saya") dan tanpa tokoh fiktif ("Andi/Siti") untuk menghindari kesan berbohong. Fokus pada keindahan proses, estetika visual, dan ketenangan pikiran.
      * Klip Terakhir (Klip N): Penutup/kesimpulan yang hangat dari aktivitas rutin tersebut dan CTA yang relevan.
    - Jika "Problem-Solution":
      * Klip Pertama (Klip 1): Hook pembuka berupa keluhan/pertanyaan.
      * Klip Awal Eskalasi (Klip 2): Menekankan rasa lelah, keluhan, atau frustrasi penonton secara dramatis (pain point). Wajib diawali kata-kata emosional seperti: "Capek banget kan...", "Pasti sebel kalau...", "Berapa kali lo ngerasa...".
      * Klip Solusi (Klip 3 s/d N-1): Pivot/perkenalan cara baru atau langkah praktis sebagai penyelesaian masalah secara konkret. Fokus pada efisiensi waktu, kemudahan, dan nilai praktis.
      * Klip Terakhir (Klip N): Kesimpulan manfaat praktis (efisiensi waktu/tenaga) dan CTA rekomendasi tindakan.
    - Jika "Educational":
      * Klip Pertama (Klip 1): Hook fakta mengejutkan/mitos salah kaprah.
      * Klip Edukasi Teoretis (Klip 2): Penjelasan ilmiah/biokimia/fakta gizi di balik topik secara teoretis. Wajib menyertakan kosa kata ilmiah seperti: "Secara ilmiah...", "kandungan nutrisi mikro...", "struktur selular...", "zat gizi".
      * Klip Detail Teknis/Penyimpanan (Klip 3 s/d N-1): Tips teknis dan mekanisme biologis/fisik praktis (seperti reaksi kimia, proses oksidasi udara, gas etilen, kelembaban, suhu kulkas, dll.) terkait topik. Gunakan bahasa informatif, logis, objektif, dan kredibel.
      * Klip Terakhir (Klip N): Ringkasan manfaat pengetahuan dan CTA edukasi/ilmu dapur lainnya.
3. Terapkan Face Visibility (${faceVisibility}) di seluruh visual prompt. Jika Faceless: frame WAJIB dipotong dari siku ke bawah, fokus pada lengan hingga pergelangan tangan dan jari (forearm & hand close-up), hindari full-body shot — aturan syariat. Jika POV, gunakan sudut pandang orang pertama.
4. Tulis visual prompt dalam bentuk deskripsi linear satu baris (Plain Text format) tanpa menyertakan enter/newline (\n).
5. ATURAN SEMANTIC STERILIZATION (FILTER BYPASS SHIELD): AI Video memiliki filter ketat. Anda dilarang keras menggunakan kata-kata ambigu: "powder", "white liquid", "thick mixture", "high-viscosity liquid", "milky", "pills", "drugs", "liquid transfer", "viscous". Ganti dengan istilah netral: "nutritional beverage", "creamy vanilla smoothie", "health supplement", "velvet texture".
   - DILARANG KERAS memasukkan kata-kata bertema organ vokal/suara/audio ke dalam bagian visual prompt maupun negative prompt (seperti: "mouth", "ears", "eyes", "speech", "read", "comments", "moaning", "wet sounds", "squishing", "sighing", "heavy breathing"). Kata-kata ini dibaca oleh pemindai audio Veo dan akan membuat prompt otomatis ditolak (PUBLIC_ERROR_AUDIO_FILTERED).
6. ATURAN NUCLEAR ANATOMY LOCK: Setiap prompt visual wajib memiliki negative prompt anatomi di bagian akhirnya.
7. ATURAN CHRONOLOGICAL PHYSICS & MICRO-KINETICS: Hindari deskripsi aksi robotik, kalimat terputus, atau fisika yang mustahil. Gunakan kata sambung aksi yang mengalir (fluid connectors) seperti "while simultaneously...", "in a continuous flow...", "maintaining the fluid momentum...". Gunakan Micro-Kinetics untuk realisme: "applying visible muscle tension", "subtle micro-balancing", "dynamic light reflections".
8. ATURAN STRICT SINGLE-LINE FORMATTING: Prompt harus dihasilkan dalam format satu baris (single-line) tanpa line breaks (enter) tersembunyi.
${storytellingRule5}
${storytellingRule6 ? storytellingRule6 + '\n' : ''}${storytellingRule7}

## OUTPUT FORMAT
Return ONLY valid JSON (no markdown code blocks, no explanation). Use this exact structure:
{
  "analysis_summary": {
    "pillar_strategy": "Penjelasan singkat taktik penulisan pilar konten",
    "sandwich_transition_plan": "Rencana transisi softsell klip ${bridgeAtClip}"
  },
  "video_dna": {
    "pilar_konten": "Kategori konten/resep (e.g. Minuman Sehat, Makanan Cepat, Diet)",
    "hook_type": "Tipe hook pembuka (e.g. Pertanyaan, Mitos, Hasil Akhir)",
    "visual_style": "Gaya presentasi visual (e.g. Faceless, Macro, Food Porn)",
    "signature_moment": "Adegan paling estetik/ASMR (e.g. Madu menetes, Smoothie pusaran)",
    "camera_pace": "Kecepatan pergerakan kamera (e.g. Static, Dynamic Tracking, Fast Cuts)",
    "primary_emotion": "Mood dominan (e.g. Menggugah Selera, Segar, Santai)",
    "affiliate_integration": "Cara menyisipkan produk (e.g. Natural Usage, Background, Problem Solver)",
    "affiliate_mention": "Metode penyebutan afiliasi (e.g. Voice Over, Visual Only, Both)",
    "scene_count": ${targetClips},
    "cta_type": "Tindakan ajajan interaksi (e.g. Save Recipe, Share to Friend, Buy Now)"
  },
  "storyboard": [
    {
      "scene": 1,
      "duration": "Estimasi durasi (e.g. 8s)",
      "visual_description": "Deskripsi visual (sangat detail)",
      "camera_movement": "Pergerakan kamera standar MAKNA",
      "audio_mood": "Instruksi SFX & gaya baca"
    }
  ],
  "voiceover": [
    {
      "scene": 1,
      "narration": "Naskah audio ${targetLanguageLabel} yang natural. Khusus klip 1 harus persis: \\"${campaignData.custom_hook}\\"",
      "duration": "Estimasi durasi narasi"
    },
    {
      "scene": ${targetClips},
      "narration": "Naskah audio penutup klip terakhir.${sanitizeCustomInstruction(campaignData.custom_instruction) ? ` MANDATORY: Akhiran/penutup kalimat naskah Klip Terakhir ini WAJIB mengakhiri dengan kalimat ucapan: \\"${sanitizeCustomInstruction(campaignData.custom_instruction)}\\"` : ''}",
      "duration": "Estimasi durasi",
      "cta_facebook": "Tuliskan alternatif Call to Action penutup khusus Facebook/Instagram (misal: 'klik link di bawah ya!'). Wajib dalam bahasa ${languageName} / ${targetLanguageLabel}.",
      "cta_tiktok": "Tuliskan alternatif Call to Action penutup khusus TikTok (misal: 'produk ori di keranjang ya!'). Wajib dalam bahasa ${languageName} / ${targetLanguageLabel}."
    }
  ],
  ${dynamicPromptFields}
  "social_media_package": {
    "caption": "Single Universal Caption (terdiri dari Hook menarik, Value delivery, CTA universal, dan Hashtags relevan). In ${targetLanguageLabel}. MANDATORY: Caption dan Hashtags DILARANG KERAS memuat kata 'detox', 'detoks', 'usus kotor', 'melunturkan lemak', atau 'tanpa efek samping'. Gunakan hashtags edukatif aman dan relevan dengan kategori produk (contoh: jika teh diet gunakan #PencernaanLancar #TehHerbal; jika bahan makanan/baking gunakan #BakingSehat #ResepPraktis; jika barang rumah tangga gunakan #RumahRapi #TipsDapur)."
  }
}

IMPORTANT RULES:
1. Scene/clip count MUST be exactly ${targetClips}.
${dynamicImportantRules}${audioSegmentMandate}
${isAudioSegmentEnabled ? '7' : '6'}. CRITICAL SAFETY RULE: DILARANG KERAS menyertakan deskripsi efek suara vokal manusia non-verbal seperti helaan napas (sigh/gasp), erangan (moan/groan), atau desahan di dalam bagian [LAYER 3: SFX] atau seksi manapun karena akan memicu filter keamanan Veo (PUBLIC_ERROR_AUDIO_FILTERED). Gunakan hanya deskripsi efek suara ambient fisik (seperti: "SFX: gentle pouring sound, subtle kitchen ambiance, sizzling sound"). DILARANG KERAS menuliskan kata "music", "background music", atau "BGM".
${isAudioSegmentEnabled ? '8' : '7'}. CRITICAL CTA VARIATIONS MANDATE: For the final scene/clip (clip ${targetClips}) inside the 'voiceover' array, you MUST generate two additional fields inside the JSON object: 'cta_facebook' (a natural call to action targeted at Facebook/Instagram users, e.g. 'klik link di bawah ya!') and 'cta_tiktok' (a natural call to action targeted at TikTok users, e.g. 'produk ori di keranjang ya!' or 'produk ori di keranjang kuning ya!'). Both CTAs must be in ${targetLanguageLabel} and match the style and flow of the narration.`;
}

/**
 * Prompt to analyze scraped HTML/text of an e-commerce product page and extract structured product details including an image CDN URL.
 * @param {string} scrapedHtml - Raw HTML or page text from e-commerce product page
 * @param {string} productUrl - The product page URL
 * @returns {string}
 */
export function buildProductSourcingPrompt(scrapedHtml, productUrl) {
  return `Kamu adalah "MAKNA v8.6" - STAGE 0: PRODUCT SOURCING AGENT.
Tugasmu adalah menganalisis raw HTML / teks hasil scraping dari halaman produk e-commerce (${productUrl}) dan mengekstrak informasi detail produk secara akurat.

[RAW SCRAPED CONTENT]
${scrapedHtml}

[TUGAS]
1. Ekstrak nama produk lengkap dengan merk/brand (field: "product_name").
   ATURAN OPTIMASI NAMA (NAME OPTIMIZATION):
   Anda WAJIB membersihkan nama produk dari tumpukan kata kunci sampah e-commerce (seperti 'READY STOCK', 'TERMURAH', 'BISA COD', 'PREMIUM ORIGINAL', 'PROMO BUNDLE', atau kode seri barang/ukuran yang terlalu panjang dan teknis). Ubah menjadi nama produk yang ringkas, bersih, berwibawa, dan elegan (maksimal 4-6 kata).
2. Ekstrak deskripsi singkat produk yang menarik (field: "product_description").
   ATURAN OPTIMASI DESKRIPSI (DESCRIPTION OPTIMIZATION):
   Ubah deskripsi e-commerce asli yang seringkali sangat panjang, bertele-tele, atau sekadar tumpukan spesifikasi kaku menjadi deskripsi naratif pendek (maksimal 2-3 kalimat) yang berfokus pada solusi, kegunaan praktis, dan keunggulan emosional produk. Gunakan bahasa percakapan yang persuasif, mengalir, dan siap pakai untuk promosi.
3. Ekstrak keunggulan utama / Unique Selling Point (USP) produk (field: "unique_selling_point").
   ATURAN EKSTRAKSI UNIQUE SELLING POINT (USP MANDATE):
   Anda DILARANG KERAS hanya menyalin spesifikasi fisik yang kaku dari e-commerce (misal: 'Bahan kaca borosilikat', 'Daya 500W'). Anda WAJIB menerjemahkan setiap fitur fisik menjadi 'Manfaat Fungsional & Emosional' (Feature-to-Benefit Translation) yang relevan dengan kehidupan atau aktivitas sehari-hari konsumen.
   CONTOH BENAR: 'Material kaca anti-retak yang sangat aman untuk menyeduh teh/kopi mendidih maupun air es.'
   Format USP Anda harus berbunyi seperti solusi fungsional yang mempermudah rutinitas.
4. Temukan URL gambar utama produk yang berkualitas HD dari tag gambar, metadata OG (og:image), atau pola CDN gambar Shopee/Tokopedia yang ada di dalam HTML/teks (field: "scraped_image_url"). Pastikan URL ini valid, mengarah langsung ke asset gambar, dan bersih dari escape character.

[OUTPUT FORMAT - STRICT JSON]
{
  "product_name": "Nama Produk Lengkap...",
  "product_description": "Deskripsi produk...",
  "unique_selling_point": "USP/Keunggulan utama...",
  "scraped_image_url": "https://..."
}`;
}

/**
 * Prompt to clean product names and extract 3 bullet-point USPs in a batch.
 * @param {Array<Object>} rawProductsArray - Array of { id, raw_description }
 * @returns {string}
 */
export function buildBatchProductExtractionPrompt(rawProductsArray) {
  return `Anda adalah seorang Copywriter E-commerce Senior dan Spesialis Ekstraksi Data.

Tugas Anda adalah menerima sekumpulan data mentah deskripsi produk (dalam bentuk JSON array), lalu membersihkan nama produk, mengekstrak **Unique Selling Proposition (USP)**, mendeteksi status fisik kemasan, serta merancang prompt gambar studio (T2I) dan prompt aksi video (I2V) untuk masing-masing produk.

ATURAN MUTLAK:
1. Ekstrak nama produk yang bersih, singkat, dan mudah dibaca (hilangkan kata-kata spam seo dari nama aslinya, maksimal 4-6 kata).
2. Buat TEPAT 3 poin USP untuk setiap produk.
3. Setiap poin USP MAKSIMAL terdiri dari 10 kata.
4. Setiap poin USP WAJIB diawali dengan tanda hubung dan spasi ("- ").
5. Pisahkan setiap poin USP dengan karakter newline (\\n) di dalam string "usp".
6. Bahasa USP harus sangat persuasif, menarik, kekinian, dan cocok dibacakan sebagai naskah video TikTok.
7. Jangan mengubah atau menghilangkan id produk yang diberikan.
8. Temukan URL gambar utama produk yang berkualitas HD dari daftar gambar yang terdeteksi di input (field: "scraped_image_url").
9. Analisis status fisik produk ("physical_state"):
   - "is_in_packaging" (boolean): true jika produk dikemas rapat dalam wadah/kotak/plastik/botol sehingga isinya belum terlihat secara langsung. false jika produk sudah terbuka, telanjang, atau siap pakai (misalnya wajan, panci, atau baju tanpa kotak).
   - "packaging_type" (string): Tipe kemasan fisik (misal: "Kardus Kotak", "Botol Plastik", "Plastik Sachet", "Jar Kaca", atau "none" jika tidak dikemas).
10. Rancang "t2i_prompt" (string) dalam Bahasa Inggris: Prompt studio photography premium untuk G-Labs.
    - Format: "Professional studio product photography of [Product Name], centered, resting on a clean glossy white podium, dramatic top-down studio lighting, sharp focus, 8k resolution, hyperrealistic materials."
11. Rancang "i2v_action_prompt" (string) dalam Bahasa Inggris untuk menggerakkan start frame:
    - **PAGAR PEMBATAS (GUARDRAILS) KETAT:**
      - JIKA "is_in_packaging" adalah true: **DILARANG KERAS** menggunakan kata kerja manipulasi isi produk (seperti: memarut, menuang, memotong, mencairkan, menyemprotkan isi, memakan). HANYA perbolehkan manipulasi wadah/kemasan (seperti: "camera panning around the box, the package resting elegantly on a table, soft lighting gliding across the packaging, unboxing lid opening").
      - JIKA "is_in_packaging" adalah false: Diizinkan menggunakan aksi manipulasi fisik langsung (seperti: "steam rising, stirring the soup, slicing the cake, pouring the liquid").

[INPUT DATA]
${JSON.stringify(rawProductsArray, null, 2)}

Kembalikan hasil dalam format JSON yang valid sesuai dengan responseSchema.`;
}

// ========================
// V8.9: Deconstruct Lab — Phase 1 Analysis Prompt
// ========================

export function buildDeconstructPhase1Prompt(originalCaption, targetRecommendationCount = 3) {
  const captionContext = originalCaption
    ? `\n[CAPTION ASLI VIDEO]\n"${originalCaption}"\n`
    : '';

  return `Kamu adalah seorang "Viral Pattern Miner" — ahli analisis konten video viral untuk menemukan celah produk e-commerce.

TUGAS: Analisis video ini secara mendalam dan hasilkan output JSON terstruktur.

${captionContext}

## INSTRUKSI FASE 1: DEKONSTRUKSI VIDEO

### A. STORYBOARD ORIGINAL (Bedah per Adegan)
Pecah video menjadi adegan-adegan (scenes) berdasarkan perubahan visual, narasi, atau transisi. Untuk SETIAP adegan:
1. **scene**: Nomor urut adegan (1, 2, 3, ...)
2. **timestamp**: Rentang waktu (contoh: "00:00-00:03")
3. **visual_description**: Deskripsi detail apa yang terlihat di layar
4. **emotional_hook**: Emosi apa yang dicoba dipicu pada penonton (curiosity, fear, desire, urgency, dll)
5. **narration_transcript**: Transkripsi teks/narasi yang terdengar (jika ada)
6. **camera_technique**: Teknik kamera (close-up, wide shot, POV, zoom in, dll)

### B. PRODUCT IDEAS (Celah Produk yang Bisa Dijual)
Berdasarkan konteks video, target audiens, dan pola viral yang terdeteksi, rekomendasikan produk yang COCOK dipromosikan menggunakan format video serupa.

Berikan ${targetRecommendationCount} rekomendasi untuk masing-masing kategori:

**Low Ticket** (Rp 10.000 - Rp 150.000):
- Produk impulsif, murah, yang biasa viral di TikTok Shop / Shopee
- Fokus pada produk yang bisa dibeli tanpa berpikir panjang

**High Ticket** (Rp 150.000 - Rp 2.000.000+):
- Produk premium yang cocok untuk storytelling mendalam
- Fokus pada produk yang menyelesaikan masalah nyata audiens

Untuk setiap produk:
1. **product_name**: Nama produk spesifik (bukan kategori generik)
2. **category**: Kategori (Skincare, Gadget, Fashion, Kitchen, Health, dll)
3. **reason**: Alasan mengapa produk ini cocok dengan pola viral video ini (2-3 kalimat)
4. **marketplace_search_query**: Kata kunci pencarian untuk Shopee/Tokopedia
5. **estimated_price_range**: Rentang harga estimasi

### C. VIRAL PATTERN SUMMARY
Rangkuman 3-5 kalimat tentang POLA VIRAL apa yang digunakan video ini:
- Teknik hook apa yang digunakan?
- Emosi apa yang mendominasi?
- Mengapa format ini efektif untuk engagement?
- Saran adaptasi untuk produk lain.

## FORMAT OUTPUT (JSON WAJIB)

Kembalikan HANYA JSON valid berikut, tanpa markdown code fences:

{
  "storyboard": [
    {
      "scene": 1,
      "timestamp": "00:00-00:03",
      "visual_description": "...",
      "emotional_hook": "...",
      "narration_transcript": "...",
      "camera_technique": "..."
    }
  ],
  "product_ideas": {
    "low_ticket": [
      {
        "product_name": "...",
        "category": "...",
        "reason": "...",
        "marketplace_search_query": "...",
        "estimated_price_range": "..."
      }
    ],
    "high_ticket": [
      {
        "product_name": "...",
        "category": "...",
        "reason": "...",
        "marketplace_search_query": "...",
        "estimated_price_range": "..."
      }
    ]
  },
  "viral_pattern_summary": "..."
}`;
}

// ========================
// V8.9: Multiplier Lab — Phase 2 Remake Prompt
// ========================

export function buildMultiplierPhase2Prompt(originalStoryboard, productDNA, aesthetics, bridging, vso, audio) {
  const targetLanguage = audio?.targetLanguage || 'id-ID';
  const languageName = targetLanguage === 'en-US' ? 'ENGLISH (US)' : 'INDONESIAN';

  const productName = productDNA?.product_name || "";
  const productUsp = productDNA?.unique_selling_point || "";
  const productDesc = productDNA?.product_description || "";

  const bridgeAtClip = Number(bridging?.bridgeAtClip) || 2;
  const bridgeDurationClips = bridging?.bridgeDurationClips !== undefined ? Number(bridging.bridgeDurationClips) : 1;
  const targetClipsCount = Number(bridging?.targetClipsCount) || 4;
  const productEndClip = (bridgeDurationClips > 0) ? (bridgeAtClip + bridgeDurationClips - 1) : targetClipsCount;
  const isBridgingActive = bridging?.isBridgingActive;
  const visualMode = bridging?.visualMode || 'pure_t2v';
  const productFilenameDeclare = bridging?.productFilenameDeclare || "";

  // Resolve VSO details using presets
  let vsoSection = "";
  if (vso?.isVsoActive) {
    const targetConcept = vso.characterConcept || "faceless";

    let wardrobeStyleVal = vso.wardrobeStyle;
    if (wardrobeStyleVal === 'random') {
      const keys = Object.keys(WARDROBE_PRESETS);
      wardrobeStyleVal = keys[Math.floor(Math.random() * keys.length)];
    }
    const targetWardrobe = WARDROBE_PRESETS[wardrobeStyleVal] || wardrobeStyleVal || "modest clothing";

    let lightingStyleVal = vso.lightingStyle;
    if (lightingStyleVal === 'random') {
      const keys = Object.keys(LIGHTING_PRESETS);
      lightingStyleVal = keys[Math.floor(Math.random() * keys.length)];
    }
    const targetLighting = LIGHTING_PRESETS[lightingStyleVal] || lightingStyleVal || "soft natural light";

    const targetCharacter = DEMOGRAPHIC_PRESETS[vso.subjectDemographic] || vso.subjectDemographic || "a graceful Muslimah";

    vsoSection = `
🚨 VISUAL SWAP OVERRIDES (VSO PRESET) MANDATE:
- Character Concept: ${targetConcept}
- Subject Demographic: ${targetCharacter}
- Hijab/Wardrobe Style: ${targetWardrobe}
- Lighting Ambiance: ${targetLighting}
- WARDROBE CONSISTENCY: The color, texture, and style of the wardrobe must be IDENTICAL across all visual prompts.
- LOCATION CONSISTENCY: The background setting (Environment/Location) must be uniform across all visual prompts. Do not switch locations abruptly between clips (e.g., stay within the same studio tabletop theme across all scenes).
`;
  }

  const productTruthVal = productDNA?.product_truth || productDNA?.clean_photo_t2i_prompt || productDNA?.t2i_prompt || "";
  const geometricTruthVal = productDNA?.geometric_truth || productDNA?.i2v_action_prompt || productDNA?.packaging_type || "";

  const productTruthLockSection = (productTruthVal || geometricTruthVal)
    ? `
🚨 MANDATORY PRODUCT TRUTH & GEOMETRIC TRUTH CONTRACT:
You MUST use the exact verified product physics below for all bridging clips (Clip ${bridgeAtClip} to ${Math.min(productEndClip, targetClipsCount)}). DO NOT HALLUCINATE OR ALTER THE PACKAGING SHAPE:
- MANDATORY PRODUCT TRUTH (T2I Start Frame): "${productTruthVal || 'Official registered product packaging'}"
- MANDATORY GEOMETRIC TRUTH (I2V Motion): "${geometricTruthVal || 'Authentic container shape & surface physics'}"
`
    : '';

  const targetAr = aesthetics?.aspectRatio || '9:16';
  const visualModeInstructions = visualMode === 'hybrid_lock'
    ? `
${productTruthLockSection}
🚨 VISUAL MODE: HYBRID LOCK (DOUBLE-PASS) & STRUCTURED LAYERED PROMPT MANDATE:
For clips within the product placement range (Clip ${bridgeAtClip} to ${Math.min(productEndClip, targetClipsCount)}):
- You MUST provide "t2i_prompt" (start frame image) and "i2v_prompt" (camera/subject motion).
- Do NOT fill "t2v_prompt" (leave it empty "").
- Use the declared filename "${productFilenameDeclare}" inside your "t2i_prompt" to refer to the product image reference.
- **t2i_prompt** MUST follow this structured layered format (written in English as a single line, NO newlines):
  (VERTICAL 9:16) --ar ${targetAr} --no landscape [LAYER 1: OPTICS] (Shot on [Camera Specs], [Lens Specs]), (Texture: [Film/Digital Physics]). [LAYER 2: SUBJECT & VISUAL TRUTH] (Anchor: [Subject Demographic]), (Wardrobe: [Hijab/Wardrobe Style]), (Product Truth: ${productTruthVal ? productTruthVal : `High fidelity photography of registered filename "${productFilenameDeclare}"`}, geometry_lock: DO NOT HALLUCINATE. Maintain exact aspect ratio, packaging shape, and label text. No morphing edges. Details: [Product geometry/label details] made of [Material Physics]). [LAYER 3: SCENE & LIGHT] (Environment: [Location/Setting]), (Lighting: [Lighting Mood/Ambiance]). [LAYER 4: KINETIC IMPLICATION] (Frozen Action: Subject is poised to [Action Verb/Pose]), (Micro-Expression: [Key Emotion/Vibe]).
- **i2v_prompt** MUST follow this structured layered format (written in English as a single line, NO newlines):
  (VERTICAL 9:16) --ar ${targetAr} --no landscape [LAYER 1: INPUT & TRUTH LOCK] (Start Frame: [Generated start frame image]), (Consistency: MAX). (Geometric Truth: ${geometricTruthVal ? geometricTruthVal : '[Consistency of subject/product]'}). [LAYER 2: MICRO-PACING & ACTION] ([00:00-00:02]): (Visual Action: [Kinetic Move]), ([00:02-00:04]): (Visual Action: [Kinetic Move]), ([00:04-00:06]): (Visual Action: [Kinetic Move]), ([00:06-00:08]): (Visual Action: [Kinetic Move] + [TRANSITION LOCK]). [LAYER 3: SFX] SFX: [SFX description, e.g. whoosh, ambient sizzle].

For clips outside this range (before Clip ${bridgeAtClip} or after Clip ${productEndClip}):
- Fill "t2v_prompt" using the structured layered format below, and leave "t2i_prompt" and "i2v_prompt" empty ("").
- **t2v_prompt** MUST follow this structured layered format (written in English as a single line, NO newlines):
  (VERTICAL 9:16) --ar ${targetAr} --no landscape [LAYER 0: VISUAL TRUTH & ANCHORS] (Geometric Truth: strictly no product shown), (Biometric Anchor: [Subject Demographic]), (Wardrobe: [Hijab/Wardrobe Style]). [LAYER 1: SCENE & OPTICS] (Location: [Setting]), (Lens: [Camera Spec]), (Camera Move: [Kinetic Move]), (Lighting: [Lighting Mood/Ambiance]). [LAYER 2: MICRO-PACING & ACTION] ([00:00-00:02]): (Visual Action: [Action]), ([00:02-00:04]): (Visual Action: [Action]), ([00:04-00:06]): (Visual Action: [Action]), ([00:06-00:08]): (Visual Action: [Action] + [TRANSITION LOCK]). [LAYER 3: SFX] SFX: [SFX description].
`
    : `
🚨 VISUAL MODE: PURE T2V & STRUCTURED LAYERED PROMPT MANDATE:
For ALL clips, fill "t2v_prompt" using the structured layered format below. Leave "t2i_prompt" and "i2v_prompt" empty ("").
- **t2v_prompt** MUST follow this structured layered format (written in English as a single line, NO newlines):
  (VERTICAL 9:16) --ar ${targetAr} --no landscape [LAYER 0: VISUAL TRUTH & ANCHORS] (Geometric Truth: [Shape consistency]), (Biometric Anchor: [Subject Demographic]), (Wardrobe: [Hijab/Wardrobe Style]). [LAYER 1: SCENE & OPTICS] (Location: [Setting]), (Lens: [Camera Spec]), (Camera Move: [Kinetic Move]), (Lighting: [Lighting Mood/Ambiance]). [LAYER 2: MICRO-PACING & ACTION] ([00:00-00:02]): (Visual Action: [Action]), ([00:02-00:04]): (Visual Action: [Action]), ([00:04-00:06]): (Visual Action: [Action]), ([00:06-00:08]): (Visual Action: [Action] + [TRANSITION LOCK]). [LAYER 3: SFX] SFX: [SFX description].
`;

  const narrativeMode = aesthetics?.narrativeMode || 'Storytelling';
  const visualStyle = aesthetics?.visualStyle || 'Cinematic';
  const faceVisibility = aesthetics?.faceVisibility || 'Faceless';
  const wordsPerClip = aesthetics?.wordsPerClip || '17-19 kata';

  const bridgingRules = isBridgingActive
    ? `
🚨 PRODUCT BRIDGING & ZONING RULES:
1. BEFORE clip ${bridgeAtClip}: Focus 100% on replicating the hook and storytelling of the original deconstructed storyboard. DILARANG KERAS (FORBIDDEN) to mention the product "${productName}" or pitch anything.
2. AT clip ${bridgeAtClip} (Pivot Point): Transition smoothly from the initial story/hook to the introduction of the product "${productName}".
3. PRODUCT PLACEMENT ZONE (Clip ${bridgeAtClip} to ${Math.min(productEndClip, targetClipsCount)}): Discuss the product's USP ("${productUsp}") and details.
${productEndClip < targetClipsCount ? `4. TRANSITION BACK ZONE (Clip ${productEndClip + 1} to ${targetClipsCount}): Return to the main story/hook or topic. DILARANG KERAS (FORBIDDEN) to mention the product "${productName}" or pitch anything here. Narasi harus kembali fokus 100% membahas, memperdalam, atau menyimpulkan pilar konten / topik utama.` : ''}
`
    : `
🚨 DIRECT PLACEMENT RULES (NO BRIDGING):
Adapt the entire storyboard flow to weave the product "${productName}" and its USP ("${productUsp}") seamlessly into the narrative from the very beginning.
`;

  const workflowSection = `
🚨 WORKFLOW & AUDIO SETTINGS:
- Voiceover (TTS): ${audio?.enableTts ? `Active (Provider: ${audio.voiceProvider || 'minimax'}, Persona: ${audio.voicePersona || 'Indonesian_SweetGirl'}, Speed: ${audio.voiceSpeed || 1.0}x)` : 'Inactive'}
- Video Generation (G-Labs): ${audio?.enableGlabs ? 'Active' : 'Inactive'}
- Smart-Sync Muxing (FFmpeg): ${audio?.enableFfmpeg ? `Active (Sync Option: ${audio.ffmpegSyncOption || 'smart_sync'})` : 'Inactive'}
- Target Language: ${languageName}
`;

  const isMiniMax = audio?.enableTts && audio?.voiceProvider === 'minimax';
  const ttsMandate = isMiniMax ? `\n${MINIMAX_MICRO_ACTING_MANDATE}\n` : "";

  return `Kamu adalah seorang Creative Director & Senior Copywriter di MAKNA Engine.
Tugas kamu adalah mengambil sebuah **Original Storyboard** (hasil dekonstruksi video viral) dan merekayasa ulang (remake) storyboard tersebut untuk mempromosikan **Produk Target Kami**.

---
### DATA PRODUK TARGET KAMI:
- Nama Produk: "${productName}"
- Deskripsi: "${productDesc}"
- Unique Selling Point (USP): "${productUsp}"

---
### ORIGINAL STORYBOARD (TEMPLATE):
${typeof originalStoryboard === 'string' ? originalStoryboard : JSON.stringify(originalStoryboard, null, 2)}

---
### ATURAN UTAMA GENERASI:
- **Jumlah Klip Remake (N)**: WAJIB menghasilkan tepat ${targetClipsCount} adegan/klip secara total. Ukuran array "storyboard" dan "prompts" pada JSON output harus memiliki persis ${targetClipsCount} elemen, tidak boleh kurang atau lebih.
- **Format Prompt Visual Terstruktur (Structured Layer)**: Semua prompt visual ("t2v_prompt", "t2i_prompt", "i2v_prompt") WAJIB mengikuti format layered ([LAYER ...]) sesuai petunjuk Visual Mode di bawah.
- **Mandat Satu Baris (Single Line Mandate)**: Setiap prompt visual WAJIB ditulis sebagai satu baris teks tunggal (Plain Text / copy-paste ready) TANPA mengandung karakter baris baru (newline / \n / enter) di dalam string JSON tersebut.
- **Narrative Mode**: ${narrativeMode}
- **Visual Style**: ${visualStyle}
- **Face Visibility**: ${faceVisibility}
- **Words per Clip Limit**: ${wordsPerClip}
- **Target Language (Naskah Voiceover)**: ${languageName} (Wajib menulis kolom naskah suara sepenuhnya dalam bahasa ${targetLanguage === 'en-US' ? 'English' : 'Bahasa Indonesia'} dengan gaya kasual/gaul/relatable).

${bridgingRules}

${vsoSection}

${visualModeInstructions}

${workflowSection}
${ttsMandate}
---
### FORMAT OUTPUT (WAJIB JSON VALID):
Kembalikan HANYA JSON valid dengan struktur berikut, tanpa dibungkus markdown code fences. Pastikan seluruh nilai prompt visual ("t2v_prompt", "t2i_prompt", "i2v_prompt") ditulis dalam SATU BARIS tunggal tanpa karakter newline/pindah baris:
{
  "storyboard": [
    {
      "scene": 1,
      "visual_description": "Deskripsi visual adegan remake (Bahasa Indonesia)...",
      "narration_transcript": "Naskah suara yang dibaca voiceover (Bahasa ${targetLanguage === 'en-US' ? 'Inggris' : 'Indonesia'}, maksimal sesuai Words per Clip)..."
    }
  ],
  "prompts": [
    {
      "scene": 1,
      "t2v_prompt": "(VERTICAL 9:16) --ar ${targetAr} --no landscape [LAYER 0: VISUAL TRUTH & ANCHORS] (Geometric Truth: ...), (Biometric Anchor: ...), (Wardrobe: ...). [LAYER 1: SCENE & OPTICS] (Location: ...), (Lens: ...), (Lighting: ...). [LAYER 2: MICRO-PACING & ACTION] ([00:00-00:02]): (Visual Action: ...), ([00:02-00:04]): (Visual Action: ...), ([00:04-00:06]): (Visual Action: ...), ([00:06-00:08]): (Visual Action: ...). [LAYER 3: SFX] SFX: ...",
      "t2i_prompt": "(VERTICAL 9:16) --ar ${targetAr} --no landscape [LAYER 1: OPTICS] (Shot on ...). [LAYER 2: SUBJECT & VISUAL TRUTH] (Anchor: ...), (Wardrobe: ...). [LAYER 3: SCENE & LIGHT] (Environment: ...). [LAYER 4: KINETIC IMPLICATION] (Frozen Action: ...)",
      "i2v_prompt": "(VERTICAL 9:16) --ar ${targetAr} --no landscape [LAYER 1: INPUT & TRUTH LOCK] (Start Frame: ...). [LAYER 2: MICRO-PACING & ACTION] ([00:00-00:02]): (Visual Action: ...), ([00:02-00:04]): (Visual Action: ...), ([00:04-00:06]): (Visual Action: ...), ([00:06-00:08]): (Visual Action: ...). [LAYER 3: SFX] SFX: ..."
    }
  ],
  "caption": "Teks caption media sosial baru yang menarik dengan hashtag..."
}`;
}

/**
 * Sanitize I2V prompt agar tidak melanggar content policy G-Labs.
 * Mengganti kata sensitif dengan padanan kata netral yang aman (synonym replacement).
 */
export function sanitizeI2vPrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') return prompt;

  let safe = prompt;

  // 1. Synonym replacements (Neutral Synonym Replacement)
  const synonyms = [
    { pattern: /\bmatcha\s+powder\b/gi, replacement: 'matcha tea' },
    { pattern: /\bpowder\b/gi, replacement: 'blend' },
    { pattern: /\bpouring\b/gi, replacement: 'dispensing' },
    { pattern: /\bpour\b/gi, replacement: 'flow' },
    { pattern: /\bpours\b/gi, replacement: 'flows' },
    { pattern: /\bdripping\b/gi, replacement: 'gliding' },
    { pattern: /\bdrip\b/gi, replacement: 'glide' },
    { pattern: /\bdrips\b/gi, replacement: 'glides' },
    { pattern: /\bfinger\b/gi, replacement: 'hand' },
    { pattern: /\bfingers\b/gi, replacement: 'hands' },
    { pattern: /\bwrist\b/gi, replacement: 'hand' },
    { pattern: /\bwrists\b/gi, replacement: 'hands' },
    { pattern: /\barm\b/gi, replacement: 'hand' },
    { pattern: /\barms\b/gi, replacement: 'hands' },
    { pattern: /\bforearm\b/gi, replacement: 'hand' },
    { pattern: /\bforearms\b/gi, replacement: 'hands' },
    { pattern: /\bcheers\b/gi, replacement: 'toast' },
    { pattern: /\bwhite\s+liquid\b/gi, replacement: 'creamy beverage' },
    { pattern: /\bthick\s+mixture\b/gi, replacement: 'velvet texture' },
    { pattern: /\bhigh-viscosity\b/gi, replacement: 'smooth texture' },
    { pattern: /\bviscosity\b/gi, replacement: 'texture' },
    { pattern: /\bliquid\s+transfer\b/gi, replacement: 'smooth flow' },
    { pattern: /\bviscous\b/gi, replacement: 'creamy' }
  ];

  synonyms.forEach(({ pattern, replacement }) => {
    safe = safe.replace(pattern, replacement);
  });

  // 2. Remove other remaining forbidden patterns
  const forbidden = [
    /hand[s]?\s+tilt[s]?/gi,
    /arm[s]?\s+(gently|slowly|carefully|move[s]?)/gi,
    /sprinkling|sprinkle[s]?/gi,
    /stream\s+of\s+liquid/gi,
    /liquid\s+(flow[s]?|falls?|drop[s]?)/gi,
    /drop[s]?\s+fall/gi,
    /tilting\s+the\s+(bottle|container|jar)/gi,
    /adding\s+(a\s+)?spoonful/gi,
    /pinch\s+of/gi,
    /mixing\s+(the|a)/gi,
    /dissolving/gi
  ];

  forbidden.forEach(pattern => {
    safe = safe.replace(pattern, '');
  });

  // 3. Remove accidental audio safety keywords from prompt (both positive and negative sections)
  const audioKeywords = [
    /\bmoaning\b/gi,
    /\bwet\s+sounds\b/gi,
    /\bsquishing\b/gi,
    /\bsighing\b/gi,
    /\bheavy\s+breathing\b/gi,
    /\bsigh\b/gi,
    /\bgasp\b/gi,
    /\bmoan\b/gi,
    /\bgroan\b/gi
  ];

  audioKeywords.forEach(pattern => {
    safe = safe.replace(pattern, '');
  });

  // Bersihkan spasi/koma ganda akibat penghapusan
  safe = safe.replace(/,\s*,/g, ',').replace(/\.\s*,/g, '.').replace(/\s{2,}/g, ' ').trim();

  // Pastikan masih ada konten bermakna — jika terlalu pendek, fallback ke camera-only prompt
  if (safe.replace(/\W/g, '').length < 30) {
    safe = '(VERTICAL 9:16) --ar 9:16 --no landscape [CAMERA MOTION] Slow Zoom In on product label, followed by Orbital Pan around the product, ending with Rack Focus from foreground to product center. Cinematic, professional studio lighting.';
  }

  return safe;
}

export function getPackagingInstruction(productData) {
  if (!productData) return '';
  const packagingType = String(productData.packaging_type || '').toLowerCase();
  const isInPackaging = productData.is_in_packaging === 1 || productData.is_in_packaging === true || ['jar', 'toples', 'pouch', 'botol', 'botol plastik', 'bottle'].includes(packagingType);

  if (isInPackaging && (
    packagingType.includes('jar') ||
    packagingType.includes('toples') ||
    packagingType.includes('pouch') ||
    packagingType.includes('botol') ||
    packagingType.includes('bottle')
  )) {
    return `\n* CRITICAL PACKAGING RULE (MANDATORY): Since the product is packaged in a ${packagingType || 'container'} (jar/pouch/bottle), the product MUST be retrieved using a spoon/scoop or measuring tool (disendok atau ditakar). DO NOT POUR the product directly from the packaging in any scene (jangan langsung dituang dari kemasan), as this is physically unnatural for this packaging. Make sure the visual description in the storyboard and visual prompts (T2V/T2I/I2V) specifies scooping, spooning, or measuring the product.`;
  }
  return '';
}

/**
 * Membangun prompt injektor untuk merajut produk ke dalam naskah lama
 * @param {string} originalScript - Teks naskah .md lama (3 klip)
 * @param {Object} productData - Data DNA Produk (Nama, Deskripsi, USP)
 * @param {string} customInstruction - Instruksi tambahan dari pengguna
 */
export function buildProductBridgingInjectorPrompt(originalScript, productData, customInstruction = '') {
  const refFilename = productData?.product_filename_declare
    || (productData?.clean_photo_url ? productData.clean_photo_url.split('/').pop() : '')
    || '';
  const refFilenameTag = refFilename
    ? `, (Product Reference File: '${refFilename}', geometry_lock: EXACT FILENAME MATCH — high-fidelity visual must match the attached reference photo)`
    : '';

  const customInstructionBlock = customInstruction ? `
---
INSTRUKSI KHUSUS PENGGUNA (USER CUSTOM INSTRUCTION):
Anda WAJIB mematuhi instruksi tambahan berikut dari pengguna saat merangkai voiceover, storyboard, serta merancang visual prompts (T2I & I2V):
"${customInstruction}"
` : '';

  return `
Anda adalah Copywriter Iklan Senior dan Aligner Narasi di MAKNA Engine V9.2.
Tugas Anda adalah membedah naskah video 3 klip yang asli di bawah ini, menyisipkan 1 klip promosi produk baru di posisi Klip 2, dan menyusun ulang naskah voiceover lengkap menjadi tepat 4 klip.
${customInstructionBlock}

---
NASKAH ASLI (3 KLIP / DAPAT BERUPA FORMAT DEKONSTRUKSI MD):
${originalScript}

---
DATA PRODUK TARGET:
- Nama Produk: "${productData.product_name}"
- Deskripsi: "${productData.product_description}"
- USP Utama  : "${productData.unique_selling_point}"
- Deskripsi Fisik/Visual (Product Truth): "${productData.key_visuals_extracted || 'Tidak ada deskripsi visual rill'}"
- Tipe Wadah/Kemasan: "${productData.packaging_type || 'Tidak ditentukan'}"
- Status Kemasan: "${productData.is_in_packaging ? 'Dalam kemasan' : 'Tidak dalam kemasan'}"
- Deklarasi Foto Studio Produk: "${refFilename || 'foto_studio_terdaftar.png'}" (Wajib diacu sebagai jangkar visual objek dalam prompt)
- Referensi Prompt Render Foto Asli: "${productData.clean_photo_t2i_prompt || 'Gunakan deskripsi fisik di atas'}"

---
ATURAN DETEKSI & PARSING NASKAH DEKONSTRUKSI (CRITICAL PARSING RULES):
Jika naskah asli di atas menggunakan format dekonstruksi terstruktur (memiliki judul bagian "## 🎙 Voiceover Script"), Anda WAJIB:
1. Cari bagian "## 🎙 Voiceover Script".
2. Ekstrak teks kutipan voiceover (VO) dari bawah sub-judul berikut:
   - "### Scene 1 (8s)" -> Gunakan teks ini sebagai isi dasar voiceover Klip 1.
   - "### Scene 2 (8s)" -> Gunakan teks ini sebagai isi dasar voiceover Klip 3 (geseran dari scene 2 lama).
   - "### Scene 3 (8s)" -> Gunakan teks ini sebagai isi dasar voiceover Klip 4 (geseran dari scene 3 lama).
3. Abaikan bagian lain seperti "## 📋 Storyboard", "## 🤖 T2V Prompts", "## 📸 T2I Prompts", "## 🎥 I2V Prompts", dan "## 📝 Captions" saat mengekstrak naskah voiceover lama, namun Anda wajib mempelajari bagian Storyboard/Visual Prompt pada Klip 1 dan Klip 2 lama untuk memahami:
   - Setting Lokasi/Latar Tempat (Environment): misal kamar tidur, dapur, jalan raya, taman kos-kosan, dsb.
   - Aktor/Karakter & Tangan: apakah ada aktor pria, wanita, tangan yang sedang memegang sesuatu, dsb.
   - Mood Visual & Pencahayaan: sore hari, lampu neon kamar, warm cozy kitchen, dsb.

Jika naskah asli berupa teks biasa tanpa heading "## 🎙 Voiceover Script", potong teks tersebut menjadi 3 bagian/klip secara logis dan pelajari kata kunci visual di dalamnya.

---
ATURAN EMOSI & MERAYUP (STRICT NARRATIVE LAWS):
1. KLIP 1 (Hook Asli): Anda WAJIB mempertahankan naskah dan emosi asli dari Klip 1. Dilarang merusak hook awal.
2. KLIP 2 (Klip Baru - Jembatan Produk):
   - Gunakan transisi halus (Pivot Point). Sambungkan bahasan dari Klip 1 ke penggunaan produk.
   - Sesuai ATURAN ANTI-BROSUR: Jangan sekadar mendikte spesifikasi produk. Hubungkan produk sebagai solusi/alat bantu dari masalah di Klip 1 secara kasual.
   - Durasi: Batasi panjang naskah tepat 18-22 kata (untuk durasi 8 detik).
3. KLIP 3 (Klip 2 Asli Geser): Sesuaikan awal kalimatnya agar mengalir logis setelah bahasan produk di Klip 2.
4. KLIP 4 (Klip 3 Asli Geser + CTA): Gabungkan resolusi cerita asli dengan Call to Action (CTA) yang mengajak penonton melirik keranjang kuning/link bio.

---
ATURAN GENERASI PROMPT VISUAL KLIP 2 (VISUAL CONTINUITY & PRODUCT TRUTH LAWS):
Anda harus menghasilkan deskripsi prompt visual \`clip2_t2i_prompt\` dan \`clip2_i2v_prompt\` dalam bahasa Inggris yang dinamis dan menyatu secara visual dengan cerita. DILARANG KERAS menggunakan templat statis seperti "centered on a clean studio tabletop, octane render style" jika itu tidak cocok dengan cerita!

1. **ATURAN KONSISTENSI KEMASAN (STRICT PACKAGING LOCK LAWS)**:
   - Anda WAJIB mengunci wujud fisik produk agar persis konsisten dengan foto produk aslinya (tidak boleh berubah warna kemasan, label, bentuk wadah, tulisan teks kemasan, atau tutup wadah).
   - Baca informasi "Deskripsi Fisik/Visual (Product Truth)" dan "Referensi Prompt Render Foto Asli" di atas secara saksama.
   - Di dalam \`clip2_t2i_prompt\`, jabarkan produk target tersebut dengan menyalin detail visual kemasan, warna wadah (misal: botol kaca coklat, pouch ziplock putih), warna label kemasan, tulisan merek, dan bentuk tutup dari referensi tersebut ke deskripsi prompt.
2. **Aturan Keselarasan Latar (Environment Continuity)**:
   - Klip 2 yang baru harus berlatar di **lokasi yang sama** dengan Klip 1. Jika Klip 1 berlatar di kamar kos yang agak berantakan, Klip 2 wajib berlatar di kamar kos yang sama. Jika Klip 1 di dapur berlampu temaram, Klip 2 wajib di dapur berlampu temaram.
2. **Aturan Interaksi & Aksi (Product Interaction vs. Packshot)**:
   - Hindari menampilkan produk berdiri sendirian secara pasif (iklan jadul).
   - Produk harus berinteraksi secara aktif atau dipegang. Contoh: "A close-up shot of a person's hand holding [Product Name]", "a woman placing [Product Name] on a wooden desk next to her laptop", "hands pouring [Product Name] into a mug", dsb. Sesuaikan dengan gender aktor/karakter yang muncul di Klip 1.
3. **Deskripsi T2I (\`clip2_t2i_prompt\`)**:
   - Tulis dalam bahasa Inggris.
   - Wajib mengikuti format terstruktur bertingkat (structured layer) berikut:
     "(VERTICAL 9:16) --ar 9:16 --no landscape [LAYER 0: VISUAL TRUTH & ANCHORS] (Geometric Truth: [detail fisik produk target seperti bentuk kemasan, label, warna]${refFilenameTag}), (Biometric Anchor: [tangan/karakter aktor yang berinteraksi dengan produk jika ada]). [LAYER 1: SCENE & OPTICS] (Location: [setting tempat yang konsisten dengan Klip 1]), (Lens: raw cinematic realism, 35mm lens, sharp focus), (Lighting: [pencahayaan yang cocok dengan cerita])."
   - Wajib sertakan nama produk target.
4. **Deskripsi I2V (\`clip2_i2v_prompt\`)**:
   - Tulis dalam bahasa Inggris.
   - Wajib mengikuti format terstruktur bertingkat (structured layer) 4 segmen micro-pacing (2 detik per segmen) berikut:
     "(VERTICAL 9:16) --ar 9:16 --no landscape [LAYER 1: INPUT & TRUTH LOCK] (Start Frame: clip2_t2i.png), (Consistency: MAX). [LAYER 2: MICRO-PACING & ACTION] ([00:00-00:02]): (Visual Action: [adegan aksi detik 0-2]), ([00:02-00:04]): (Visual Action: [adegan aksi detik 2-4]), ([00:04-00:06]): (Visual Action: [adegan aksi detik 4-6]), ([00:06-00:08]): (Visual Action: [adegan aksi detik 6-8] + [TRANSITION LOCK]). [LAYER 3: SFX] SFX: [suara efek suara yang cocok]"

---
FORMAT OUTPUT WAJIB (JSON VALID):
{
  "injected_vo_1": "Naskah VO Klip 1...",
  "injected_vo_2": "Naskah VO Klip 2 (Produk)...",
  "injected_vo_3": "Naskah VO Klip 3...",
  "injected_vo_4": "Naskah VO Klip 4...",
  "clip2_t2i_prompt": "(VERTICAL 9:16) --ar 9:16 --no landscape [LAYER 0: VISUAL TRUTH & ANCHORS] ...",
  "clip2_i2v_prompt": "(VERTICAL 9:16) --ar 9:16 --no landscape [LAYER 1: INPUT & TRUTH LOCK] ... [LAYER 2: MICRO-PACING & ACTION] ... [LAYER 3: SFX] ..."
}
  `;
}

/**
 * Prompt Builder for Strategic Campaign Single-Pass Generator (V10.0 Engine)
 */
export function buildStrategicCampaignPrompt(campaign, item, workflow, creativeKb, vsoDirectives, isolationMandate, bridgeRangeText) {
  const clipCount = item.target_clips_count || workflow.target_clips_count || 4;
  const langLabel = workflow.target_language === 'en-US' ? 'English (Global / US Market)' : 'Bahasa Indonesia (Lokal)';
  const audioSegDirective = workflow.enable_audio_segment 
    ? 'Diaktifkan. Setiap adegan WAJIB menyertakan array "voice_segments" berisi pembagian naskah dialog per beat (2-4 detik).' 
    : 'Disabled (Voiceover narasi tunggal per adegan)';
  const sfxDirective = workflow.sfx_setting === 'with_sfx' 
    ? 'Diaktifkan. Setiap adegan WAJIB menyertakan field "sfx_prompt" yang merinci efek suara sinematik pencetus emosi (misal: [SFX: Soft camera click, gentle swoosh, warm riser]).' 
    : 'Tanpa SFX (without_sfx)';
  const bridgingDirective = workflow.is_bridging_active 
    ? `Aktif (Sandwich Protocol). Sisipkan transisi produk pada ${bridgeRangeText} dari total ${clipCount} klip dengan Gaya Promosi "${workflow.promotion_style || 'Softselling'}".` 
    : 'Tidak Aktif (Murni Edukasi / Storytelling)';

  const toneInstruction = getToneDemographicInstruction(workflow.target_demographic, workflow.target_demographic_custom);

  return `
Kamu adalah Creative Production Engine MAKNA Engine.
Tugasmu adalah mentransformasikan 1 Strategic Campaign Item menjadi Paket Produksi Kreatif Lengkap yang terdiri dari persis ${clipCount} adegan (scenes/clips).

KNOWLEDGE BASE STRATEGIS & KREATIF:
${creativeKb}
${vsoDirectives}
${isolationMandate}

${MANDATORY_TRUTH_NARRATIVE_RULE}

${toneInstruction ? `## GAYA BAHASA & TARGET DEMOGRAFI AUDIENS\n${toneInstruction}\n` : ''}

INSTRUKSI KONFIGURASI PROFIL PRODUK & KAMPANYE:
- Produk: ${item.product}
- Deskripsi Produk: ${campaign.product_description}
- USP Produk: ${campaign.product_usp}
- Deklarasi Foto Studio Produk: "${workflow.product_filename_declare || 'foto_studio_terdaftar.png'}" (Wajib diacu sebagai jangkar visual objek dalam t2i_prompt dan i2v_prompt)
- Bahasa Naskah (Script Language): ${langLabel}
- Batasan Kata per Klip: ${workflow.words_per_clip || '15-16 kata'}
- Audio Segmenting per Beat: ${audioSegDirective}
- Aturan Sound Effect (SFX): ${sfxDirective}
- Product Bridging Protocol: ${bridgingDirective}
- Visual Framing (Face Visibility): ${workflow.face_visibility || 'Faceless'} (${workflow.face_visibility === 'Faceless' ? 'Framing dari siku ke bawah, hanya lengan/tangan. DILARANG keras menampilkan wajah/kepala.' : ''})
- Visual Style & Mode: ${workflow.visual_style || 'Cinematic'} (${workflow.visual_mode || 'hybrid_lock'})
- Custom Instruction: "${workflow.custom_instruction || '-'}"

STRATEGI TERKUNCI (DILARANG UBAH):
- Pillar: ${item.pillar}
- Category CEP: ${item.category_cep}
- W'S Matrix: ${item.ws_matrix}
- Context: ${item.context}
- VFO: ${item.vfo}
- Strategic Angle: ${item.strategic_angle}
- Planner Hook: ${item.hook}
- Planner Visual Action: ${item.visual_action}
- Jumlah Klip Target: ${clipCount} klip (setiap klip berdurasi ~8 detik)

ATURAN GENERASI STORYBOARD:
1. Klip 1 (Hook): Wajib berfokus menahan retensi 3-5 detik pertama sesuai Planner Hook (scene_function: "hook").
${workflow.is_bridging_active 
  ? `2. Klip Bridging Produk (${bridgeRangeText}): Sisipkan transisi produk secara presisi pada ${bridgeRangeText} sesuai Gaya Promosi "${workflow.promotion_style || 'Softselling'}" (scene_function: "bridging").` 
  : `2. Klip Murni Edukasi: Semua klip berfokus pada penyampaian edukasi & cerita secara murni.`
}
3. Klip Edukasi / CTA (Klip Lainnya): Berfokus pada pilar edukasi dan penutup aksi visual produk (scene_function: "educational" atau "cta").
3.5 MANDATORY WARDROBE CONSISTENCY LOCK (100% UNIFIED WARDROBE ACROSS ALL CLIPS):
    Warna, tekstur, bahan, dan motif dari wardrobe/pakaian subjek HARUS IDENTIK 100% di SELURUH adegan (Klip 1 s/d ${clipCount}) pada item kampanye ini.
    - DILARANG KERAS mengganti warna baju, warna hijab/jilbab, atau motif pakaian antar adegan.
    - Pada bagian "(Wardrobe: [English Wardrobe details])" di Layer 2 t2i_prompt setiap klip, WAJIB menyertakan deskripsi warna dan gaya wardrobe yang PERSIS SAMA.
4. KETENTUAN ANATOMI FORMAT PROMPT VISUAL (MANDATORI 100% BAHASA INGGRIS / ENGLISH ONLY):
   - "t2i_prompt": WAJIB 100% BERBAHASA INGGRIS (ENGLISH ONLY) berupa 1 Paragraf Teks Polos berstruktur 4-Layer System:
     (VERTICAL 9:16) --ar 9:16 --no landscape [LAYER 1: OPTICS] (Shot on Phase One XF IQ4 (150MP), 100mm Macro lens, fine organic grain). [LAYER 2: SUBJECT & VISUAL TRUTH] (Anchor: [English Subject & Demographic description]), (Wardrobe: [English Wardrobe details]), (Product Truth: High fidelity raw photography of source file '${workflow.product_filename_declare || 'foto_studio_terdaftar.png'}' geometry_lock: DO NOT HALLUCINATE. Maintain exact aspect ratio and label text. No morphing edges. Material Physics: ...). [LAYER 3: SCENE & LIGHT] (Environment: [English Location details]), (Lighting: [English Light sources & color grade]). [LAYER 4: KINETIC IMPLICATION] (Frozen Action: [English frozen moment description])

   - "i2v_prompt": WAJIB 100% BERBAHASA INGGRIS (ENGLISH ONLY - DILARANG KERAS MENGGUNAKAN BAHASA INDONESIA PADA PROMPT I2V. DILARANG KERAS MENGHASILKAN OBJEK JSON / NESTED OBJECT). WAJIB berfokus pada gerakan mikro kamera halus (cinematic slow dolly zoom, subtle hand balance, steady ambient lighting) yang mengikat presisi pada Start Frame T2I. DILARANG KERAS (FORBIDDEN) meminta aksi fisik ekstrem yang merubah bentuk fisik produk (seperti tangan baru masuk dari luar layar atau membuka kemasan utuh):
     (VERTICAL 9:16) --ar 9:16 --no landscape [LAYER 1: INPUT & TRUTH LOCK] (Start Frame Reference: CLIP_N_START_FRAME.png), (Consistency: MAX). [LAYER 2: MICRO-PACING & ACTION] ([00:00-00:02]): (Visual Action: [Cinetic camera/hand motion]), ([00:02-00:04]): (Visual Action: [Micro camera move]), ([00:04-00:06]): (Visual Action: [Micro motion]), ([00:06-00:08]): (Visual Action: [Micro motion]).${workflow.sfx_setting === 'with_sfx' ? ' [LAYER 3: SFX] [SFX: English sound effect details]' : ''}

5. KETENTUAN RECORDING STORYBOARD & SOCIAL MEDIA PACKAGE:
   - "duration_seconds": 8
   - "scene_function": string ("hook", "bridging", "educational", "cta")
   - "visual_action": string (deskripsi aksi & pergerakan kamera Bahasa Indonesia)
   - "voice_over": string (naskah suara per klip dalam ${langLabel})
   - "on_screen_text": string (teks di layar)
   - "negative_prompt": string (kualitas buruk, distortion, dll.)
   ${workflow.sfx_setting === 'with_sfx' ? '- "sfx_prompt": string (detail efek suara sinematik per klip)' : ''}
   ${workflow.enable_audio_segment ? '- "voice_segments": array [ { "character_id": "narrator", "text": "..." } ] (pembagian dialog per 2-4 detik)' : ''}

Format Output WAJIB berupa JSON Object:
{
  "campaign_item_id": "${item.id}",
  "creative_direction": {
    "pillar": "${item.pillar}",
    "final_hook": "${item.hook}",
    "narrative_mode": "${item.narrative_mode || workflow.narrative_mode || 'Storytelling'}",
    "core_message": "..."
  },
  "storyboard": [
    // Array berisi persis ${clipCount} objek adegan
  ],
  "voice_over": {
    "master_vo": "..."
  },
  "caption": "Naskah Universal Social Media Caption (terdiri dari Hook menarik, Value delivery, CTA universal, dan Hashtags relevan) dalam ${langLabel}...",
  "social_media_package": {
    "caption": "Naskah Universal Social Media Caption yang sama...",
    "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5"],
    "call_to_action": "Kalimat CTA penutup..."
  }
}
  `;
}

/**
 * Prompt to extract Product Truth and Geometric Truth for products in a batch.
 * @param {Array<Object>} productsArray - Array of product objects
 * @returns {string}
 */
export function buildBatchProductTruthsPrompt(productsArray) {
  return `Anda adalah seorang AI Video Director dan Product Specialist di MAKNA Creative Studio.

Tugas Anda adalah merumuskan **Product Truth (T2I Physics & Packaging Lock)** dan **Geometric Truth (I2V Geometry & Material Lock)** untuk sekumpulan produk berdasarkan data deskripsi dan USP-nya.

DEFINISI BAKU & PETUNJUK:

1. **Product Truth (T2I Physics & Packaging Lock)**:
   - Deskripsi detail wujud fisik kemasan/poduk yang tampak dari luar.
   - Harus memuat aspek-aspek yang harus dijaga agar Text-to-Image (T2I) stabil: warna dominan kemasan, letak logo, tulisan utama kemasan, jenis tutup, aksen warna penting, dll.
   - Tujuan: Menjadi pedoman agar gambar AI tetap setia pada produk asli dan tidak menghasilkan tulisan typo/cacat.
   - Format: Berupa 3-4 kalimat deskriptif yang padat dan fokus pada visual kemasan/produk.

2. **Geometric Truth (I2V Geometry & Material Lock)**:
   - Deskripsi struktur 3 dimensi dan material penyusun produk.
   - Harus memuat bentuk geometris wadah (misal: botol silinder tegak, toples bulat pipih, wadah tube persegi) dan sifat permukaan/refleksi materialnya (misal: kaca transparan tebal, plastik matte doff, aluminium mengkilap glossy, cairan kental berwarna merah).
   - Tujuan: Menjadi pedoman agar saat Image-to-Video (I2V) menggerakkan objek tersebut, AI memahami sifat fisika gerak benda dan pembiasan cahaya yang logis.
   - Format: Berupa 2-3 kalimat deskriptif yang fokus pada struktur 3D dan tekstur material.

ATURAN MUTLAK BAHASA:
- Hasil rumusan "product_truth" dan "geometric_truth" **WAJIB ditulis sepenuhnya dalam Bahasa Inggris (English)**. Hal ini sangat krusial agar deskripsi fisik dan geometris tersebut dapat dibaca dan dipahami langsung oleh model T2I (Text-to-Image) dan I2V (Image-to-Video) internasional yang kita gunakan di pipeline visual generator.

[DAFTAR DATA PRODUK]
${JSON.stringify(productsArray, null, 2)}

Kembalikan respon hanya dalam bentuk JSON valid dengan format array "extracted_truths" yang berisi objek dengan format:
{
  "extracted_truths": [
    {
      "id": "id_produk_dari_input",
      "product_truth": "Isi rumusan Product Truth...",
      "geometric_truth": "Isi rumusan Geometric Truth..."
    }
  ]
}`;
}