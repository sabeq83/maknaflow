import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

import { withTenantContext } from '@/lib/auth';

export const POST = withTenantContext(async (request, { params }) => {
  try {
    const db = getDb();
    const { itemId } = await params;
    const body = await request.json().catch(() => ({}));
    const clipIndex = body.clipIndex;

    if (!clipIndex) {
      return NextResponse.json({ success: false, error: 'Parameter clipIndex wajib diisi.' }, { status: 400 });
    }

    const item = await db.prepare('SELECT * FROM re_campaign_items WHERE id = ?').get(itemId);
    if (!item) {
      return NextResponse.json({ success: false, error: 'Item tidak ditemukan.' }, { status: 404 });
    }

    // Reset status to trigger retry in scheduler or background worker
    await db.prepare("UPDATE re_campaign_items SET workflow_status = 'i2v_pending', status = 'processing', system_log = ? WHERE id = ?")
      .run(`[Retry Clip #${clipIndex}] Triggered retry for I2V video clip generation.`, itemId);

    return NextResponse.json({
      success: true,
      message: `Trigger retry I2V klip #${clipIndex} berhasil dijadwalkan.`
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
