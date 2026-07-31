import { NextResponse } from 'next/server';
import { getJobStats, getAllSchedulerConfigs, getRecentJobs } from '@/lib/db';
import { isSchedulerRunning } from '@/lib/scheduler';

export async function GET() {
  try {
    const running = isSchedulerRunning();
    const configs = await getAllSchedulerConfigs();
    const jobStats = await getJobStats();

    const queues = await Promise.all(configs.map(async config => {
      const stats = jobStats.find(s => s.queue_name === config.queue_name) || {
        pending: 0, running: 0, completed: 0, failed: 0,
      };
      const recent = await getRecentJobs(config.queue_name, 5);
      return {
        ...config,
        stats,
        recent_jobs: recent.map(j => ({
          id: j.id, status: j.status,
          created_at: j.created_at, completed_at: j.completed_at,
          error_note: j.error_note,
        })),
      };
    }));

    return NextResponse.json({
      success: true,
      data: { running, queues },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
