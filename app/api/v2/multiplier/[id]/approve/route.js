import { NextResponse } from 'next/server';
import { dbRun, getMultiplierTaskById } from '@/lib/db';
import { withTenantContext } from '@/lib/auth';

export const POST = withTenantContext(async (req, { params }) => {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const body = await req.json().catch(() => ({}));
    const { audio_config_json } = body;

    const task = await getMultiplierTaskById(id);
    if (!task) {
      return NextResponse.json({ success: false, error: 'Task tidak ditemukan' }, { status: 404 });
    }

    if (audio_config_json) {
      await dbRun(`
        UPDATE re_multiplier_tasks 
        SET status = 'generating_audio', audio_config_json = ?, error_message = NULL 
        WHERE id = ?
      `, [audio_config_json, id]);
    } else {
      await dbRun("UPDATE re_multiplier_tasks SET status = 'generating_audio', error_message = NULL WHERE id = ?", [id]);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Approve API Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
