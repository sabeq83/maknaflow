import { NextResponse } from 'next/server';
import { getMultiplierTasksByBatchId } from '@/lib/db';
import { uploadCompletedTaskToNextcloud } from '@/lib/re-multiplier-worker';
import { withTenantContext } from '@/lib/auth';

export const POST = withTenantContext(async (request, { params }) => {
  try {
    const resolvedParams = await params;
    const id = resolvedParams?.id || params?.id;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Campaign / Batch ID wajib disertakan.' }, { status: 400 });
    }

    const tasks = await getMultiplierTasksByBatchId(id);
    const completedTasks = (tasks || []).filter(t => t.status === 'completed' && t.ffmpeg_output_path);

    if (completedTasks.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Belum ada video berstatus "completed" dengan file hasil render di kampanye ini.' 
      }, { status: 400 });
    }

    const results = [];
    let syncedCount = 0;

    for (const task of completedTasks) {
      try {
        const uploadRes = await uploadCompletedTaskToNextcloud(task.id, task.ffmpeg_output_path, true);
        results.push({ taskId: task.id, success: true, ...uploadRes });
        syncedCount++;
      } catch (err) {
        console.error(`[Nextcloud Sync] Failed uploading task ${task.id}:`, err.message);
        results.push({ taskId: task.id, success: false, error: err.message });
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Berhasil menyinkronkan aset ${syncedCount} dari ${completedTasks.length} video ke Nextcloud.`,
      synced_count: syncedCount, 
      total: completedTasks.length,
      results 
    });
  } catch (error) {
    console.error('[API /v2/multiplier-lab/[id]/sync-nextcloud POST Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
