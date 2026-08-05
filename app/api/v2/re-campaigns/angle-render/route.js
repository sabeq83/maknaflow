import { NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/db';
import { withTenantContext } from '../../../../../lib/auth';

export const POST = withTenantContext(async (req) => {
  try {
    const { angle_variant_id, enable_tts, enable_ffmpeg } = await req.json();

    if (!angle_variant_id) {
      return NextResponse.json({ success: false, error: "angle_variant_id is required" }, { status: 400 });
    }

    const db = getDb();

    // 1. Ambil data dari tabel variasi angle
    const variant = await db.prepare("SELECT * FROM re_item_angle_variants WHERE id = ?").get(angle_variant_id);
    if (!variant) {
      return NextResponse.json({ success: false, error: "Data variasi angle tidak ditemukan." }, { status: 404 });
    }

    const parentItem = await db.prepare("SELECT campaign_id FROM re_campaign_items WHERE id = ?").get(variant.re_item_id);
    const campaign = await db.prepare("SELECT enable_tts FROM re_campaigns WHERE id = ?").get(parentItem.campaign_id);

    const flagTts = enable_tts !== false && campaign?.enable_tts !== 0;
    const flagFfmpeg = enable_ffmpeg !== false;

    // 2. Reset status variasi angle
    await db.prepare(`
      UPDATE re_item_angle_variants
      SET tts_status = ?,
          visual_status = 'pending',
          ffmpeg_status = ?,
          upload_status = 'pending',
          drive_link = NULL,
          ffmpeg_output_path = NULL,
          visual_clip_paths = NULL,
          glabs_task_ids = NULL
      WHERE id = ?
    `).run(
      flagTts ? 'pending' : 'skipped',
      flagFfmpeg ? 'pending' : 'skipped',
      angle_variant_id
    );

    // 3. Masukkan ke dalam antrean pengerjaan scheduler_jobs
    await db.prepare(`
      INSERT INTO scheduler_jobs (queue_name, status, payload)
      VALUES ('re_glabs', 'pending', ?)
    `).run(
      JSON.stringify({
        target_type: 'angle_variant',
        variant_id: variant.id,
        enable_tts: flagTts,
        enable_ffmpeg: flagFfmpeg
      })
    );

    return NextResponse.json({
      success: true,
      message: "Tugas rendering variasi angle berhasil dimasukkan ke dalam antrean scheduler."
    });

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
