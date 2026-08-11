/**
 * Publishing Scheduler Worker Module
 * Background worker responsible for claiming due jobs, executing Meta publishing requests,
 * handling transient retries, verifying ambiguous outcomes, and syncing status summaries to Content Flow.
 */

import {
  claimDuePublishingJob,
  appendPublishingAttempt,
  markPublishingResult,
  recoverStalePublishingJobs,
  getPublishingControl,
  getPublishingAccountById
} from './publishing-repository.js';
import {
  classifyProviderFailure,
  calculateRetryDelay,
  sanitizeErrorMessage
} from './publishing-contract.js';
import {
  createFacebookDraft,
  publishFacebookLive,
  createInstagramContainer,
  getInstagramContainerStatus,
  publishInstagramContainer
} from './meta-publisher.js';
import { decryptSecret } from './encrypted-secret.js';
import { isPublishingWorkerEnabled } from './node-config.js';
import { pgQuery } from './db-pg.js';
import crypto from 'crypto';

let workerIntervalHandle = null;
let isProcessingTick = false;
let lastTickAt = null;
let lastTickStats = { processed: 0, errors: 0 };

const WORKER_ID = `pub_worker_${process.pid}_${crypto.randomBytes(3).toString('hex')}`;
const DEFAULT_INTERVAL_MS = parseInt(process.env.PUBLISHING_WORKER_INTERVAL_MS || '15000', 10);
const MAX_BATCH_PER_TICK = parseInt(process.env.PUBLISHING_WORKER_MAX_BATCH || '3', 10);

/**
 * Sinkronisasi ringkasan hasil publikasi ke Content Flow items.
 */
async function syncContentFlowSummary(job, outcome, permalink = null) {
  try {
    const { tenant_id, content_id, platform, publish_mode } = job;
    const nowIso = new Date().toISOString();

    if (platform === 'facebook') {
      const statusText = outcome === 'published' 
        ? (publish_mode === 'draft' ? 'Draft Created' : 'Published')
        : 'Failed';
      
      await pgQuery(`
        UPDATE content_flow_items
        SET 
          facebook_status = $1,
          facebook_publish_date = CASE WHEN $1 != 'Failed' THEN $2 ELSE facebook_publish_date END,
          permalink_facebook = COALESCE($3, permalink_facebook),
          updated_at = CURRENT_TIMESTAMP
        WHERE video_id = $4 AND tenant_id = $5
      `, [statusText, nowIso, permalink, content_id, tenant_id]);
    } else if (platform === 'instagram') {
      const statusText = outcome === 'published' ? 'Published' : 'Failed';
      await pgQuery(`
        UPDATE content_flow_items
        SET 
          instagram_status = $1,
          instagram_publish_date = CASE WHEN $1 != 'Failed' THEN $2 ELSE instagram_publish_date END,
          permalink_instagram = COALESCE($3, permalink_instagram),
          updated_at = CURRENT_TIMESTAMP
        WHERE video_id = $4 AND tenant_id = $5
      `, [statusText, nowIso, permalink, content_id, tenant_id]);
    }
  } catch (err) {
    console.warn('[Publishing Worker] Gagal menyinkronkan ringkasan ke Content Flow:', err.message);
  }
}

/**
 * Proses eksekusi satu publishing job yang telah diklaim atomik.
 */
