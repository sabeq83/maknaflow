import { NextResponse } from 'next/server';
import { runSyncWorker, logToAutopilot } from '@/lib/sheets-autopilot-worker';

export async function POST(request) {
  // Trigger sync asynchronously
  runSyncWorker().catch(err => {
    logToAutopilot(`[FATAL BG ERROR] Background poller encountered critical failure: ${err.message}`);
  });

  return NextResponse.json({
    success: true,
    message: 'Sinkronisasi autopilot telah berhasil dijalankan di latar belakang.'
  });
}

export async function GET(request) {
  // Also support manual sync trigger via simple GET fetch
  runSyncWorker().catch(err => {
    logToAutopilot(`[FATAL BG ERROR] Background poller encountered critical failure: ${err.message}`);
  });

  return NextResponse.json({
    success: true,
    message: 'Sinkronisasi autopilot telah berhasil dijalankan di latar belakang.'
  });
}
