import { google } from 'googleapis';
import { getAuthorizedClient } from './google-auth.js';
import { getSetting, setSetting } from './db.js';
import { Readable } from 'stream';

/**
 * Create a new Google Spreadsheet with pre-defined tabs.
 * Returns { spreadsheetId, spreadsheetUrl }
 */
export async function createSpreadsheet(title, sheetTitles = ['RE Results', 'Storyboard', 'Voiceover', 'Prompts', 'Captions']) {
  const auth = getAuthorizedClient();
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: sheetTitles.map(t => ({ properties: { title: t } })),
    },
  });
  return {
    spreadsheetId: res.data.spreadsheetId,
    spreadsheetUrl: res.data.spreadsheetUrl,
  };
}

/**
 * Upload a video file (from a local path) to a specific Google Drive folder.
 * Returns { fileId, driveUrl }
 */
export async function uploadVideoToFolder(localPath, filename, folderId) {
  const { createReadStream } = await import('fs');
  const auth = getAuthorizedClient();
  const drive = google.drive({ version: 'v3', auth });

  const uploaded = await drive.files.create({
    requestBody: { name: filename, parents: [folderId] },
    media: { mimeType: 'video/mp4', body: createReadStream(localPath) },
    fields: 'id,webViewLink',
  });

  await drive.permissions.create({
    fileId: uploaded.data.id,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  return {
    fileId: uploaded.data.id,
    driveUrl: uploaded.data.webViewLink || `https://drive.google.com/file/d/${uploaded.data.id}/view`,
  };
}

/**
 * Format direct streamable Google Drive URL (returns HTTP 200 directly without 303 redirects)
 * Sesuai untuk TikTok Direct Post API dan platform video lainnya.
 */
export function formatGoogleDriveDirectUrl(fileId) {
  if (!fileId) return '';
  return `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;
}

/**
 * Normalisasi segala format URL Google Drive menjadi format direct streamable usercontent
 */
export function normalizeGoogleDriveDirectUrl(url) {
  if (!url || typeof url !== 'string') return url;
  const match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/) || url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return formatGoogleDriveDirectUrl(match[1]);
  }
  return url;
}

/**
 * Upload file dari URL (stream) langsung ke Google Drive tanpa menyimpan ke disk.
 * Digunakan oleh publishing worker untuk membuat media Nextcloud bisa diakses Repliz
 * (Nextcloud diblokir Cloudflare robots.txt, Google Drive tidak).
 *
 * @param {string} sourceUrl  - URL sumber (Nextcloud internal via Tailscale)
 * @param {string} filename   - Nama file di Google Drive
 * @param {string} folderId   - ID folder Google Drive tujuan
 * @param {Object} [options]  - Opsi tambahan (appProperties untuk idempoten)
 * @returns {Promise<{ fileId: string, directDownloadUrl: string }>}
 */
export async function uploadToDriveStaging(sourceUrl, filename, folderId, options = {}) {
  const auth = getAuthorizedClient();
  const drive = google.drive({ version: 'v3', auth });
  const { appProperties = {} } = options;

  // Cek apakah file sudah pernah diupload untuk jobId ini (idempoten)
  if (appProperties.jobId) {
    try {
      const q = `'${folderId}' in parents and appProperties has { key='jobId' and value='${appProperties.jobId}' } and trashed=false`;
      const searchRes = await drive.files.list({
        q,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fields: 'files(id, name, appProperties)'
      });
      if (searchRes.data.files && searchRes.data.files.length > 0) {
        const existing = searchRes.data.files[0];
        const directDownloadUrl = formatGoogleDriveDirectUrl(existing.id);
        console.log(`[Drive Upload] Reused existing upload for job ${appProperties.jobId} → fileId=${existing.id}`);
        return { fileId: existing.id, directDownloadUrl };
      }
    } catch (e) {
      console.warn('[Drive Uploader] Idempotency lookup failed, proceeding to upload:', e.message);
    }
  }

  // Download dari source URL (misal Tailscale internal — no Cloudflare/robots.txt)
  const res = await fetch(sourceUrl, {
    signal: AbortSignal.timeout(120000),
    headers: { 'User-Agent': 'MAKNA-Publisher/1.0' }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch media from ${sourceUrl}: HTTP ${res.status}`);
  }

  const contentType = res.headers.get('content-type') || 'video/mp4';

  // Stream langsung ke Drive (tanpa buffer ke disk)
  const requestBody = {
    name: filename,
    parents: [folderId],
  };
  if (Object.keys(appProperties).length > 0) {
    requestBody.appProperties = appProperties;
  }

  const uploaded = await drive.files.create({
    supportsAllDrives: true,
    requestBody,
    media: {
      mimeType: contentType,
      body: Readable.from(res.body),
    },
    fields: 'id, webViewLink',
  });

  const fileId = uploaded.data.id;

  // Set public agar Repliz bisa download tanpa auth (fail-closed jika ditolak kebijakan domain/akun)
  try {
    await drive.permissions.create({
      fileId,
      supportsAllDrives: true,
      requestBody: { role: 'reader', type: 'anyone' },
    });
  } catch (permErr) {
    console.error(`[Drive Uploader] Public reader permission rejected for ${fileId}:`, permErr.message);
    try {
      await drive.files.delete({ fileId, supportsAllDrives: true });
    } catch (_) {}
    const err = new Error(`Gagal mengatur izin akses publik (anyone/reader) pada media staging Google Drive: ${permErr.message}`);
    err.code = 'GOOGLE_DRIVE_PUBLIC_SHARING_BLOCKED';
    throw err;
  }

  const directDownloadUrl = formatGoogleDriveDirectUrl(fileId);
  console.log(`[Drive Upload] ${filename} → fileId=${fileId}`);

  return { fileId, directDownloadUrl };
}

