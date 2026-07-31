import { getDb } from './db.js';
import { getGeminiModel } from './gemini.js';
import { getStrategicSkeletonKB, getCreativeGeneratorKB, getReviewerKB } from './kb-loader.js';
import { getAuthorizedClient } from './google-auth.js';
import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';
import { sendToContentFlow } from './contentflow-client.js';
import { getToneDemographicInstruction, UNIVERSAL_ZERO_TESTIMONY_MANDATE } from './prompts.js';

/**
 * Generate a unique Video ID in format: [namaakun]-[12digitalfanumerik]
 */
function generateVideoId(accountName) {
  const sanitized = (accountName || 'account')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || 'account';

  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let random12 = '';
  for (let i = 0; i < 12; i++) {
    random12 += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return `${sanitized}-${random12}`;
}

/**
 * Clean JSON output from Gemini response markdown codeblocks
 */
function cleanJsonResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

/**
 * Helper to execute Gemini generation with JSON output constraint & dynamic temperature
 */
async function callGeminiJson(prompt, systemInstruction = '', temperature = 0.7) {
  const model = await getGeminiModel();
  const fullPrompt = systemInstruction 
    ? `${systemInstruction}\n\n${prompt}`
    : prompt;
    
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    generationConfig: {
      temperature,
      responseMimeType: "application/json"
    }
  });

  const responseText = result.response.text();
  const jsonStr = cleanJsonResponse(responseText);
  return JSON.parse(jsonStr);
}

/**
 * Extract compact history digest for a product to enforce anti-repetition
 */
async function getProductHistoryDigest(db, productId, productName, limit = 60) {
  let rows = [];
  if (productId) {
    rows = await db.prepare(`
      SELECT r.sequence, r.pillar, r.category_cep, r.ws_matrix, r.context, r.vfo, r.strategic_angle, r.hook
      FROM content_planner_rows r
      JOIN content_planners p ON r.planner_id = p.id
      WHERE p.product_id = ?
      ORDER BY r.created_at DESC
      LIMIT ?
    `).all(productId, limit);
  }

  if ((!rows || rows.length === 0) && productName) {
    rows = await db.prepare(`
      SELECT r.sequence, r.pillar, r.category_cep, r.ws_matrix, r.context, r.vfo, r.strategic_angle, r.hook
      FROM content_planner_rows r
      JOIN content_planners p ON r.planner_id = p.id
      WHERE LOWER(p.product_name) = LOWER(?)
      ORDER BY r.created_at DESC
      LIMIT ?
    `).all(productName.trim(), limit);
  }

  if (!rows || rows.length === 0) {
    return {
      hasHistory: false,
      totalRows: 0,
      anglesUsed: [],
      contextsUsed: [],
      digestText: ''
    };
  }

  const anglesSet = new Set();
  const contextsList = [];
  rows.forEach(r => {
    if (r.strategic_angle) anglesSet.add(r.strategic_angle);
    if (r.context) {
      const shortCtx = r.context.length > 50 ? r.context.substring(0, 50) + '...' : r.context;
      contextsList.push(shortCtx);
    }
  });

  const anglesUsed = Array.from(anglesSet);
  const contextsUsed = Array.from(new Set(contextsList)).slice(0, 30);

  const digestText = `
=== RIWAYAT KAMPANYE PRODUK SEBELUMNYA (${rows.length} Baris Terakhir) ===
Sangat Penting: Produk ini SUDAH Memiliki ${rows.length} Baris Konten Sebelumnya.
DILARANG MENGULANG sudut pandang (angle) dan konteks situasi yang sudah pernah dipakai berikut:

1. STRATEGIC ANGLES YANG SUDAH TERPAKAI:
${anglesUsed.map(a => `- ${a}`).join('\n')}

2. KONTEKS SITUASI YANG SUDAH TERPAKAI:
${contextsUsed.map(c => `- ${c}`).join('\n')}

MANDAT KREATIF & ANTI-REPETISI:
Kamu WAJIB memilih Strategic Angle, konteks situasi harian, dan variabel visual yang 100% SEGAR, UNIK, DAN TERDENGAR BARU dari daftar riwayat di atas.
`.trim();

  return {
    hasHistory: true,
    totalRows: rows.length,
    anglesUsed,
    contextsUsed,
    digestText
  };
}

