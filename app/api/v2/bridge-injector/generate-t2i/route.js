import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateImage } from '@/lib/webhook-client';
import { logToBridgeInjector } from '@/lib/bridge-injector-logger';
import fs from 'fs';
import path from 'path';

function fileToBase64(filePath) {
  if (!filePath) return null;
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return null;
  }
  let absolutePath = filePath;
  if (!fs.existsSync(absolutePath)) {
    const relativePart = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    absolutePath = path.join(process.cwd(), 'public', relativePart);
  }
  if (!fs.existsSync(absolutePath)) {
    console.warn(`[fileToBase64] File not found: ${filePath}`);
    return null;
  }
  const fileBuffer = fs.readFileSync(absolutePath);
  let mimeType = 'image/png';
  if (fileBuffer[0] === 0xFF && fileBuffer[1] === 0xD8 && fileBuffer[2] === 0xFF) {
    mimeType = 'image/jpeg';
  } else if (fileBuffer[0] === 0x89 && fileBuffer[1] === 0x50 && fileBuffer[2] === 0x4E && fileBuffer[3] === 0x47) {
    mimeType = 'image/png';
  } else if (fileBuffer[0] === 0x52 && fileBuffer[1] === 0x49 && fileBuffer[2] === 0x46 && fileBuffer[3] === 0x46) {
    mimeType = 'image/webp';
  }
  return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
}

import { withTenantContext } from '@/lib/auth';

export const POST = withTenantContext(async (request) => {
  let campaignId = null;
  try {
    const body = await request.json().catch(() => ({}));
    campaignId = body.campaignId;

    if (!campaignId) {
      return NextResponse.json({ success: false, error: 'campaignId wajib disertakan.' }, { status: 400 });
    }

    const db = getDb();
    const output = await db.prepare('SELECT clip2_t2i_prompt FROM bridge_injector_outputs WHERE campaign_id = ?').get(campaignId);

    if (!output) {
      return NextResponse.json({ success: false, error: 'Output naskah belum dibuat untuk kampanye ini.' }, { status: 404 });
    }

    let finalPrompt = output.clip2_t2i_prompt || '';

    // Resolusi gambar produk dari database
    const campaign = await db.prepare('SELECT target_product_id FROM bridge_injector_campaigns WHERE id = ?').get(campaignId);
    const reference_images = [];

    if (campaign && campaign.target_product_id) {
      const product = await db.prepare('SELECT photo_url, active_photo, clean_photo_url, cleaned_photo_url, generated_photo_url, product_truth, geometric_truth FROM product_extractions WHERE id = ?').get(campaign.target_product_id);
      if (product) {
        if (product.product_truth && !finalPrompt.includes('Product Truth:')) {
          finalPrompt = `${finalPrompt} [LAYER 2: SUBJECT & VISUAL TRUTH] (Product Truth: ${product.product_truth}, geometry_lock: DO NOT HALLUCINATE)`;
        }
        const activePhotoField = product.active_photo || 'photo_url';
        const photoPath = product[activePhotoField] || product.photo_url || product.generated_photo_url;
        if (photoPath) {
          try {
            const base64Str = fileToBase64(photoPath);
            if (base64Str) {
              reference_images.push(base64Str);
              logToBridgeInjector(`[${campaignId}] Menyertakan foto produk database (${activePhotoField}) base64 ke payload G-Labs: ${photoPath}`);
            }
          } catch (b64Err) {
            logToBridgeInjector(`[${campaignId}] [WARNING] Gagal membaca gambar produk ke base64: ${b64Err.message}`);
          }
        }
      }
    }

    logToBridgeInjector(`[${campaignId}] Memulai pemicuan Image Generation (T2I) ke G-Labs dengan prompt: "${finalPrompt}"`);
    
    // Submit prompt ke G-Labs
    const res = await generateImage({
      prompt: finalPrompt,
      model: 'nano_banana_pro',
      aspect_ratio: '9:16',
      reference_images
    });

    if (res && res.task_id) {
      await db.prepare(`
        UPDATE bridge_injector_outputs 
        SET clip2_t2i_task_id = ? 
        WHERE campaign_id = ?
      `).run(res.task_id, campaignId);

      await db.prepare(`
        UPDATE bridge_injector_campaigns 
        SET status = 'polling_t2i' 
        WHERE id = ?
      `).run(campaignId);

      logToBridgeInjector(`[${campaignId}] Task T2I berhasil didaftarkan ke G-Labs dengan Task ID: ${res.task_id}. Mengubah status ke 'polling_t2i'`);

      return NextResponse.json({
        success: true,
        message: 'Task T2I berhasil didaftarkan ke G-Labs!',
        data: { task_id: res.task_id }
      });
    } else {
      throw new Error('G-Labs tidak mengembalikan task_id');
    }

  } catch (error) {
    console.error('[Bridge Injector T2I Error]:', error);
    logToBridgeInjector(`[${campaignId || 'unknown'}] [ERROR T2I Dispatch Failed]: ${error.message}`);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
