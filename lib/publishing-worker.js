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
  resolvePageAccessToken,
  startFacebookReelUpload,
  transferFacebookReel,
  getFacebookVideoStatus,
  finishFacebookReel,
  fetchFacebookReelDetails,
  createInstagramContainer,
  getInstagramContainerStatus,
  publishInstagramContainer
} from './meta-publisher.js';
import { decryptSecret } from './encrypted-secret.js';
import { isPublishingWorkerEnabled } from './node-config.js';
import { pgQuery } from './db-pg.js';
import crypto from 'crypto';
import { tenantContext } from './tenant-context.js';
import { getSetting, cachesLoaded } from './db.js';
import {
  createReplizSchedule,
  getReplizSchedule,
  retryReplizSchedule
} from './repliz-client.js';

/**
 * Maps MAKNA media_type to Repliz schedule type, per platform.
 * Repliz docs: Reels → Facebook only. TikTok/YouTube/LinkedIn → video only.
 */
function getReplizPostType(platform, mediaType) {
  if (mediaType === 'text_only') return 'text';
  if (mediaType === 'image') return 'image';
  // Video content: platform-specific mapping
  if (['tiktok', 'youtube', 'linkedin', 'threads'].includes(platform)) return 'video';
  if (platform === 'instagram') return 'reel';
  if (platform === 'facebook') return mediaType === 'reels' ? 'reel' : 'video';
  return 'video';
}

/**
 * Konversi URL Nextcloud ke proxy URL MAKNA agar Repliz bisa download
 * tanpa diblokir robots.txt Cloudflare pada domain Nextcloud.
 */
const MEDIA_PROXY_ALLOWED_HOSTS = (process.env.MEDIA_PROXY_ALLOWED_HOSTS || 'cloud.ast402.my.id').split(',');
const PUBLIC_MEDIA_PROXY_URL = process.env.PUBLIC_MEDIA_PROXY_URL || '';

function resolveToProxyUrl(mediaUrl) {
  if (!mediaUrl || !PUBLIC_MEDIA_PROXY_URL) return mediaUrl;
  try {
    const parsed = new URL(mediaUrl);
    if (MEDIA_PROXY_ALLOWED_HOSTS.includes(parsed.hostname)) {
      const encoded = Buffer.from(mediaUrl).toString('base64url');
      const proxyUrl = `${PUBLIC_MEDIA_PROXY_URL}/api/media-proxy?url=${encoded}`;
      console.log(`[Publishing Worker] Media URL proxied via MAKNA: ${parsed.hostname}${parsed.pathname.slice(0, 40)}...`);
      return proxyUrl;
    }
  } catch { /* bukan URL valid */ }
  return mediaUrl;
}

/**
 * Konstruksi permalink post dari postId + info platform yang dikembalikan Repliz.
 * Repliz TIDAK mengembalikan permalink — MAKNA mengkonstruksinya sendiri.
 */
function buildPlatformPermalink(platform, postId, username, pageId) {
  if (!postId) return null;
  switch (platform) {
    case 'tiktok':    return `https://www.tiktok.com/@${username}/video/${postId}`;
    case 'instagram': return `https://www.instagram.com/reel/${postId}/`;
    case 'facebook':  return `https://www.facebook.com/${pageId || username}/posts/${postId}`;
    case 'youtube':   return `https://www.youtube.com/watch?v=${postId}`;
    case 'threads':   return `https://www.threads.net/@${username}/post/${postId}`;
    case 'linkedin':  return `https://www.linkedin.com/feed/update/${postId}`;
    default:          return null;
  }
}

let workerIntervalHandle = null;
let isProcessingTick = false;
let lastTickAt = null;
let lastTickStats = { processed: 0, errors: 0 };

const WORKER_ID = `pub_worker_${process.pid}_${crypto.randomBytes(3).toString('hex')}`;
const DEFAULT_INTERVAL_MS = parseInt(process.env.PUBLISHING_WORKER_INTERVAL_MS || '15000', 10);
const MAX_BATCH_PER_TICK = parseInt(process.env.PUBLISHING_WORKER_MAX_BATCH || '3', 10);
const MEDIA_POLL_DELAY_MS = parseInt(process.env.PUBLISHING_MEDIA_POLL_DELAY_MS || '30000', 10);

