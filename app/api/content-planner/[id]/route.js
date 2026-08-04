import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { withTenantContext } from '@/lib/auth';

export const GET = withTenantContext(async (request, { params }, user) => {
  try {
    const { id } = await params;
    const db = getDb();

    const planner = await db.prepare('SELECT * FROM content_planners WHERE id = ?').get(id);
    if (!planner) {
      return NextResponse.json({ success: false, error: 'Planner tidak ditemukan.' }, { status: 404 });
    }

    const rows = await db.prepare('SELECT * FROM content_planner_rows WHERE planner_id = ? ORDER BY sequence ASC').all(id);

    return NextResponse.json({
      success: true,
      planner: {
        ...planner,
        pillars: (() => { try { return JSON.parse(planner.pillars_json || '[]'); } catch (_) { return []; } })(),
        rows
      }
    });
  } catch (error) {
    console.error('[API /content-planner/[id] GET Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const DELETE = withTenantContext(async (request, { params }, user) => {
  try {
    const { id } = await params;
    const db = getDb();

    await db.prepare('DELETE FROM content_planners WHERE id = ?').run(id);

    return NextResponse.json({ success: true, message: 'Planner berhasil dihapus.' });
  } catch (error) {
    console.error('[API /content-planner/[id] DELETE Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
