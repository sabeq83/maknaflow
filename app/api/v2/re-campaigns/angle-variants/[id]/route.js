import { NextResponse } from 'next/server';
import { getDb } from '../../../../../../lib/db';
import { withTenantContext } from '../../../../../../lib/auth';

export const PATCH = withTenantContext(async (req, { params }) => {
  try {
    const { id } = await params;
    const { visual_tasks_json } = await req.json();

    if (!id) {
      return NextResponse.json({ success: false, error: "id is required" }, { status: 400 });
    }

    if (!visual_tasks_json) {
      return NextResponse.json({ success: false, error: "visual_tasks_json is required" }, { status: 400 });
    }

    // Validate JSON structure
    try {
      JSON.parse(visual_tasks_json);
    } catch (e) {
      return NextResponse.json({ success: false, error: "visual_tasks_json must be valid JSON" }, { status: 400 });
    }

    const db = getDb();

    // Check if variant exists
    const variant = await db.prepare("SELECT * FROM re_item_angle_variants WHERE id = ?").get(id);
    if (!variant) {
      return NextResponse.json({ success: false, error: "Data variasi angle tidak ditemukan." }, { status: 404 });
    }

    // Update DB
    await db.prepare("UPDATE re_item_angle_variants SET visual_tasks_json = ? WHERE id = ?").run(visual_tasks_json, id);

    return NextResponse.json({
      success: true,
      message: "Naskah & prompt variasi angle berhasil diperbarui."
    });

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
