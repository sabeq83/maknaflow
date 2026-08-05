import { NextResponse } from 'next/server';
import { getDb, getSheetsCampaign, getSetting } from '@/lib/db';
import { sanitizeI2vPrompt } from '@/lib/prompts';
import { getAuthorizedClient } from '@/lib/google-auth';
import { google } from 'googleapis';
import { generateImage, generateVideo, getTaskStatus, getFileUrl } from '@/lib/webhook-client';
import { processVideoMuxing } from '@/lib/video-studio-processor'; // kept for potential future use
import { getOrCreateFolderInFolder, uploadLocalFileToFolder } from '@/lib/drive-uploader';
import fs from 'fs';
import path from 'path';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function log(msg) {
  const ts = new Date().toLocaleTimeString('id-ID', { hour12: false });
  const line = `[${ts}] [repair-clip] ${msg}`;
  console.log(line);
  return line;
}

function fileToBase64(relPath) {
  try {
    const absPath = relPath.startsWith('/') ? path.join(process.cwd(), 'public', relPath) : relPath;
    if (!fs.existsSync(absPath)) return null;
    return fs.readFileSync(absPath).toString('base64');
  } catch {
    return null;
  }
}

// Resolve the best product image path following hierarchy: Studio -> Cleaned/Clean -> photo_url -> Raw
function resolveProductImagePath(product) {
  if (!product) return null;
  
  // 1. Studio photo (generated_photo_url)
  if (product.generated_photo_url) {
    const absPath = path.join(process.cwd(), 'public', product.generated_photo_url);
    if (fs.existsSync(absPath)) {
      return product.generated_photo_url;
    }
  }
  
  // 2. Cleaned photo (cleaned_photo_url)
  if (product.cleaned_photo_url) {
    const absPath = path.join(process.cwd(), 'public', product.cleaned_photo_url);
    if (fs.existsSync(absPath)) {
      return product.cleaned_photo_url;
    }
  }
  
  // 2b. Clean photo (clean_photo_url)
  if (product.clean_photo_url) {
    const absPath = path.join(process.cwd(), 'public', product.clean_photo_url);
    if (fs.existsSync(absPath)) {
      return product.clean_photo_url;
    }
  }
  
  // 3. Fallback pointer (photo_url)
  if (product.photo_url) {
    const absPath = path.join(process.cwd(), 'public', product.photo_url);
    if (fs.existsSync(absPath)) {
      return product.photo_url;
    }
  }
  
  // 4. Raw photo (raw_photo_url)
  if (product.raw_photo_url) {
    const absPath = path.join(process.cwd(), 'public', product.raw_photo_url);
    if (fs.existsSync(absPath)) {
      return product.raw_photo_url;
    }
  }
  
  return null;
}

import { withTenantContext } from '@/lib/auth';