/**
 * Sinkronisasi ringkasan hasil publikasi ke Content Flow items.
 */
async function syncContentFlowSummary(job, outcome, permalink = null) {
  try {
    const { tenant_id, content_id, platform } = job;
    const nowIso = new Date().toISOString();

    // Peta kolom DB per platform — generik untuk semua platform
    const platformColumnMap = {
      facebook:  { status: 'facebook_status',  date: 'facebook_publish_date',  permalink: 'permalink_facebook' },
      instagram: { status: 'instagram_status', date: 'instagram_publish_date', permalink: 'permalink_instagram' },
      tiktok:    { status: 'tiktok_status',    date: 'tiktok_publish_date',    permalink: 'permalink_tiktok' },
      youtube:   { status: 'youtube_status',   date: 'youtube_publish_date',   permalink: 'permalink_youtube' },
      threads:   { status: 'threads_status',   date: 'threads_publish_date',   permalink: 'permalink_threads' },
      linkedin:  { status: 'linkedin_status',  date: 'linkedin_publish_date',  permalink: 'permalink_linkedin' }
    };

    const cols = platformColumnMap[platform];
    if (!cols) {
      console.warn(`[Publishing Worker] syncContentFlowSummary: platform '${platform}' tidak dikenal, skip.`);
      return;
    }

    // Hanya 3 status yang dikenal di ContentFlow
    const statusMap = {
      published:    'Published',
      processing:   'Scheduled',
      verifying:    'Scheduled',
      draft_created: 'Scheduled',
      needs_review:  'Scheduled',
      failed:       'Not Published',
      cancelled:    'Not Published'
    };
    const statusText = statusMap[outcome] || 'Not Published';

    await pgQuery(`
      UPDATE content_flow_items
      SET
        ${cols.status} = $1,
        ${cols.date} = CASE WHEN $1 = 'Published' THEN $2 ELSE ${cols.date} END,
        ${cols.permalink} = COALESCE($3, ${cols.permalink}),
        updated_at = CURRENT_TIMESTAMP
      WHERE video_id = $4 AND tenant_id = $5
    `, [statusText, nowIso, permalink, content_id, tenant_id]);
  } catch (err) {
    console.warn('[Publishing Worker] Gagal menyinkronkan ringkasan ke Content Flow:', err.message);
  }
}

function facebookStatusHasError(status) {
  return status.videoStatus === 'error' ||
    status.videoStatus === 'expired' ||
    status.videoStatus === 'upload_failed' ||
    status.uploadingStatus === 'error' ||
    status.processingStatus === 'error' ||
    status.publishingStatus === 'error';
}

