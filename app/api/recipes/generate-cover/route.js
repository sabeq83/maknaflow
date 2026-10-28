import path from 'path';
import fs from 'fs';
import { NextResponse } from 'next/server.js';
import { withTenantContext } from '../../../../lib/auth.js';
import { generateImage, getTaskStatus, getFileUrl } from '../../../../lib/webhook-client.js';
import { getDb } from '../../../../lib/db.js';

export const POST = withTenantContext(async (req) => {
  try {
    const { recipeId, sourceType, originType, prompt } = await req.json();

    if (!prompt || !prompt.trim()) {
      return NextResponse.json({ success: false, error: 'Prompt T2I tidak boleh kosong' }, { status: 400 });
    }

    // 1. Submit T2I Task ke G-Labs dengan Aspect Ratio 4:3
    const t2iResult = await generateImage({
      prompt: prompt.trim(),
      aspect_ratio: '4:3'
    });

    if (!t2iResult || !t2iResult.task_id) {
      return NextResponse.json({ success: false, error: 'Gagal mengirim tugas T2I ke G-Labs' }, { status: 500 });
    }

    const taskId = t2iResult.task_id;

    // 2. Poll Task Status hingga selesai (maksimal 2.5 menit = 75 x 2 detik)
    let statusRes = null;
    let maxRetries = 75;
    while (maxRetries > 0) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      statusRes = await getTaskStatus(taskId);
      if (statusRes.status === 'completed' || statusRes.status === 'failed') break;
      maxRetries--;
    }

    if (!statusRes || statusRes.status !== 'completed') {
      return NextResponse.json({
        success: false,
        error: `Generasi gambar G-Labs gagal atau timeout: ${statusRes?.error || 'timeout'}`
      }, { status: 500 });
    }

    const results = statusRes.results || statusRes.files || [];
    let completedImageName = results.find(f => 
      typeof f === 'string' && (f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.webp') || f.endsWith('.jpeg'))
    ) || results[0];

    if (!completedImageName) {
      return NextResponse.json({ success: false, error: 'G-Labs tidak mengembalikan file gambar valid.' }, { status: 500 });
    }

    if (completedImageName.startsWith('http://') || completedImageName.startsWith('https://')) {
      completedImageName = completedImageName.split('/').pop();
    }
    const downloadUrl = getFileUrl(completedImageName, taskId);
    const ext = completedImageName.split('.').pop() || 'jpg';
    const filename = `recipe_cover_${recipeId || 'temp'}_${Date.now()}.${ext}`;

    const destDir = path.join(process.cwd(), 'public', 'uploads', 'recipes');
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    const destPath = path.join(destDir, filename);
    const dlRes = await fetch(downloadUrl);
    if (!dlRes.ok) throw new Error(`Gagal download hasil render dari G-Labs: ${dlRes.statusText}`);

    const buffer = await dlRes.arrayBuffer();
    fs.writeFileSync(destPath, Buffer.from(buffer));

    const publicUrl = `/uploads/recipes/${filename}`;

    // 3. Simpan ke database jika recipeId tersedia
    if (recipeId) {
      try {
        const db = getDb();
        if (sourceType === 'labs') {
          await db.prepare('UPDATE recipe_items SET img_grid_path = ? WHERE id = ?').run(publicUrl, recipeId);
        } else if (originType === 'pillar' || sourceType === 'campaign') {
          await db.prepare('UPDATE pillar_campaign_items SET t2i_start_frame_path = ? WHERE id = ?').run(publicUrl, recipeId);
        }
      } catch (dbErr) {
        console.warn('[Cover Generator Warning] Gagal mengupdate link cover di database:', dbErr.message);
      }
    }

    return NextResponse.json({ success: true, imageUrl: publicUrl, taskId });
  } catch (err) {
    console.error('[Generate Cover Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});
