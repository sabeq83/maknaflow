import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { reviewCreative, rewriteUnsafeFields } from '@/lib/tiktok-compliance-service';

export async function GET(request, { params }) {
  try {
    const { itemId } = await params;
    const db = getDb();

    const reviews = await db.prepare('SELECT * FROM content_compliance_reviews WHERE campaign_item_id = ? ORDER BY created_at DESC').all(itemId);
    return NextResponse.json({ success: true, reviews });
  } catch (error) {
    console.error('[API Compliance Review GET Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { itemId } = await params;
    const db = getDb();

    const item = await db.prepare('SELECT * FROM strategic_campaign_items WHERE id = ?').get(itemId);
    if (!item || !item.creative_package_json) {
      return NextResponse.json({ success: false, error: 'Creative Package (Call 1) belum tersedia.' }, { status: 404 });
    }

    const creativePkg = JSON.parse(item.creative_package_json);
    const reviewResult = await reviewCreative(item, creativePkg, {});

    // Save review log
    const reviewId = `rev_${Math.random().toString(36).substring(2, 10)}`;
    await db.prepare(`
      INSERT INTO content_compliance_reviews (
        id, campaign_item_id, creative_content_package_id, platform, review_stage, status, risk_level, detected_issues_json, safe_revisions_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      reviewId,
      itemId,
      itemId,
      'tiktok',
      'creative',
      reviewResult.status,
      reviewResult.risk_level,
      JSON.stringify(reviewResult.detected_issues || []),
      JSON.stringify(reviewResult.safe_revisions || {})
    );

    return NextResponse.json({ success: true, review: reviewResult });
  } catch (error) {
    console.error('[API Compliance Review POST Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
