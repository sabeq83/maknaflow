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