/**
 * Build distribution plan for pillars, CEP categories, VFO types with dynamic offset
 */
function buildDistributionPlan(plannerCount, pillarsList, offsetIndex = 0, seedString = '') {
  let seed = 0;
  if (seedString) {
    for (let i = 0; i < seedString.length; i++) {
      seed = (seed << 5) - seed + seedString.charCodeAt(i);
      seed |= 0;
    }
    seed = Math.abs(seed);
  }

  const shiftArray = (arr, shift) => {
    if (arr.length === 0) return arr;
    const s = shift % arr.length;
    return [...arr.slice(s), ...arr.slice(0, s)];
  };

  const defaultPillars = pillarsList && pillarsList.length > 0
    ? pillarsList
    : ['Edukasi & Problem Solving', 'Routine & Habit Building', 'Review & Honest Comparison', 'Behind the Scene & Lifestyle'];

  const cepTypes = [
    'Problem-Solution Based',
    'Routine Based',
    'Emotional Based',
    'Aspirational Based',
    'Commitment Based',
    'Opportunistic Based'
  ];

  const vfoTypes = [
    'Concrete (Fakta & Produk Langsung)',
    'Instinctive (Emosi & Sensorik Visual)',
    'Uncharted (Sudut Pandang Unik / Mind-Blowing)',
    'Aspirational (Gaya Hidup & Transformasi)'
  ];

  const rotatedPillars = shiftArray(defaultPillars, seed);
  const rotatedCEPs = shiftArray(cepTypes, seed + 1);
  const rotatedVFOs = shiftArray(vfoTypes, seed + 2);

  const distribution = [];
  for (let i = 0; i < plannerCount; i++) {
    const idx = i + offsetIndex;
    distribution.push({
      sequence: i + 1,
      pillar: rotatedPillars[idx % rotatedPillars.length],
      category_cep: rotatedCEPs[idx % rotatedCEPs.length],
      vfo: rotatedVFOs[idx % rotatedVFOs.length]
    });
  }
  return distribution;
}

/**
 * Create a draft Content Planner (persists parameters, status = 'draft', no AI calls yet)
 */
export async function createDraftContentPlanner(params) {
  const {
    title,
    account_name = 'account',
    google_sheet_id = null,
    input_mode = 'manual',
    brand_id = null,
    product_id = null,
    product_name,
    product_description,
    product_usp,
    product_url = null,
    affiliate_url = null,
    product_photo_url = null,
    product_ref_image = null,
    platform = 'tiktok',
    objective = 'soft_sell',
    planner_count = 12,
    target_audience = 'genz_casual'
  } = params;

  if (!product_name || !product_description) {
    throw new Error('Nama produk dan deskripsi produk wajib diisi.');
  }

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}${mm}${dd}`;

  const cleanAcc = (account_name || 'Account').trim();
  const words = (product_name || '').trim().split(/\s+/).filter(Boolean);
  const twoWordsProd = words.slice(0, 2).join(' ');
  const defaultAutofillTitle = twoWordsProd 
    ? `${cleanAcc} - ${dateStr} - ${twoWordsProd}`
    : `${cleanAcc} - ${dateStr}`;

  const plannerTitle = (title || defaultAutofillTitle).trim();

  const db = getDb();
  const plannerId = `pln_${uuidv4().substring(0, 8)}`;
  const count = parseInt(planner_count, 10) || 12;

  await db.prepare(`
    INSERT INTO content_planners (
      id, title, account_name, google_sheet_id, brand_id, product_id, input_mode, product_name, product_description, product_usp, product_url, affiliate_url, product_photo_url, product_ref_image, platform, objective, planner_count, status, target_audience
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    plannerId,
    plannerTitle,
    account_name,
    google_sheet_id,
    brand_id,
    product_id,
    input_mode,
    product_name,
    product_description,
    product_usp,
    product_url,
    affiliate_url,
    product_photo_url,
    product_ref_image,
    platform,
    objective,
    count,
    'draft',
    target_audience
  );

  return {
    success: true,
    planner_id: plannerId,
    planner: {
      id: plannerId,
      title: plannerTitle,
      account_name,
      google_sheet_id,
      product_name,
      product_description,
      product_usp,
      product_url,
      affiliate_url,
      product_photo_url,
      platform,
      objective,
      planner_count: count,
      status: 'draft',
      rows: []
    }
  };
}

