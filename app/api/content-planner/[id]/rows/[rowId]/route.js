import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { regeneratePlannerRow } from '@/lib/content-planner-engine';

export async function PATCH(request, { params }) {
  try {
    const { id: plannerId, rowId } = await params;
    const body = await request.json();
    const db = getDb();

    const existingRow = await db.prepare('SELECT * FROM content_planner_rows WHERE id = ? AND planner_id = ?').get(rowId, plannerId);
    if (!existingRow) {
      return NextResponse.json({ success: false, error: 'Baris planner tidak ditemukan.' }, { status: 404 });
    }

    // Allowed updatable fields
    const fields = [
      'pillar', 'category_cep', 'ws_matrix', 'context', 'vfo', 'strategic_angle',
      'hook', 'visual_action', 'product', 'is_locked'
    ];

    const updates = [];
    const values = [];

    fields.forEach(field => {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    });

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(rowId);
      await db.prepare(`UPDATE content_planner_rows SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updatedRow = await db.prepare('SELECT * FROM content_planner_rows WHERE id = ?').get(rowId);
    return NextResponse.json({ success: true, row: updatedRow });
  } catch (error) {
    console.error('[API /content-planner/[id]/rows/[rowId] PATCH Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { id: plannerId, rowId } = await params;
    const body = await request.json();

    const updatedRow = await regeneratePlannerRow({
      plannerId,
      rowId,
      scope: body.scope || 'row',
      targetField: body.field || null
    });

    return NextResponse.json({ success: true, row: updatedRow });
  } catch (error) {
    console.error('[API /content-planner/[id]/rows/[rowId] POST Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id: plannerId, rowId } = await params;
    const db = getDb();

    await db.prepare('DELETE FROM content_planner_rows WHERE id = ? AND planner_id = ?').run(rowId, plannerId);
    return NextResponse.json({ success: true, message: 'Baris berhasil dihapus.' });
  } catch (error) {
    console.error('[API /content-planner/[id]/rows/[rowId] DELETE Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
