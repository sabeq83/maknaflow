import { NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/lib/db';

import { withTenantContext } from '@/lib/auth';

export const GET = withTenantContext(async () => {
  try {
    const isSchedulerActive = await getSetting('recipe_scheduler_active') === 'true';
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

    await setSetting('recipe_scheduler_active', schedulerStatus ? 'true' : 'false');
    
    // Log change to Recipe logs
    try {
      const { writeLogToFile } = await import('@/lib/console-hook');
      const { getActiveTenantId } = await import('@/lib/tenant-context');
      const path = await import('path');
      const tenantId = getActiveTenantId();
      const logFile = path.join(process.cwd(), 'public', `recipe_logs_${tenantId}.txt`);
      writeLogToFile(logFile, `Recipe Scheduler status changed to: ${schedulerStatus ? 'ACTIVE' : 'INACTIVE'}`);
    } catch (_) {}

    return NextResponse.json({ success: true, isSchedulerActive: schedulerStatus });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