export async function processFacebookReelJob(job, plainToken, context = {}) {
  const correlationId = context.correlationId || `corr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const attemptNumber = context.attemptNumber || job.attempt_count || 1;
  const pageToken = await resolvePageAccessToken(job.facebook_page_id, plainToken);
  let videoId = job.external_container_id || job.external_post_id || null;
  let providerState = job.provider_state_json || {};

  if (!videoId) {
    const started = await startFacebookReelUpload({
      facebookPageId: job.facebook_page_id,
      token: pageToken
    });
    videoId = started.videoId;
    providerState = { uploadUrl: started.uploadUrl, transferred: false, finished: false };
    await markPublishingResult(job.tenant_id, job.id, {
      status: 'uploading_media',
      externalContainerId: videoId,
      externalPostId: videoId,
      externalObjectType: 'REEL',
      providerStage: 'uploading_media',
      providerState,
      nextAttemptAt: new Date().toISOString()
    });
    await appendPublishingAttempt({
      tenantId: job.tenant_id,
      jobId: job.id,
      attemptNumber,
      correlationId,
      stage: 'reel_initialize',
      outcome: 'success',
      externalContainerId: videoId,
      externalPostId: videoId
    });
  }

  if (!providerState.transferred) {
    if (!providerState.uploadUrl) throw new Error('State upload URL Facebook Reel tidak tersedia.');
    await transferFacebookReel({
      uploadUrl: providerState.uploadUrl,
      token: pageToken,
      mediaUrl: job.media_url_snapshot
    });
    providerState = { ...providerState, transferred: true };
    await markPublishingResult(job.tenant_id, job.id, {
      status: 'waiting_media',
      externalContainerId: videoId,
      externalPostId: videoId,
      externalMediaStatus: 'processing',
      externalObjectType: 'REEL',
      providerStage: 'waiting_media',
      providerState,
      nextAttemptAt: new Date(Date.now() + MEDIA_POLL_DELAY_MS).toISOString()
    });
    await appendPublishingAttempt({
      tenantId: job.tenant_id,
      jobId: job.id,
      attemptNumber,
      correlationId,
      stage: 'reel_upload',
      outcome: 'success',
      externalContainerId: videoId,
      externalPostId: videoId
    });
    await syncContentFlowSummary(job, 'processing');
    return;
  }

  if (!providerState.finished) {
    if (providerState.finishAttempted) {
      const ambiguousDetails = await fetchFacebookReelDetails({ videoId, token: pageToken });
      const expectedPublished = job.publish_mode === 'draft'
        ? ambiguousDetails.publishStatus === 'draft'
        : ambiguousDetails.isPublished;
      if (!expectedPublished) {
        await markPublishingResult(job.tenant_id, job.id, {
          status: 'verifying',
          externalContainerId: videoId,
          externalPostId: ambiguousDetails.postId,
          externalPermalink: ambiguousDetails.permalink,
          externalMediaStatus: ambiguousDetails.videoStatus,
          externalObjectType: 'REEL',
          providerStage: 'verifying',
          providerState,
          nextAttemptAt: new Date(Date.now() + MEDIA_POLL_DELAY_MS).toISOString()
        });
        return;
      }
      providerState = { ...providerState, finished: true };
    }

    if (providerState.finished) {
      // Lanjut ke verifikasi terminal di bawah tanpa mengulang finish.
    } else {
    const mediaStatus = await getFacebookVideoStatus({ videoId, token: pageToken });
    if (facebookStatusHasError(mediaStatus)) {
      throw new Error(mediaStatus.error || `Facebook Reel media status '${mediaStatus.videoStatus}'.`);
    }
    if (mediaStatus.videoStatus !== 'ready') {
      await markPublishingResult(job.tenant_id, job.id, {
        status: 'waiting_media',
        externalContainerId: videoId,
        externalPostId: videoId,
        externalMediaStatus: mediaStatus.videoStatus,
        externalObjectType: 'REEL',
        providerStage: 'waiting_media',
        providerState,
        nextAttemptAt: new Date(Date.now() + MEDIA_POLL_DELAY_MS).toISOString()
      });
      return;
    }

    providerState = { ...providerState, finishAttempted: true };
    await markPublishingResult(job.tenant_id, job.id, {
      status: 'publishing',
      externalContainerId: videoId,
      externalPostId: videoId,
      externalMediaStatus: 'ready',
      externalObjectType: 'REEL',
      providerStage: 'publishing',
      providerState,
      nextAttemptAt: new Date(Date.now() + MEDIA_POLL_DELAY_MS).toISOString()
    });
    await finishFacebookReel({
      facebookPageId: job.facebook_page_id,
      videoId,
      token: pageToken,
      caption: job.caption_snapshot,
      publishMode: job.publish_mode
    });
    providerState = { ...providerState, finished: true };
    await markPublishingResult(job.tenant_id, job.id, {
      status: 'verifying',
      externalContainerId: videoId,
      externalPostId: videoId,
      externalMediaStatus: 'ready',
      externalObjectType: 'REEL',
      providerStage: 'verifying',
      providerState,
      nextAttemptAt: new Date(Date.now() + MEDIA_POLL_DELAY_MS).toISOString()
    });
    await appendPublishingAttempt({
      tenantId: job.tenant_id,
      jobId: job.id,
      attemptNumber,
      correlationId,
      stage: 'reel_finish',
      outcome: 'success',
      externalContainerId: videoId,
      externalPostId: videoId
    });
    return;
    }
  }

  const details = await fetchFacebookReelDetails({ videoId, token: pageToken });
  const isDraft = job.publish_mode === 'draft';
  const verified = isDraft ? details.publishStatus === 'draft' : details.isPublished;
  if (!verified) {
    await markPublishingResult(job.tenant_id, job.id, {
      status: 'verifying',
      externalContainerId: videoId,
      externalPostId: details.postId,
      externalPermalink: details.permalink,
      externalMediaStatus: details.videoStatus,
      externalObjectType: details.objectType,
      providerStage: 'verifying',
      providerState,
      nextAttemptAt: new Date(Date.now() + MEDIA_POLL_DELAY_MS).toISOString()
    });
    return;
  }

  const terminalStatus = isDraft ? 'draft_created' : 'published';
  const verifiedAt = new Date().toISOString();
  await markPublishingResult(job.tenant_id, job.id, {
    status: terminalStatus,
    externalContainerId: videoId,
    externalPostId: details.postId,
    externalPermalink: details.permalink,
    externalMediaStatus: details.videoStatus,
    externalObjectType: details.objectType,
    providerStage: terminalStatus,
    providerState,
    verifiedAt,
    publishedAt: isDraft ? null : verifiedAt
  });
  await syncContentFlowSummary(job, terminalStatus, details.permalink);
}

/**
 * Proses eksekusi satu publishing job yang telah diklaim atomik.
 */
export async function processPublishingJob(job) {
  const correlationId = `corr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const attemptNumber = job.attempt_count;
  const startedAt = new Date().toISOString();

  if (job.provider === 'repliz') {
    try {
      const url = await getSetting('repliz_api_url') || 'https://api.repliz.com';
      const accessKey = await getSetting('repliz_access_key');
      const secretKey = await getSetting('repliz_secret_key');
      if (!accessKey || !secretKey) {
        throw new Error('Kredensial Repliz belum dikonfigurasi di Settings.');
      }
      const credentials = { apiUrl: url, accessKey, secretKey };
      await processReplizJob(job, credentials, { correlationId, attemptNumber, startedAt });
      return;
    } catch (replizErr) {
      const sanitized = sanitizeErrorMessage(replizErr);
      await markPublishingResult(job.tenant_id, job.id, {
        status: 'needs_review',
        lastErrorCode: 'REPLIZ_CONFIG_ERROR',
        lastErrorMessage: sanitized
      });
      await appendPublishingAttempt({
        tenantId: job.tenant_id,
        jobId: job.id,
        attemptNumber,
        correlationId,
        stage: 'repliz_init',
        outcome: 'failed',
        sanitizedMessage: sanitized
      });
      return;
    }
  }

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
      if (job.media_type === 'reels') {
        await processFacebookReelJob(job, plainToken, { correlationId, attemptNumber });
        return;
      }
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

      const terminalStatus = job.publish_mode === 'draft' ? 'draft_created' : 'published';
      await markPublishingResult(job.tenant_id, job.id, {
        status: terminalStatus,
        externalPostId: result.postId,
        externalPermalink: result.permalink,
        publishedAt: job.publish_mode === 'draft' ? null : new Date().toISOString(),
        verifiedAt: new Date().toISOString()
      });

      await syncContentFlowSummary(job, terminalStatus, result.permalink);
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

      if (classified.targetStatus === 'retry_wait' && attemptNumber < (job.max_attempts || 8)) {
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

      if (classified.targetStatus === 'retry_wait' && attemptNumber < (job.max_attempts || 8)) {
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

export async function processReplizJob(job, credentials, { correlationId, attemptNumber, startedAt }) {
  try {
    await appendPublishingAttempt({
      tenantId: job.tenant_id,
      jobId: job.id,
      attemptNumber,
      correlationId,
      stage: 'repliz_request',
      outcome: 'processing',
      sanitizedMessage: 'Mengirimkan request ke Repliz API.'
    });

    if (!job.external_schedule_id) {
      // Resolve media URL: jika dari Nextcloud, gunakan MAKNA proxy agar Repliz
      // tidak diblokir robots.txt Cloudflare pada domain Nextcloud.
      const resolvedMediaUrl = resolveToProxyUrl(job.media_url_snapshot);

      const payload = {
        accountId: job.provider_account_id,
        scheduleAt: job.scheduled_at,
        type: getReplizPostType(job.platform, job.media_type),
        title: job.content_id || 'Untitled',
        description: job.caption_snapshot || '',
        topic: 'Content Flow',
        medias: resolvedMediaUrl ? [
          {
            type: job.media_type === 'image' ? 'image' : 'video',
            url: resolvedMediaUrl
          }
        ] : [],
        meta: {
          title: '',
          description: '',
          url: ''
        },
        additionalInfo: {
          isAiGenerated: !!job.is_ai_generated
        },
        replies: []
      };

      console.log(`[Publishing Worker] Creating schedule on Repliz for job ${job.id}...`);
      const res = await createReplizSchedule(credentials, payload);
      const schedule = res?.data || res;
      const externalScheduleId = String(schedule?.id || schedule?.scheduleId);

      await markPublishingResult(job.tenant_id, job.id, {
        external_schedule_id: externalScheduleId,
        status: 'processing',
        provider_stage: schedule?.status || 'scheduled'
      });

      // Tandai 'Scheduled' di ContentFlow segera setelah job dikirim ke Repliz
      await syncContentFlowSummary(job, 'processing');

      // Poll immediately or on next tick
      const nextAttempt = new Date(Date.now() + 10000).toISOString();
      await markPublishingResult(job.tenant_id, job.id, {
        nextAttemptAt: nextAttempt
      });
    } else if (job.status === 'retry_wait') {
      // Retrying a failed Repliz schedule
      console.log(`[Publishing Worker] Retrying Repliz schedule ${job.external_schedule_id} for job ${job.id}...`);
      await retryReplizSchedule(credentials, job.external_schedule_id);
      await markPublishingResult(job.tenant_id, job.id, {
        status: 'processing',
        provider_stage: 'retrying'
      });
      const nextAttempt = new Date(Date.now() + 10000).toISOString();
      await markPublishingResult(job.tenant_id, job.id, {
        nextAttemptAt: nextAttempt
      });
    } else {
      // Polling / reconciling status
      console.log(`[Publishing Worker] Reconciling Repliz schedule ${job.external_schedule_id} for job ${job.id}...`);
      const res = await getReplizSchedule(credentials, job.external_schedule_id);
      const schedule = res?.data || res;
      const replizStatus = (schedule?.status || 'scheduled').toLowerCase();

      if (['completed', 'success', 'published'].includes(replizStatus)) {
        let postId = schedule?.postId || schedule?.externalId || null;

        // FIX: Repliz terkadang mengembalikan postId sebagai object { type: 'schedule', id: '...' }
        // saat posting belum selesai dipublish. Treat ini sebagai 'masih pending' — lanjutkan polling.
        if (postId && typeof postId === 'object') {
          if (postId.type === 'schedule') {
            console.log(`[Publishing Worker] Job ${job.id} postId masih bertipe 'schedule' (belum publish). Lanjutkan polling...`);
            const nextAttempt = new Date(Date.now() + 20000).toISOString();
            await markPublishingResult(job.tenant_id, job.id, {
              status: 'processing',
              provider_stage: 'pending_publish',
              nextAttemptAt: nextAttempt
            });
            return;
          }
          // Object postId tipe lain — ambil id-nya
          postId = postId.id || postId.postId || String(postId);
        }

        const username = schedule?.account?.username || '';
        const pageId = schedule?.account?.generatedId || '';
        // Repliz tidak mengembalikan permalink — konstruksi sendiri dari postId + username
        const permalink = schedule?.permalink || schedule?.publishedUrl
          || buildPlatformPermalink(job.platform, postId, username, pageId);

        console.log(`[Publishing Worker] Repliz success: postId=${postId}, permalink=${permalink}`);

        await markPublishingResult(job.tenant_id, job.id, {
          status: 'published',
          external_post_id: postId,
          externalPermalink: permalink,
          verified_at: new Date().toISOString()
        });

        await appendPublishingAttempt({
          tenantId: job.tenant_id,
          jobId: job.id,
          attemptNumber,
          correlationId,
          stage: 'repliz_complete',
          outcome: 'published',
          sanitizedMessage: 'Postingan berhasil dipublikasikan via Repliz.',
          startedAt,
          finishedAt: new Date().toISOString()
        });

        await syncContentFlowSummary(job, 'published', permalink);
        console.log(`[Publishing Worker] Job ${job.id} published successfully via Repliz`);
      } else if (['failed', 'error'].includes(replizStatus)) {
        const errMsg = schedule?.errorMessage || schedule?.error || schedule?.failureReason || 'Repliz schedule execution failed';
        throw new Error(errMsg);
      } else if (replizStatus === 'cancelled') {
        await markPublishingResult(job.tenant_id, job.id, {
          status: 'cancelled',
          lastErrorMessage: 'Schedule dibatalkan oleh pengguna atau sistem di Repliz.'
        });
        await appendPublishingAttempt({
          tenantId: job.tenant_id,
          jobId: job.id,
          attemptNumber,
          correlationId,
          stage: 'repliz_cancel',
          outcome: 'failed',
          sanitizedMessage: 'Schedule dibatalkan di Repliz.'
        });
        await syncContentFlowSummary(job, 'cancelled');
      } else {
        // Still processing/scheduled in Repliz, schedule next poll in 30s
        const nextAttempt = new Date(Date.now() + 30000).toISOString();
        await markPublishingResult(job.tenant_id, job.id, {
          status: 'processing',
          provider_stage: replizStatus,
          nextAttemptAt: nextAttempt
        });
        console.log(`[Publishing Worker] Job ${job.id} still in progress in Repliz (status: ${replizStatus})`);
      }
    }
  } catch (err) {
    const classified = classifyProviderFailure(err, err.status || 0, 'processing');
    const sanitized = sanitizeErrorMessage(err);

    await appendPublishingAttempt({
      tenantId: job.tenant_id,
      jobId: job.id,
      attemptNumber,
      correlationId,
      stage: 'repliz_execution',
      outcome: classified.targetStatus,
      httpStatus: err.status || 0,
      sanitizedMessage: sanitized,
      startedAt,
      finishedAt: new Date().toISOString()
    });

    if (classified.targetStatus === 'retry_wait' && attemptNumber < (job.max_attempts || 8)) {
      const retryDelayMs = calculateRetryDelay(attemptNumber);
      const nextAttempt = new Date(Date.now() + retryDelayMs).toISOString();

      await markPublishingResult(job.tenant_id, job.id, {
        status: 'retry_wait',
        lastErrorCode: 'REPLIZ_TRANSIENT_ERROR',
        lastErrorMessage: sanitized,
        nextAttemptAt: nextAttempt
      });
    } else {
      await markPublishingResult(job.tenant_id, job.id, {
        status: 'failed',
        lastErrorCode: 'REPLIZ_EXECUTION_FAILED',
        lastErrorMessage: sanitized
      });
      await syncContentFlowSummary(job, 'failed');
    }
  }
}

/**
 * Single tick loop untuk worker.
 */
export async function runPublishingTick() {
  if (isProcessingTick) return;
  isProcessingTick = true;

  if (!cachesLoaded) {
    console.log('[Publishing Worker] Delaying tick because DB caches are not yet loaded...');
    isProcessingTick = false;
    return;
  }

  console.log(`[Publishing Worker] Tick running...`);
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
        await tenantContext.run(job.tenant_id, async () => {
          await processPublishingJob(job);
        });
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
