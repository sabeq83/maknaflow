import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { createDraftContentPlanner } from '@/lib/content-planner-engine';

export async function GET(request) {
  try {
    const db = getDb();
    const planners = await db.prepare(`
      SELECT p.*, COUNT(r.id) as row_count
      FROM content_planners p
      LEFT JOIN content_planner_rows r ON p.id = r.planner_id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `).all();

    return NextResponse.json({ success: true, planners });
  } catch (error) {
    console.error('[API /content-planner GET Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const result = await createDraftContentPlanner(body);
    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    console.error('[API /content-planner POST Error]', error);
    const status = error.code === 'CONTENT_PLANNER_VALIDATION' ? 400 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
