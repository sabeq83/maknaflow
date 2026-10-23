import fs from 'fs';
import path from 'path';
import { getGeminiModel } from './gemini.js';
import { parseGeminiJSON } from './json-parser.js';
import { getDb } from './db.js';
import { tenantContext, getActiveTenantId } from './tenant-context.js';

function sanitizeBlueprintId(id) {
  if (!id || typeof id !== 'string') return id;
  const match = id.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return match ? match[0] : id.trim();
}

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
export async function getExcludedAnglesHistory(blueprintId, tenantId) {
  const cleanId = sanitizeBlueprintId(blueprintId);
  if (!cleanId) return [];
  const effectiveTenantId = tenantId || getActiveTenantId();

  return tenantContext.run(effectiveTenantId, async () => {
    const db = getDb();
    try {
      let rows = [];
      try {
        rows = await db.prepare(
          `SELECT bridging_config_json, new_caption, remake_storyboard_json 
           FROM re_multiplier_tasks 
           WHERE deconstruct_asset_id = ? 
           ORDER BY created_at DESC LIMIT 30`
        ).all(cleanId);
      } catch (queryErr) {
        if (queryErr.message?.includes('tenant_id')) {
          rows = await db.prepare(
            `SELECT bridging_config_json, new_caption, remake_storyboard_json 
             FROM re_multiplier_tasks 
             WHERE deconstruct_asset_id = ? 
             LIMIT 30`
          ).all(cleanId);
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
  });
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

  // Ekstraksi Masalah Utama (Core Problem) & Solusi Inti
  let coreProblem = blueprint.core_problem || '';
  let coreSolution = blueprint.core_solution || '';
  let targetAudiencePainPoint = blueprint.target_audience_pain_point || '';

  if (!coreProblem) {
    if (blueprint.viral_pattern_summary) {
      const match = blueprint.viral_pattern_summary.match(/(?:terkait|membahas|solusi|masalah|fokus)\s+([^,.]+)/i);
      if (match && match[1].length > 10) {
        coreProblem = match[1].trim();
      } else {
        const sentences = blueprint.viral_pattern_summary.split('.');
        coreProblem = (sentences[0] || '').trim();
      }
    } else if (sb[0]?.narration_transcript || sb[0]?.voice_over) {
      coreProblem = (sb[0].narration_transcript || sb[0].voice_over).slice(0, 120);
    }
  }

  return {
    detectedNiche,
    nicheLabel,
    recommendedKb,
    extractedIngredients,
    coreProblem: coreProblem || 'Kesehatan, kebugaran, dan nutrisi alami',
    coreSolution: coreSolution || '',
    targetAudiencePainPoint: targetAudiencePainPoint || '',
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
  const effectiveTenantId = tenantId || getActiveTenantId();

  return tenantContext.run(effectiveTenantId, async () => {
    const db = getDb();
    const kbDir = path.join(process.cwd(), 'kb');
    const cleanBpId = sanitizeBlueprintId(blueprintId);
    const cleanBpIds = (blueprintIds || []).map(sanitizeBlueprintId).filter(Boolean);

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
    if (mode === 'multi_to_1' && cleanBpIds.length > 0) {
      const placeholders = cleanBpIds.map(() => '?').join(',');
      blueprintDataList = await db.prepare(
        `SELECT id, source_url, source_url AS original_video_url, original_storyboard_json, viral_pattern_summary, original_caption, core_problem, core_solution, target_audience_pain_point, created_at 
         FROM re_deconstructed_assets WHERE id IN (${placeholders})`
      ).all(...cleanBpIds);
    } else if (cleanBpId) {
      const bp = await db.prepare(
        `SELECT id, source_url, source_url AS original_video_url, original_storyboard_json, viral_pattern_summary, original_caption, core_problem, core_solution, target_audience_pain_point, created_at 
         FROM re_deconstructed_assets WHERE id = ?`
      ).get(cleanBpId);
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
    const coreProblemResolved = primaryBp.core_problem || anchorDNA.coreProblem || 'Kesehatan & kebugaran alami';
    const coreSolutionResolved = primaryBp.core_solution || anchorDNA.coreSolution || '';

    // 4. Read Selected or Auto-Detected Niche KB
    const selectedNicheKb = nicheKbName || anchorDNA.recommendedKb || 'HERBAL_CONTENT_KB.md';
    let nicheKbContent = '';
    if (selectedNicheKb && fs.existsSync(path.join(kbDir, selectedNicheKb))) {
      nicheKbContent = fs.readFileSync(path.join(kbDir, selectedNicheKb), 'utf8');
    }

    // 5. Ingest Historical Excluded Angles for Zero-Repetition
    const targetBpId = blueprintDataList[0].id;
    const excludedAngles = await getExcludedAnglesHistory(targetBpId, effectiveTenantId);

    const sceneSummaries = originalStoryboard.map((s, idx) => {
      return `Scene ${idx + 1}: Visual: "${s.visual_description || s.scene_summary || s.t2v_prompt || 'Visual adegan'}" | Original VO: "${s.voice_over || s.narration || s.narration_transcript || ''}"`;
    }).join('\n');

  // 6. Build Multi-Axis Prompt for Gemini AI (Dynamic count up to 20 angles)
  const requestedCount = Math.min(Math.max(parseInt(angleCount, 10) || 5, 3), 20);

  const prompt = `
Anda adalah Chief Viral Strategist & Retention Algorithm Expert kelas dunia di MAKNA Flow.

TUGAS ANDA:
Menganalisis aset Visual Blueprint referensi dan menghasilkan **${requestedCount} SUDUT PANDANG (EDITORIAL ANGLES) YANG 100% UNIK, SEGAR, DAN VIRAL-OPTIMIZED** dengan menerapkan **CONTENT PLANNER STRATEGIC MATRIX (CEP × W'S MATRIX × 30 STRATEGIC ARCHETYPES)**.

---

## 🎯 DATA VISUAL BLUEPRINT REFERENSI & MASALAH UTAMA (CORE ANCHOR):
- Blueprint ID: ${primaryBp.id}
- Niche Terdeteksi: ${anchorDNA.nicheLabel} (${anchorDNA.detectedNiche})
- Total Adegan: ${originalStoryboard.length || 3} Scene
- 🔥 MASALAH UTAMA POKOK BLUEPRINT (LOCKED): "${coreProblemResolved}"
${coreSolutionResolved ? `- 🥣 SOLUSI INTI POKOK (LOCKED): "${coreSolutionResolved}"\n` : ''}${anchorDNA.extractedIngredients.length > 0 ? `- Bahan Baku Pokok Visual (LOCKED): ${anchorDNA.extractedIngredients.join(', ')}\n` : ''}${primaryBp.viral_pattern_summary ? `- Pola Hook/Viral Asli: ${primaryBp.viral_pattern_summary}\n` : ''}- Rincian Adegan Visual & Voiceover Asli:
${sceneSummaries || 'Adegan pembuatan/resep sesuai visual asli video blueprint.'}

${customTheme ? `## 🎯 CUSTOM THEME / ARAH TOPIK DARI PENGGUNA:\n"${customTheme}"\n` : ''}

---

## 🔒 MANDAT KESINAMBUNGAN MASALAH UTAMA (STRICT CORE PROBLEM CONTINUITY):
1. **KUNCI MASALAH UTAMA (DILARANG KERAS MENGGANTI MASALAH POKOK)**:
   - Seluruh ${requestedCount} sudut pandang yang Anda hasilkan WAJIB 100% berakar dan menyelesaikan MASALAH UTAMA di atas ("${coreProblemResolved}")!
   - JIKA Blueprint membahas [Membakar / Merontokkan Lemak Perut Alami], maka SELURUH ${requestedCount} angle WAJIB tetap seputar membakar lemak perut alami tersebut!
   - DILARANG KERAS berhalusinasi mengganti masalah pokok menjadi perut begah, kecanduan kopi, stamina keluarga, susah tidur, atau hemat biaya kost!
2. **DIVERSIFIKASI HANYA PADA PERSPEKTIF AUDIENS (BUKAN MENGGANTI MASALAHNYA)**:
   - Variasi dilakukan melalui permutasi Matriks Strategi Content Planner di bawah ini, sehingga audiens yang berbeda (pekerja kantor, ibu pasca melahirkan, pejuang diet, momen malam) merasakan kedekatan emosional terhadap solusi masalah utama yang sama.

---

## 🧬 MATRIKS STRATEGI CONTENT PLANNER (PANDUAN PERMUTASI DINAMIS):
Setiap angle dari ${requestedCount} angle yang Anda ciptakan WAJIB mengombinasikan 3 dimensi strategi berikut:

### 1. Kategori CEP (Category Entry Points - Pilih 1 per Baris):
- Problem-Solution Based: Mengatasi keluhan fisik/kesehatan mendesak
- Routine-Based: Rutinitas harian (pagi sebelum ngantor, sarapan praktis)
- Commitment-Based: Disiplin & dedikasi (defisit kalori, tantangan 7 hari)
- Aspirational-Based: Menuju lingkar tubuh ideal & perbaikan kualitas hidup
- Opportunistic-Based: Solusi cerdas, modal murah bahan dapur
- Emotional-Based: Meredakan stres, rasa bersalah makan banyak, ngidam malam

### 2. W's Matrix (Pilih & Gabungkan Minimal 2 Variabel per Baris):
- When? (Pagi hari sebelum ngantor, malam jam 10 sebelum tidur, sore saat energi drop)
- Where? (Dapur kost, meja kantor, gym, ruang makan keluarga)
- With/For Whom? (Sendiri, ibu pasca melahirkan, pasangan, lansia)
- How Feeling? (Frustrasi timbangan stuck, kancing celana sesak, bersalah makan gorengan)
- While? (Sambil lembur kerja, sambil bersiap pagi, sehabis olahraga ringan)
- With What? (Panci kost sederhana, modal 5 ribu perak, 2 rempah dapur)
- Why? (Detoksifikasi alami, susut lingkar pinggang, hilangkan lemak visceral)

### 3. The Infinite Strategic Angle Matrix (30 Archetypes dari KB):
Gunakan variasi archetype yang berbeda tajam antar baris:
- The Life Hack / Efficiency ("Trik dapur 8 menit...")
- The Myth Buster ("Mitos: bakar lemak harus lapar seharian...")
- The Cost of Inaction ("Bahaya membiarkan lemak visceral menumpuk...")
- The Habit Replacement ("Ganti kebiasaan X dengan racikan ini...")
- The 7-Day Challenge ("Tantangan 7 hari susut lingkar perut...")
- The Scientific Proof ("Cara kerja cinnamaldehyde & asam sitrat...")
- The Pure Relief ("Sensasi kancing celana mulai longgar...")
- The Ancient Wisdom / Heritage ("Resep turun-temurun peluruh lemak...")
- The Second Chance ("Kembalikan lingkar pinggang pasca melahirkan...")
- The Sensory ASMR ("Visual uap mendidih dan aroma rempah...")
- The Secret Club ("Trik dapur rahasia yang jarang diungkap...")
- The Minimalist ("Hanya modal 2 bahan dapur...")

---

## 🛡️ ATURAN ANTI-DUPLIKASI KETAT (ZERO-REPETITION MANDATE):
DILARANG KERAS mengulangi atau membuat sudut pandang yang mirip/bersinggungan dengan riwayat berikut yang SUDAH PERNAH DIBUAT sebelumnya:
${excludedAngles.length > 0 ? excludedAngles.map((ex, i) => `${i + 1}. "${ex}"`).join('\n') : '(Belum ada riwayat sebelumnya. Pastikan semua variasi saling berbeda tajam).'}

---

## 🧬 PANDUAN STRATEGIS DARI KNOWLEDGE BASE:
${strategicFramework ? `### 1. STRATEGIC FRAMEWORKS:\n${strategicFramework.slice(0, 1500)}...\n` : ''}
${realistViral ? `### 2. REALIST VIRAL NARRATIVE & HOOK RULES:\n${realistViral.slice(0, 1200)}...\n` : ''}
${ctaRules ? `### 3. CTA RETENTION RULES:\n${ctaRules.slice(0, 800)}...\n` : ''}
${nicheKbContent ? `### 4. NICHE DOMAIN GUIDELINES (${selectedNicheKb}):\n${nicheKbContent.slice(0, 1500)}...\n` : ''}

---

## 📤 FORMAT OUTPUT (WAJIB STRICT VALID JSON ARRAY):
Kembalikan respons HANYA berupa JSON Array murni tanpa markdown pembungkus di luar JSON:

[
  {
    "angle_id": "ang_1",
    "title": "Judul Angle Singkat & Menarik (Maks 10 Kata)",
    "category_cep": "Problem-Solution | Routine | Commitment | Aspirational | Opportunistic | Emotional",
    "ws_matrix": "When (Pagi) + While (Sebelum Ngantor)",
    "strategic_archetype": "The Habit Replacement | The Cost of Inaction | The 7-Day Challenge | The Myth Buster | The Life Hack",
    "target_persona": "Target Audiens Spesifik",
    "emotional_trigger": "Emosi & Masalah Utama yang Disentuh",
    "hook_text": "Naskah Hook 0 - 3 Detik Pertama (Wajib sangat kuat & memikat)",
    "vo_preview": "Draft kelanjutan naskah Voice-Over Scene 2 & 3 yang sinkron dengan visual blueprint",
    "recommended_voice": "Warm Mentor | Cozy ASMR Whisper | Energetic Inspiring | Wise Storyteller",
    "cta_type": "Komen 'IKUTAN' | Share ke teman | Simpan video ini",
    "core_problem": "${coreProblemResolved}",
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
      maxOutputTokens: 8192
    }
  });

  const responseText = response.response.text();
  const parsed = parseGeminiJSON(responseText);

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Gemini AI gagal menghasilkan format list sudut pandang (angles). Silakan coba lagi.');
  }

  // Ensure unique angle IDs and complete metadata
  const finalized = parsed.map((item, index) => ({
    angle_id: item.angle_id || `ang_${Date.now()}_${index + 1}`,
    title: item.title || `Sudut Pandang Alternatif #${index + 1}`,
    category_cep: item.category_cep || 'Problem-Solution',
    ws_matrix: item.ws_matrix || 'Contextual Trigger',
    strategic_archetype: item.strategic_archetype || 'The Life Hack',
    target_persona: item.target_persona || 'Pecinta Hidup Sehat',
    emotional_trigger: item.emotional_trigger || 'Kesehatan & Kebugaran Alami',
    hook_text: item.hook_text || '',
    vo_preview: item.vo_preview || '',
    recommended_voice: item.recommended_voice || 'Warm Mentor (1.0x)',
    cta_type: item.cta_type || 'Komen "MAU" di bawah ini',
    core_problem: item.core_problem || coreProblemResolved,
    estimated_retention: item.estimated_retention || 'High Retention'
  }));

    return finalized;
  });
}
