import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { createDraftContentPlanner } from '@/lib/content-planner-engine';
import { withTenantContext } from '@/lib/auth';

export const GET = withTenantContext(async (request, _context, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brand_id');
    const search = searchParams.get('search');
    const isArchivedParam = searchParams.get('is_archived'); // 'all', 'true', 'false', or null

    const db = getDb();
    const tenantId = user?.tenantId || 'default_tenant';
    const conditions = ['(p.tenant_id = ? OR p.tenant_id IS NULL)'];
    const params = [tenantId];

    if (brandId) {
      conditions.push('(p.brand_id = ? OR p.account_name = ?)');
      params.push(brandId, brandId);
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push('(p.product_name LIKE ? OR p.title LIKE ? OR p.brand_context LIKE ?)');
      params.push(term, term, term);
    }

    if (isArchivedParam === 'true') {
      conditions.push('p.is_archived = 1');
    } else if (isArchivedParam === 'false') {
      conditions.push('(p.is_archived = 0 OR p.is_archived IS NULL)');
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const planners = await db.prepare(`
      SELECT p.*, b.brand_name AS brand_profile_name, COUNT(r.id) as row_count
      FROM content_planners p
      LEFT JOIN brand_profiles b ON p.brand_id = b.id
      LEFT JOIN content_planner_rows r ON p.id = r.planner_id
      ${whereClause}
      GROUP BY p.id, b.brand_name
      ORDER BY p.created_at DESC
    `).all(...params);

    const formattedPlanners = (planners || []).map(p => ({
      ...p,
      is_archived: Boolean(p.is_archived)
    }));

    return NextResponse.json({ success: true, planners: formattedPlanners });
  } catch (error) {
    console.error('[API /content-planner GET Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const POST = withTenantContext(async (request, _context, user) => {
  try {
    const body = await request.json();
    const result = await createDraftContentPlanner(body);
    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    console.error('[API /content-planner POST Error]', error);
    const status = error.code === 'CONTENT_PLANNER_VALIDATION' ? 400 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
});
