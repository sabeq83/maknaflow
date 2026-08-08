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
    const item = await db.prepare('SELECT * FROM bridge_injector_items WHERE id = ?').get(itemId);

    if (!item) {
      return NextResponse.json({ success: false, error: 'Item tidak ditemukan.' }, { status: 404 });
    }

    const campaign = await db.prepare('SELECT id FROM bridge_injector_campaigns WHERE id = ?').get(item.campaign_id);
    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Kampanye tidak ditemukan atau Anda tidak memiliki akses.' }, { status: 404 });
    }

    logToBridgeInjector(`[BULK Item #${itemId}] Pengguna menyetujui (Approve & Proceed) pembuatan video.`);

    // Update status ke 'approved' agar scheduler memicu I2V & Nextcloud sync
    await db.prepare(`
      UPDATE bridge_injector_items
      SET workflow_status = 'approved',
          i2v_status = CASE WHEN i2v_status = 'failed' THEN 'pending' ELSE i2v_status END,
          sync_status = CASE WHEN sync_status = 'failed' THEN 'pending' ELSE sync_status END,
          error_message = NULL
      WHERE id = ?
    `).run(itemId);

    logToBridgeInjector(`[BULK Item #${itemId}] Status berhasil diubah ke 'approved' untuk pemrosesan video.`);

    return NextResponse.json({
      success: true,
      message: 'Item berhasil disetujui! Proses rendering video segera dimulai di background.'
    });

  } catch (error) {
    console.error('[Bridge Injector Item Approve Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