export const uploadUrlToPublicDrive = uploadToDriveStaging;



/**
 * Verify that a Google Drive public media URL can be downloaded anonymously
 * without OAuth headers or cookies, receiving HTTP 200/206 and non-HTML binary media.
 *
 * @param {string} url - Direct download URL (e.g. uc?export=download&id=...)
 * @returns {Promise<boolean>}
 */
export async function verifyAnonymousDriveDownload(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL Google Drive tidak valid untuk anonymous probe.');
  }

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Range: 'bytes=0-1023',
      'User-Agent': 'MAKNA-Repliz-Preflight/1.0'
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000)
  });

  if (!res.ok && res.status !== 206) {
    throw new Error(`Anonymous Drive download probe failed with HTTP ${res.status}`);
  }

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('text/html')) {
    throw new Error('Anonymous Drive download probe returned HTML (virus scan/login page) instead of binary media.');
  }

  return true;
}



const ROOT_FOLDER_NAME = 'MAKNA Assets';

/**
 * Get or create the root folder in Google Drive.
 */
export async function getOrCreateRootFolder(drive, rootFolderName = null) {
  const configuredFolder = getSetting('drive_target_folder') || ROOT_FOLDER_NAME;
  const targetFolder = (rootFolderName && rootFolderName !== ROOT_FOLDER_NAME) ? rootFolderName : configuredFolder.replace(/^\//, '');

  let rootId = null;
  if (targetFolder === ROOT_FOLDER_NAME || targetFolder === configuredFolder.replace(/^\//, '')) {
    rootId = getSetting('drive_assets_folder_id');
  }

  if (rootId) {
    try {
      const check = await drive.files.get({ fileId: rootId, fields: 'id,trashed' });
      if (!check.data.trashed) return rootId;
    } catch { /* folder deleted or invalid, recreate */ }
  }

  // Search for existing
  const search = await drive.files.list({
    q: `name='${rootFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });

  if (search.data.files?.length) {
    rootId = search.data.files[0].id;
  } else {
    const created = await drive.files.create({
      requestBody: {
        name: rootFolderName,
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id',
    });
    rootId = created.data.id;
  }

  if (rootFolderName === ROOT_FOLDER_NAME) {
    setSetting('drive_assets_folder_id', rootId);
  }
  return rootId;
}

/**
 * Get or create a batch subfolder inside the root.
 * e.g. "RE-20260509-001" or "PROD-20260509-001"
 */
async function getOrCreateBatchFolder(drive, rootId, batchId) {
  const search = await drive.files.list({
    q: `name='${batchId}' and '${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });

  if (search.data.files?.length) {
    return search.data.files[0].id;
  }

  const created = await drive.files.create({
    requestBody: {
      name: batchId,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [rootId],
    },
    fields: 'id',
  });
  return created.data.id;
}

/**
 * Upload a file to Google Drive in a batch folder.
 * 
 * @param {Object} params
 * @param {string} params.fileUrl - URL to download the file from (webhook output)
 * @param {string} params.batchId - Batch ID (e.g. "RE-20260509-001", "PROD-20260509-001")
 * @param {string} params.filename - Filename to use in Drive
 * @param {string} params.mimeType - MIME type of the file
 * @param {string} [params.rootFolderName] - Custom root folder name (defaults to MAKNA Assets)
 * @returns {{ fileId, webViewLink, webContentLink, driveUrl }}
 */
export async function uploadToDriveBatch({ fileUrl, batchId, filename, mimeType, rootFolderName = ROOT_FOLDER_NAME }) {
  const auth = getAuthorizedClient();
  const drive = google.drive({ version: 'v3', auth });

  // Get/create folder structure
  const rootId = await getOrCreateRootFolder(drive, rootFolderName);
  const batchFolderId = await getOrCreateBatchFolder(drive, rootId, batchId);

  // Download file from webhook
  const response = await fetch(fileUrl);
  if (!response.ok) throw new Error(`Failed to download file: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Upload to Drive
  const uploaded = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [batchFolderId],
    },
    media: {
      mimeType: mimeType || 'application/octet-stream',
      body: Readable.from(buffer),
    },
    fields: 'id,webViewLink,webContentLink',
  });

  // Make file viewable by anyone with link
  await drive.permissions.create({
    fileId: uploaded.data.id,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  return {
    fileId: uploaded.data.id,
    webViewLink: uploaded.data.webViewLink,
    webContentLink: uploaded.data.webContentLink,
    driveUrl: `https://drive.google.com/file/d/${uploaded.data.id}/view`,
    folderUrl: `https://drive.google.com/drive/folders/${batchFolderId}`,
  };
}

/**
 * Get the folder URL for a batch.
 */
export async function getBatchFolderUrl(batchId, rootFolderName = ROOT_FOLDER_NAME) {
  const auth = getAuthorizedClient();
  const drive = google.drive({ version: 'v3', auth });
  const rootId = await getOrCreateRootFolder(drive, rootFolderName);

  const search = await drive.files.list({
    q: `name='${batchId}' and '${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });

  if (search.data.files?.length) {
    return `https://drive.google.com/drive/folders/${search.data.files[0].id}`;
  }
  return null;
}

/**
 * Upload Markdown file specifically for RE Results.
 * Saves to a root folder named "MAKNA RE Markdown Results".
 */
export async function uploadREMarkdownToDrive(markdownContent, filename) {
  const auth = getAuthorizedClient();
  const drive = google.drive({ version: 'v3', auth });
  const folderName = 'MAKNA RE Markdown Results';

  // Get or create the folder
  let folderId = getSetting('master_re_drive_folder_id');

  if (folderId) {
    try {
      const check = await drive.files.get({ fileId: folderId, fields: 'id,trashed' });
      if (check.data.trashed) folderId = null;
    } catch { folderId = null; }
  }

  if (!folderId) {
    const search = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id)',
      spaces: 'drive',
    });

    if (search.data.files?.length) {
      folderId = search.data.files[0].id;
    } else {
      const created = await drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id',
      });
      folderId = created.data.id;
    }
    setSetting('master_re_drive_folder_id', folderId);
  }

  // Upload file
  const uploaded = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
    },
    media: {
      mimeType: 'text/markdown',
      body: markdownContent,
    },
    fields: 'id,webViewLink',
  });

  return {
    fileId: uploaded.data.id,
    driveUrl: uploaded.data.webViewLink,
  };
}

