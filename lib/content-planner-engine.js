import { getDb } from './db.js';
import { getGeminiModel } from './gemini.js';
import { getStrategicSkeletonKB, getCreativeGeneratorKB, getReviewerKB } from './kb-loader.js';
import { getAuthorizedClient } from './google-auth.js';
import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';
import { sendToContentFlow } from './contentflow-client.js';
import { getToneDemographicInstruction, UNIVERSAL_ZERO_TESTIMONY_MANDATE } from './prompts.js';
import { buildDistributionPlan, normalizeGeneratedPlannerRows, normalizePillars, validatePlannerCount, validatePlannerDraft } from './content-planner-contract.js';

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

async function getEditorialHistoryDigest(db, planner, pillars, limit = 90) {
  const rows = await db.prepare(`
    SELECT r.pillar, r.context, r.strategic_angle, r.hook
    FROM content_planner_rows r
    JOIN content_planners p ON r.planner_id = p.id
    WHERE p.planner_focus = 'brand_editorial'
      AND (p.brand_id = ? OR LOWER(p.account_name) = LOWER(?))
    ORDER BY r.created_at DESC
    LIMIT ?
  `).all(planner.brand_id || '', planner.account_name || '', limit);
  if (!rows?.length) return { hasHistory: false, totalRows: 0, digestText: '' };
  const contexts = [...new Set(rows.map(r => r.context).filter(Boolean))].slice(0, 35);
  const angles = [...new Set(rows.map(r => r.strategic_angle).filter(Boolean))];
  return {
    hasHistory: true,
    totalRows: rows.length,
    digestText: `=== RIWAYAT EDITORIAL BRAND (${rows.length} BARIS) ===\nPilar aktif: ${pillars.join(', ')}\nHindari pengulangan konteks: ${contexts.join(' | ')}\nHindari pengulangan angle: ${angles.join(' | ')}`
  };
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
    planner_focus = 'product_campaign',
    brand_context = null,
    content_goal = null,
    pillars = [],
    pillar_distribution_mode = 'balanced',
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

  const normalizedPillars = normalizePillars(pillars);
  const focus = validatePlannerDraft({ ...params, planner_focus, planner_count, pillars: normalizedPillars });
  const { count } = validatePlannerCount(focus, planner_count, normalizedPillars);

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}${mm}${dd}`;

  const cleanAcc = (account_name || 'Account').trim();
  const words = focus === 'brand_editorial'
    ? ['Editorial']
    : (product_name || '').trim().split(/\s+/).filter(Boolean);
  const twoWordsProd = words.slice(0, 2).join(' ');
  const defaultAutofillTitle = twoWordsProd 
    ? `${cleanAcc} - ${dateStr} - ${twoWordsProd}`
    : `${cleanAcc} - ${dateStr}`;

  const plannerTitle = (title || defaultAutofillTitle).trim();

  const db = getDb();
  const plannerId = `pln_${uuidv4().substring(0, 8)}`;
  await db.prepare(`
    INSERT INTO content_planners (
      id, title, account_name, google_sheet_id, brand_id, product_id, input_mode, planner_focus, brand_context, content_goal, pillars_json, pillar_distribution_mode, product_name, product_description, product_usp, product_url, affiliate_url, product_photo_url, product_ref_image, platform, objective, planner_count, status, target_audience
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    plannerId,
    plannerTitle,
    account_name,
    google_sheet_id,
    brand_id,
    product_id,
    input_mode,
    focus,
    brand_context,
    content_goal,
    JSON.stringify(normalizedPillars),
    pillar_distribution_mode,
    focus === 'product_campaign' ? product_name : null,
    focus === 'product_campaign' ? product_description : null,
    focus === 'product_campaign' ? product_usp : null,
    focus === 'product_campaign' ? product_url : null,
    focus === 'product_campaign' ? affiliate_url : null,
    focus === 'product_campaign' ? product_photo_url : null,
    focus === 'product_campaign' ? product_ref_image : null,
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
      planner_focus: focus,
      brand_context,
      content_goal,
      pillars: normalizedPillars,
      pillar_distribution_mode,
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

  const {
      planner_focus = 'product_campaign',
      brand_context,
      content_goal,
      brand_id,
      account_name,
      product_id,
      product_name,
      product_description,
      product_usp,
      platform = 'tiktok',
      objective = 'soft_sell',
      planner_count = 12,
      target_audience = 'genz_casual'
    } = planner;

  const pillars = normalizePillars(planner.pillars_json);
  const focus = validatePlannerDraft({ ...planner, planner_focus, planner_count, pillars });
  const { count, rowsPerPillar } = validatePlannerCount(focus, planner_count, pillars);

  // Change status only after the stored draft has passed validation.
  await db.prepare('UPDATE content_planners SET status = ? WHERE id = ?').run('generating', plannerId);

  try {
    const toneInstruction = getToneDemographicInstruction(target_audience);

    // 0. Extract Product History Digest & Dynamic Offset
    const historyDigest = focus === 'brand_editorial'
      ? await getEditorialHistoryDigest(db, planner, pillars, 90)
      : await getProductHistoryDigest(db, product_id, product_name, 60);
    const offsetIndex = historyDigest.totalRows || 0;
    const dynamicTemperature = historyDigest.hasHistory ? 0.85 : 0.7;

    console.log(`[ContentPlannerEngine] Focus: ${focus} | Subject: "${product_name || account_name}" | Existing History Rows: ${offsetIndex}`);

     // 1. Distribution Plan (with dynamic offset)
     const distributionPlan = buildDistributionPlan(count, pillars, offsetIndex, focus === 'brand_editorial' ? `${account_name}:${pillars.join('|')}` : product_name);
 
     // 2. AI Call 1: Strategic Skeleton Generator
     const strategicKb = getStrategicSkeletonKB();
     const skeletonSystemInstruction = `
Kamu adalah Strategic Content Architect senior MAKNA Engine.
Tugasmu adalah menyusun Rangka Strategi Konten (Strategic Skeleton) berdasarkan Knowledge Base Strategis berikut:

${strategicKb}
${UNIVERSAL_ZERO_TESTIMONY_MANDATE}

INSTRUKSI KHUSUS:
${focus === 'brand_editorial' ? `- MODE: BRAND EDITORIAL (BUKAN KAMPANYE PRODUK)
- Brand/Akun: ${account_name}
- Konteks Brand: ${brand_context}
- Tujuan Konten: ${content_goal || 'Membangun authority dan engagement akun'}
- Pilar Wajib: ${pillars.join(', ')}
- Jumlah Pilar: ${pillars.length}
- Ide per Pilar: ${rowsPerPillar}
- Total Baris: ${count}
- Setiap pilar WAJIB muncul tepat ${rowsPerPillar} kali.
- DILARANG menambah, menghapus, mengganti nama, atau mengubah distribusi pilar dari Strategic Skeleton.
- DILARANG mengarang, menyimpulkan, atau memaksakan produk tertentu.
- Product reference harus null kecuali produk diberikan eksplisit.
- Fokus pada masalah, kebiasaan, sistem, bahan, teknik, dan lifestyle audiens.` : `- MODE: PRODUCT CAMPAIGN
- Produk Target: ${product_name}
- Deskripsi Produk: ${product_description}
- USP Produk: ${product_usp || 'Tidak disebutkan'}`}
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
  "content_subject": string (subjek/topik spesifik baris),
  "product": ${focus === 'brand_editorial' ? 'null' : `string (Nama produk: "${product_name}")`},
  "product_reference": ${focus === 'brand_editorial' ? 'null' : `string (Nama produk: "${product_name}")`},
  "commercial_intent": string,
  "cta_type": string
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
    const generatedSkeletons = Array.isArray(skeletonResult) ? skeletonResult : (skeletonResult.planner_rows || skeletonResult.rows || []);

    if (!generatedSkeletons || generatedSkeletons.length === 0) {
      throw new Error('Gagal menghasilkan Strategic Skeleton dari AI.');
    }
    const skeletons = normalizeGeneratedPlannerRows(generatedSkeletons, distributionPlan, count);

    const creativeKb = getCreativeGeneratorKB();
    const creativeSystemInstruction = `
Kamu adalah Creative Copywriter & Visual Director senior MAKNA Engine.
Tugasmu adalah menghasilkan "Hook" (kalimat penarik perhatian 3 detik pertama) dan "Visual Action" (deskripsi visual gerakan kamera & aksi adegan) berdasarkan Strategic Skeleton yang SUDAH DILOCK.

${focus === 'brand_editorial' ? `INFORMASI BRAND EDITORIAL:
- Akun: ${account_name}
- Konteks: ${brand_context}
- Tujuan: ${content_goal || 'Authority dan engagement'}
- Jangan mengarang produk atau membuat CTA pembelian.` : `INFORMASI PRODUK TARGET:
- Nama Produk: ${product_name}
- Deskripsi Produk: ${product_description}
- USP Produk: ${product_usp || 'Tidak disebutkan'}`}

Gunakan Knowledge Base Kreatif berikut:
${creativeKb}
${UNIVERSAL_ZERO_TESTIMONY_MANDATE}

ATURAN STRUKTUR OUTPUT & KREATIF & GAYA BAHASA AUDIENS:
1. ${toneInstruction}
2. Hook harus sangat menarik perhatian 3 detik pertama, relevan dengan Context & Strategic Angle, tidak terkesan jualan kasar (soft-selling), serta memilih intonasi, diksi, dan gaya bahasa khas target audiens tersebut.
3. Visual Action harus mendeskripsikan pergerakan kamera dan aksi nyata yang dapat dieksekusi.${focus === 'product_campaign' ? ' Perlihatkan aksi produk secara fisik.' : ' Jangan memaksakan demonstrasi produk; visualkan aktivitas, bahan, teknik, atau lifestyle yang relevan.'}
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
    "product": string|null,
    "content_subject": string,
    "product_reference": string|null,
    "commercial_intent": string,
    "cta_type": string,
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
    const finalRows = normalizeGeneratedPlannerRows(creativeResult, skeletons, count);

    // Clean up existing rows if any
    await db.prepare('DELETE FROM content_planner_rows WHERE planner_id = ?').run(plannerId);

    const insertRowStmt = await db.prepare(`
      INSERT INTO content_planner_rows (
        id, planner_id, sequence, video_id, pillar, category_cep, ws_matrix, context, vfo, strategic_angle, narrative_mode, hook, visual_action, content_subject, product_reference, commercial_intent, cta_type, product, selling_intent, validation_status, is_locked
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
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
      const contentSubject = row.content_subject || skeletons[idx]?.content_subject || pCtx || pPillar;
      const productReference = focus === 'brand_editorial'
        ? (row.product_reference || null)
        : (row.product_reference || row.product || product_name);
      const pProduct = productReference || '';
      let commercialIntent = focus === 'brand_editorial' ? (row.commercial_intent || 'none') : (row.commercial_intent || objective);
      let ctaType = focus === 'brand_editorial' ? (row.cta_type || 'save') : (row.cta_type || 'product');
      if (!productReference && focus === 'brand_editorial') {
        if (commercialIntent === 'hard_sell') commercialIntent = 'none';
        if (ctaType === 'product') ctaType = 'save';
      }

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
        contentSubject,
        productReference,
        commercialIntent,
        ctaType,
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
        content_subject: contentSubject,
        product_reference: productReference,
        commercial_intent: commercialIntent,
        cta_type: ctaType,
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
    content_subject: r.content_subject || r.context || '',
    nama_produk: planner.planner_focus === 'brand_editorial'
      ? (r.product_reference || '')
      : (r.product_reference || r.product || planner.product_name || ''),
    link_affiliate: planner.planner_focus === 'brand_editorial' && !r.product_reference ? '' : (planner.affiliate_url || ''),
    link_produk: planner.planner_focus === 'brand_editorial' && !r.product_reference ? '' : (planner.product_url || ''),
    commercial_intent: r.commercial_intent || (planner.planner_focus === 'brand_editorial' ? 'none' : 'soft_sell'),
    cta_type: r.cta_type || (planner.planner_focus === 'brand_editorial' ? 'save' : 'product'),
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
  const isEditorial = planner.planner_focus === 'brand_editorial';
  const headers = isEditorial
    ? ['ID Video', 'Pilar', 'Content Subject', 'Hook', 'CTA', 'Product Reference']
    : ['ID Video', 'Hook', 'Nama Produk', 'Link Affiliate', 'Link Produk'];
  const sheetRows = rows.map(r => isEditorial ? [
    r.video_id || '', r.pillar || '', r.content_subject || r.context || '',
    r.hook || '', r.cta_type || 'save', r.product_reference || ''
  ] : [
    r.video_id || '', r.hook || '', r.product_reference || r.product || planner.product_name || '',
    planner.affiliate_url || '', planner.product_url || ''
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
  const isEditorial = planner.planner_focus === 'brand_editorial';
  const subjectInstruction = isEditorial
    ? `- Content Subject: ${row.content_subject || row.context}\n- Mode: Brand Editorial; jangan mengarang atau memaksakan produk.`
    : `- Produk: ${row.product_reference || row.product}\n- Deskripsi: ${planner.product_description}`;

  if (targetField === 'hook' || scope === 'hook') {
    const prompt = `
Berdasarkan konteks strategi berikut:
${subjectInstruction}
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
${subjectInstruction}
- Hook Saat Ini: ${row.hook}
- Pilar: ${row.pillar}
- Category CEP: ${row.category_cep}
- Context: ${row.context}
- VFO: ${row.vfo}
- Strategic Angle: ${row.strategic_angle}

Tuliskan SATU (1) "Visual Action" baru (deskripsi pergerakan kamera, pencahayaan, dan aksi nyata). ${isEditorial ? 'Visualkan aktivitas/topik tanpa memaksakan produk.' : 'Perlihatkan aksi produk.'}
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
