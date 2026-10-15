import fs from 'fs';
import path from 'path';
import { getGeminiModel } from './gemini.js';
import { parseGeminiJSON } from './json-parser.js';
import { getDb } from './db.js';

/**
 * Returns list of available niche KBs in the kb/ directory with human-readable labels
 */
export function getAvailableNicheKBs() {
  const kbDir = path.join(process.cwd(), 'kb');
  const knownNiches = [
    { file: 'HERBAL_CONTENT_KB.md', id: 'HERBAL_CONTENT_KB.md', label: '🌿 Resep Herbal, Jamu & Pengobatan Tradisional', default: true },
    { file: 'Food Styling & Photography KB.md', id: 'Food Styling & Photography KB.md', label: '🍳 Food Styling, Kuliner & Fotografi Makanan' },
    { file: 'KITCHEN_CONTENT_KB.md', id: 'KITCHEN_CONTENT_KB.md', label: '🔪 Dapur, Alat Masak & Tips Rumah Tangga' },
    { file: 'HOME_IMPROVEMENT_KB.md', id: 'HOME_IMPROVEMENT_KB.md', label: '🏠 Perbaikan Rumah, Dekorasi & DIY' },
    { file: 'ISLAMIC_HISTORY_CONTENT_KB.md', id: 'ISLAMIC_HISTORY_CONTENT_KB.md', label: '🕌 Kisah Sejarah Islam & Inspirasi Religi' },
    { file: 'HISTORY_CONTENT_KB.md', id: 'HISTORY_CONTENT_KB.md', label: '📜 Sejarah Dunia, Tokoh & Peradaban' },
    { file: 'PET_CONTENT_KB.md', id: 'PET_CONTENT_KB.md', label: '🐾 Hewan Peliharaan & Tips Kucing/Anjing' },
    { file: 'COMPLIANCE_GUIDE.md', id: 'COMPLIANCE_GUIDE.md', label: '🛡️ Standar Kepatuhan & Safe Claim Global' }
  ];

  return knownNiches.filter(n => fs.existsSync(path.join(kbDir, n.file))).map(n => ({
    id: n.id,
    file: n.file,
    filename: n.file,
    label: n.label,
    default: !!n.default
  }));
}

/**
 * Get previously generated angles/topics for a blueprint to build negative constraints
 */
export async function getExcludedAnglesHistory(blueprintId) {
  if (!blueprintId) return [];
  const db = getDb();
  try {
    let rows = [];
    try {
      rows = await db.prepare(
        `SELECT bridging_config_json, new_caption, remake_storyboard_json 
         FROM re_multiplier_tasks 
         WHERE deconstruct_asset_id = ? 
         ORDER BY created_at DESC LIMIT 30`
      ).all(blueprintId);
    } catch (queryErr) {
      if (queryErr.message?.includes('tenant_id')) {
        rows = await db.prepare(
          `SELECT bridging_config_json, new_caption, remake_storyboard_json 
           FROM re_multiplier_tasks 
           WHERE deconstruct_asset_id = ? 
           LIMIT 30`
        ).all(blueprintId);
      } else {
        throw queryErr;
      }
    }

    const excluded = [];
    rows.forEach(r => {
      if (r.bridging_config_json) {
        try {
          const cfg = typeof r.bridging_config_json === 'string' ? JSON.parse(r.bridging_config_json) : r.bridging_config_json;
          if (cfg.angleTitle && !excluded.includes(cfg.angleTitle)) excluded.push(cfg.angleTitle);
          if (cfg.hookText && !excluded.includes(cfg.hookText)) excluded.push(cfg.hookText);
        } catch (_) {}
      }
      if (r.new_caption && !excluded.includes(r.new_caption)) excluded.push(r.new_caption);
      if (r.remake_storyboard_json) {
        try {
          const sb = typeof r.remake_storyboard_json === 'string' ? JSON.parse(r.remake_storyboard_json) : r.remake_storyboard_json;
          const firstVo = sb[0]?.voice_over || sb[0]?.narration || '';
          if (firstVo && !excluded.includes(firstVo)) excluded.push(firstVo);
        } catch (_) {}
      }
    });

    return excluded.slice(0, 25);
  } catch (err) {
    console.warn('[Multiplier Angle Generator] Warning reading angle history:', err.message);
    return [];
  }
}

/**
 * Ekstraksi DNA Blueprint (subjek, niche, bahan baku visual, proses) secara dinamis
 * agar generator sudut pandang dan resep selalu terikat 100% pada visual blueprint.
 */
