import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateVideo } from '@/lib/webhook-client';
import { logToBridgeInjector } from '@/lib/bridge-injector-logger';
import fs from 'fs';
import path from 'path';

const fileToBase64 = (relPath) => {
  const absPath = path.join(process.cwd(), 'public', relPath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`File gambar tidak ditemukan di path: ${absPath}`);
  }
  const buffer = fs.readFileSync(absPath);
  let mimeType = 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    mimeType = 'image/png';
  } else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    mimeType = 'image/webp';
  }
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
};

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
    const campaign = await db.prepare('SELECT id FROM bridge_injector_campaigns WHERE id = ?').get(campaignId);
    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Kampanye tidak ditemukan atau Anda tidak memiliki akses.' }, { status: 404 });
    }

    const output = await db.prepare('SELECT clip2_i2v_prompt, clip2_t2i_image_path FROM bridge_injector_outputs WHERE campaign_id = ?').get(campaignId);

    if (!output) {
      return NextResponse.json({ success: false, error: 'Output naskah belum dibuat untuk kampanye ini.' }, { status: 404 });
    }

    if (!output.clip2_t2i_image_path) {
      return NextResponse.json({ success: false, error: 'Gambar Start Frame belum siap atau belum di-download. Harap jalankan T2I terlebih dahulu.' }, { status: 400 });
    }

    logToBridgeInjector(`[${campaignId}] Memulai pemicuan Video Generation (I2V) ke G-Labs dengan prompt: "${output.clip2_i2v_prompt}"`);
    
    // Konversi gambar start frame lokal menjadi base64 data URL
    const startFrameBase64 = fileToBase64(output.clip2_t2i_image_path);

    // Kirim task video (I2V) ke G-Labs
    const res = await generateVideo({
      prompt: output.clip2_i2v_prompt,
      model: 'veo_31_lite',
      aspect_ratio: '9:16',
      mode: 'start_image',
      reference_images: [startFrameBase64]
    });

    if (res && res.task_id) {
      await db.prepare(`
        UPDATE bridge_injector_outputs 
        SET clip2_i2v_task_id = ? 
        WHERE campaign_id = ?
      `).run(res.task_id, campaignId);

      await db.prepare(`
        UPDATE bridge_injector_campaigns 
        SET status = 'generating_i2v' 
        WHERE id = ?
      `).run(campaignId);

      logToBridgeInjector(`[${campaignId}] Task I2V berhasil didaftarkan ke G-Labs dengan Task ID: ${res.task_id}. Mengubah status ke 'generating_i2v'`);

      return NextResponse.json({
        success: true,
        message: 'Task I2V berhasil didaftarkan ke G-Labs!',
        data: { task_id: res.task_id }
      });
    } else {
      throw new Error('G-Labs tidak mengembalikan task_id');
    }

  } catch (error) {
    console.error('[Bridge Injector I2V Error]:', error);
    logToBridgeInjector(`[${campaignId || 'unknown'}] [ERROR I2V Dispatch Failed]: ${error.message}`);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
