import { NextResponse } from 'next/server';
import { getAllFfmpegStudioJobs, getFfmpegStudioJob } from '@/lib/db';

/**
 * GET /api/video-studio/jobs
 * Get all jobs, or status of a single job.
 * Query parameters: ?id=fsj_xxxx (for single job status)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const job = await getFfmpegStudioJob(id);
      if (!job) {
        return NextResponse.json({ success: false, error: 'Pekerjaan tidak ditemukan' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: job });
    }

    const jobs = await getAllFfmpegStudioJobs();
    return NextResponse.json({ success: true, data: jobs });

  } catch (error) {
    console.error('[Video Studio Jobs API] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