/**
 * Execute AI pipeline for an existing draft Content Planner
 */
export async function executeContentPlanner(plannerId) {
  const db = getDb();
  const planner = await db.prepare('SELECT * FROM content_planners WHERE id = ?').get(plannerId);
  if (!planner) {
    throw new Error('Planner tidak ditemukan.');
  }

  // Update status to 'generating'
  await db.prepare('UPDATE content_planners SET status = ? WHERE id = ?').run('generating', plannerId);

  try {
    const {
      product_id,
      product_name,
      product_description,
      product_usp,
      platform = 'tiktok',
      objective = 'soft_sell',
      planner_count = 12,
      target_audience = 'genz_casual',
      pillars = []
    } = planner;

    const count = parseInt(planner_count, 10) || 12;
    const toneInstruction = getToneDemographicInstruction(target_audience);

    // 0. Extract Product History Digest & Dynamic Offset
    const historyDigest = await getProductHistoryDigest(db, product_id, product_name, 60);
    const offsetIndex = historyDigest.totalRows || 0;
    const dynamicTemperature = historyDigest.hasHistory ? 0.85 : 0.7;

    console.log(`[ContentPlannerEngine] Product: "${product_name}" | Target Audience: ${target_audience} | Existing History Rows: ${offsetIndex} | Temp: ${dynamicTemperature}`);

     // 1. Distribution Plan (with dynamic offset)
     const distributionPlan = buildDistributionPlan(count, pillars, offsetIndex, product_name);
 
     // 2. AI Call 1: Strategic Skeleton Generator
     const strategicKb = getStrategicSkeletonKB();
     const skeletonSystemInstruction = `
Kamu adalah Strategic Content Architect senior MAKNA Engine.
Tugasmu adalah menyusun Rangka Strategi Konten (Strategic Skeleton) berdasarkan Knowledge Base Strategis berikut:

${strategicKb}
${UNIVERSAL_ZERO_TESTIMONY_MANDATE}

INSTRUKSI KHUSUS:
- Produk Target: ${product_name}
- Deskripsi Produk: ${product_description}
- USP Produk: ${product_usp || 'Tidak disebutkan'}
- Platform: ${platform}
- Objective: ${objective}
- ${toneInstruction}
- Jumlah Baris Planner: ${count}

${historyDigest.hasHistory ? historyDigest.digestText + '\n' : ''}

Kamu harus menghasilkan persis ${count} baris JSON array dengan struktur objek berikut per baris:
{
  "sequence": number,
  "pillar": string,
  "category_cep": string,
  "ws_matrix": string (Gabungkan minimal 2 atau lebih variabel dari Ws Framework secara dinamis & relevan untuk produk ini, misal: "When + While" atau "Where + With What" atau "Why + How Feeling"),
  "context": string (Konteks situasi spesifik yang realistis berdasarkan gabungan Ws Matrix di atas),
  "vfo": string,
  "strategic_angle": string (Sudut pandang strategi dari KB misal: "The Life Hack", "The Contrast Shock", "The Hidden Secret", "The Cost of Inaction"),
  "product": string (Nama produk: "${product_name}")
}

PANDUAN VARIABEL W'S FRAMEWORK (WAJIB PILIH DAN GABUNGKAN SECARA DINAMIS PER BARIS):
* When? (Waktu spesifik harian, misal: pagi hari saat heboh bersiap kerja)
* Where? (Lokasi / Tempat kejadian)
* With/For Whom? (Konteks sosial / Mertua / Anak / Pasangan)
* How Feeling? (Kondisi emosi / Mood / Fisik, misal: merasa kembung, cemas berat badan)
* While? (Aktivitas bersamaan yang sedang berjalan)
* With What? (Bahan pendamping / Alat masak / Barang penunjang)
* Why? (Tujuan utama / Kebutuhan mendasar)

Output WAJIB berupa JSON array murni tanpa narasi tambahan.
`;

    const skeletonPrompt = `
Gunakan distribusi dasar berikut sebagai panduan awal dan kembangkan konteks & strategic angle yang tajam, realistis, dan bervariasi:
${JSON.stringify(distributionPlan, null, 2)}
`;

    console.log(`[ContentPlannerEngine] Running AI Call 1 (Strategic Skeleton) for ${plannerId}...`);
    const skeletonResult = await callGeminiJson(skeletonPrompt, skeletonSystemInstruction, dynamicTemperature);
    const skeletons = Array.isArray(skeletonResult) ? skeletonResult : (skeletonResult.planner_rows || skeletonResult.rows || []);

    if (!skeletons || skeletons.length === 0) {
      throw new Error('Gagal menghasilkan Strategic Skeleton dari AI.');
    }

    const creativeKb = getCreativeGeneratorKB();
    const creativeSystemInstruction = `
Kamu adalah Creative Copywriter & Visual Director senior MAKNA Engine.
Tugasmu adalah menghasilkan "Hook" (kalimat penarik perhatian 3 detik pertama) dan "Visual Action" (deskripsi visual gerakan kamera & aksi adegan) berdasarkan Strategic Skeleton yang SUDAH DILOCK.

INFORMASI PRODUK TARGET:
- Nama Produk: ${product_name}
- Deskripsi Produk: ${product_description}
- USP Produk: ${product_usp || 'Tidak disebutkan'}

Gunakan Knowledge Base Kreatif berikut:
${creativeKb}
${UNIVERSAL_ZERO_TESTIMONY_MANDATE}

ATURAN STRUKTUR OUTPUT & KREATIF & GAYA BAHASA AUDIENS:
1. ${toneInstruction}
2. Hook harus sangat menarik perhatian 3 detik pertama, relevan dengan Context & Strategic Angle, tidak terkesan jualan kasar (soft-selling), serta memilih intonasi, diksi, dan gaya bahasa khas target audiens tersebut.
3. Visual Action harus mendeskripsikan pergerakan kamera (misal: "Top view close-up", "Panning tracking", "Macro shot") dan memperlihatkan aksi produk secara fisik yang dapat dieksekusi secara nyata.
4. DILARANG mengubah Strategic Skeleton (Pillar, Category CEP, W'S Matrix, Context, VFO, Strategic Angle, Product).
${historyDigest.hasHistory ? '\n5. DILARANG MENGULANG kata kunci hook & visual adegan yang sama persis dari riwayat produk sebelumnya.' : ''}

Format Output WAJIB berupa JSON array dengan ${skeletons.length} objek yang menambahkan field "hook" dan "visual_action":
[
  {
    "sequence": number,
    "pillar": string,
    "category_cep": string,
    "ws_matrix": string,
    "context": string,
    "vfo": string,
    "strategic_angle": string,
    "product": string,
    "hook": string,
    "visual_action": string
  }
]
`;

    const creativePrompt = `
Berikut adalah Strategic Skeleton yang terkunci:
${JSON.stringify(skeletons, null, 2)}

Hasilkan Hook dan Visual Action untuk seluruh ${skeletons.length} baris di atas.
`;

    console.log(`[ContentPlannerEngine] Running AI Call 2 (Creative Generator) for ${plannerId}...`);
    const creativeResult = await callGeminiJson(creativePrompt, creativeSystemInstruction, dynamicTemperature);
    const finalRows = Array.isArray(creativeResult) ? creativeResult : (creativeResult.planner_rows || creativeResult.rows || []);

    // Clean up existing rows if any
    await db.prepare('DELETE FROM content_planner_rows WHERE planner_id = ?').run(plannerId);

    const insertRowStmt = await db.prepare(`
      INSERT INTO content_planner_rows (
        id, planner_id, sequence, video_id, pillar, category_cep, ws_matrix, context, vfo, strategic_angle, narrative_mode, hook, visual_action, product, selling_intent, validation_status, is_locked
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);

    const insertedRows = [];
    finalRows.forEach((row, idx) => {
      const rowId = `row_${uuidv4().substring(0, 8)}`;
      const videoId = generateVideoId(planner.account_name);
      const seq = row.sequence || (idx + 1);
      const pPillar = row.pillar || skeletons[idx]?.pillar || 'Edukasi';
      const pCep = row.category_cep || skeletons[idx]?.category_cep || 'Problem-Solution Based';
      const pWs = row.ws_matrix || skeletons[idx]?.ws_matrix || 'When + While Doing What';
      const pCtx = row.context || skeletons[idx]?.context || 'Situasi harian';
      const pVfo = row.vfo || skeletons[idx]?.vfo || 'Concrete';
      const pAngle = row.strategic_angle || skeletons[idx]?.strategic_angle || 'The Life Hack';
      const pHook = row.hook || 'Gagal generate hook.';
      const pVisual = row.visual_action || 'Gagal generate visual action.';
      const pProduct = row.product || product_name;

      insertRowStmt.run(
        rowId,
        plannerId,
        seq,
        videoId,
        pPillar,
        pCep,
        pWs,
        pCtx,
        pVfo,
        pAngle,
        'Storytelling',
        pHook,
        pVisual,
        pProduct,
        objective,
        'pass'
      );

      insertedRows.push({
        id: rowId,
        planner_id: plannerId,
        sequence: seq,
        video_id: videoId,
        pillar: pPillar,
        category_cep: pCep,
        ws_matrix: pWs,
        context: pCtx,
        vfo: pVfo,
        strategic_angle: pAngle,
        hook: pHook,
        visual_action: pVisual,
        product: pProduct,
        is_locked: 0
      });
    });

    // Update status to 'completed'
    await db.prepare('UPDATE content_planners SET status = ? WHERE id = ?').run('completed', plannerId);

    // Auto-sync to Content Flow Ingestion API
    try {
      console.log(`[ContentPlannerEngine] Syncing generated rows to Content Flow API for planner ${plannerId}...`);
      await syncPlannerToContentFlow(plannerId);
      console.log(`[ContentPlannerEngine] Content Flow sync successful.`);
    } catch (cfErr) {
      console.warn('[ContentPlannerEngine] Content Flow sync warning:', cfErr.message);
    }

    return {
      success: true,
      planner_id: plannerId,
      status: 'completed',
      rows: insertedRows
    };
  } catch (error) {
    await db.prepare('UPDATE content_planners SET status = ? WHERE id = ?').run('draft', plannerId);
    throw error;
  }
}

/**
 * Explicitly sync/write planner rows to Content Flow Direct Ingestion API
 */
export async function syncPlannerToContentFlow(plannerId) {
  const db = getDb();
  const planner = await db.prepare('SELECT * FROM content_planners WHERE id = ?').get(plannerId);
  if (!planner) {
    throw new Error('Planner tidak ditemukan.');
  }

  const rows = await db.prepare('SELECT * FROM content_planner_rows WHERE planner_id = ? ORDER BY sequence ASC').all(plannerId);
  if (!rows || rows.length === 0) {
    throw new Error('Belum ada baris plan yang dapat disinkronkan. Eksekusi AI Pipeline terlebih dahulu.');
  }

  // Ensure every row has a video_id
  const updateVideoIdStmt = await db.prepare('UPDATE content_planner_rows SET video_id = ? WHERE id = ?');
  for (const r of rows) {
    if (!r.video_id) {
      r.video_id = generateVideoId(planner.account_name);
      await updateVideoIdStmt.run(r.video_id, r.id);
    }
  }

  const accountName = (planner.account_name && planner.account_name.trim()) 
    ? planner.account_name.trim() 
    : (planner.brand_id || 'Default Account');
  const todayStr = new Date().toISOString().split('T')[0];

  const payload = rows.map(r => ({
    account_name: accountName,
    video_id: r.video_id,
    hook: r.hook || '',
    nama_produk: r.product || planner.product_name || '',
    link_affiliate: planner.affiliate_url || '',
    link_produk: planner.product_url || '',
    pipeline_status: 'In Production',
    production_date: todayStr
  }));

  const res = await sendToContentFlow(payload);

  return {
    success: true,
    planner_id: plannerId,
    account_name: accountName,
    synced_rows: rows.length,
    response: res.data
  };
}

/**
 * Legacy wrapper: sync to Google Sheets if explicitly invoked
 */
export async function syncPlannerToGoogleSheet(plannerId) {
  const db = getDb();
  const planner = await db.prepare('SELECT * FROM content_planners WHERE id = ?').get(plannerId);
  if (!planner) {
    throw new Error('Planner tidak ditemukan.');
  }

  if (!planner.google_sheet_id || !planner.google_sheet_id.trim()) {
    throw new Error('Google Sheet ID belum diisi pada planner ini.');
  }

  const rows = await db.prepare('SELECT * FROM content_planner_rows WHERE planner_id = ? ORDER BY sequence ASC').all(plannerId);
  if (!rows || rows.length === 0) {
    throw new Error('Belum ada baris plan yang dapat disinkronkan. Eksekusi AI Pipeline terlebih dahulu.');
  }

  // Ensure every row has a video_id
  const updateVideoIdStmt = await db.prepare('UPDATE content_planner_rows SET video_id = ? WHERE id = ?');
  for (const r of rows) {
    if (!r.video_id) {
      r.video_id = generateVideoId(planner.account_name);
      await updateVideoIdStmt.run(r.video_id, r.id);
    }
  }

  const { shouldSyncGoogleSheets } = await import('./google-auth.js');
  if (!shouldSyncGoogleSheets()) {
    console.log(`[ContentPlannerEngine] Storage provider is not Google Drive or Google account not connected. Skipping Google Sheets sync.`);
    return {
      success: true,
      planner_id: plannerId,
      skipped: true,
      message: 'Google Sheets sync skipped (Storage set to Nextcloud or Google account not connected)'
    };
  }

  const auth = getAuthorizedClient();
  const sheets = google.sheets({ version: 'v4', auth });
  const tabName = planner.account_name ? planner.account_name.trim() : 'Content_Planner';
  const headers = ['ID Video', 'Hook', 'Nama Produk', 'Link Affiliate', 'Link Produk'];
  const sheetRows = rows.map(r => [
    r.video_id || '',
    r.hook || '',
    r.product || planner.product_name || '',
    planner.affiliate_url || '',
    planner.product_url || ''
  ]);

  await ensureTabAndAppendRows(sheets, planner.google_sheet_id.trim(), tabName, headers, sheetRows);

  return {
    success: true,
    planner_id: plannerId,
    sheet_id: planner.google_sheet_id.trim(),
    tab_name: tabName,
    synced_rows: rows.length
  };
}

/**
 * Legacy wrapper: create draft & execute immediately
 */
export async function generateContentPlanner(params) {
  const draftResult = await createDraftContentPlanner(params);
  const execResult = await executeContentPlanner(draftResult.planner_id);
  return {
    ...draftResult,
    ...execResult
  };
}

/**
 * Regenerate single row or single field (hook, visual_action, strategy)
 */
export async function regeneratePlannerRow({ plannerId, rowId, scope = 'row', targetField = null }) {
  const db = getDb();
  const planner = await db.prepare('SELECT * FROM content_planners WHERE id = ?').get(plannerId);
  if (!planner) throw new Error('Planner tidak ditemukan.');

  const row = await db.prepare('SELECT * FROM content_planner_rows WHERE id = ?').get(rowId);
  if (!row) throw new Error('Baris planner tidak ditemukan.');

  if (row.is_locked) {
    throw new Error('Baris ini sedang dikunci (Locked). Buka kuncian terlebih dahulu untuk meregenerasi.');
  }

  const creativeKb = getCreativeGeneratorKB();

  if (targetField === 'hook' || scope === 'hook') {
    const prompt = `
Berdasarkan konteks strategi berikut:
- Produk: ${row.product}
- Deskripsi: ${planner.product_description}
- Pilar: ${row.pillar}
- Category CEP: ${row.category_cep}
- W'S Matrix: ${row.ws_matrix}
- Context: ${row.context}
- VFO: ${row.vfo}
- Strategic Angle: ${row.strategic_angle}
- Visual Action Saat Ini: ${row.visual_action}

Tuliskan SATU (1) "Hook" baru yang lebih menarik, emosional, dan sesuai platform ${planner.platform}.
Output WAJIB berupa JSON: { "hook": "..." }
`;
    const res = await callGeminiJson(prompt, creativeKb);
    const newHook = res.hook || res.new_hook || row.hook;
    await db.prepare('UPDATE content_planner_rows SET hook = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHook, rowId);
    return { ...row, hook: newHook };
  }

  if (targetField === 'visual_action' || scope === 'visual_action') {
    const prompt = `
Berdasarkan konteks strategi berikut:
- Produk: ${row.product}
- Deskripsi: ${planner.product_description}
- Hook Saat Ini: ${row.hook}
- Pilar: ${row.pillar}
- Category CEP: ${row.category_cep}
- Context: ${row.context}
- VFO: ${row.vfo}
- Strategic Angle: ${row.strategic_angle}

Tuliskan SATU (1) "Visual Action" baru (deskripsi pergerakan kamera, pencahayaan, aksi adegan produk).
Output WAJIB berupa JSON: { "visual_action": "..." }
`;
    const res = await callGeminiJson(prompt, creativeKb);
    const newVisual = res.visual_action || res.new_visual_action || row.visual_action;
    await db.prepare('UPDATE content_planner_rows SET visual_action = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newVisual, rowId);
    return { ...row, visual_action: newVisual };
  }

  // Scope = Full Row Regeneration
  const prompt = `
Regenerasi penuh untuk 1 baris planner produk "${row.product}":
- Deskripsi Produk: ${planner.product_description}
- Pilar: ${row.pillar}
- Platform: ${planner.platform}

Hasilkan strategi, konteks, hook, dan visual action baru.
Output WAJIB berupa JSON:
{
  "pillar": "${row.pillar}",
  "category_cep": "...",
  "ws_matrix": "...",
  "context": "...",
  "vfo": "...",
  "strategic_angle": "...",
  "hook": "...",
  "visual_action": "...",
  "product": "${row.product}"
}
`;
  const res = await callGeminiJson(prompt, creativeKb);
  const updated = {
    category_cep: res.category_cep || row.category_cep,
    ws_matrix: res.ws_matrix || row.ws_matrix,
    context: res.context || row.context,
    vfo: res.vfo || row.vfo,
    strategic_angle: res.strategic_angle || row.strategic_angle,
    hook: res.hook || row.hook,
    visual_action: res.visual_action || row.visual_action
  };

  await db.prepare(`
    UPDATE content_planner_rows
    SET category_cep = ?, ws_matrix = ?, context = ?, vfo = ?, strategic_angle = ?, hook = ?, visual_action = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    updated.category_cep,
    updated.ws_matrix,
    updated.context,
    updated.vfo,
    updated.strategic_angle,
    updated.hook,
    updated.visual_action,
    rowId
  );

  return { ...row, ...updated };
}
