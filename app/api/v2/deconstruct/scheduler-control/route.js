import { NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/lib/db';
import { withTenantContext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (request) => {
  try {
    const isSchedulerActive = await getSetting('deconstruct_scheduler_active') !== 'false';
    return NextResponse.json({ success: true, isSchedulerActive });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const POST = withTenantContext(async (request) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { schedulerStatus } = body;

    if (schedulerStatus === undefined) {
      return NextResponse.json({ success: false, error: 'schedulerStatus is required' }, { status: 400 });
    }

    await setSetting('deconstruct_scheduler_active', schedulerStatus ? 'true' : 'false');
    
    // Log change to Deconstruct logs
    try {
      const { writeLogToFile } = await import('@/lib/console-hook');
      const { getActiveTenantId } = await import('@/lib/tenant-context');
      const path = await import('path');
      const tenantId = getActiveTenantId();
      const logFile = path.join(process.cwd(), 'public', `deconstruct_logs_${tenantId}.txt`);
      writeLogToFile(logFile, `Deconstruct Scheduler status changed to: ${schedulerStatus ? 'ACTIVE' : 'INACTIVE'}`);
    } catch (_) {}

    return NextResponse.json({ success: true, isSchedulerActive: schedulerStatus });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
