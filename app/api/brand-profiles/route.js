import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { tenantContext } from '@/lib/tenant-context';

export async function GET(req) {
  try {
    const currentUser = getCurrentUser(req);
    if (!currentUser || currentUser.tenantId === '__none__') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: currentUser ? 403 : 401 });
    }
    const db = getDb();

    let brands = [];

    if (currentUser.role === 'admin') {
      brands = await tenantContext.run(currentUser.tenantId, () => db.prepare(`
        SELECT id, brand_name, tone_of_voice, visual_signature, color_palette, forbidden_elements, brand_slogan_or_cta,
               editorial_brand_context, editorial_content_goal, editorial_content_pillars_json, guideline_filename, created_at
        FROM brand_profiles ORDER BY brand_name ASC
      `).all());
    } else {
      // Regular user: return assigned brand profiles
      brands = await tenantContext.run(currentUser.tenantId, () => db.prepare(`
        SELECT bp.id, bp.brand_name, bp.tone_of_voice, bp.visual_signature, bp.color_palette, bp.forbidden_elements, bp.brand_slogan_or_cta,
               bp.editorial_brand_context, bp.editorial_content_goal, bp.editorial_content_pillars_json, bp.guideline_filename, bp.created_at
        FROM brand_profiles bp
        JOIN user_brands ub ON bp.id = ub.brand_id
        WHERE ub.user_id = ?
        ORDER BY bp.brand_name ASC
      `).all(currentUser.id));
    }

    return NextResponse.json({ success: true, brands });
  } catch (error) {
    console.error('[API Brand Profiles GET Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
