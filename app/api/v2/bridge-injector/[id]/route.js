import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { logToBridgeInjector } from '@/lib/bridge-injector-logger';
import fs from 'fs';
import path from 'path';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';

export const GET = withTenantContext(async (request, { params }) => {
  try {
    const { id } = await params;
    const db = getDb();
    const tenantId = getActiveTenantId();

    const campaign = await db.prepare(`
      SELECT c.*, p.product_name 
      FROM bridge_injector_campaigns c
      LEFT JOIN product_extractions p ON c.target_product_id = p.id
      WHERE c.id = ? AND c.tenant_id = ?
    `).get(id, tenantId);

    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Kampanye tidak ditemukan.' }, { status: 404 });
    }

    if (campaign.campaign_type === 'bulk') {
      const items = await db.prepare(`
        SELECT i.*, p.product_name 
        FROM bridge_injector_items i
        LEFT JOIN product_extractions p ON i.target_product_id = p.id
        WHERE i.campaign_id = ? 
        ORDER BY i.id ASC
      `).all(id);

      return NextResponse.json({
        success: true,
        data: {
          campaign,
          items
        }
      });
    }

    const output = await db.prepare('SELECT * FROM bridge_injector_outputs WHERE campaign_id = ?').get(id);

    return NextResponse.json({
      success: true,
      data: {
        campaign,
        output: output || null
      }
    });
  } catch (error) {
    console.error('[Bridge Injector Item GET Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const PUT = withTenantContext(async (request, { params }) => {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const {
      injected_vo_1,
      injected_vo_2,
      injected_vo_3,
      injected_vo_4,
      clip2_t2i_prompt,
      clip2_i2v_prompt
    } = body;

    const db = getDb();
    const campaign = await db.prepare('SELECT campaign_name FROM bridge_injector_campaigns WHERE id = ?').get(id);

    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Kampanye tidak ditemukan.' }, { status: 404 });
    }

    logToBridgeInjector(`[${id}] Pengguna mengubah teks naskah voiceover / prompt visual...`);

    // 1. Update data di database
    await db.prepare(`
      UPDATE bridge_injector_outputs
      SET injected_vo_1 = ?, injected_vo_2 = ?, injected_vo_3 = ?, injected_vo_4 = ?,
          clip2_t2i_prompt = ?, clip2_i2v_prompt = ?
      WHERE campaign_id = ?
    `).run(injected_vo_1, injected_vo_2, injected_vo_3, injected_vo_4, clip2_t2i_prompt, clip2_i2v_prompt, id);

    // 2. Tulis ulang file naskah_bridging.md secara lokal untuk sinkronisasi
    const outputDir = path.join(process.cwd(), 'public', 'uploads', 'bridge-injector', id);
    fs.mkdirSync(outputDir, { recursive: true });
    
    const mdContent = `# ${campaign.campaign_name} - Naskah Bridging Product

## Klip 1: Hook (Original)
${injected_vo_1}

## Klip 2: Product (New Injected)
${injected_vo_2}

## Klip 3: Continuation
${injected_vo_3}

## Klip 4: CTA
${injected_vo_4}
`;

    const mdFilePath = path.join(outputDir, 'naskah_bridging.md');
    fs.writeFileSync(mdFilePath, mdContent);
    
    logToBridgeInjector(`[${id}] Perubahan berhasil disimpan dan berkas naskah_bridging.md diperbarui.`);

    return NextResponse.json({
      success: true,
      message: 'Perubahan naskah & prompt berhasil disimpan!'
    });

  } catch (error) {
    console.error('[Bridge Injector Item PUT Error]:', error);
    logToBridgeInjector(`[${id}] [ERROR] Gagal menyimpan perubahan teks: ${error.message}`);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const DELETE = withTenantContext(async (request, { params }) => {
  try {
    const { id } = await params;
    const db = getDb();
    
    logToBridgeInjector(`[${id}] Menghapus kampanye bridging injector...`);
    
    // Hapus file naskah & media terkait di penyimpanan lokal
    const outputDir = path.join(process.cwd(), 'public', 'uploads', 'bridge-injector', id);
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }

    await db.prepare('DELETE FROM bridge_injector_campaigns WHERE id = ?').run(id);
    
    logToBridgeInjector(`[${id}] Kampanye berhasil dihapus sepenuhnya dari database & penyimpanan lokal.`);
    return NextResponse.json({ success: true, message: 'Kampanye berhasil dihapus.' });
  } catch (error) {
    console.error('[Bridge Injector Item DELETE Error]:', error);
    logToBridgeInjector(`[${id}] [ERROR] Gagal menghapus kampanye: ${error.message}`);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const PATCH = withTenantContext(async (request, { params }) => {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const db = getDb();

    const campaign = await db.prepare('SELECT status, paused_previous_status, campaign_type FROM bridge_injector_campaigns WHERE id = ?').get(id);
    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Kampanye tidak ditemukan.' }, { status: 404 });
    }

    // Jika request mengganti status (Play/Pause/Run)
    if (body.status !== undefined) {
      let nextStatus = body.status;
      if (nextStatus === 'paused') {
        // Simpan status aktif saat ini sebelum di-pause
        await db.prepare('UPDATE bridge_injector_campaigns SET status = ?, paused_previous_status = ? WHERE id = ?')
          .run('paused', campaign.status, id);
      } else if (nextStatus === 'running' && campaign.status === 'paused') {
        // Melanjutkan kembali (Resume) status sebelumnya
        const resumeStatus = campaign.paused_previous_status || (campaign.campaign_type === 'bulk' ? 'running' : 'pending_storyboard');
        await db.prepare('UPDATE bridge_injector_campaigns SET status = ?, paused_previous_status = NULL WHERE id = ?')
          .run(resumeStatus, id);
        nextStatus = resumeStatus;
      } else if (nextStatus === 'running' && campaign.status === 'draft') {
        // Menjalankan kampanye dari status draft pertama kali
        const startStatus = campaign.campaign_type === 'bulk' ? 'running' : 'pending_storyboard';
        await db.prepare('UPDATE bridge_injector_campaigns SET status = ?, paused_previous_status = NULL WHERE id = ?')
          .run(startStatus, id);
        nextStatus = startStatus;
      } else {
        await db.prepare('UPDATE bridge_injector_campaigns SET status = ? WHERE id = ?').run(nextStatus, id);
      }

      logToBridgeInjector(`[${id}] Status kampanye diubah menjadi: ${nextStatus}`);
      return NextResponse.json({
        success: true,
        message: `Status kampanye berhasil diubah ke ${nextStatus}!`,
        data: { status: nextStatus }
      });
    }

    const allowedFields = ['enable_tts', 'enable_ffmpeg', 'voice_provider', 'voice_persona', 'voice_speed', 'voice_volume'];
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

    values.push(id);
    const query = `UPDATE bridge_injector_campaigns SET ${updates.join(', ')} WHERE id = ?`;
    await db.prepare(query).run(...values);

    logToBridgeInjector(`[${id}] Pengaturan kampanye berhasil diperbarui: ${JSON.stringify(body)}`);

    return NextResponse.json({
      success: true,
      message: 'Pengaturan kampanye berhasil diperbarui!'
    });
  } catch (error) {
    console.error('[Bridge Injector Item PATCH Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