/**
 * Get or create a campaign subfolder inside root ('MAKNA Assets')
 */
export async function getOrCreateCampaignFolder(campaignName, prefix = 'RE_Campaign_', brandProfile = null) {
  const auth = getAuthorizedClient();
  const drive = google.drive({ version: 'v3', auth });

  // Use brand profile folder ID directly if specified, else check brand profile folder name, else fallback to ROOT_FOLDER_NAME
  const rootId = brandProfile?.drive_glabs_folder_id || await getOrCreateRootFolder(drive, brandProfile?.drive_target_folder || ROOT_FOLDER_NAME);
  const campaignFolderName = `${prefix}${campaignName.replace(/[^a-zA-Z0-9_]/g, '_')}`;

  const searchSub = await drive.files.list({
    q: `name='${campaignFolderName}' and '${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });

  if (searchSub.data.files?.length) {
    return searchSub.data.files[0].id;
  }

  const createdSub = await drive.files.create({
    requestBody: {
      name: campaignFolderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [rootId]
    },
    fields: 'id',
  });

  // Make folder viewable by anyone with link
  try {
    await drive.permissions.create({
      fileId: createdSub.data.id,
      requestBody: { role: 'reader', type: 'anyone' },
    });
  } catch (err) {
    console.warn('[Drive Uploader] Failed to set folder permissions:', err.message);
  }

  return createdSub.data.id;
}

/**
 * Move a file in Google Drive to a specific target folder.
 */
export async function moveFileToFolder(fileId, folderId) {
  const auth = getAuthorizedClient();
  const drive = google.drive({ version: 'v3', auth });

  // Retrieve current parents to remove them
  const file = await drive.files.get({
    fileId: fileId,
    fields: 'parents',
  });
  const previousParents = file.data.parents ? file.data.parents.join(',') : '';

  // Move the file
  await drive.files.update({
    fileId: fileId,
    addParents: folderId,
    removeParents: previousParents,
    fields: 'id, parents',
  });
}

/**
 * Upload a markdown file directly to a campaign folder in Google Drive.
 */
export async function uploadMarkdownToCampaignFolder(markdownContent, filename, folderId) {
  const auth = getAuthorizedClient();
  const drive = google.drive({ version: 'v3', auth });

  // Check if file already exists in the folder to update or create
  const search = await drive.files.list({
    q: `name='${filename}' and '${folderId}' in parents and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });

  let uploaded;
  if (search.data.files?.length) {
    const existingFileId = search.data.files[0].id;
    uploaded = await drive.files.update({
      fileId: existingFileId,
      media: {
        mimeType: 'text/markdown',
        body: Readable.from(markdownContent),
      },
      fields: 'id,webViewLink',
    });
  } else {
    uploaded = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [folderId],
      },
      media: {
        mimeType: 'text/markdown',
        body: Readable.from(markdownContent),
      },
      fields: 'id,webViewLink',
    });
  }

  // Make file viewable by anyone with link
  try {
    await drive.permissions.create({
      fileId: uploaded.data.id,
      requestBody: { role: 'reader', type: 'anyone' },
    });
  } catch (err) {
    console.warn('[Drive Uploader] Failed to set file permissions:', err.message);
  }

  return {
    fileId: uploaded.data.id,
    driveUrl: uploaded.data.webViewLink || `https://drive.google.com/file/d/${uploaded.data.id}/view`,
  };
}

