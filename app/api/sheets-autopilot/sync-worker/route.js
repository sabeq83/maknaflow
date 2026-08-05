import { NextResponse } from 'next/server';
import { runSyncWorker, logToAutopilot } from '@/lib/sheets-autopilot-worker';

import { withTenantContext } from '@/lib/auth';

export const POST = withTenantContext(async (request) => {
  // Trigger sync asynchronously
  runSyncWorker().catch(err => {
    logToAutopilot(`[FATAL BG ERROR] Background poller encountered critical failure: ${err.message}`);
  });

  return NextResponse.json({
    success: true,
    message: 'Sinkronisasi autopilot telah berhasil dijalankan di latar belakang.'
  });
});

export const GET = withTenantContext(async (request) => {
  // Also support manual sync trigger via simple GET fetch
  runSyncWorker().catch(err => {
    logToAutopilot(`[FATAL BG ERROR] Background poller encountered critical failure: ${err.message}`);
  });

  return NextResponse.json({
    success: true,
    message: 'Sinkronisasi autopilot telah berhasil dijalankan di latar belakang.'
  });
});
