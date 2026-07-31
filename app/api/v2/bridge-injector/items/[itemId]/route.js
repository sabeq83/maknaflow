import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { logToBridgeInjector } from '@/lib/bridge-injector-logger';
import fs from 'fs';
import path from 'path';

export async function PUT(request, { params }) {
  try {
    const { itemId } = await params;
    const body = await request.json().catch(() => ({}));
    const {
      injected_vo_1,
      injected_vo_2,
      injected_vo_3,
      injected_vo_4,
      clip2_t2i_prompt,
      clip2_i2v_prompt
    } = body;

    if (!itemId) {
      return NextResponse.json({ success: false, error: 'Item ID wajib disertakan.' }, { status: 400 });
    }

    const db = getDb();
    const item = await db.prepare('SELECT * FROM bridge_injector_items WHERE id = ?').get(itemId);

    if (!item) {
      return NextResponse.json({ success: false, error: 'Item tidak ditemukan.' }, { status: 404 });
    }

    const campaign = await db.prepare('SELECT campaign_name FROM bridge_injector_campaigns WHERE id = ?').get(item.campaign_id);
    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Kampanye tidak ditemukan.' }, { status: 404 });
    }

    logToBridgeInjector(`[BULK Item #${itemId}] Pengguna mengubah teks naskah voiceover / prompt visual...`);

    // 1. Update data di database
    await db.prepare(`
      UPDATE bridge_injector_items
      SET injected_vo_1 = ?, injected_vo_2 = ?, injected_vo_3 = ?, injected_vo_4 = ?,
          clip2_t2i_prompt = ?, clip2_i2v_prompt = ?
      WHERE id = ?
    `).run(
      injected_vo_1 || '', 
      injected_vo_2 || '', 
      injected_vo_3 || '', 
      injected_vo_4 || '',
      clip2_t2i_prompt || '', 
      clip2_i2v_prompt || '', 
      itemId
    );

    // 2. Tulis ulang file naskah_bridging.md secara lokal untuk sinkronisasi
    const outputDir = path.join(process.cwd(), 'public', 'uploads', 'bridge-injector', `bulk_${item.campaign_id}_${itemId}`);
    fs.mkdirSync(outputDir, { recursive: true });
    
    const mdContent = `# ${campaign.campaign_name} - Item ${itemId} Naskah Bridging Product

## Klip 1: Hook (Original)
${injected_vo_1 || ''}

## Klip 2: Product (New Injected)
${injected_vo_2 || ''}

## Klip 3: Continuation
${injected_vo_3 || ''}

## Klip 4: CTA
${injected_vo_4 || ''}
`;

    const mdFilePath = path.join(outputDir, 'naskah_bridging.md');
    fs.writeFileSync(mdFilePath, mdContent);
    const relativeMdPath = `/uploads/bridge-injector/bulk_${item.campaign_id}_${itemId}/naskah_bridging.md`;

    // Pastikan path md tersimpan di database jika sebelumnya belum ada
    await db.prepare('UPDATE bridge_injector_items SET injected_script_md_path = ? WHERE id = ?').run(relativeMdPath, itemId);
    
    logToBridgeInjector(`[BULK Item #${itemId}] Perubahan berhasil disimpan dan berkas naskah_bridging.md diperbarui.`);

    return NextResponse.json({
      success: true,
      message: 'Perubahan naskah & prompt berhasil disimpan!'
    });

  } catch (error) {
    console.error('[Bridge Injector Item PUT Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { itemId } = await params;
    const body = await request.json().catch(() => ({}));
    const db = getDb();

    const item = await db.prepare('SELECT id FROM bridge_injector_items WHERE id = ?').get(itemId);
    if (!item) {
      return NextResponse.json({ success: false, error: 'Item tidak ditemukan.' }, { status: 404 });
    }

    const allowedFields = [
      'enable_tts', 
      'enable_ffmpeg', 
      'voice_provider', 
      'voice_persona', 
      'voice_speed', 
      'voice_volume',
      'ffmpeg_video_scale',
      'ffmpeg_sfx_volume',
      'ffmpeg_bgm_volume',
      'ffmpeg_sync_option'
    ];
    const updates = [];
    const values = [];

    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(body[key]);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: 'Tidak ada data perubahan yang valid.' }, { status: 400 });
    }

    values.push(itemId);
    const query = `UPDATE bridge_injector_items SET ${updates.join(', ')} WHERE id = ?`;
    await db.prepare(query).run(...values);

    logToBridgeInjector(`[BULK Item #${itemId}] Pengaturan item berhasil diperbarui: ${JSON.stringify(body)}`);

    return NextResponse.json({
      success: true,
      message: 'Pengaturan item berhasil diperbarui!'
    });
  } catch (error) {
    console.error('[Bridge Injector Item PATCH Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
