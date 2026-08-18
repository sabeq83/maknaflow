import { NextResponse } from 'next/server';
import { dbRun, getMultiplierTaskById } from '@/lib/db';
import { withTenantContext } from '@/lib/auth';

export const POST = withTenantContext(async (req, { params }) => {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const body = await req.json();
    const { stage } = body;

    const task = await getMultiplierTaskById(id);
    if (!task) {
      return NextResponse.json({ success: false, error: 'Task tidak ditemukan' }, { status: 404 });
    }

    let nextStatus = 'pending_resolution';
    if (stage === 'remaking') nextStatus = 'remaking';
    else if (stage === 'tts') nextStatus = 'generating_audio';
    else if (stage === 'visuals') nextStatus = 'generating_visuals';
    else if (stage === 'ffmpeg') nextStatus = 'ffmpeg_muxing';

    await dbRun(`
      UPDATE re_multiplier_tasks 
      SET status = ?, error_message = NULL 
      WHERE id = ?
    `, [nextStatus, id]);

    return NextResponse.json({ success: true, message: `Tahapan ${stage} berhasil ditrigger ulang.` });

  } catch (error) {
    console.error('[Retry API Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