export function extractBlueprintAnchorDNA(blueprint = {}, originalStoryboard = []) {
  const sb = Array.isArray(originalStoryboard) ? originalStoryboard : [];
  const allText = [
    blueprint.viral_pattern_summary || '',
    blueprint.original_caption || '',
    ...sb.map(s => `${s.visual_description || s.scene_summary || s.t2v_prompt || ''} ${s.narration_transcript || s.voice_over || s.narration || ''}`)
  ].join(' ').toLowerCase();

  let detectedNiche = 'culinary_general';
  let nicheLabel = 'Kuliner & Kreasi Makanan';
  let recommendedKb = 'Food Styling & Photography KB.md';

  // Deteksi niche spesifik berdasarkan konten teks dan visual adegan
  if (
    allText.includes('chia') ||
    allText.includes('protein') ||
    allText.includes('diet') ||
    allText.includes('ngidam') ||
    allText.includes('gula darah') ||
    allText.includes('kalori') ||
    allText.includes('fitness') ||
    allText.includes('workout') ||
    allText.includes('peanut butter') ||
    allText.includes('selai kacang') ||
    allText.includes('almond milk') ||
    allText.includes('susu almond') ||
    allText.includes('overnight') ||
    allText.includes('oatmeal') ||
    allText.includes('toples')
  ) {
    detectedNiche = 'health_nutrition';
    nicheLabel = 'Health & Fitness Nutrition / Diet Prep';
    recommendedKb = 'HERBAL_CONTENT_KB.md';
  } else if (
    allText.includes('es krim') ||
    allText.includes('alpukat') ||
    allText.includes('pisang beku') ||
    allText.includes('dessert') ||
    allText.includes('smoothie') ||
    allText.includes('gelato') ||
    allText.includes('sorbet') ||
    allText.includes('buah beku') ||
    allText.includes('yogurt')
  ) {
    detectedNiche = 'healthy_dessert';
    nicheLabel = 'Dessert Sehat & Olahan Buah';
    recommendedKb = 'Food Styling & Photography KB.md';
  } else if (
    allText.includes('jahe') ||
    allText.includes('kunyit') ||
    allText.includes('serai') ||
    allText.includes('temulawak') ||
    allText.includes('jamu') ||
    allText.includes('rebusan') ||
    allText.includes('seduhan') ||
    allText.includes('herbal') ||
    allText.includes('rimpang') ||
    allText.includes('wedang')
  ) {
    detectedNiche = 'herbal_wellness';
    nicheLabel = 'Herbal, Rempah & Jamu Tradisional';
    recommendedKb = 'HERBAL_CONTENT_KB.md';
  } else if (
    allText.includes('dapur') ||
    allText.includes('alat') ||
    allText.includes('pisau') ||
    allText.includes('wajan') ||
    allText.includes('talenan') ||
    allText.includes('bersih') ||
    allText.includes('kitchen')
  ) {
    detectedNiche = 'kitchen_home';
    nicheLabel = 'Dapur & Kebutuhan Rumah Tangga';
    recommendedKb = 'KITCHEN_CONTENT_KB.md';
  }

  // Ekstraksi bahan baku visual dari adegan storyboard
  const extractedIngredients = [];
  const ingredientKeywords = [
    'chia seed', 'chia', 'selai kacang', 'peanut butter', 'bubuk kakao', 'cocoa', 'susu almond', 'almond milk',
    'alpukat', 'avocado', 'pisang', 'banana', 'greek yogurt', 'yogurt', 'lemon', 'pistachio',
    'jahe', 'kunyit', 'serai', 'temulawak', 'kayu manis', 'cengkeh', 'madu', 'honey',
    'oat', 'oatmeal', 'susu', 'milk', 'keju', 'cheese', 'telur', 'egg', 'bawang', 'garlic', 'chili', 'cabai'
  ];

  ingredientKeywords.forEach(kw => {
    if (allText.includes(kw) && !extractedIngredients.includes(kw)) {
      extractedIngredients.push(kw);
    }
  });

  return {
    detectedNiche,
    nicheLabel,
    recommendedKb,
    extractedIngredients,
    sceneCount: sb.length
  };
}

/**
 * Generates dynamic, high-RPM viral angles for Multiplier Lab Non-Product Campaigns
 */
