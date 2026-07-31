import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { rewriteUnsafeFields } from '@/lib/tiktok-compliance-service';

export async function POST(request, { params }) {
  try {
    const { itemId } = await params;
    const { action, custom_hook, custom_vo } = await request.json(); // action: 'apply_safe_revisions' | 'override_approve' | 'edit_manual'
    const db = getDb();

    const item = await db.prepare('SELECT * FROM strategic_campaign_items WHERE id = ?').get(itemId);
    if (!item || !item.creative_package_json) {
      return NextResponse.json({ success: false, error: 'Creative Package tidak ditemukan.' }, { status: 404 });
    }

    let creativePkg = JSON.parse(item.creative_package_json);

    if (action === 'apply_safe_revisions') {
      const latestReview = await db.prepare("SELECT * FROM content_compliance_reviews WHERE campaign_item_id = ? AND review_stage = 'creative' ORDER BY created_at DESC").get(itemId);
      const safeRevisions = latestReview ? JSON.parse(latestReview.safe_revisions_json || '{}') : {};
      
      creativePkg = rewriteUnsafeFields(item, creativePkg, safeRevisions);
      
      await db.prepare(`
        UPDATE strategic_campaign_items
        SET creative_package_json = ?, hook = ?, workflow_status = 'compliance_passed', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        JSON.stringify(creativePkg),
        creativePkg.creative_direction?.final_hook || item.hook,
        itemId
      );
    } else if (action === 'override_approve') {
      await db.prepare("UPDATE strategic_campaign_items SET workflow_status = 'compliance_passed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(itemId);
    } else if (action === 'edit_manual') {
      if (custom_hook) {
        if (creativePkg.creative_direction) creativePkg.creative_direction.final_hook = custom_hook;
      }
      if (custom_vo) {
        if (creativePkg.voice_over) creativePkg.voice_over.master_vo = custom_vo;
      }

      await db.prepare(`
        UPDATE strategic_campaign_items
        SET creative_package_json = ?, hook = ?, workflow_status = 'compliance_passed', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        JSON.stringify(creativePkg),
        custom_hook || item.hook,
        itemId
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Human review override berhasil diterapkan.',
      workflow_status: 'compliance_passed'
    });
  } catch (error) {
    console.error('[API Compliance Override POST Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
