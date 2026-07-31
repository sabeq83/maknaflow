import { NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/lib/db';

export async function GET() {
  try {
    const isSchedulerActive = await getSetting('opc_campaigns_scheduler_active') !== 'false';
    return NextResponse.json({ success: true, isSchedulerActive });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { schedulerStatus } = body;

    if (schedulerStatus === undefined) {
      return NextResponse.json({ success: false, error: 'schedulerStatus is required' }, { status: 400 });
    }

    await setSetting('opc_campaigns_scheduler_active', schedulerStatus ? 'true' : 'false');
    
    // Log change to OPC logs
    try {
      const { writeLogToFile } = await import('@/lib/console-hook');
      const path = await import('path');
      const logFile = path.join(process.cwd(), 'public', 'opc_logs.txt');
      writeLogToFile(logFile, `OPC Scheduler status changed to: ${schedulerStatus ? 'ACTIVE' : 'INACTIVE'}`);
    } catch (_) {}

    return NextResponse.json({ success: true, isSchedulerActive: schedulerStatus });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