export async function processPublishingJob(job) {
  const correlationId = `corr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const attemptNumber = job.attempt_count;
  const startedAt = new Date().toISOString();

  let plainToken = null;
  try {
    if (job.token_ciphertext) {
      plainToken = decryptSecret(job.token_ciphertext);
    }
  } catch (decErr) {
    console.error(`[Publishing Worker] Failed to decrypt token for job ${job.id}:`, decErr.message);
    await markPublishingResult(job.tenant_id, job.id, {
      status: 'needs_review',
      lastErrorCode: 'TOKEN_DECRYPT_FAILED',
      lastErrorMessage: 'Format enkripsi token akun tidak valid atau kunci enkripsi berubah.'
    });
    await appendPublishingAttempt({
      tenantId: job.tenant_id,
      jobId: job.id,
      attemptNumber,
      correlationId,
      stage: 'token_decrypt',
      outcome: 'failed',
      sanitizedMessage: 'Gagal mendekripsi token akun Meta.'
    });
    return;
  }

  // 1. Eksekusi Facebook
  if (job.platform === 'facebook') {
    try {
      let result;
      if (job.publish_mode === 'draft') {
        result = await createFacebookDraft({
          facebookPageId: job.facebook_page_id,
          token: plainToken,
          caption: job.caption_snapshot,
          mediaUrl: job.media_url_snapshot,
          mediaType: job.media_type
        });
      } else {
        console.log(`[Publishing Worker] Executing Live Facebook publication for page ${job.facebook_page_id}...`);
        result = await publishFacebookLive({
          facebookPageId: job.facebook_page_id,
          token: plainToken,
          caption: job.caption_snapshot,
          mediaUrl: job.media_url_snapshot,
          mediaType: job.media_type
        });
      }

      await appendPublishingAttempt({
        tenantId: job.tenant_id,
        jobId: job.id,
        attemptNumber,
        correlationId,
        stage: 'publishing',
        outcome: 'success',
        httpStatus: 200,
        externalPostId: result.postId,
        startedAt,
        finishedAt: new Date().toISOString()
      });

      await markPublishingResult(job.tenant_id, job.id, {
        status: 'published',
        externalPostId: result.postId,
        externalPermalink: result.permalink,
        publishedAt: new Date().toISOString()
      });

      await syncContentFlowSummary(job, 'published', result.permalink);
      console.log(`[Publishing Worker] Job ${job.id} Facebook ${job.publish_mode} published successfully (#${result.postId})`);
    } catch (err) {
      const classified = classifyProviderFailure(err, err.httpStatus || 0, 'publishing');
      const sanitized = sanitizeErrorMessage(err);

      await appendPublishingAttempt({
        tenantId: job.tenant_id,
        jobId: job.id,
        attemptNumber,
        correlationId,
        stage: 'publishing',
        outcome: classified.targetStatus,
        httpStatus: err.httpStatus || 0,
        providerErrorCode: String(err.code || ''),
        sanitizedMessage: sanitized,
        startedAt,
        finishedAt: new Date().toISOString()
      });

      if (classified.targetStatus === 'retry_wait' && attemptNumber < (job.max_attempts || 3)) {
        const retryDelayMs = calculateRetryDelay(attemptNumber);
        const nextAttempt = new Date(Date.now() + retryDelayMs).toISOString();

        await markPublishingResult(job.tenant_id, job.id, {
          status: 'retry_wait',
          lastErrorCode: String(err.code || 'TRANSIENT_ERROR'),
          lastErrorMessage: sanitized,
          nextAttemptAt: nextAttempt
        });
        console.warn(`[Publishing Worker] Job ${job.id} transient error. Scheduled for retry at ${nextAttempt}`);
      } else {
        const finalStatus = classified.targetStatus === 'verifying' ? 'verifying' : (classified.targetStatus === 'needs_review' ? 'needs_review' : 'failed');
        await markPublishingResult(job.tenant_id, job.id, {
          status: finalStatus,
          lastErrorCode: String(err.code || 'PUBLISH_FAILED'),
          lastErrorMessage: sanitized
        });
        await syncContentFlowSummary(job, finalStatus);
        console.error(`[Publishing Worker] Job ${job.id} failed permanently or entered ${finalStatus}:`, sanitized);
      }
    }
  }

  // 2. Eksekusi Instagram Container Workflow
  else if (job.platform === 'instagram') {
    try {
      // Step A: Create Container if not created yet
      let containerId = job.external_container_id;
      if (!containerId) {
        const containerRes = await createInstagramContainer({
          instagramUserId: job.instagram_user_id,
          token: plainToken,
          caption: job.caption_snapshot,
          mediaUrl: job.media_url_snapshot,
          mediaType: job.media_type
        });
        containerId = containerRes.containerId;

        await markPublishingResult(job.tenant_id, job.id, {
          status: 'creating_container',
          externalContainerId: containerId
        });

        await appendPublishingAttempt({
          tenantId: job.tenant_id,
          jobId: job.id,
          attemptNumber,
          correlationId,
          stage: 'create_container',
          outcome: 'success',
          externalContainerId: containerId,
          startedAt,
          finishedAt: new Date().toISOString()
        });
      }

      // Step B: Check Readiness Status
      const statusRes = await getInstagramContainerStatus(containerId, plainToken);
      if (statusRes.statusCode !== 'FINISHED') {
        if (statusRes.statusCode === 'ERROR' || statusRes.statusCode === 'EXPIRED') {
          throw new Error(`Instagram container status '${statusRes.statusCode}'. Media gagal diproses oleh Meta.`);
        }
        // Container masih diproses Meta (misal transcoding Reels), beri jeda 30 detik untuk polling berikutnya
        await markPublishingResult(job.tenant_id, job.id, {
          status: 'waiting_media',
          externalContainerId: containerId,
          nextAttemptAt: new Date(Date.now() + 30000).toISOString()
        });
        console.log(`[Publishing Worker] Instagram container ${containerId} still in progress (${statusRes.statusCode}). Retrying readiness in 30s.`);
        return;
      }

      // Step C: Publish Container
      const publishRes = await publishInstagramContainer(job.instagram_user_id, containerId, plainToken);

      await appendPublishingAttempt({
        tenantId: job.tenant_id,
        jobId: job.id,
        attemptNumber,
        correlationId,
        stage: 'publish_container',
        outcome: 'success',
        httpStatus: 200,
        externalContainerId: containerId,
        externalPostId: publishRes.postId,
        startedAt,
        finishedAt: new Date().toISOString()
      });

      await markPublishingResult(job.tenant_id, job.id, {
        status: 'published',
        externalContainerId: containerId,
        externalPostId: publishRes.postId,
        externalPermalink: publishRes.permalink,
        publishedAt: new Date().toISOString()
      });

      await syncContentFlowSummary(job, 'published', publishRes.permalink);
      console.log(`[Publishing Worker] Job ${job.id} Instagram published successfully (#${publishRes.postId})`);
    } catch (err) {
      const classified = classifyProviderFailure(err, err.httpStatus || 0, 'publishing');
      const sanitized = sanitizeErrorMessage(err);

      await appendPublishingAttempt({
        tenantId: job.tenant_id,
        jobId: job.id,
        attemptNumber,
        correlationId,
        stage: 'publishing',
        outcome: classified.targetStatus,
        httpStatus: err.httpStatus || 0,
        providerErrorCode: String(err.code || ''),
        sanitizedMessage: sanitized,
        startedAt,
        finishedAt: new Date().toISOString()
      });

      if (classified.targetStatus === 'retry_wait' && attemptNumber < (job.max_attempts || 3)) {
        const retryDelayMs = calculateRetryDelay(attemptNumber);
        const nextAttempt = new Date(Date.now() + retryDelayMs).toISOString();

        await markPublishingResult(job.tenant_id, job.id, {
          status: 'retry_wait',
          lastErrorCode: String(err.code || 'TRANSIENT_ERROR'),
          lastErrorMessage: sanitized,
          nextAttemptAt: nextAttempt
        });
      } else {
        const finalStatus = classified.targetStatus === 'verifying' ? 'verifying' : (classified.targetStatus === 'needs_review' ? 'needs_review' : 'failed');
        await markPublishingResult(job.tenant_id, job.id, {
          status: finalStatus,
          lastErrorCode: String(err.code || 'PUBLISH_FAILED'),
          lastErrorMessage: sanitized
        });
        await syncContentFlowSummary(job, finalStatus);
      }
    }
  }
}

