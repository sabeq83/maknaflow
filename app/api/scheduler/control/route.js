import { NextResponse } from 'next/server';
import { startScheduler, stopScheduler, isSchedulerRunning } from '@/lib/scheduler';
import { createJob } from '@/lib/db';
import { writeLogToFile } from '@/lib/console-hook';
import path from 'path';

function logToAll(message) {
  try {
    const logDir = path.join(process.cwd(), 'public');
    const files = [
      're_campaign_logs.txt',
      'opc_logs.txt',
      'instant_factory_logs.txt',
      'autopilot_logs.txt',
      'multiplier_logs.txt'
    ];
    for (const filename of files) {
      writeLogToFile(path.join(logDir, filename), message);
    }
  } catch (e) {
    // Fail silently
  }
}

export async function POST(request) {
  try {
    const { action, queue_name } = await request.json();

    if (action === 'start') {
      startScheduler();
      logToAll(`Global Scheduler STARTED.`);
      return NextResponse.json({ success: true, data: { running: true, message: 'Scheduler started' } });
    }

    if (action === 'stop') {
      stopScheduler();
      logToAll(`Global Scheduler STOPPED.`);
      return NextResponse.json({ success: true, data: { running: false, message: 'Scheduler stopped' } });
    }

    if (action === 'run_now') {
      if (!queue_name) {
        return NextResponse.json({ success: false, error: 'queue_name wajib diisi untuk run_now' }, { status: 400 });
      }
      // Create an immediate job
      await createJob(queue_name, null);
      logToAll(`Immediate job created for queue: ${queue_name}.`);
      return NextResponse.json({
        success: true,
        data: { message: `Job created for queue: ${queue_name}. Will be processed on next tick.` },
      });
    }

    return NextResponse.json({ success: false, error: 'Action tidak valid. Gunakan: start, stop, run_now' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    data: { running: isSchedulerRunning() },
  });
}
