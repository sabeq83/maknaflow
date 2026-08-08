import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { logToBridgeInjector } from '@/lib/bridge-injector-logger';
import { withTenantContext } from '@/lib/auth';

export const POST = withTenantContext(async (request, { params }) => {
  try {
    const { itemId } = await params;
    const body = await request.json().catch(() => ({}));
    const { step } = body;

    if (!itemId) {
      return NextResponse.json({ success: false, error: 'Item ID wajib disertakan.' }, { status: 400 });
    }
    if (!step) {
      return NextResponse.json({ success: false, error: 'Langkah (step) wajib disertakan.' }, { status: 400 });
    }

    const db = getDb();
    const item = await db.prepare('SELECT campaign_id FROM bridge_injector_items WHERE id = ?').get(itemId);

    if (!item) {
      return NextResponse.json({ success: false, error: 'Item tidak ditemukan.' }, { status: 404 });
    }

    const campaign = await db.prepare('SELECT id FROM bridge_injector_campaigns WHERE id = ?').get(item.campaign_id);
    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Kampanye tidak ditemukan atau Anda tidak memiliki akses.' }, { status: 404 });
    }

    logToBridgeInjector(`[BULK Item #${itemId}] Pengguna melakukan manual retry pada langkah: ${step}`);

    let updates = '';
    let statusLog = '';

    if (step === 'download') {
      updates = `
        download_status = 'pending',
        gemini_status = 'pending',
        t2i_status = 'pending',
        i2v_status = 'pending',
        tts_status = 'pending',
        ffmpeg_status = 'pending',
        sync_status = 'pending',
        workflow_status = 'pending',
        local_clip1_path = NULL,
        local_clip2_path = NULL,
        local_clip3_path = NULL,
        local_audio_clip1_path = NULL,
        clip2_t2i_task_id = NULL,
        clip2_t2i_image_path = NULL,
        clip2_i2v_task_id = NULL,
        clip2_video_path = NULL,
        error_message = NULL
      `;
      statusLog = 'Reset ke pending untuk mengunduh ulang berkas Nextcloud.';
    } else if (step === 'gemini') {
      updates = `
        gemini_status = 'pending',
        t2i_status = 'pending',
        i2v_status = 'pending',
        tts_status = 'pending',
        ffmpeg_status = 'pending',
        sync_status = 'pending',
        workflow_status = 'processing',
        clip2_t2i_task_id = NULL,
        clip2_t2i_image_path = NULL,
        clip2_i2v_task_id = NULL,
        clip2_video_path = NULL,
        error_message = NULL
      `;
      statusLog = 'Reset ke processing untuk regenerasi naskah via Gemini.';
    } else if (step === 't2i') {
      updates = `
        t2i_status = 'pending',
        i2v_status = 'pending',
        tts_status = 'pending',
        ffmpeg_status = 'pending',
        sync_status = 'pending',
        workflow_status = 'processing',
        clip2_t2i_task_id = NULL,
        clip2_t2i_image_path = NULL,
        clip2_i2v_task_id = NULL,
        clip2_video_path = NULL,
        error_message = NULL
      `;
      statusLog = 'Reset ke processing untuk regenerasi Start Frame T2I.';
    } else if (step === 'i2v') {
      updates = `
        i2v_status = 'pending',
        tts_status = 'pending',
        ffmpeg_status = 'pending',
        sync_status = 'pending',
        workflow_status = 'approved',
        clip2_i2v_task_id = NULL,
        clip2_video_path = NULL,
        error_message = NULL
      `;
      statusLog = 'Reset ke approved untuk mengulangi proses I2V.';
    } else if (step === 'tts') {
      updates = `
        tts_status = 'pending',
        ffmpeg_status = 'pending',
        sync_status = 'pending',
        workflow_status = 'rendering_tts',
        error_message = NULL
      `;
      statusLog = 'Reset ke rendering_tts untuk mengulangi pembuatan TTS audio.';
    } else if (step === 'ffmpeg') {
      updates = `
        ffmpeg_status = 'pending',
        sync_status = 'pending',
        workflow_status = 'muxing_ffmpeg',
        error_message = NULL
      `;
      statusLog = 'Reset ke muxing_ffmpeg untuk mengulangi perangkaian video.';
    } else if (step === 'sync') {
      updates = `
        sync_status = 'pending',
        workflow_status = 'uploading',
        error_message = NULL
      `;
      statusLog = 'Reset ke uploading untuk mengulangi unggah berkas ke Nextcloud.';
    } else {
      return NextResponse.json({ success: false, error: 'Langkah pipeline tidak dikenal.' }, { status: 400 });
    }

    const query = `UPDATE bridge_injector_items SET ${updates} WHERE id = ?`;
    await db.prepare(query).run(itemId);

    // Pastikan status campaign dikembalikan ke 'running' agar scheduler memprosesnya kembali
    await db.prepare(`
      UPDATE bridge_injector_campaigns
      SET status = 'running'
      WHERE id = ?
    `).run(item.campaign_id);

    logToBridgeInjector(`[BULK Item #${itemId}] Manual retry berhasil diproses: ${statusLog}`);

    return NextResponse.json({
      success: true,
      message: `Berhasil memicu ulang langkah '${step}'!`
    });

  } catch (error) {
    console.error('[Bridge Injector Item Retry Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
