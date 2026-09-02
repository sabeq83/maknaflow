/**
 * Publishing Media Cleanup Worker Module
 * Background worker responsible for purging expired Google Drive staging files (default 14 days)
 * after parent publishing jobs have reached terminal states (published, failed, cancelled, draft_created).
 *
 * CRITICAL SAFETY INVARIANT:
 * This worker ONLY purges temporary staging copies on Google Drive.
 * It NEVER touches, modifies, or deletes the original source media on Nextcloud.
 */

import { google } from 'googleapis';
import { getAuthorizedClient } from './google-auth.js';
import { listExpiredMediaStaging, markMediaStagingDeleted } from './publishing-repository.js';
import { isPublishingWorkerEnabled } from './node-config.js';

let cleanupIntervalHandle = null;
let isCleaningTick = false;

/**
 * Single tick execution for expired Google Drive media staging cleanup.
 * @returns {Promise<{ processed: number, deleted: number, errors: number }>}
 */
export async function runPublishingMediaCleanupTick() {
  if (isCleaningTick) return { processed: 0, deleted: 0, errors: 0 };
  isCleaningTick = true;

  let processed = 0;
  let deleted = 0;
  let errors = 0;

  try {
    const expiredItems = await listExpiredMediaStaging(20);
    if (!expiredItems || expiredItems.length === 0) {
      return { processed: 0, deleted: 0, errors: 0 };
    }

    let driveClient = null;
    try {
      const auth = getAuthorizedClient();
      driveClient = google.drive({ version: 'v3', auth });
    } catch (authErr) {
      console.warn('[Publishing Media Cleanup] Google client not available for cleanup, skipping tick:', authErr.message);
      return { processed: expiredItems.length, deleted: 0, errors: expiredItems.length };
    }

    for (const item of expiredItems) {
      processed++;
      try {
        if (item.provider === 'google_drive' && item.external_file_id) {
          try {
            console.log(`[Publishing Media Cleanup] Purging expired Drive staging file ${item.external_file_id} for job ${item.job_id}...`);
            await driveClient.files.delete({ fileId: item.external_file_id });
          } catch (delErr) {
            const status = delErr?.status || delErr?.code || delErr?.response?.status;
            // 404 means already deleted on Drive, treat as successful deletion
            if (status !== 404 && !delErr?.message?.includes('File not found')) {
              throw delErr;
            }
          }
        }

        await markMediaStagingDeleted(item.id);
        deleted++;
        console.log(`[Publishing Media Cleanup] Marked media staging ${item.id} as deleted.`);
      } catch (itemErr) {
        errors++;
        console.error(`[Publishing Media Cleanup] Error purging staging item ${item.id} (job ${item.job_id}):`, itemErr.message);
      }
    }
  } catch (tickErr) {
    console.error('[Publishing Media Cleanup Tick Error]:', tickErr.message);
  } finally {
    isCleaningTick = false;
  }

  return { processed, deleted, errors };
}

/**
 * Start periodic cleanup timer (default every 1 hour).
 */
export function startPublishingMediaCleanupWorker(intervalMs = 3600000) {
  if (!isPublishingWorkerEnabled()) {
    return null;
  }

  if (cleanupIntervalHandle) {
    return cleanupIntervalHandle;
  }

  console.log(`🧹 Starting MAKNA Publishing Media Cleanup Worker (interval: ${intervalMs}ms)...`);
  runPublishingMediaCleanupTick().catch(err => console.error('[Cleanup Initial Tick Error]:', err));

  cleanupIntervalHandle = setInterval(runPublishingMediaCleanupTick, intervalMs);
  return cleanupIntervalHandle;
}

/**
 * Stop periodic cleanup timer.
 */
export function stopPublishingMediaCleanupWorker() {
  if (cleanupIntervalHandle) {
    clearInterval(cleanupIntervalHandle);
    cleanupIntervalHandle = null;
    console.log('🛑 MAKNA Publishing Media Cleanup Worker stopped.');
  }
}
