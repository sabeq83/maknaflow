import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import { getPublishingControl } from '@/lib/publishing-repository';
import { getPublishingWorkerStatus } from '@/lib/publishing-worker';
import { pgQuery } from '@/lib/db-pg';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async () => {
  try {
    const tenantId = getActiveTenantId();
    const control = await getPublishingControl(tenantId);
    const workerStatus = getPublishingWorkerStatus();

    const backlogRes = await pgQuery(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'scheduled') AS scheduled_count,
        COUNT(*) FILTER (WHERE status = 'processing') AS processing_count,
        COUNT(*) FILTER (WHERE status = 'retry_wait') AS retry_wait_count,
        COUNT(*) FILTER (WHERE status = 'verifying') AS verifying_count,
        COUNT(*) FILTER (WHERE status IN ('processing', 'creating_container', 'publishing') AND locked_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes') AS stale_count
      FROM publishing_jobs
      WHERE tenant_id = $1
    `, [tenantId]);

    const backlog = backlogRes.rows[0] || {};

    return NextResponse.json({
      success: true,
      data: {
        tenantId,
        isPaused: Boolean(control.is_paused),
        pausedAt: control.paused_at,
        pausedBy: control.paused_by,
        pauseReason: control.pause_reason,
        worker: workerStatus,
        backlog: {
          scheduled: parseInt(backlog.scheduled_count || 0, 10),
          processing: parseInt(backlog.processing_count || 0, 10),
          retryWait: parseInt(backlog.retry_wait_count || 0, 10),
          verifying: parseInt(backlog.verifying_count || 0, 10),
          stale: parseInt(backlog.stale_count || 0, 10)
        }
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status || 500 }
    );
  }
});