/**
 * Get or create a generic subfolder under a parent folder.
 */
export async function getOrCreateFolderInFolder(folderName, parentFolderId) {
  const auth = getAuthorizedClient();
  const drive = google.drive({ version: 'v3', auth });

  const searchSub = await drive.files.list({
    q: `name='${folderName}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });

  if (searchSub.data.files?.length) {
    return searchSub.data.files[0].id;
  }

  const createdSub = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId]
    },
    fields: 'id',
  });

  try {
    await drive.permissions.create({
      fileId: createdSub.data.id,
      requestBody: { role: 'reader', type: 'anyone' },
    });
  } catch (err) {
    console.warn('[Drive Uploader] Failed to set folder permissions:', err.message);
  }

  return createdSub.data.id;
}

/**
 * Upload a local file (such as scraped product image) to a target Google Drive folder.
 */
export async function uploadLocalFileToFolder(localPath, filename, folderId, mimeType = 'image/png') {
  const { createReadStream } = await import('fs');
  const auth = getAuthorizedClient();
  const drive = google.drive({ version: 'v3', auth });

  const uploaded = await drive.files.create({
    requestBody: { name: filename, parents: [folderId] },
    media: { mimeType, body: createReadStream(localPath) },
    fields: 'id,webViewLink',
  });

  try {
    await drive.permissions.create({
      fileId: uploaded.data.id,
      requestBody: { role: 'reader', type: 'anyone' },
    });
  } catch (_) {}

  return {
    fileId: uploaded.data.id,
    driveUrl: uploaded.data.webViewLink || `https://drive.google.com/file/d/${uploaded.data.id}/view`,
  };
}