/**
 * Single tick loop untuk worker.
 */
export async function runPublishingTick() {
  if (isProcessingTick) return;
  isProcessingTick = true;
  lastTickAt = new Date().toISOString();
  let processed = 0;
  let errors = 0;

  try {
    // 1. Recover stale locked jobs
    await recoverStalePublishingJobs(5);

    // 2. Claim due jobs up to MAX_BATCH_PER_TICK
    for (let i = 0; i < MAX_BATCH_PER_TICK; i++) {
      const job = await claimDuePublishingJob(WORKER_ID);
      if (!job) break; // Tidak ada job lagi yang jatuh tempo

      processed++;
      try {
        await processPublishingJob(job);
      } catch (jobErr) {
        errors++;
        console.error(`[Publishing Worker] Unhandled error processing job ${job.id}:`, jobErr);
      }
    }
  } catch (tickErr) {
    errors++;
    console.error('[Publishing Worker Tick Error]:', tickErr.message);
  } finally {
    lastTickStats = { processed, errors };
    isProcessingTick = false;
  }
}

/**
 * Start background timer scheduler.
 */
export function startPublishingWorker(intervalMs = DEFAULT_INTERVAL_MS) {
  if (!isPublishingWorkerEnabled()) {
    console.log('ℹ️  Publishing Worker disabled by environment configuration (ENABLE_PUBLISHING_WORKER!=true).');
    return null;
  }

  if (workerIntervalHandle) {
    console.log('ℹ️  Publishing Worker is already running.');
    return workerIntervalHandle;
  }

  console.log(`🚀 Starting MAKNA Publishing Worker (ID: ${WORKER_ID}, interval: ${intervalMs}ms)...`);
  runPublishingTick().catch(err => console.error('[Publishing Worker Initial Tick Error]:', err));

  workerIntervalHandle = setInterval(runPublishingTick, intervalMs);
  return workerIntervalHandle;
}

export function stopPublishingWorker() {
  if (workerIntervalHandle) {
    clearInterval(workerIntervalHandle);
    workerIntervalHandle = null;
    console.log('🛑 MAKNA Publishing Worker stopped.');
  }
}

export function getPublishingWorkerStatus() {
  return {
    workerId: WORKER_ID,
    isRunning: Boolean(workerIntervalHandle),
    isEnabled: isPublishingWorkerEnabled(),
    intervalMs: DEFAULT_INTERVAL_MS,
    maxBatch: MAX_BATCH_PER_TICK,
    lastTickAt,
    lastTickStats,
    isProcessingTick
  };
}