export async function generateDynamicMultiplierAngles({
  blueprintId,
  blueprintIds = [],
  mode = '1_to_multi', // '1_to_multi' | 'multi_to_1'
  nicheKbName = null, // dynamic fallback to detected Blueprint anchor KB if null
  angleCount = 5,
  customTheme = '',
  tenantId = 'default_tenant'
}) {
  const db = getDb();
  const kbDir = path.join(process.cwd(), 'kb');

  // 1. Read Strategic Core Knowledge Bases
  let strategicFramework = '';
  let realistViral = '';
  let ctaRules = '';
  try {
    if (fs.existsSync(path.join(kbDir, 'STRATEGIC_FRAMEWORKS_v47.9.md'))) {
      strategicFramework = fs.readFileSync(path.join(kbDir, 'STRATEGIC_FRAMEWORKS_v47.9.md'), 'utf8');
    }
    if (fs.existsSync(path.join(kbDir, 'REALIST_VIRAL_NARRATIVE_v47.9.md'))) {
      realistViral = fs.readFileSync(path.join(kbDir, 'REALIST_VIRAL_NARRATIVE_v47.9.md'), 'utf8');
    }
    if (fs.existsSync(path.join(kbDir, 'CTA_RULES.md'))) {
      ctaRules = fs.readFileSync(path.join(kbDir, 'CTA_RULES.md'), 'utf8');
    }
  } catch (kbErr) {
    console.warn('[Multiplier Angle Generator] Warning reading core KBs:', kbErr.message);
  }

  // 2. Fetch Blueprint Assets Data First
  let blueprintDataList = [];
  if (mode === 'multi_to_1' && blueprintIds && blueprintIds.length > 0) {
    const placeholders = blueprintIds.map(() => '?').join(',');
    blueprintDataList = await db.prepare(
      `SELECT id, source_url, source_url AS original_video_url, original_storyboard_json, viral_pattern_summary, original_caption, created_at 
       FROM re_deconstructed_assets WHERE id IN (${placeholders})`
    ).all(...blueprintIds);
  } else if (blueprintId) {
    const bp = await db.prepare(
      `SELECT id, source_url, source_url AS original_video_url, original_storyboard_json, viral_pattern_summary, original_caption, created_at 
       FROM re_deconstructed_assets WHERE id = ?`
    ).get(blueprintId);
    if (bp) blueprintDataList = [bp];
  }

  if (blueprintDataList.length === 0) {
    throw new Error('Blueprint referensi tidak ditemukan. Pastikan blueprintId valid.');
  }

  // 3. Parse Blueprint Visual Context & Scenes & Extract Anchor DNA
  const primaryBp = blueprintDataList[0];
  let originalStoryboard = [];
  try {
    originalStoryboard = JSON.parse(primaryBp.original_storyboard_json || '[]');
  } catch (_) {}

  const anchorDNA = extractBlueprintAnchorDNA(primaryBp, originalStoryboard);

  // 4. Read Selected or Auto-Detected Niche KB
  const selectedNicheKb = nicheKbName || anchorDNA.recommendedKb || 'HERBAL_CONTENT_KB.md';
  let nicheKbContent = '';
  if (selectedNicheKb && fs.existsSync(path.join(kbDir, selectedNicheKb))) {
    nicheKbContent = fs.readFileSync(path.join(kbDir, selectedNicheKb), 'utf8');
  }

  // 5. Ingest Historical Excluded Angles for Zero-Repetition
  const targetBpId = blueprintDataList[0].id;
  const excludedAngles = await getExcludedAnglesHistory(targetBpId);

  const sceneSummaries = originalStoryboard.map((s, idx) => {
    return `Scene ${idx + 1}: Visual: "${s.visual_description || s.scene_summary || s.t2v_prompt || 'Visual adegan'}" | Original VO: "${s.voice_over || s.narration || s.narration_transcript || ''}"`;
  }).join('\n');

  // 6. Build Multi-Axis Prompt for Gemini AI
  const requestedCount = Math.min(Math.max(parseInt(angleCount, 10) || 5, 3), 10);

  const prompt = `
Anda adalah Chief Viral Strategist & Retention Algorithm Expert kelas dunia untuk Facebook Content Monetization (Reels & In-Stream Ads) di MAKNA Flow.

TUGAS ANDA:
Menganalisis aset Visual Blueprint referensi di bawah ini dan menghasilkan **${requestedCount} SUDUT PANDANG (EDITORIAL ANGLES) YANG 100% UNIK, SANGAT VARIATIF, DAN VIRAL-OPTIMIZED** untuk kampanye video non-produk (organik murni).

---

## 📄 DATA VISUAL BLUEPRINT REFERENSI (SOURCE DNA)
- Blueprint ID: ${primaryBp.id}
- Niche Terdeteksi: ${anchorDNA.nicheLabel} (${anchorDNA.detectedNiche})
- Total Adegan/Scene: ${originalStoryboard.length || 3} Scene
${anchorDNA.extractedIngredients.length > 0 ? `- Bahan Baku Pokok Visual: ${anchorDNA.extractedIngredients.join(', ')}\n` : ''}${primaryBp.viral_pattern_summary ? `- Pola Hook/Viral Asli: ${primaryBp.viral_pattern_summary}\n` : ''}- Rincian Adegan Visual & Voiceover Asli:
${sceneSummaries || 'Adegan pembuatan/resep sesuai visual asli video blueprint.'}

${customTheme ? `## 🎯 CUSTOM THEME / ARAH TOPIK DARI PENGGUNA:\n"${customTheme}"\n` : ''}

---

## 🔒 MANDAT KESINAMBUNGAN KETAT BLUEPRINT (STRICT NICHE & ENTITY CONTINUITY):
1. **KUNCI SUBJEK & NICHE ASLI (DILARANG KERAS BERPINDAH TOPIK / PRODUK)**:
   - Niche Terdeteksi dari Blueprint: "${anchorDNA.nicheLabel}".
   - SELURUH ${requestedCount} sudut pandang (editorial angles) yang Anda ciptakan WAJIB 100% berada dalam NICHE YANG SAMA dan MEMBAHAS SUBJEK/HIDANGAN YANG SAMA dengan Blueprint!
   - JIKA Blueprint membahas [Puding Chia Cokelat / Resep Health & Diet], maka SELURUH angle harus tetap seputar puding chia cokelat sehat tersebut (misal: sudut pandang pemuas ngidam manis malam tanpa lonjakan gula darah, sudut pandang protein booster gym/workout, sudut pandang sarapan toples kenyang 6 jam, sudut pandang ramah lambung). DILARANG KERAS melompat ke rebusan jamu rimpang ataupun memanggang kue oven!
   - JIKA Blueprint membahas [Es Krim Alpukat / Healthy Dessert], maka SELURUH angle harus tetap variasi seputar es krim alpukat tersebut (misal: sudut pandang camilan anak bebas susu sapi, sudut pandang diet bebas gula pasir, trik penyelamat alpukat kematangan). DILARANG KERAS melompat ke jamu rebusan!
   - JIKA Blueprint membahas [Herbal Jamu], maka barulah seluruh angle membahas racikan herbal/jamu tersebut.
2. **DIVERSIFIKASI HANYA PADA PERSPEKTIF AUDIENS (BUKAN MENGGANTI BAHAN POKOK VISUAL)**:
   - Semua angle menggunakan rekaman visual dan bahan baku yang sama persis dengan yang ada di blueprint.
   - Variasi yang Anda buat HANYA berupa perbedaan target persona (pejuang diet, ibu rumah tangga, pekerja sibuk/lembur, pegiat gym), momen konsumsi (malam hari, sarapan kilat, pasca olahraga), dan formula hook emosional.

---

## 🛡️ ATURAN ANTI-DUPLIKASI KETAT (ZERO-REPETITION MANDATE):
DILARANG KERAS mengulangi atau membuat sudut pandang yang mirip/bersinggungan dengan riwayat sudut pandang berikut yang SUDAH PERNAH DIBUAT sebelumnya:
${excludedAngles.length > 0 ? excludedAngles.map((ex, i) => `${i + 1}. "${ex}"`).join('\n') : '(Belum ada riwayat sebelumnya. Pastikan semua variasi yang dihasilkan saling berbeda tajam satu sama lain).'}

---

## 🧬 PANDUAN STRATEGIS & FORMULA HOOK (DARI KNOWLEDGE BASE):
${strategicFramework ? `### 1. STRATEGIC FRAMEWORKS:\n${strategicFramework.slice(0, 1500)}...\n` : ''}
${realistViral ? `### 2. REALIST VIRAL NARRATIVE & HOOK RULES:\n${realistViral.slice(0, 1200)}...\n` : ''}
${ctaRules ? `### 3. CTA RETENTION RULES:\n${ctaRules.slice(0, 800)}...\n` : ''}
${nicheKbContent ? `### 4. NICHE DOMAIN GUIDELINES (${selectedNicheKb}):\n${nicheKbContent.slice(0, 1500)}...\n` : ''}

---

## 📐 MATRIKS 5-SUMBU PERMUTASI (WAJIB DIVERSIFIKASI SESUAI TOPIK):
Setiap angle yang Anda ciptakan WAJIB mengambil kombinasi sumbu yang berbeda sesuai niche "${anchorDNA.nicheLabel}":
1. **Sumbu Persona**: Sesuaikan dengan niche (misal: Pekerja sibuk/lembur butuh praktis, Pejuang defisit kalori/diet sehat, Ibu rumah tangga cari menu sehat keluarga, Pegiat kebugaran/gym, Lansia/pemerhati gula darah).
2. **Sumbu Momen/Waktu**: Sesuai konteks konsumsi hidangan (misal: Ngidam manis jam 10 malam, Sarapan kilat sebelum macet-macetan, Camilan sore saat energi drop, Pasca workout/olahraga, Akhir pekan santai).
3. **Sumbu Format Hook (0-3 Detik)**:
   - Challenge/Gamification ("Coba rutinkan 7 hari...")
   - Problem-Agitation-Solution ("Tiap malam tersiksa pengen yang manis-manis tapi takut timbangan...")
   - Curiosity Secret / Myth Buster ("Siapa bilang makanan sehat itu hambar dan ribet?...")
   - ASMR & Visual Satisfaction ("Suara toples dikocok / blender berputar...")
   - Direct Benefit / Habit Replacement ("Ganti camilan tinggi gula dengan racikan toples ini...")
4. **Sumbu Emosi**: Divalidasi rasa bersalahnya, Solusi mudah tanpa ribet, Ketenangan kesehatan jangka panjang, Kepuasan rasa lezat tanpa bersalah.
5. **Sumbu CTA Bait (Algoritma Facebook Booster)**: Komen kata kunci pendek ("RESEP", "MAU", "IKUTAN", "SEHAT"), Share ke keluarga/sahabat, atau Save untuk menu besok.

---

## 📤 FORMAT OUTPUT (WAJIB STRICT VALID JSON ARRAY):
Kembalikan respons HANYA berupa JSON Array murni tanpa markdown pembungkus di luar JSON:

[
  {
    "angle_id": "ang_1",
    "title": "Judul Angle Singkat & Menarik (Maks 10 Kata)",
    "hook_type": "Challenge 7 Hari | Problem-Agitation | Curiosity Gap | Cozy ASMR | Direct Habit",
    "target_persona": "Target Audiens Spesifik",
    "emotional_trigger": "Emosi & Masalah Utama yang Disentuh",
    "hook_text": "Naskah Hook 0 - 3 Detik Pertama (Wajib sangat kuat & memikat)",
    "vo_preview": "Draft kelanjutan naskah Voice-Over Scene 2 & 3 yang sinkron dengan visual blueprint",
    "recommended_voice": "Warm Mentor | Cozy ASMR Whisper | Energetic Inspiring | Wise Storyteller",
    "cta_type": "Komen 'IKUTAN' | Share ke teman | Simpan video ini",
    "estimated_retention": "High (Target 85% 3s Retention)"
  }
]
`;

  // 7. Call Gemini Model
  const model = await getGeminiModel();
  const response = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 4096
    }
  });

  const responseText = response.response.text();
  const parsed = parseGeminiJSON(responseText);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Gemini AI gagal menghasilkan format list sudut pandang (angles). Silakan coba lagi.');
  }

  // Ensure unique angle IDs
  const finalized = parsed.map((item, index) => ({
    angle_id: item.angle_id || `ang_${Date.now()}_${index + 1}`,
    title: item.title || `Sudut Pandang Alternatif #${index + 1}`,
    hook_type: item.hook_type || 'Problem-Agitation-Solution',
    target_persona: item.target_persona || 'Pecinta Hidup Sehat',
    emotional_trigger: item.emotional_trigger || 'Kesehatan & Kebugaran Alami',
    hook_text: item.hook_text || '',
    vo_preview: item.vo_preview || '',
    recommended_voice: item.recommended_voice || 'Warm Mentor (1.0x)',
    cta_type: item.cta_type || 'Komen "MAU" di bawah ini',
    estimated_retention: item.estimated_retention || 'High Retention'
  }));

  return finalized;
}
