import { NextResponse } from 'next/server';
import { getTaskStatus, getTaskResult } from '@/lib/webhook-client';
import { updateGlabsTaskStatus } from '@/lib/db';

/**
 * GET /api/webhook/status?task_id=xxx — Poll task status
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('task_id');

    if (!taskId) {
      return NextResponse.json({ success: false, error: 'task_id required' }, { status: 400 });
    }

    const status = await getTaskStatus(taskId);
    const taskStatus = (status?.status || '').toLowerCase();

    // If completed, also get result
    if (taskStatus === 'completed') {
      try {
        const result = await getTaskResult(taskId);
        const files = result?.files || status?.files || [];
        const videoFile = files.find(f => f.endsWith('.mp4')) || files[0];
        let videoUrl = null;
        if (videoFile) {
          const { getFileUrl } = await import('@/lib/webhook-client');
          videoUrl = getFileUrl(videoFile);
        }

        try {
          await updateGlabsTaskStatus(taskId, 'completed', videoUrl);
        } catch (dbErr) {
          console.error(`Failed to update task status in DB for task ${taskId}:`, dbErr.message);
        }

        return NextResponse.json({ success: true, data: { ...status, ...result } });
      } catch {
        try {
          await updateGlabsTaskStatus(taskId, 'completed');
        } catch (dbErr) {
          console.error(`Failed to update task status in DB for task ${taskId}:`, dbErr.message);
        }
        return NextResponse.json({ success: true, data: status });
      }
    } else if (taskStatus === 'failed') {
      try {
        await updateGlabsTaskStatus(taskId, 'failed');
      } catch (dbErr) {
        console.error(`Failed to update task status in DB for task ${taskId}:`, dbErr.message);
      }
    }

    return NextResponse.json({ success: true, data: status });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
