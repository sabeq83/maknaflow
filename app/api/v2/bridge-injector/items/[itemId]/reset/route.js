import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { logToBridgeInjector } from '@/lib/bridge-injector-logger';

import { withTenantContext } from '@/lib/auth';

export const POST = withTenantContext(async (request, { params }) => {
  try {
    const { itemId } = await params;
    if (!itemId) {
      return NextResponse.json({ success: false, error: 'Item ID wajib disertakan.' }, { status: 400 });
    }

    const db = getDb();
    const item = await db.prepare('SELECT campaign_id FROM bridge_injector_items WHERE id = ?').get(itemId);

    if (!item) {
      return NextResponse.json({ success: false, error: 'Item tidak ditemukan.' }, { status: 404 });
    }

    logToBridgeInjector(`[BULK Item #${itemId}] Pengguna melakukan reset status dan data baris ke pending...`);

    // 1. Reset seluruh status item ke pending & kosongkan data visual/vo
    await db.prepare(`
      UPDATE bridge_injector_items
      SET download_status = 'pending',
          gemini_status = 'pending',
          t2i_status = 'pending',
          i2v_status = 'pending',
          sync_status = 'pending',
          workflow_status = 'pending',
          tts_status = 'pending',
          ffmpeg_status = 'pending',
          local_clip1_path = NULL,
          local_clip2_path = NULL,
          local_clip3_path = NULL,
          local_audio_clip1_path = NULL,
          injected_vo_1 = NULL,
          injected_vo_2 = NULL,
          injected_vo_3 = NULL,
          injected_vo_4 = NULL,
          clip2_t2i_prompt = NULL,
          clip2_i2v_prompt = NULL,
          clip2_t2i_task_id = NULL,
          clip2_t2i_image_path = NULL,
          clip2_i2v_task_id = NULL,
          clip2_video_path = NULL,
          injected_script_md_path = NULL,
          error_message = NULL
      WHERE id = ?
    `).run(itemId);

    // 2. Pastikan status campaign dikembalikan ke 'running' agar scheduler memprosesnya kembali
    await db.prepare(`
      UPDATE bridge_injector_campaigns
      SET status = 'running'
      WHERE id = ?
    `).run(item.campaign_id);

    logToBridgeInjector(`[BULK Item #${itemId}] Reset berhasil diselesaikan. Status kampanye diubah kembali ke 'running'.`);

    return NextResponse.json({
      success: true,
      message: 'Item berhasil di-reset!'
    });

  } catch (error) {
    console.error('[Bridge Injector Item Reset Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
