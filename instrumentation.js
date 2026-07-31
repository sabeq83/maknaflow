/**
 * MAKNA V4 Instrumentation: Auto-boot scheduler when Next.js server starts.
 * Only runs in Node.js runtime (not Edge).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Hook console logging and ensure log files exist
    try {
      const { hookConsole, ensureLogFilesExist } = await import('./lib/console-hook.js');
      hookConsole();
      ensureLogFilesExist();
      console.log('📝 Console logging hooked and public log files initialized.');
    } catch (err) {
      console.error('❌ Failed to initialize console hook:', err.message);
    }

    // Jalankan pembersihan stale jobs di database saat booting
    try {
      const { cleanupStaleJobs } = await import('./lib/db.js');
      await cleanupStaleJobs();
    } catch (err) {
      console.error('❌ Failed to run boot database cleanup:', err.message);
    }

    // Failsafe pemuatan .env.local untuk mendeteksi MAKNA_SCHEDULER
    if (process.env.MAKNA_SCHEDULER === undefined) {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const envPath = path.join(process.cwd(), '.env.local');
        if (fs.existsSync(envPath)) {
          const envContent = fs.readFileSync(envPath, 'utf8');
          const matches = envContent.match(/MAKNA_SCHEDULER\s*=\s*(\d+)/);
          if (matches && matches[1] === '1') {
            process.env.MAKNA_SCHEDULER = '1';
          }
        }
      } catch (_) {}
    }

    // Only start scheduler if explicitly enabled via env var
    // Set MAKNA_SCHEDULER=1 to auto-start
    if (process.env.MAKNA_SCHEDULER === '1') {
      const { startScheduler } = await import('./lib/scheduler.js');
      startScheduler();
      console.log('🏭 MAKNA Scheduler V4 auto-started via instrumentation.');
    } else {
      console.log('ℹ️  MAKNA Scheduler V4 available. Start manually from Settings or set MAKNA_SCHEDULER=1.');
    }

    // Always start campaign scheduler in background
    try {
      const { startCampaignScheduler } = await import('./lib/campaign-scheduler.js');
      startCampaignScheduler();
      console.log('⚡ MAKNA Campaign Local Scheduler V7.3 auto-started.');
    } catch (err) {
      console.error('❌ Failed to start MAKNA Campaign Local Scheduler:', err.message);
    }

    // Always start cloud sync scheduler in background
    try {
      const { startCloudSyncScheduler } = await import('./lib/cloud-sync-scheduler.js');
      startCloudSyncScheduler();
      console.log('☁️  MAKNA Cloud Hub Sync Daemon auto-started.');
    } catch (err) {
      console.error('❌ Failed to start MAKNA Cloud Hub Sync Daemon:', err.message);
    }
  }
}

