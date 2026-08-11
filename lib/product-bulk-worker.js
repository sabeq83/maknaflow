/**
 * product-bulk-worker.js
 * Refactored v2 — PostgreSQL tenant-aware, split stages:
 *   1. Enrichment via Gemini (metadata + prompts)
 *   2. Photo dispatch (Gemini sync or G-Labs async)
 *   3. G-Labs polling & result save
 *
 * Aturan:
 * - Tidak menggunakan SQLite (getDb()) untuk operasi product baru.
 * - Tidak menggunakan rembg / bg-remover.js.
 * - Input reference AI selalu raw_photo_url.
 * - Output clean hanya menulis clean_photo_url dan cleaned_photo_url (mirror).
 * - generated_photo_url dan active_photo tidak ditulis oleh pipeline ini.
 */

import fs from 'fs';
import path from 'path';
import { executeWithKeyPool } from './gemini.js';
import { getActiveTenantId, tenantContext } from './tenant-context.js';
import { pgQuery, withPgTransaction, getPgPool } from './db-pg.js';
import { getSetting } from './db.js';
import { pollGlabsPhotoTask } from './product-photo-providers/glabs.js';
import { buildCleanProductPrompt, resolveProductPhotoProvider } from './product-photo-service.js';
import { saveCleanProductImage, readLocalImageToBuffer, sha256Hex, detectImageMime } from './product-image-storage.js';

// ============================================================
// LOGGING
// ============================================================

