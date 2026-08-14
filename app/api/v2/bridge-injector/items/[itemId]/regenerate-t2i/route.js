import { NextResponse } from 'next/server';
import { getDb, getSetting } from '@/lib/db';
import { generateImage, getTaskStatus, getFileUrl } from '@/lib/webhook-client';
import { logToBridgeInjector } from '@/lib/bridge-injector-logger';
import fs from 'fs';
import path from 'path';

async function downloadFile(url, destPath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buffer);
}
const fileToBase64 = (filePath) => {
  if (!filePath) return null;
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) return null;
  
  try {
    let absolutePath = filePath;
    if (!path.isAbsolute(filePath) || !fs.existsSync(filePath)) {
      const relativePart = filePath.startsWith('/') ? filePath.slice(1) : filePath;
      absolutePath = path.join(process.cwd(), 'public', relativePart);
    }
    
    if (!fs.existsSync(absolutePath)) {
      console.warn(`[fileToBase64] File not found: ${filePath} (resolved: ${absolutePath})`);
      return null;
    }
    
    const buffer = fs.readFileSync(absolutePath);
    let mimeType = 'image/png';
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      mimeType = 'image/jpeg';
    } else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      mimeType = 'image/png';
    } else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
      mimeType = 'image/webp';
    }
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  } catch (err) {
    console.error('[fileToBase64 Error]:', err.message);
    return null;
  }
};
import { withTenantContext } from '@/lib/auth';

export const POST = withTenantContext(async (req, { params }) => {
  try {
    const resolvedParams = await params;
    const itemId = resolvedParams.itemId;
    const { t2i_prompt } = await req.json().catch(() => ({}));

    if (!itemId || !t2i_prompt) {
      return NextResponse.json({ success: false, error: "itemId dan t2i_prompt wajib disertakan." }, { status: 400 });
    }

    const db = getDb();
    const item = await db.prepare("SELECT * FROM bridge_injector_items WHERE id = ?").get(itemId);
    if (!item) {
      return NextResponse.json({ success: false, error: "Item kampanye tidak ditemukan." }, { status: 404 });
    }

    const campaign = await db.prepare('SELECT id FROM bridge_injector_campaigns WHERE id = ?').get(item.campaign_id);
    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Kampanye tidak ditemukan atau Anda tidak memiliki akses.' }, { status: 404 });
    }

    logToBridgeInjector(`[BULK Item #${itemId}] Memulai regenerasi Start Frame T2I kustom dengan prompt: "${t2i_prompt}"`);

    // 1. Update t2i prompt di DB
    await db.prepare("UPDATE bridge_injector_items SET clip2_t2i_prompt = ? WHERE id = ?").run(t2i_prompt, itemId);

    let productData = null;
    if (item.target_product_id) {
      productData = await db.prepare('SELECT * FROM product_extractions WHERE id = ?').get(item.target_product_id);
    }
    const { resolveProductBase64 } = await import('../../../../../../../lib/scheduler-processors');
    const productBase64 = await resolveProductBase64({}, productData);

    // 3. Trigger image generation
    const imageModel = await getSetting('webhook_image_model') || 'nano_banana_pro';
    const t2iResult = await generateImage({
      prompt: t2i_prompt,
      model: imageModel,
      aspect_ratio: '9:16',
      reference_images: productBase64 ? [productBase64] : undefined
    });

    if (!t2iResult?.task_id) {
      return NextResponse.json({ success: false, error: "Gagal memicu tugas T2I ke G-Labs" }, { status: 500 });
    }

    const t2iTaskId = t2iResult.task_id;
    await db.prepare("UPDATE bridge_injector_items SET clip2_t2i_task_id = ? WHERE id = ?").run(t2iTaskId, itemId);
    logToBridgeInjector(`[BULK Item #${itemId}] Tugas T2I terdaftar di G-Labs dengan ID: ${t2iTaskId}. Mulai polling...`);

    // 4. Poll status
    let completedImageName = null;
    const maxAttempts = 75; // 150s max
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const statusRes = await getTaskStatus(t2iTaskId);
      const status = (statusRes?.status || '').toLowerCase();

      if (status === 'completed') {
        const files = statusRes.results || statusRes.files || [];
        completedImageName = files.find(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.webp')) || files[0];
        break;
      } else if (status === 'failed') {
        throw new Error(`G-Labs T2I rendering failed: ${statusRes.error || 'Unknown error'}`);
      }
    }

    if (!completedImageName) {
      throw new Error("G-Labs T2I rendering timed out.");
    }

    // 5. Unduh file start frame kustom
    if (completedImageName.startsWith('http://') || completedImageName.startsWith('https://')) {
      completedImageName = completedImageName.split('/').pop();
    }
    const downloadUrl = getFileUrl(completedImageName);
    const ext = completedImageName.split('.').pop() || 'png';
    
    const safeFilename = `clip2_start_frame.${ext}`;
    const localRelPath = `/uploads/bridge-injector/bulk_${item.campaign_id}_${itemId}/${safeFilename}`;
    const localAbsPath = path.join(process.cwd(), 'public', 'uploads', 'bridge-injector', `bulk_${item.campaign_id}_${itemId}`, safeFilename);

    logToBridgeInjector(`[BULK Item #${itemId}] Mengunduh hasil regenerasi Start Frame dari: ${downloadUrl}`);
    await downloadFile(downloadUrl, localAbsPath);

    await db.prepare(`
      UPDATE bridge_injector_items 
      SET clip2_t2i_image_path = ?, t2i_status = 'completed'
      WHERE id = ?
    `).run(localRelPath, itemId);

    logToBridgeInjector(`[BULK Item #${itemId}] Gambar Start Frame sukses diregenerasi ke lokal: ${localRelPath}`);

    return NextResponse.json({
      success: true,
      imageUrl: `${localRelPath}?t=${Date.now()}`,
      message: 'Start Frame berhasil diregenerasi!'
    });

  } catch (error) {
    console.error('[Bridge Injector Item Regenerate T2I Error]:', error);
    logToBridgeInjector(`[BULK Item #${params?.itemId || itemId || 'unknown'}] [ERROR Regenerate T2I]: ${error.message}`);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