export const POST = withTenantContext(async (request) => {
  const logs = [];
  const addLog = (msg) => { logs.push(log(msg)); };

  try {
    const body = await request.json();
    const { jobId, clipIndex, productImageUrl: productImageUrlOverride } = body;

    if (!jobId || !clipIndex) {
      return NextResponse.json({ error: 'jobId dan clipIndex diperlukan' }, { status: 400 });
    }

    addLog(`Memulai repair klip ${clipIndex} untuk job ${jobId}...`);

    const db = getDb();
    const job = await db.prepare('SELECT * FROM sheets_jobs WHERE id = ?').get(jobId);
    if (!job) return NextResponse.json({ error: `Job ${jobId} tidak ditemukan` }, { status: 404 });

    const campaign = await getSheetsCampaign(job.campaign_id);
    if (!campaign) return NextResponse.json({ error: `Campaign tidak ditemukan` }, { status: 404 });

    const batchId = job.batch_id;
    const tempDir = path.join(process.cwd(), 'public', 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    // ─── STEP 1: Ambil prompts dari job ───────────────────────────────────────
    addLog('Membaca prompts dari DB...');
    const prompts = JSON.parse(job.prompts_json || '{}');
    const t2vObj = (prompts.t2v_prompts || []).find(p => Number(p.clip) === clipIndex);
    const t2iObj = (prompts.t2i_prompts || []).find(p => Number(p.clip) === clipIndex);
    const i2vObj = (prompts.i2v_prompts || []).find(p => Number(p.clip) === clipIndex);

    let newClipVideoUrl = null;
    let finalTaskId = null;
    let usedPrompt = '';

    if (t2vObj && (!t2iObj || !i2vObj)) {
      // ─── T2V Flow (Text-to-Video) ──────────────────────────────────────────
      addLog('[T2V] Mengirim request generate video (Text-to-Video)...');
      const t2vResult = await generateVideo({
        prompt: t2vObj.prompt,
        model: campaign.video_model || 'veo_31_lite',
        aspect_ratio: campaign.aspect_ratio || '9:16'
      });
      if (!t2vResult?.task_id) throw new Error('Gagal mendapatkan task_id dari T2V');
      addLog(`T2V task_id: ${t2vResult.task_id}. Polling...`);
      finalTaskId = t2vResult.task_id;
      usedPrompt = t2vObj.prompt;

      for (let i = 0; i < 60; i++) {
        await sleep(5000);
        const statusRes = await getTaskStatus(t2vResult.task_id);
        if (statusRes?.status === 'completed') {
          const files = statusRes.results || statusRes.files || [];
          let videoFile = files.find(f => f.endsWith('.mp4')) || files[0];
          if (videoFile && (videoFile.startsWith('http://') || videoFile.startsWith('https://'))) {
            newClipVideoUrl = videoFile;
          } else {
            newClipVideoUrl = getFileUrl(videoFile);
          }
          addLog(`T2V selesai! URL: ${newClipVideoUrl}`);
          break;
        } else if (statusRes?.status === 'failed') {
          throw new Error(`T2V task ${t2vResult.task_id} gagal.`);
        }
      }
      if (!newClipVideoUrl) throw new Error('T2V task timeout setelah 300 detik.');

    } else if (t2iObj && i2vObj) {
      // ─── Double-Pass Flow (T2I + I2V) ──────────────────────────────────────
      addLog(`T2I prompt: ${t2iObj.prompt.substring(0, 80)}...`);
      addLog(`I2V prompt: ${i2vObj.prompt.substring(0, 80)}...`);
      usedPrompt = i2vObj.prompt;

      // ─── STEP 2: Ambil foto produk ────────────────────────────────────────────
      addLog('Mencari foto produk dari DB...');
      const auth = getAuthorizedClient();
      const sheets = google.sheets({ version: 'v4', auth });

      // Baca header sheet
      const sheetName = campaign.campaign_type === 'OPC' ? 'CAMPAIGN_OPC'
        : campaign.campaign_type === 'RE' ? 'CAMPAIGN_RE'
        : campaign.campaign_type === 'IFC' ? 'CAMPAIGN_IFC'
        : 'CAMPAIGN';

      const headerRes = await sheets.spreadsheets.values.get({
        spreadsheetId: campaign.spreadsheet_id,
        range: `'${sheetName}'!A1:Z1`
      });
      const headers = (headerRes.data.values?.[0] || []).map(h => h.trim().toLowerCase());
      const linkProductIdx = headers.findIndex(h =>
        ['link product', 'link_product', 'link produk', 'url produk', 'url product', 'url_product'].includes(h)
      );

      const rowRes = await sheets.spreadsheets.values.get({
        spreadsheetId: campaign.spreadsheet_id,
        range: `'${sheetName}'!A${job.row_index}:Z${job.row_index}`
      });
      const row = rowRes.data.values?.[0] || [];
      const productUrl = linkProductIdx !== -1 ? row[linkProductIdx]?.trim() : '';

      let product = null;
      if (productUrl && productUrl.startsWith('http')) {
        product = await db.prepare('SELECT * FROM product_extractions WHERE input_source = ? OR source_url = ?').get(productUrl, productUrl);
      }

      if (!product) {
        return NextResponse.json({
          error: 'Produk tidak ditemukan di DB. Pastikan JIT scraping sudah pernah berjalan untuk URL produk ini.',
          productUrl
        }, { status: 400 });
      }

      addLog(`Produk ditemukan: "${product.product_name}"`);

      // Re-download foto jika file hilang dari disk
      let productBase64 = null;

      if (productImageUrlOverride) {
        // Override URL diberikan langsung — download tanpa cek disk
        addLog(`Menggunakan productImageUrl override: ${productImageUrlOverride}`);
        const imgRes = await fetch(productImageUrlOverride);
        if (!imgRes.ok) throw new Error(`Gagal download foto produk dari override URL: HTTP ${imgRes.status}`);
        const imgBuf = Buffer.from(await imgRes.arrayBuffer());
        productBase64 = imgBuf.toString('base64');
        // Simpan ke disk + update DB untuk future use
        const safeFilename = `repair_product_${Date.now()}.png`;
        const newPhotoPath = `/uploads/products/${safeFilename}`;
        const absNewPath = path.join(process.cwd(), 'public', 'uploads', 'products', safeFilename);
        fs.mkdirSync(path.dirname(absNewPath), { recursive: true });
        fs.writeFileSync(absNewPath, imgBuf);
        await db.prepare("UPDATE product_extractions SET photo_url = ?, scraped_image_url = ? WHERE id = ?")
          .run(newPhotoPath, productImageUrlOverride, product.id);
        addLog(`Foto produk disimpan ke ${newPhotoPath} dan DB diperbarui.`);
      } else {
        const resolvedPath = resolveProductImagePath(product);
        if (resolvedPath) {
          addLog(`Menggunakan foto produk: ${resolvedPath}`);
          productBase64 = fileToBase64(resolvedPath);
        }

        if (!productBase64) {
          addLog(`File foto produk tidak ada di disk. Mencoba re-download dari scraped_image_url...`);
          const redownloadUrl = product.scraped_image_url;
          if (redownloadUrl && redownloadUrl.startsWith('http')) {
            const imgRes = await fetch(redownloadUrl);
            if (!imgRes.ok) throw new Error(`Gagal download foto produk: HTTP ${imgRes.status}`);
            const imgBuf = Buffer.from(await imgRes.arrayBuffer());
            
            const rawFilename = `raw_redownload_${product.id || Date.now()}.png`;
            const rawRelPath = `/uploads/products/raw/${rawFilename}`;
            const rawAbsPath = path.join(process.cwd(), 'public', 'uploads', 'products', 'raw', rawFilename);
            
            fs.mkdirSync(path.dirname(rawAbsPath), { recursive: true });
            fs.writeFileSync(rawAbsPath, imgBuf);
            
            // Simpan raw_photo_url ke DB
            await db.prepare("UPDATE product_extractions SET raw_photo_url = ? WHERE id = ?").run(rawRelPath, product.id);
            product.raw_photo_url = rawRelPath; // update in-memory object
            
            addLog(`Foto produk berhasil di-download ulang ke ${rawRelPath}`);
            productBase64 = imgBuf.toString('base64');
          } else {
            addLog('scraped_image_url kosong. Tidak dapat re-download foto produk secara otomatis.');
            return NextResponse.json({
              error: 'File foto produk hilang dari disk dan scraped_image_url tidak tersedia di DB. Sertakan "productImageUrl" (URL CDN langsung ke gambar produk) di body request.',
              product_id: product.id,
              photo_url: product.photo_url
            }, { status: 400 });
          }
        }
      }

      addLog('Foto produk berhasil di-encode ke base64.');

      // ─── STEP 3: T2I — Generate start frame ───────────────────────────────────
      addLog('[T2I] Mengirim request generate image (start frame)...');
      const imageModel = await getSetting('webhook_image_model') || 'nano_banana_pro';
      const t2iResult = await generateImage({
        prompt: t2iObj.prompt,
        model: imageModel,
        aspect_ratio: campaign.aspect_ratio || '9:16',
        reference_images: (imageModel.startsWith('nano_') || imageModel.includes('banana'))
          ? [productBase64]
          : [{ data: productBase64, category: 'subject' }]
      });
      if (!t2iResult?.task_id) throw new Error('Gagal mendapatkan task_id dari T2I');
      addLog(`T2I task_id: ${t2iResult.task_id}. Polling...`);

      let t2iImageUrl = null;
      for (let i = 0; i < 40; i++) {
        await sleep(2000);
        const statusRes = await getTaskStatus(t2iResult.task_id);
        if (statusRes?.status === 'completed') {
          const files = statusRes.results || statusRes.files || [];
          let imageFile = files.find(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')) || files[0];
          if (imageFile && (imageFile.startsWith('http://') || imageFile.startsWith('https://'))) {
            imageFile = imageFile.split('/').pop();
          }
          t2iImageUrl = getFileUrl(imageFile);
          addLog(`T2I selesai! URL: ${t2iImageUrl}`);
          break;
        } else if (statusRes?.status === 'failed') {
          throw new Error(`T2I task ${t2iResult.task_id} gagal.`);
        }
      }
      if (!t2iImageUrl) throw new Error('T2I task timeout setelah 80 detik.');

      // ─── STEP 4: Unduh start frame → encode ke base64 ────────────────────────
      addLog('Mengunduh start frame...');
      const startFrameRes = await fetch(t2iImageUrl);
      if (!startFrameRes.ok) throw new Error(`Gagal mengunduh start frame: HTTP ${startFrameRes.status}`);
      const startFrameBuffer = Buffer.from(await startFrameRes.arrayBuffer());
      const startFrameBase64 = startFrameBuffer.toString('base64');
      addLog('Start frame berhasil diunduh dan di-encode.');

      // ─── STEP 5: I2V — Generate video dari start frame ───────────────────────
      const safeI2vPrompt = sanitizeI2vPrompt(i2vObj.prompt);
      if (safeI2vPrompt !== i2vObj.prompt) {
        addLog(`[I2V Sanitizer] Prompt dimodifikasi untuk keamanan content policy.`);
        addLog(`[I2V Sanitizer] Prompt aman: ${safeI2vPrompt.substring(0, 100)}...`);
      }
      addLog('[I2V] Mengirim request generate video dari start frame...');
      const i2vResult = await generateVideo({
        prompt: safeI2vPrompt,
        model: campaign.video_model || 'veo_31_lite',
        aspect_ratio: campaign.aspect_ratio || '9:16',
        mode: 'start_image',
        reference_images: [startFrameBase64]
      });
      if (!i2vResult?.task_id) throw new Error('Gagal mendapatkan task_id dari I2V');
      addLog(`I2V task_id: ${i2vResult.task_id}. Polling...`);
      finalTaskId = i2vResult.task_id;

      for (let i = 0; i < 60; i++) {
        await sleep(5000);
        const statusRes = await getTaskStatus(i2vResult.task_id);
        if (statusRes?.status === 'completed') {
          const files = statusRes.results || statusRes.files || [];
          let videoFile = files.find(f => f.endsWith('.mp4')) || files[0];
          if (videoFile && (videoFile.startsWith('http://') || videoFile.startsWith('https://'))) {
            newClipVideoUrl = videoFile;
          } else {
            newClipVideoUrl = getFileUrl(videoFile);
          }
          addLog(`I2V selesai! URL: ${newClipVideoUrl}`);
          break;
        } else if (statusRes?.status === 'failed') {
          throw new Error(`I2V task ${i2vResult.task_id} gagal.`);
        }
      }
      if (!newClipVideoUrl) throw new Error('I2V task timeout setelah 300 detik.');

    } else {
      return NextResponse.json({
        error: `Tidak ada T2V atau T2I/I2V prompt untuk klip ${clipIndex}.`,
        prompts_keys: Object.keys(prompts)
      }, { status: 400 });
    }

    // Update glabs_tasks untuk klip ini dengan video baru
    const updateRes = await db.prepare("UPDATE glabs_tasks SET video_url = ?, task_id = ?, status = 'completed' WHERE item_id = ? AND clip_index = ?")
      .run(newClipVideoUrl, finalTaskId, jobId, clipIndex);

    if (updateRes.changes === 0) {
      addLog(`Klip ${clipIndex} tidak ditemukan di glabs_tasks. Membuat baris baru...`);
      await db.prepare(`
        INSERT INTO glabs_tasks (task_id, campaign_id, item_id, clip_index, prompt, status, video_url)
        VALUES (?, ?, ?, ?, ?, 'completed', ?)
      `).run(finalTaskId, job.campaign_id, jobId, clipIndex, usedPrompt, newClipVideoUrl);
    }

    addLog(`DB glabs_tasks klip ${clipIndex} diperbarui dengan video URL baru.`);

    // ─── STEP 6: Download klip baru yang baru saja digenerate ────────────────
    addLog(`Mengunduh klip ${clipIndex} baru dari G-Labs...`);
    const newClipFileName = `temp_clip_${batchId}_${clipIndex}.mp4`;
    const absoluteNewClipPath = path.join(tempDir, newClipFileName);
    const dlRes = await fetch(newClipVideoUrl);
    if (!dlRes.ok) throw new Error(`Gagal mengunduh klip ${clipIndex} baru: HTTP ${dlRes.status}`);
    fs.writeFileSync(absoluteNewClipPath, Buffer.from(await dlRes.arrayBuffer()));
    addLog(`Klip ${clipIndex} baru berhasil diunduh ke ${newClipFileName}.`);

    // ─── STEP 7: Upload klip baru ke Storage Provider ────────────────────────
    const storageProvider = await getSetting('storage_provider') || 'gdrive';
    let shareUrl = job.gdrive_folder_url || '';

    if (storageProvider === 'nextcloud') {
      addLog(`Mengunggah klip ${clipIndex} baru ke Nextcloud...`);
      const { uploadFileToNextcloud, getOrCreatePublicShareLink, checkAndCreateFolder } = await import('@/lib/nextcloud-helper');
      const targetFolder = campaign.gdrive_folder_id || await getSetting('nextcloud_target_folder') || '/MAKNA_Video_Generations';
      const batchFolderPath = `${targetFolder}/${batchId}`.replace(/\/+/g, '/');

      await checkAndCreateFolder(batchFolderPath);

      const newClipName = `${batchId}_video_clip_${clipIndex}_re-gen.mp4`;
      const remoteClipPath = `${batchFolderPath}/${newClipName}`.replace(/\/+/g, '/');
      await uploadFileToNextcloud(absoluteNewClipPath, remoteClipPath, false);
      addLog(`Klip ${clipIndex} diunggah ke Nextcloud: ${newClipName}`);

      shareUrl = await getOrCreatePublicShareLink(batchFolderPath);
      await db.prepare("UPDATE sheets_jobs SET gdrive_folder_url = ? WHERE id = ?").run(shareUrl, jobId);
      addLog(`Folder share link Nextcloud: ${shareUrl}`);
    } else {
      addLog(`Mengunggah klip ${clipIndex} baru ke Google Drive...`);
      const parentFolderId = campaign.gdrive_folder_id;
      const batchFolderId = await getOrCreateFolderInFolder(batchId, parentFolderId);

      const newClipName = `${batchId}_video_clip_${clipIndex}_re-gen.mp4`;
      await uploadLocalFileToFolder(absoluteNewClipPath, newClipName, batchFolderId, 'video/mp4');
      addLog(`Klip ${clipIndex} diunggah ke Drive: ${newClipName}`);

      shareUrl = `https://drive.google.com/drive/folders/${batchFolderId}`;
      await db.prepare("UPDATE sheets_jobs SET gdrive_folder_url = ? WHERE id = ?").run(shareUrl, jobId);
    }

    addLog('✅ Repair klip selesai!');

    return NextResponse.json({
      success: true,
      jobId,
      clipIndex,
      batchId,
      newClipVideoUrl,
      driveFolder: shareUrl,
      logs
    });

  } catch (err) {
    console.error('[repair-clip] ERROR:', err);
    return NextResponse.json({ error: err.message, logs }, { status: 500 });
  }
});
