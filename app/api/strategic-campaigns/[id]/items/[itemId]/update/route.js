import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req, { params }) {
  try {
    const resolvedParams = await params;
    const { id: campaignId, itemId } = resolvedParams;
    const body = await req.json();

    const db = getDb();
    const item = await db.prepare("SELECT * FROM strategic_campaign_items WHERE id = ?").get(itemId);
    if (!item) {
      return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });
    }

    const { scenes, publishingPackage } = body;

    await db.transaction(async () => {
      // 1. Update scenes if provided
      if (Array.isArray(scenes)) {
        const updateSceneStmt = await db.prepare(`
          UPDATE strategic_campaign_scenes
          SET visual_action = ?, voice_over = ?, t2i_prompt = ?, i2v_prompt = ?
          WHERE id = ? AND campaign_item_id = ?
        `);
        for (const sc of scenes) {
          await updateSceneStmt.run(
            sc.visual_action || '',
            sc.voice_over || '',
            sc.t2i_prompt || '',
            sc.i2v_prompt || '',
            sc.id,
            itemId
          );
        }
      }

      // 2. Update publishing_package_json if provided
      if (publishingPackage) {
        await db.prepare(`
          UPDATE strategic_campaign_items
          SET publishing_package_json = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(JSON.stringify(publishingPackage), itemId);
      }
    })();

    return NextResponse.json({ success: true, message: 'Item berhasil diperbarui' });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
