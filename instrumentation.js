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

    const backgroundServicesEnabled = process.env.ENABLE_BACKGROUND_SERVICES !== 'false';
    const campaignSchedulerEnabled = process.env.ENABLE_CAMPAIGN_SCHEDULER !== 'false';

    if (backgroundServicesEnabled && campaignSchedulerEnabled) {
      try {
        const { startCampaignScheduler } = await import('./lib/campaign-scheduler.js');
        startCampaignScheduler();
        console.log('⚡ MAKNA Campaign Local Scheduler V7.3 auto-started.');
      } catch (err) {
        console.error('❌ Failed to start MAKNA Campaign Local Scheduler:', err.message);
      }
    } else {
      console.log('ℹ️  MAKNA Campaign Local Scheduler disabled by environment.');
    }

    if (backgroundServicesEnabled && process.env.ENABLE_OPERATOR_WORKER !== 'false') {
      try {
        const { startOperatorContentWorker } = await import('./lib/operator-content-worker.js');
        startOperatorContentWorker();
      } catch (err) {
        console.error('❌ Failed to start MAKNA Operator Content Worker:', err.message);
      }
    } else {
      console.log('ℹ️  MAKNA Operator Content Worker disabled by environment.');
    }

    if (backgroundServicesEnabled && process.env.ENABLE_CONTENT_AUTOMATION_WORKER !== 'false') {
      try {
        const { startContentAutomationWorker } = await import('./lib/content-automation-worker.js');
        startContentAutomationWorker();
      } catch (err) {
        console.error('❌ Failed to start Content Automation Worker:', err.message);
      }
    } else {
      console.log('ℹ️  Content Automation Worker disabled by environment.');
    }

    if (backgroundServicesEnabled && process.env.ENABLE_AGENT_AUTOMATION_WORKER === 'true') {
      try {
        const { startAgentAutomationWorker } = await import('./lib/agent-automation-worker.js');
        startAgentAutomationWorker();
      } catch (err) {
        console.error('❌ Failed to start Agent Automation Worker:', err.message);
      }
    } else {
      console.log('ℹ️  Agent Automation Worker disabled by environment.');
    }

    if (backgroundServicesEnabled && process.env.ENABLE_START_FRAME_WORKER !== 'false') {
      try {
        const { startStartFrameWorker } = await import('./lib/start-frame-worker.js');
        startStartFrameWorker();
        console.log('🖼️ Durable Start Frame Worker started.');
      } catch (err) {
        console.error('❌ Failed to start Start Frame Worker:', err.message);
      }
    }

    if (backgroundServicesEnabled && process.env.ENABLE_CONTENT_AUTOMATION_NOTIFICATIONS !== 'false') {
      try {
        const { startContentAutomationNotificationWorker } = await import('./lib/content-automation-notification-worker.js');
        startContentAutomationNotificationWorker();
      } catch (err) {
        console.error('❌ Failed to start Content Automation Notification Worker:', err.message);
      }
    } else {
      console.log('ℹ️  Content Automation Notification Worker disabled by environment.');
    }

    if (backgroundServicesEnabled && process.env.ENABLE_PUBLISHING_WORKER !== 'false') {
      try {
        const { startPublishingWorker } = await import('./lib/publishing-worker.js');
        startPublishingWorker();
        console.log('⚡ MAKNA Meta Publishing Worker auto-started.');
      } catch (err) {
        console.error('❌ Failed to start MAKNA Meta Publishing Worker:', err.message);
      }
    } else {
      console.log('ℹ️  MAKNA Meta Publishing Worker disabled by environment.');
    }
  }
}
