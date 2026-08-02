import { NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/lib/db';
import { getCampaignSchedulerRuntime, startCampaignScheduler, stopCampaignScheduler } from '@/lib/campaign-scheduler';
import { getNodeRole, isWorkerEnabled } from '@/lib/node-config';

async function buildSchedulerStatus() {
  const configured = await getSetting('opc_campaigns_scheduler_active') !== 'false';
  const processEnabled = process.env.ENABLE_BACKGROUND_SERVICES !== 'false' && process.env.ENABLE_CAMPAIGN_SCHEDULER !== 'false';
  const workerEnabled = isWorkerEnabled();
  const runtime = getCampaignSchedulerRuntime();
  return {
    configured,
    process_enabled: processEnabled,
    worker_enabled: workerEnabled,
    effective: configured && processEnabled && workerEnabled && runtime.running,
    node_role: getNodeRole(),
    ...runtime
  };
}

export async function GET() {
  try {
    const scheduler = await buildSchedulerStatus();
    return NextResponse.json({ success: true, isSchedulerActive: scheduler.effective, scheduler });
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
    if (schedulerStatus) startCampaignScheduler();
    else stopCampaignScheduler();
    
    // Log change to OPC logs
    try {
      const { writeLogToFile } = await import('@/lib/console-hook');
      const path = await import('path');
      const logFile = path.join(process.cwd(), 'public', 'opc_logs.txt');
      writeLogToFile(logFile, `OPC Scheduler status changed to: ${schedulerStatus ? 'ACTIVE' : 'INACTIVE'}`);
    } catch (_) {}

    const scheduler = await buildSchedulerStatus();
    return NextResponse.json({ success: true, isSchedulerActive: scheduler.effective, scheduler });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