function safeTenantId(tenantId) {
  if (!tenantId) return 'default';
  return String(tenantId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
}

function logToBulk(message, tenantId) {
  try {
    const logDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const safeId = safeTenantId(tenantId || getActiveTenantId());
    const logPath = path.join(logDir, `product_bulk_logs_${safeId}.txt`);
    const timestamp = new Date().toLocaleString('id-ID');
    const logLine = `[${timestamp}] ${message}`;
    console.log(`[Product Bulk Worker] ${message}`);
    fs.appendFileSync(logPath, `${logLine}\n`);
  } catch (err) {
    console.error('[Bulk Worker Logger Error]:', err.message);
  }
}

// ============================================================
// REPOSITORY CLAIM HELPERS (tenant-aware, FOR UPDATE SKIP LOCKED)
// ============================================================

/**
 * Klaim batch produk yang perlu enrichment.
 * Tandai enrichment_status = 'processing' agar worker lain tidak memproses ulang.
 */
export async function claimPendingEnrichmentProducts({ tenantId, limit = 10 }) {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query(`
      SELECT id, product_name, raw_description, product_description, packaging_status, raw_photo_url, photo_provider
      FROM product_extractions
      WHERE tenant_id = $1
        AND enrichment_status = 'pending'
      ORDER BY created_at ASC
      LIMIT $2
      FOR UPDATE SKIP LOCKED
    `, [tenantId, limit]);

    if (res.rowCount > 0) {
      const ids = res.rows.map(r => r.id);
      await client.query(`
        UPDATE product_extractions
        SET enrichment_status = 'processing', updated_at = NOW()
        WHERE id = ANY($1::text[]) AND tenant_id = $2
      `, [ids, tenantId]);
    }
    await client.query('COMMIT');
    return res.rows.map(r => ({ ...r, tenantId }));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Klaim batch produk yang perlu pemrosesan foto (status photo_status = 'pending').
 */
export async function claimPendingPhotoProducts({ tenantId, limit = 5 }) {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query(`
      SELECT id, product_name, raw_photo_url, clean_photo_t2i_prompt, photo_provider,
             packaging_status, enrichment_status
      FROM product_extractions
      WHERE tenant_id = $1
        AND photo_status = 'pending'
        AND enrichment_status IN ('completed', 'needs_review', 'failed')
      ORDER BY created_at ASC
      LIMIT $2
      FOR UPDATE SKIP LOCKED
    `, [tenantId, limit]);

    if (res.rowCount > 0) {
      const ids = res.rows.map(r => r.id);
      await client.query(`
        UPDATE product_extractions
        SET photo_status = 'processing', updated_at = NOW()
        WHERE id = ANY($1::text[]) AND tenant_id = $2
      `, [ids, tenantId]);
    }
    await client.query('COMMIT');
    return res.rows.map(r => ({ ...r, tenantId }));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ============================================================
// FASE 1: ENRICHMENT VIA GEMINI (metadata + prompts)
// ============================================================

async function enrichProduct(job) {
  const { id, product_name, raw_description, product_description, packaging_status, raw_photo_url, tenantId } = job;
  logToBulk(`[Enrichment] Memulai untuk "${product_name}" (${id})`, tenantId);

  const description = raw_description || product_description || '';
  const prompt = buildEnrichmentPrompt([{ id, product_name, raw_description: description, packaging_status }]);

  try {
    const rawResponse = await executeWithKeyPool(1, async (apiKey) => {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const { GEMINI_MODELS } = await import('./gemini.js');
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: GEMINI_MODELS.PRIMARY,
        generationConfig: { responseMimeType: 'application/json', temperature: 0.7 }
      });
      const result = await model.generateContent([{ text: prompt }]);
      return result.response.text();
    });

    const enriched = JSON.parse(rawResponse);
    const item = (enriched.products || [enriched])[0];
    if (!item) throw new Error('Gemini tidak mengembalikan data produk');

    await pgQuery(`
      UPDATE product_extractions
      SET unique_selling_point = $1,
          product_truth = $2,
          geometric_truth = $3,
          clean_photo_t2i_prompt = $4,
          t2i_prompt = $5,
          i2v_action_prompt = $6,
          category = COALESCE($7, category),
          enrichment_status = 'completed',
          enrichment_error = NULL,
          extraction_status = 'pending_image',
          updated_at = NOW()
      WHERE id = $8 AND tenant_id = $9
    `, [
      JSON.stringify(item.unique_selling_point || []),
      item.product_truth || null,
      item.geometric_truth || null,
      item.clean_photo_t2i_prompt || null,
      item.t2i_prompt || null,
      item.i2v_action_prompt || null,
      item.category || null,
      id,
      tenantId
    ]);

    // Queue foto setelah enrichment selesai
    await pgQuery(`
      UPDATE product_extractions
      SET photo_status = 'pending', updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2 AND photo_status = 'approved'
    `, [id, tenantId]);

    logToBulk(`[Enrichment] ✅ "${product_name}" selesai diperkaya`, tenantId);
  } catch (err) {
    logToBulk(`[Enrichment ERROR] "${product_name}": ${err.message}`, tenantId);
    await pgQuery(`
      UPDATE product_extractions
      SET enrichment_status = 'failed',
          enrichment_error = $1,
          extraction_status = 'failed',
          updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3
    `, [err.message.slice(0, 500), id, tenantId]).catch(() => {});
  }
}

function buildEnrichmentPrompt(products) {
  return `Anda adalah expert E-commerce Copywriter dan Branding Strategist.
Analisis produk berikut dan kembalikan JSON valid (tanpa markdown):
${JSON.stringify(products, null, 2)}

Format output:
{
  "products": [
    {
      "id": "ID produk asli",
      "unique_selling_point": ["USP 1", "USP 2", "USP 3"],
      "product_truth": "Fakta nyata produk dari perspektif konsumen (1-2 kalimat)",
      "geometric_truth": "Deskripsi bentuk fisik, dimensi, dan visual kemasan (1-2 kalimat)",
      "category": "Kategori produk",
      "clean_photo_t2i_prompt": "Prompt Bahasa Inggris untuk foto produk clean berlatar putih — deskripsi produk, studio light, white background",
      "t2i_prompt": "Prompt Bahasa Inggris untuk foto kampanye premium studio",
      "i2v_action_prompt": "Prompt Bahasa Inggris untuk pergerakan kamera halus (slow zoom, panning)"
    }
  ]
}
Aturan: JSON valid, ID sesuai input, semua prompt Bahasa Inggris.`;
}

// ============================================================
// FASE 2: DISPATCH FOTO (Gemini sync atau G-Labs async)
// ============================================================

async function processProductPhoto(job) {
  const { id, product_name, raw_photo_url, clean_photo_t2i_prompt, tenantId } = job;
  logToBulk(`[Photo] Memproses foto untuk "${product_name}" (${id})`, tenantId);

  try {
    // Resolve reference image dari raw_photo_url
    let referenceImage = null;
    if (raw_photo_url) {
      const buf = readLocalImageToBuffer(raw_photo_url);
      if (buf) {
        const mime = detectImageMime(buf);
        referenceImage = `data:${mime};base64,${buf.toString('base64')}`;
      }
    }

    const prompt = clean_photo_t2i_prompt || buildCleanProductPrompt(job);
    const provider = await resolveProductPhotoProvider(job, tenantId);

    if (provider === 'gemini') {
      const { generateWithGemini } = await import('./product-photo-providers/gemini.js');
      const result = await generateWithGemini({ referenceImage, prompt, tenantId });

      if (result.imageBuffer) {
        await saveAndCommitCleanPhoto({
          tenantId, productId: id, imageBuffer: result.imageBuffer,
          mimeType: result.mimeType, provider: 'gemini', productName: product_name
        });
        return;
      }
    }

    // G-Labs async
    const { generateWithGlabs } = await import('./product-photo-providers/glabs.js');
    const result = await generateWithGlabs({ referenceImage, prompt, tenantId });

    await pgQuery(`
      UPDATE product_extractions
      SET photo_task_id = $1,
          photo_provider = 'glabs',
          photo_status = 'processing',
          extraction_status = 'generating_image',
          updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3
    `, [result.taskId, id, tenantId]);

    logToBulk(`[Photo] G-Labs task ${result.taskId} dikirim untuk "${product_name}"`, tenantId);
  } catch (err) {
    logToBulk(`[Photo ERROR] "${product_name}": ${err.message}`, tenantId);
    await pgQuery(`
      UPDATE product_extractions
      SET photo_status = 'failed',
          photo_error = $1,
          extraction_status = 'failed',
          updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3
    `, [err.message.slice(0, 500), id, tenantId]).catch(() => {});
  }
}

// ============================================================
// FASE 3: POLLING G-LABS & SIMPAN HASIL
// ============================================================

export async function pollPendingProductPhotoTasks({ tenantId, limit = 20 }) {
  const res = await pgQuery(`
    SELECT id, product_name, photo_task_id, tenant_id
    FROM product_extractions
    WHERE tenant_id = $1
      AND photo_status = 'processing'
      AND photo_provider = 'glabs'
      AND photo_task_id IS NOT NULL
    ORDER BY updated_at ASC
    LIMIT $2
  `, [tenantId, limit]);

  for (const product of res.rows) {
    try {
      logToBulk(`[Polling] Memeriksa task ${product.photo_task_id} untuk "${product.product_name}"`, tenantId);
      const pollResult = await pollGlabsPhotoTask(product.photo_task_id);

      if (pollResult.completed) {
        await saveAndCommitCleanPhoto({
          tenantId,
          productId: product.id,
          imageBuffer: pollResult.imageBuffer,
          mimeType: pollResult.mimeType,
          provider: 'glabs',
          productName: product.product_name
        });
      } else if (pollResult.failed) {
        logToBulk(`[Polling] ❌ Task gagal untuk "${product.product_name}"`, tenantId);
        await pgQuery(`
          UPDATE product_extractions
          SET photo_status = 'failed',
              photo_error = $1,
              extraction_status = 'failed',
              updated_at = NOW()
          WHERE id = $2 AND tenant_id = $3
        `, [pollResult.error || 'G-Labs task failed', product.id, tenantId]);
      }
      // masih processing: tidak ada update
    } catch (err) {
      logToBulk(`[Polling ERROR] task ${product.photo_task_id}: ${err.message}`, tenantId);
    }
  }
}

// ============================================================
// HELPER: SIMPAN CLEAN PHOTO & UPDATE DB
// ============================================================

async function saveAndCommitCleanPhoto({ tenantId, productId, imageBuffer, mimeType, provider, productName }) {
  try {
    const saved = await saveCleanProductImage({ tenantId, productId, buffer: imageBuffer, mimeType });
    const sha256 = sha256Hex(imageBuffer);
    const autoApprove = Number(await getSetting('product_photo_auto_approve').catch(() => '0')) === 1;
    const newStatus = autoApprove ? 'approved' : 'needs_review';
    const newExtractionStatus = autoApprove ? 'completed' : 'completed'; // selalu completed (review di UI)

    await pgQuery(`
      UPDATE product_extractions
      SET clean_photo_url = $1,
          cleaned_photo_url = $1,
          photo_url = $1,
          photo_status = $2,
          photo_provider = $3,
          photo_error = NULL,
          extraction_status = $4,
          updated_at = NOW()
      WHERE id = $5 AND tenant_id = $6
    `, [
      saved.relativePath,
      newStatus,
      provider,
      newExtractionStatus,
      productId,
      tenantId
    ]);

    // Jangan menulis generated_photo_url atau active_photo pada pipeline baru

    logToBulk(`[Photo] ✅ Clean photo disimpan untuk "${productName}": ${saved.relativePath} (${newStatus})`, tenantId);
  } catch (err) {
    logToBulk(`[Save Clean ERROR] "${productName}": ${err.message}`, tenantId);
    await pgQuery(`
      UPDATE product_extractions
      SET photo_status = 'failed',
          photo_error = $1,
          updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3
    `, [err.message.slice(0, 500), productId, tenantId]).catch(() => {});
  }
}

// ============================================================
// ENTRY POINT — DIPANGGIL OLEH SCHEDULER
// ============================================================

// Fungsi bantu internal untuk menjalankan satu cycle per tenant
async function runBulkCycleForTenant(tenantId) {
  logToBulk('======= Bulk Worker Cycle Start =======', tenantId);

  // Fase 1: Enrichment
  try {
    const enrichmentJobs = await claimPendingEnrichmentProducts({ tenantId, limit: 10 });
    if (enrichmentJobs.length > 0) {
      logToBulk(`Menemukan ${enrichmentJobs.length} produk pending enrichment.`, tenantId);
      for (const job of enrichmentJobs) {
        await enrichProduct(job);
      }
    }
  } catch (err) {
    logToBulk(`[Enrichment Claim ERROR]: ${err.message}`, tenantId);
  }

  // Fase 2: Photo dispatch
  try {
    const photoJobs = await claimPendingPhotoProducts({ tenantId, limit: 5 });
    if (photoJobs.length > 0) {
      logToBulk(`Menemukan ${photoJobs.length} produk pending foto.`, tenantId);
      for (const job of photoJobs) {
        await processProductPhoto(job);
      }
    }
  } catch (err) {
    logToBulk(`[Photo Claim ERROR]: ${err.message}`, tenantId);
  }

  // Fase 3: G-Labs polling
  try {
    await pollPendingProductPhotoTasks({ tenantId, limit: 20 });
  } catch (err) {
    logToBulk(`[Polling ERROR]: ${err.message}`, tenantId);
  }

  logToBulk('======= Bulk Worker Cycle End =======', tenantId);
}

export async function processProductBulkEnrichment() {
  let activeTenantId;
  try {
    // Gunakan AsyncLocalStorage langsung untuk mendeteksi context
    activeTenantId = tenantContext.getStore();
  } catch (_) {
    activeTenantId = null;
  }

  // Skenario A: Dipanggil dalam context request tenant tertentu (misal: API manual trigger)
  if (activeTenantId && activeTenantId !== '__none__') {
    await runBulkCycleForTenant(activeTenantId);
    return;
  }

  // Skenario B: Dipanggil secara global oleh Scheduler (background loop)
  // Ambil semua tenant_id yang memiliki antrean produk aktif
  try {
    const pendingTenants = await pgQuery(`
      SELECT DISTINCT tenant_id FROM product_extractions
      WHERE enrichment_status = 'pending'
         OR photo_status = 'pending'
         OR (photo_status = 'processing' AND photo_provider = 'glabs' AND photo_task_id IS NOT NULL)
    `);

    await Promise.all(pendingTenants.rows.map(async (row) => {
      const tId = row.tenant_id;
      if (tId && tId !== '__none__') {
        await tenantContext.run(tId, async () => {
          await runBulkCycleForTenant(tId);
        });
      }
    }));
  } catch (err) {
    console.error('[Product Bulk Worker] Gagal mendeteksi antrean tenant:', err.message);
  }
}
