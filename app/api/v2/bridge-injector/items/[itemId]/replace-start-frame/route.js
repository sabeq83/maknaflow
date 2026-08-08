import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { logToBridgeInjector } from '@/lib/bridge-injector-logger';
import fs from 'fs';
import path from 'path';

import { withTenantContext } from '@/lib/auth';

export const POST = withTenantContext(async (req, { params }) => {
  try {
    const resolvedParams = await params;
    const itemId = resolvedParams.itemId;
    
    if (!itemId) {
      return NextResponse.json({ success: false, error: 'Item ID wajib disertakan.' }, { status: 400 });
    }

    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ success: false, error: 'Content type harus berupa multipart/form-data' }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ success: false, error: 'Tidak ada berkas gambar yang diunggah.' }, { status: 400 });
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

    logToBridgeInjector(`[BULK Item #${itemId}] Pengguna mengganti Start Frame secara manual dengan mengunggah gambar baru.`);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Dapatkan ekstensi file asli
    const ext = path.extname(file.name) || '.png';
    const startFrameFilename = `clip2_start_frame${ext}`;
    
    const outputDir = path.join(process.cwd(), 'public', 'uploads', 'bridge-injector', `bulk_${item.campaign_id}_${itemId}`);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const startFrameLocalPath = path.join(outputDir, startFrameFilename);
    fs.writeFileSync(startFrameLocalPath, buffer);
    const relativeStartFramePath = `/uploads/bridge-injector/bulk_${item.campaign_id}_${itemId}/${startFrameFilename}`;

    // Update database
    await db.prepare(`
      UPDATE bridge_injector_items 
      SET clip2_t2i_image_path = ?, t2i_status = 'completed'
      WHERE id = ?
    `).run(relativeStartFramePath, itemId);

    logToBridgeInjector(`[BULK Item #${itemId}] Gambar Start Frame sukses digantikan secara manual ke: ${relativeStartFramePath}`);

    const localUrl = `${relativeStartFramePath}?t=${Date.now()}`;
    return NextResponse.json({
      success: true,
      imageUrl: localUrl,
      message: "Start frame berhasil diganti secara manual!"
    });

  } catch (error) {
    console.error('[Replace Start Frame Error]', error);
    logToBridgeInjector(`[BULK Item #${params?.itemId || itemId || 'unknown'}] [ERROR Replace Start Frame]: ${error.message}`);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
