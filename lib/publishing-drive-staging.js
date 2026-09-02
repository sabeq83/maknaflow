/**
 * Publishing Drive Staging Service Module
 * Handles readiness check, idempotent media upload to Google Drive for Repliz publishing,
 * anonymous download probe verification, and staging media lifecycle tracking.
 */

import { google } from 'googleapis';
import { getAuthorizedClient, verifyGoogleConnection } from './google-auth.js';
import { getSetting } from './db.js';
import { uploadUrlToPublicDrive, verifyAnonymousDriveDownload } from './drive-uploader.js';
import {
  saveMediaStaging,
  getMediaStagingByJob,
  listExpiredMediaStaging,
  markMediaStagingDeleted
} from './publishing-repository.js';

let readinessCache = { timestamp: 0, data: null };

/**
 * Check if a media URL belongs to Nextcloud hosts that are blocked by Cloudflare robots.txt
 */
export function isNextcloudMediaUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    const nextcloudHosts = (process.env.MEDIA_PROXY_ALLOWED_HOSTS || 'cloud.ast402.my.id').split(',').map(h => h.trim());
    return nextcloudHosts.includes(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Actively verify that Google Drive is ready for Repliz publishing.
 * Validates OAuth tokens, folder existence, trashed status, and write capabilities.
 * Throws structured Error with error.code and error.status on failure.
 */
export async function verifyPublishingDriveReady({ bypassCache = false } = {}) {
  const now = Date.now();
  if (!bypassCache && readinessCache.data && (now - readinessCache.timestamp < 30000)) {
    return readinessCache.data;
  }

  // 1. Verify OAuth token
  const authState = await verifyGoogleConnection();
  if (!authState.connected) {
    const err = new Error(authState.message || 'Koneksi Google Drive tidak valid.');
    err.code = authState.code || 'GOOGLE_REAUTH_REQUIRED';
    err.status = authState.state === 'reauth_required' ? 409 : 503;
    err.reconnectUrl = `/api/google/auth?returnTo=${encodeURIComponent('/content-flow?view=publishing')}`;
    throw err;
  }

  // 2. Verify folder ID setting
  const folderId = getSetting('repliz_drive_folder_id') || process.env.MAKNA_PUBLISHING_DRIVE_FOLDER_ID || '';
  if (!folderId) {
    const err = new Error('Folder ID Google Drive (Repliz) belum dikonfigurasi di Settings.');
    err.code = 'GOOGLE_DRIVE_FOLDER_MISSING';
    err.status = 409;
    throw err;
  }

  // 3. Verify folder in Google Drive
  let folderRes;
  try {
    const auth = getAuthorizedClient();
    const drive = google.drive({ version: 'v3', auth });
    folderRes = await drive.files.get({
      fileId: folderId,
      fields: 'id,name,mimeType,trashed,capabilities(canAddChildren)'
    });
  } catch (apiErr) {
    const isRevoked = apiErr?.message?.includes('invalid_grant') || apiErr?.message?.includes('revoked');
    if (isRevoked) {
      const err = new Error('Koneksi Google perlu dihubungkan ulang.');
      err.code = 'GOOGLE_REAUTH_REQUIRED';
      err.status = 409;
      err.reconnectUrl = `/api/google/auth?returnTo=${encodeURIComponent('/content-flow?view=publishing')}`;
      throw err;
    }
    const err = new Error(`Folder Google Drive tidak ditemukan atau tidak dapat diakses (${apiErr.message})`);
    err.code = 'GOOGLE_DRIVE_FOLDER_NOT_FOUND';
    err.status = 409;
    throw err;
  }

  const folder = folderRes?.data;
  if (!folder || folder.trashed || folder.mimeType !== 'application/vnd.google-apps.folder') {
    const err = new Error('Folder Google Drive tujuan telah dihapus (trashed) atau bukan folder.');
    err.code = 'GOOGLE_DRIVE_FOLDER_INVALID';
    err.status = 409;
    throw err;
  }

  if (folder.capabilities && folder.capabilities.canAddChildren === false) {
    const err = new Error('Akun Google tidak memiliki izin menulis (canAddChildren) pada folder Google Drive.');
    err.code = 'GOOGLE_DRIVE_PERMISSION_ERROR';
    err.status = 409;
    throw err;
  }

  const result = {
    state: 'connected',
    connected: true,
    folderId: folder.id,
    folderName: folder.name || 'Repliz Publishing',
    checkedAt: new Date().toISOString()
  };

  readinessCache = { timestamp: now, data: result };
  return result;
}

/**
 * Get readiness status safely without throwing (for status endpoints & settings UI)
 */
export async function getPublishingDriveReadiness({ bypassCache = false } = {}) {
  try {
    return await verifyPublishingDriveReady({ bypassCache });
  } catch (err) {
    return {
      state: err.code || 'GOOGLE_DRIVE_ERROR',
      connected: false,
      code: err.code || 'GOOGLE_DRIVE_ERROR',
      error: err.message,
      reconnectUrl: err.reconnectUrl || null
    };
  }
}

/**
 * Stage media for Repliz publishing:
 * 1. Double checks Google Drive readiness
 * 2. Uploads media stream from Nextcloud to Google Drive with idempotency metadata
 * 3. Sets public reader permission
 * 4. Runs anonymous download probe
 * 5. Saves staging record in DB
 * Returns { fileId, directDownloadUrl }
 */
export async function stageMediaForRepliz(job) {
  const ready = await verifyPublishingDriveReady({ bypassCache: true });
  const folderId = ready.folderId;
  const nextcloudInternalBase = process.env.NEXTCLOUD_INTERNAL_BASE || 'http://100.78.186.123';

  let sourceUrl = job.media_url_snapshot;
  if (isNextcloudMediaUrl(sourceUrl)) {
    const parsed = new URL(sourceUrl);
    sourceUrl = `${nextcloudInternalBase}${parsed.pathname}${parsed.search}`;
  }

  const filename = `publishing_${job.id}_${job.platform || 'video'}.mp4`;
  const appProperties = {
    jobId: String(job.id),
    tenantId: String(job.tenant_id || 'default_tenant'),
    contentId: String(job.content_id || '')
  };

  console.log(`[Drive Staging] Uploading media for job ${job.id} to folder ${folderId}...`);
  const uploaded = await uploadUrlToPublicDrive(sourceUrl, filename, folderId, { appProperties });

  console.log(`[Drive Staging] Running anonymous probe on ${uploaded.directDownloadUrl}...`);
  await verifyAnonymousDriveDownload(uploaded.directDownloadUrl);
  console.log(`[Drive Staging] Anonymous probe passed for job ${job.id}!`);

  const retentionDays = parseInt(process.env.PUBLISHING_DRIVE_RETENTION_DAYS || '14', 10);
  const expiresAt = new Date(Date.now() + retentionDays * 24 * 3600 * 1000).toISOString();

  try {
    await saveMediaStaging({
      tenantId: job.tenant_id || 'default_tenant',
      jobId: job.id,
      provider: 'google_drive',
      externalFileId: uploaded.fileId,
      publicUrl: uploaded.directDownloadUrl,
      status: 'verified',
      verifiedAt: new Date().toISOString(),
      expiresAt
    });
  } catch (dbErr) {
    console.warn(`[Drive Staging] Failed to save media staging row for job ${job.id}:`, dbErr.message);
  }

  return uploaded;
}
