import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const db = getDb();

    const campaign = await db.prepare('SELECT * FROM strategic_campaigns WHERE id = ?').get(id);
    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Kampanye strategis tidak ditemukan.' }, { status: 404 });
    }

    const items = await db.prepare('SELECT * FROM strategic_campaign_items WHERE campaign_id = ? ORDER BY sequence ASC').all(id);

    // Fetch scenes for each item
    const itemsWithScenes = await Promise.all(items.map(async item => {
      const scenes = await db.prepare('SELECT * FROM strategic_campaign_scenes WHERE campaign_item_id = ? ORDER BY scene_number ASC').all(item.id);
      return {
        ...item,
        scenes
      };
    }));

    return NextResponse.json({
      success: true,
      campaign: {
        ...campaign,
        vso_config: JSON.parse(campaign.vso_config_json || '{}'),
        workflow_config: JSON.parse(campaign.workflow_config_json || '{}'),
        items: itemsWithScenes
      }
    });
  } catch (error) {
    console.error('[API /strategic-campaigns/[id] GET Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const db = getDb();

    await db.prepare('DELETE FROM strategic_campaigns WHERE id = ?').run(id);

    return NextResponse.json({ success: true, message: 'Kampanye strategis berhasil dihapus.' });
  } catch (error) {
    console.error('[API /strategic-campaigns/[id] DELETE Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const db = getDb();

    const campaign = await db.prepare('SELECT * FROM strategic_campaigns WHERE id = ?').get(id);
    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Kampanye strategis tidak ditemukan.' }, { status: 404 });
    }

    let existingWorkflow = {};
    try {
      existingWorkflow = JSON.parse(campaign.workflow_config_json || '{}');
    } catch (_) {}

    const newWorkflow = {
      ...existingWorkflow,
      ...(body.workflow_config || body.settings || {})
    };

    await db.prepare('UPDATE strategic_campaigns SET workflow_config_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
      JSON.stringify(newWorkflow),
      id
    );

    return NextResponse.json({
      success: true,
      message: 'Pengaturan workflow & produksi berhasil disimpan.',
      workflow_config: newWorkflow
    });
  } catch (error) {
    console.error('[API /strategic-campaigns/[id] PATCH Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
