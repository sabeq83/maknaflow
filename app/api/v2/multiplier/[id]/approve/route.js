import { NextResponse } from 'next/server';
import { dbRun, getMultiplierTaskById } from '@/lib/db';
import { withTenantContext } from '@/lib/auth';

export const POST = withTenantContext(async (request, { params }) => {
  try {
    const { id } = await params;
    const task = await getMultiplierTaskById(id);
    if (!task) {
      return NextResponse.json({ success: false, error: 'Task tidak ditemukan' }, { status: 404 });
    }
    await dbRun("UPDATE re_multiplier_tasks SET status = 'generating_audio' WHERE id = ?", [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
