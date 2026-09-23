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
 * Generates dynamic, high-RPM viral angles for Multiplier Lab Non-Product Campaigns
 */
export async function generateDynamicMultiplierAngles({
  blueprintId,
  blueprintIds = [],
  mode = '1_to_multi', // '1_to_multi' | 'multi_to_1'
  nicheKbName = 'HERBAL_CONTENT_KB.md',
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

  // 2. Read Selected Niche KB
  let nicheKbContent = '';
  if (nicheKbName && fs.existsSync(path.join(kbDir, nicheKbName))) {
    nicheKbContent = fs.readFileSync(path.join(kbDir, nicheKbName), 'utf8');
  }

  // 3. Fetch Blueprint Assets Data
  let blueprintDataList = [];
  if (mode === 'multi_to_1' && blueprintIds && blueprintIds.length > 0) {
    const placeholders = blueprintIds.map(() => '?').join(',');
    blueprintDataList = await db.prepare(
      `SELECT id, original_video_url, original_storyboard_json, prompt_dna_json, created_at 
       FROM re_deconstructed_assets WHERE id IN (${placeholders})`
    ).all(...blueprintIds);
  } else if (blueprintId) {
    const bp = await db.prepare(
      `SELECT id, original_video_url, original_storyboard_json, prompt_dna_json, created_at 
       FROM re_deconstructed_assets WHERE id = ?`
    ).get(blueprintId);
    if (bp) blueprintDataList = [bp];
  }

  if (blueprintDataList.length === 0) {
    throw new Error('Blueprint referensi tidak ditemukan. Pastikan blueprintId valid.');
  }

  // 4. Ingest Historical Excluded Angles for Zero-Repetition
  const targetBpId = blueprintDataList[0].id;
  const excludedAngles = await getExcludedAnglesHistory(targetBpId);

  // 5. Parse Blueprint Visual Context & Scenes
  const primaryBp = blueprintDataList[0];
  let originalStoryboard = [];
  let promptDna = {};
  try {
    originalStoryboard = JSON.parse(primaryBp.original_storyboard_json || '[]');
    promptDna = JSON.parse(primaryBp.prompt_dna_json || '{}');
  } catch (_) {}

  const sceneSummaries = originalStoryboard.map((s, idx) => {
    return `Scene ${idx + 1}: Visual: "${s.visual_description || s.scene_summary || s.t2v_prompt || 'Visual adegan'}" | Original VO: "${s.voice_over || s.narration || ''}"`;
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
- Total Adegan/Scene: ${originalStoryboard.length || 3} Scene
- Rincian Adegan Visual & Voiceover Asli:
${sceneSummaries || 'Adegan pembuatan/resep herbal alami rustic cozy.'}

${customTheme ? `## 🎯 CUSTOM THEME / ARAH TOPIK DARI PENGGUNA:\n"${customTheme}"\n` : ''}

---

## 🛡️ ATURAN ANTI-DUPLIKASI KETAT (ZERO-REPETITION MANDATE):
DILARANG KERAS mengulangi atau membuat sudut pandang yang mirip/bersinggungan dengan riwayat sudut pandang berikut yang SUDAH PERNAH DIBUAT sebelumnya:
${excludedAngles.length > 0 ? excludedAngles.map((ex, i) => `${i + 1}. "${ex}"`).join('\n') : '(Belum ada riwayat sebelumnya. Pastikan semua variasi yang dihasilkan saling berbeda tajam satu sama lain).'}

---

## 🧬 PANDUAN STRATEGIS & FORMULA HOOK (DARI KNOWLEDGE BASE):
${strategicFramework ? `### 1. STRATEGIC FRAMEWORKS:\n${strategicFramework.slice(0, 1500)}...\n` : ''}
${realistViral ? `### 2. REALIST VIRAL NARRATIVE & HOOK RULES:\n${realistViral.slice(0, 1200)}...\n` : ''}
${ctaRules ? `### 3. CTA RETENTION RULES:\n${ctaRules.slice(0, 800)}...\n` : ''}
${nicheKbContent ? `### 4. NICHE DOMAIN GUIDELINES (${nicheKbName}):\n${nicheKbContent.slice(0, 1500)}...\n` : ''}

---

## 📐 MATRIKS 5-SUMBU PERMUTASI (WAJIB DIVERSIFIKASI):
Setiap angle yang Anda ciptakan WAJIB mengambil kombinasi sumbu yang berbeda:
1. **Sumbu Persona**: Pekerja lembur/burnout, Ibu rumah tangga, Usia 45+ / Orang tua, Pengendara motor malam, Pecinta herbal alami, Pejuang diet/metabolisme.
2. **Sumbu Momen/Waktu**: Bangun pagi leher kaku, Menjelang tidur insomnia, Musim hujan/pancaroba, Pasca makan makanan berlemak/santan, Sore hari saat stamina drop.
3. **Sumbu Format Hook (0-3 Detik)**:
   - Challenge/Gamification ("Coba rutinkan 7 hari...")
   - Problem-Agitation-Solution ("Tiap musim hujan badan meriang...")
   - Curiosity Secret / Myth Buster ("Mengapa orang tua zaman dulu merebus...")
   - Cozy ASMR & Relaksasi ("Jam segini masih belum bisa tidur?...")
   - Direct Benefit / Habit Replacement ("Ganti teh manismu dengan seduhan ini...")
4. **Sumbu Emosi**: Divalidasi kelelahannya, Keingintahuan fakta mengejutkan, Rasa bersalah makan berlemak, Ketenangan batin/relaksasi.
5. **Sumbu CTA Bait (Algoritma Facebook Booster)**: Komen kata kunci pendek ("IKUTAN", "MAU", "SEHAT", "RESEP"), Share ke keluarga/teman, atau Save untuk dicoba.

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
