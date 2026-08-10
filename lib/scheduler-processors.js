/**
 * MAKNA Scheduler V4 — Queue Processors
 *
 * Each processor handles one job from its respective queue.
 * Processors reuse existing automation logic from the API routes.
 */

import { getSetting, getDb } from './db.js';
import { executeWithKeyPool, GEMINI_MODELS } from './gemini.js';

import {
  getProductSlug,
  formatVideoId,
  getCampaignParentFolderName,
  getFilePrefixFromBatchId,
  getReBatchId,
  getIfcBatchId,
  getOpcBatchId
} from './naming-helper.js';
import { google } from 'googleapis';
import { getAuthorizedClient } from './google-auth.js';
import { resolveVisualOverrides } from './visual-override-resolver.js';

export function getCampaignNextcloudTargetFolder(campaign, fallbackS) {
  const getS = typeof fallbackS === 'function' ? fallbackS : getSetting;
  let parentFolder = campaign?.nextcloud_parent_folder;

  if (!parentFolder && campaign?.account_name) {
    try {
      const { getBrandProfileByNameSync } = require('./db');
      const bp = getBrandProfileByNameSync(campaign.account_name);
      if (bp?.nextcloud_target_folder) {
        parentFolder = bp.nextcloud_target_folder;
      }
    } catch (_) {}
  }

  const baseFolder = parentFolder || getS('nextcloud_target_folder') || '/MAKNA_Video_Generations';
  return baseFolder.startsWith('/') ? baseFolder : '/' + baseFolder;
}

export function resolveProductBase64(campaign, productData = null, rowPayload = null) {
  try {
    const fs = require('fs');
    const path = require('path');

    const fileToBase64 = (filePath) => {
      if (!filePath || typeof filePath !== 'string') return null;
      let cleanPath = filePath;
      if (cleanPath.includes('/api/v2/products/image?path=')) {
        try {
          const match = cleanPath.match(/path=([^&]+)/);
          if (match) cleanPath = decodeURIComponent(match[1]);
          if (cleanPath.includes('/api/v2/products/image?path=')) {
            const match2 = cleanPath.match(/path=([^&]+)/);
            if (match2) cleanPath = decodeURIComponent(match2[1]);
          }
        } catch (_) {}
      }

      const candidates = [
        cleanPath,
        path.join(process.cwd(), 'public', cleanPath.startsWith('/') ? cleanPath.slice(1) : cleanPath),
        path.join(process.cwd(), cleanPath.startsWith('/') ? cleanPath.slice(1) : cleanPath),
        path.join(process.cwd(), 'public', 'uploads', 'products', path.basename(cleanPath)),
        path.join(process.cwd(), 'public', 'uploads', 'products', 'clean', path.basename(cleanPath)),
        path.join(process.cwd(), 'public', 'uploads', 'products', 'raw', path.basename(cleanPath)),
        path.join(process.cwd(), 'public', 'uploads', path.basename(cleanPath))
      ];

      let targetPath = null;
      for (const p of candidates) {
        if (p && fs.existsSync(p) && fs.statSync(p).isFile()) {
          targetPath = p;
          break;
        }
      }

      if (!targetPath) return null;
      const buffer = fs.readFileSync(targetPath);
      let mimeType = 'image/png';
      if (targetPath.endsWith('.jpg') || targetPath.endsWith('.jpeg')) {
        mimeType = 'image/jpeg';
      } else if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        mimeType = 'image/jpeg';
      } else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        mimeType = 'image/png';
      } else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
        mimeType = 'image/webp';
      }
      return `data:${mimeType};base64,${buffer.toString('base64')}`;
    };

    // SAFE HYBRID MANDATE:
    // 1. Jika terhubung dengan target_product_id di Database, selalu baca Foto Studio Bersih TERBARU dari DB
    if (campaign?.target_product_id || campaign?.product_id) {
      try {
        const { getProductById } = require('./db.js');
        const p = getProductById(campaign.target_product_id || campaign.product_id);
        if (p) {
          const studioPhoto = p.clean_photo_url || p.cleaned_photo_url || p.raw_photo_url || p.photo_url;
          const b64 = fileToBase64(studioPhoto);
          if (b64) return b64;
        }
      } catch (e) {}
    }

    // 2. Jika productData dikirimkan langsung
    if (productData) {
      const studioPhoto = productData.clean_photo_url || productData.cleaned_photo_url || productData.raw_photo_url || productData.photo_url;
      const b64 = fileToBase64(studioPhoto);
      if (b64) return b64;
    }

    // 3. Check campaign custom reference image path
    if (campaign?.product_ref_image_path) {
      const b64 = fileToBase64(campaign.product_ref_image_path);
      if (b64) return b64;
    }

    if (rowPayload?.product_ref_image_path) {
      const b64 = fileToBase64(rowPayload.product_ref_image_path);
      if (b64) return b64;
    }

    return null;
  } catch (err) {
    console.error('[resolveProductBase64] Failed to resolve product Base64:', err.message);
    return null;
  }
}

// ========================
// Helper to save files to local storage
// ========================
async function saveFileToLocalStorage(sourcePath, subPath, fileName) {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const { getSetting } = await import('./db');

    const saveToLocal = Number(getSetting('save_to_local_storage') || 0);
    if (saveToLocal !== 1) return;

    const localDirSetting = getSetting('local_storage_path') || 'renders';

    // Resolve path: if it's relative, base it on process.cwd()
    let baseDir = localDirSetting;
    if (!path.isAbsolute(baseDir)) {
      baseDir = path.join(process.cwd(), baseDir);
    }

    const targetDir = path.join(baseDir, subPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const destPath = path.join(targetDir, fileName);

    // Resolve source path to absolute
    let absoluteSourcePath = sourcePath;
    if (!path.isAbsolute(absoluteSourcePath)) {
      absoluteSourcePath = path.join(process.cwd(), absoluteSourcePath);
    }

    if (fs.existsSync(absoluteSourcePath)) {
      fs.copyFileSync(absoluteSourcePath, destPath);
      console.log(`[Local Storage] Successfully saved a copy to: ${destPath}`);
    } else {
      console.error(`[Local Storage] Source file not found: ${absoluteSourcePath}`);
    }
  } catch (err) {
    console.error(`[Local Storage] Failed to copy file:`, err.message);
  }
}

// ========================
// Helper to find column letters and row by url source
// ========================
async function findRowByUrl(sheets, spreadsheetId, sheetName, targetUrl) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!A1:Z1000`
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) return { rowIndex: -1, headers: [] };

    const headers = rows[0].map(h => (h || '').trim().toLowerCase());
    const urlAliases = ['url_source', 'url source', 'source url', 'source_url', 'link source', 'link_source', 'source_link', 'source link'];
    let urlColIdx = -1;
    for (const alias of urlAliases) {
      const idx = headers.indexOf(alias);
      if (idx !== -1) {
        urlColIdx = idx;
        break;
      }
    }
    if (urlColIdx === -1) return { rowIndex: -1, headers };

    let matchedRowIndex = -1;
    for (let i = rows.length - 1; i >= 1; i--) {
      const cellVal = (rows[i][urlColIdx] || '').trim();
      if (cellVal === targetUrl.trim()) {
        matchedRowIndex = i + 1; // 1-based index
        break;
      }
    }
    return { rowIndex: matchedRowIndex, headers };
  } catch (err) {
    console.warn(`[RE Sheet Search] Failed to search for URL in sheet:`, err.message);
    return { rowIndex: -1, headers: [] };
  }
}

// ========================
// 1. SCRAPER PROCESSOR (Cost: 0)
// Downloads 1 pending video from "Riset RE" sheet
// ========================
export async function processScraper(payload, job) {
  // Dynamically import to reuse existing scraper logic
  const { downloadFromUrl, moveToLibrary, generateThumbnail, getFileSize } = await import('./video-downloader');
  const { createVideoLibraryEntry } = await import('./db');
  const { RE_PIPELINE_HEADERS } = await import('./export-builder');
  const { v4: uuidv4 } = await import('uuid');
  const path = await import('path');

  const auth = getAuthorizedClient();
  const sheets = google.sheets({ version: 'v4', auth });

  const spreadsheetId = getSetting('master_re_sheet_id');
  if (!spreadsheetId) return { skip: true, reason: 'No Master RE Sheet configured' };

  // Read Riset RE tab
  let rows;
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId, range: "'Riset RE'!A:P",
    });
    rows = res.data.values || [];
  } catch {
    return { skip: true, reason: 'Cannot read Riset RE tab' };
  }

  if (rows.length <= 1) return { skip: true, reason: 'No data rows in Riset RE' };

  const headers = rows[0];
  const statusIdx = headers.indexOf('status');
  const urlIdx = headers.indexOf('source_url');
  const nameIdx = headers.indexOf('video_name');

  if (statusIdx === -1 || urlIdx === -1) {
    return { skip: true, reason: 'Missing required columns in Riset RE' };
  }

  // Find first "pending" row
  let targetRow = null;
  let targetRowNum = -1;
  for (let i = 1; i < rows.length; i++) {
    const status = (rows[i][statusIdx] || '').toLowerCase().trim();
    if (status === 'pending' || status === '') {
      targetRow = rows[i];
      targetRowNum = i + 1;
      break;
    }
  }

  if (!targetRow) return { skip: true, reason: 'No pending videos to scrape' };

  const sourceUrl = targetRow[urlIdx];
  const videoName = targetRow[nameIdx] || 'video';
  if (!sourceUrl) return { skip: true, reason: 'Empty source URL' };

  // Mark as "scraping"
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'Riset RE'!${String.fromCharCode(65 + statusIdx)}${targetRowNum}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['scraping']] },
  });

  try {
    // Download video
    const dlResult = await downloadFromUrl(sourceUrl);
    const videoId = uuidv4();
    const ext = path.extname(dlResult.filename) || '.mp4';
    const filename = `${videoId}${ext}`;
    const localPath = await moveToLibrary(dlResult.filePath, filename);
    const fileSize = getFileSize(localPath);
    let thumbnailPath = null;
    try {
      const thumbFilename = `${videoId}.jpg`;
      thumbnailPath = await generateThumbnail(localPath, thumbFilename);
    } catch { }

    createVideoLibraryEntry({
      id: videoId,
      source_type: 'url',
      source_url: sourceUrl,
      filename,
      local_path: localPath,
      file_size: fileSize,
      mime_type: 'video/mp4',
      thumbnail_path: thumbnailPath,
      status: 'ready',
      error_note: null,
      tags: videoName,
    });

    // Update sheet: status = "processing", video_id
    const videoIdIdx = headers.indexOf('video_id');
    const updates = [['processing']];
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'Riset RE'!${String.fromCharCode(65 + statusIdx)}${targetRowNum}`,
      valueInputOption: 'RAW',
      requestBody: { values: updates },
    });
    if (videoIdIdx !== -1) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'Riset RE'!${String.fromCharCode(65 + videoIdIdx)}${targetRowNum}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[videoId]] },
      });
    }

    return { processed: true, video_id: videoId, filename, source_url: sourceUrl };
  } catch (error) {
    // Mark as error in sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'Riset RE'!${String.fromCharCode(65 + statusIdx)}${targetRowNum}`,
      valueInputOption: 'RAW',
      requestBody: { values: [['error']] },
    });
    const errorNoteIdx = headers.indexOf('error_note');
    if (errorNoteIdx !== -1) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'Riset RE'!${String.fromCharCode(65 + errorNoteIdx)}${targetRowNum}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[error.message?.slice(0, 200)]] },
      });
    }
    throw error;
  }
}


// ========================
// 2. ANALYZER (RE) PROCESSOR (Cost: 1)
// Analyzes 1 scraped video via Gemini multimodal
// ========================
export async function processAnalyzer(payload, job) {
  const { parseGeminiJSON } = await import('./json-parser');
  const { getAllKnowledgeBasesWithContent, createReverseResult, getSetting: getS } = await import('./db');
  const { buildReverseEngineeringPrompt } = await import('./prompts');
  const { uploadVideoToGemini, generateWithVideo } = await import('./gemini');
  const { v4: uuidv4 } = await import('uuid');
  const {
    generateREBatchId, buildREResultRow, buildREStoryboardRows,
    buildREVoiceoverRows, buildREPromptRows, buildRECaptionsRow, buildMarkdownContent,
  } = await import('./export-builder');

  const auth = getAuthorizedClient();
  const sheets = google.sheets({ version: 'v4', auth });

  const spreadsheetId = getS('master_re_sheet_id');
  if (!spreadsheetId) return { skip: true, reason: 'No Master RE Sheet configured' };

  // Find first "processing" row in Riset RE
  let rows;
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'Riset RE'!A:P" });
    rows = res.data.values || [];
  } catch {
    return { skip: true, reason: 'Cannot read Riset RE tab' };
  }

  if (rows.length <= 1) return { skip: true, reason: 'No data rows' };
  const headers = rows[0];
  const statusIdx = headers.indexOf('status');
  const urlIdx = headers.indexOf('source_url');
  const nameIdx = headers.indexOf('video_name');
  const instrIdx = headers.indexOf('custom_instruction');
  const arIdx = headers.indexOf('aspect_ratio');
  const aiIdx = headers.indexOf('target_ai');
  const videoIdIdx = headers.indexOf('video_id');
  const markdownUrlIdx = headers.indexOf('markdown_url');
  const assetUrlIdx = headers.indexOf('asset_url');

  let targetRow = null;
  let targetRowNum = -1;
  for (let i = 1; i < rows.length; i++) {
    const status = (rows[i][statusIdx] || '').toLowerCase().trim();
    if (status === 'processing') {
      targetRow = rows[i];
      targetRowNum = i + 1;
      break;
    }
  }

  if (!targetRow) return { skip: true, reason: 'No processing videos to analyze' };

  const sourceUrl = targetRow[urlIdx] || '';
  const videoName = targetRow[nameIdx] || 'video';
  const customInstruction = targetRow[instrIdx] || '';
  const aspectRatio = targetRow[arIdx] || '9:16';
  const targetAi = targetRow[aiIdx] || 'Google Veo (8s)';

  // Mark as "analyzing"
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'Riset RE'!${String.fromCharCode(65 + statusIdx)}${targetRowNum}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['analyzing']] },
  });

  try {
    // Find video file path from library
    const { getVideoById, getAllVideoLibrary } = await import('./db');
    const vidId = targetRow[videoIdIdx] || '';
    let videoEntry = vidId ? getVideoById(vidId) : null;
    if (!videoEntry) {
      // Try finding by source_url
      const library = getAllVideoLibrary();
      videoEntry = library.find(v => v.source_url === sourceUrl && v.status === 'ready');
    }
    if (!videoEntry) return { skip: true, reason: 'Video file not found in library' };

    // Use key pool for Gemini call
    const result = await executeWithKeyPool(1, async (apiKey) => {
      const { getMimeType } = await import('./video-downloader');
      const mimeType = getMimeType(videoEntry.local_path);
      const uploadResult = await uploadVideoToGemini(videoEntry.local_path, mimeType, apiKey);

      const kbs = await getAllKnowledgeBasesWithContent();
      const prompt = buildReverseEngineeringPrompt(
        kbs.map(kb => ({ name: kb.name, content: kb.content })),
        { aspect_ratio: aspectRatio, target_ai: targetAi, custom_instruction: customInstruction, prompt_output_format: 'plain_text' }
      );

      const responseText = await generateWithVideo(uploadResult.fileUri, uploadResult.mimeType, prompt, apiKey);
      return responseText;
    });

    const parsed = parseGeminiJSON(result);
    const reId = uuidv4();

    // Save to DB
    createReverseResult({
      id: reId, source_type: 'url', source_url: sourceUrl,
      video_filename: videoName, custom_instruction: customInstruction,
      aspect_ratio: aspectRatio, target_ai: targetAi, prompt_output_format: 'plain_text',
      storyboard: JSON.stringify(parsed.storyboard || []),
      voiceover: JSON.stringify(parsed.voiceover || []),
      t2v_prompts: JSON.stringify(parsed.t2v_prompts || []),
      tiktok_caption: parsed.tiktok_caption || '', ig_caption: parsed.ig_caption || '',
      yt_title: parsed.yt_title || '', yt_desc: parsed.yt_desc || '',
      raw_response: result,
    });

    // Sync to Google Sheets & Drive
    let batchId = '';
    let driveUrl = '';
    try {
      const existingRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'RE Results'!B:B" }).catch(() => ({ data: { values: [] } }));
      const existingIds = (existingRes.data?.values || []).flat().filter(v => v && v.startsWith('RE-'));
      batchId = generateREBatchId(existingIds, 'MASTER');

      const fullResult = {
        id: reId,
        source_type: 'url',
        source_url: sourceUrl,
        video_filename: videoName,
        custom_instruction: customInstruction,
        aspect_ratio: aspectRatio,
        target_ai: targetAi,
        prompt_output_format: 'plain_text',
        storyboard: parsed.storyboard || [],
        voiceover: parsed.voiceover || [],
        t2v_prompts: parsed.t2v_prompts || [],
        t2i_prompts: parsed.t2i_prompts || [],
        i2v_prompts: parsed.i2v_prompts || [],
        tiktok_caption: parsed.tiktok_caption || '',
        ig_caption: parsed.ig_caption || '',
        yt_title: parsed.yt_title || '',
        yt_desc: parsed.yt_desc || '',
      };

      const storyboardRows = buildREStoryboardRows(fullResult, batchId);
      const voiceoverRows = buildREVoiceoverRows(fullResult, batchId);
      const promptRows = buildREPromptRows(fullResult, batchId);

      await sheets.spreadsheets.values.append({ spreadsheetId, range: "'RE Results'!A1", valueInputOption: 'RAW', requestBody: { values: [buildREResultRow(fullResult, batchId)] } });
      if (storyboardRows.length) await sheets.spreadsheets.values.append({ spreadsheetId, range: "'Storyboard'!A1", valueInputOption: 'RAW', requestBody: { values: storyboardRows } });
      if (voiceoverRows.length) await sheets.spreadsheets.values.append({ spreadsheetId, range: "'Voiceover'!A1", valueInputOption: 'RAW', requestBody: { values: voiceoverRows } });
      if (promptRows.length) await sheets.spreadsheets.values.append({ spreadsheetId, range: "'Prompts'!A1", valueInputOption: 'RAW', requestBody: { values: promptRows } });
      await sheets.spreadsheets.values.append({ spreadsheetId, range: "'Captions'!A1", valueInputOption: 'RAW', requestBody: { values: [buildRECaptionsRow(fullResult, batchId)] } });

      // Markdown Export
      let folderUrl = '';
      try {
        const markdownContent = buildMarkdownContent(fullResult, batchId);
        const filename = `${batchId}.md`;

        const storageProvider = getS('storage_provider') || 'gdrive';
        const { getReCampaign } = await import('./db');
        const campaign = await getReCampaign(reId);
        const parentFolderName = getCampaignParentFolderName(campaign, 'RE');

        if (storageProvider === 'nextcloud') {
          const { uploadBufferToNextcloud, getOrCreatePublicShareLink } = await import('./nextcloud-helper');
          const targetFolder = getCampaignNextcloudTargetFolder(campaign, getS);
          const nextcloudBaseFolder = `${targetFolder}/${parentFolderName}/${batchId}`.replace(/\/+/g, '/');
          const targetPath = `${nextcloudBaseFolder}/${filename}`;
          await uploadBufferToNextcloud(Buffer.from(markdownContent, 'utf-8'), targetPath);
          folderUrl = await getOrCreatePublicShareLink(nextcloudBaseFolder);
        } else {
          const { getOrCreateCampaignFolder, getOrCreateFolderInFolder, uploadMarkdownToCampaignFolder } = await import('./drive-uploader');
          const campaignFolderId = await getOrCreateCampaignFolder(parentFolderName, '');
          const batchFolderId = await getOrCreateFolderInFolder(batchId, campaignFolderId);
          await uploadMarkdownToCampaignFolder(markdownContent, filename, batchFolderId);
          folderUrl = `https://drive.google.com/drive/folders/${batchFolderId}`;
        }
      } catch (mdErr) {
        console.error('[Scheduler RE] Failed to upload Markdown:', mdErr);
      }
    } catch (sheetErr) {
      console.error('[Scheduler RE] Failed to sync results to Google Sheets:', sheetErr);
    }

    // Update sheet status
    const reIdIdx = headers.indexOf('re_id');
    const batchIdIdx = headers.indexOf('batch_id');
    const processedAtIdx = headers.indexOf('processed_at');

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'Riset RE'!${String.fromCharCode(65 + statusIdx)}${targetRowNum}`,
      valueInputOption: 'RAW',
      requestBody: { values: [['produced']] },
    });
    if (reIdIdx !== -1) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'Riset RE'!${String.fromCharCode(65 + reIdIdx)}${targetRowNum}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[reId]] },
      });
    }
    if (batchIdIdx !== -1 && batchId) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'Riset RE'!${String.fromCharCode(65 + batchIdIdx)}${targetRowNum}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[batchId]] },
      });
    }
    if (assetUrlIdx !== -1 && folderUrl) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'Riset RE'!${String.fromCharCode(65 + assetUrlIdx)}${targetRowNum}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[folderUrl]] },
      });
    }
    if (processedAtIdx !== -1) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'Riset RE'!${String.fromCharCode(65 + processedAtIdx)}${targetRowNum}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[new Date().toISOString()]] },
      });
    }

    return { processed: true, re_id: reId, video_name: videoName };
  } catch (error) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'Riset RE'!${String.fromCharCode(65 + statusIdx)}${targetRowNum}`,
      valueInputOption: 'RAW',
      requestBody: { values: [['error']] },
    });
    throw error;
  }
}


// ========================
// 3. IDEATION PROCESSOR (Cost: 1)
// Generates ideas for tagged products
// ========================
export async function processIdeation(payload, job) {
  const { parseGeminiJSON } = await import('./json-parser');
  const { getAllKnowledgeBasesWithContent, getAllProductExtractions, createIdea } = await import('./db');
  const { buildIdeationPrompt } = await import('./prompts');
  const { v4: uuidv4 } = await import('uuid');
  const { generateBatchId, PIPELINE_HEADERS, buildIdeationRow } = await import('./export-builder');

  const auth = getAuthorizedClient();
  const sheets = google.sheets({ version: 'v4', auth });

  const spreadsheetId = getSetting('master_pipeline_sheet_id');
  if (!spreadsheetId) return { skip: true, reason: 'No Master Pipeline Sheet configured' };

  // Get products that have been tagged for ideation (check settings for tagged IDs)
  const taggedIdsStr = getSetting('scheduler_ideation_product_ids');
  if (!taggedIdsStr) return { skip: true, reason: 'No products tagged for auto-ideation' };

  const taggedIds = JSON.parse(taggedIdsStr);
  if (!taggedIds.length) return { skip: true, reason: 'No products tagged for auto-ideation' };

  // Get all existing ideas to see which products already have ideas
  const { getAllIdeas, getProductExtraction } = await import('./db');
  const existingIdeas = getAllIdeas();
  const existingProductNames = new Set(existingIdeas.map(i => i.product_name?.toLowerCase()));

  // Find first product without ideas
  let product = null;
  for (const pid of taggedIds) {
    const p = getProductExtraction(pid);
    if (p && !existingProductNames.has(p.product_name?.toLowerCase())) {
      product = p;
      break;
    }
  }

  if (!product) return { skip: true, reason: 'All tagged products already have ideas' };

  const kbs = await getAllKnowledgeBasesWithContent();
  if (kbs.length === 0) return { skip: true, reason: 'No Knowledge Bases available' };

  const result = await executeWithKeyPool(1, async (apiKey) => {
    const { getGeminiModel } = await import('./gemini');
    const model = await getGeminiModel(apiKey);
    const prompt = buildIdeationPrompt(
      kbs.map(kb => ({ name: kb.name, content: kb.content })),
      { product_name: product.product_name, product_description: product.product_description },
      { jumlah_ide: 3 }
    );
    const res = await model.generateContent(prompt);
    return res.response.text();
  });

  const parsed = parseGeminiJSON(result);
  const savedIdeas = [];

  for (const ideaData of parsed.ideas || [parsed]) {
    const idea = {
      id: uuidv4(),
      topik: ideaData.topik || '',
      konteks_cep: ideaData.konteks_cep || '',
      vfo: ideaData.vfo || '',
      key_messages: ideaData.key_messages || '',
      kb_digunakan: kbs.map(kb => kb.name).join(', '),
      jumlah_klip: 5,
      narrative_mode: 'Psikodrama',
      visual_style: 'UGC',
      words_per_clip: '15-16 Words',
      target_ai: 'Veo',
      face_visibility: 'Faceless',
      aspect_ratio: '9:16 Vertical',
      instruksi_tambahan: '',
      product_name: product.product_name,
      product_description: product.product_description || '',
      jumlah_ide: 3,
      prompt_output_format: 'json',
      raw_response: result,
      status: 'Draft',
    };
    createIdea(idea);
    savedIdeas.push(idea);
  }

  // Sync to Pipeline Sheet - Ideation tab
  try {
    const existingRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Ideation!A:B' });
    const existingBatchIds = (existingRes.data.values || []).flat().filter(v => v?.startsWith('B-'));

    for (const idea of savedIdeas) {
      const batchId = generateBatchId(existingBatchIds);
      existingBatchIds.push(batchId);
      await sheets.spreadsheets.values.append({
        spreadsheetId, range: 'Ideation!A1', valueInputOption: 'RAW',
        requestBody: { values: [buildIdeationRow(idea, batchId)] },
      });
    }
  } catch (syncErr) {
    console.error('[Scheduler] Ideation sheet sync error:', syncErr.message);
  }

  return { processed: true, product: product.product_name, ideas_count: savedIdeas.length };
}


// ========================
// 4. PRODUCTION PROCESSOR (Cost: 1)
// Reads Ideation tab from Sheet, takes PENDING idea, produces assets
// ========================
export async function processProduction(payload, job) {
  const { parseGeminiJSON } = await import('./json-parser');
  const { getAllKnowledgeBasesWithContent, getIdea, createAsset, updateIdeaStatus } = await import('./db');
  const { buildProductionPrompt } = await import('./prompts');
  const { v4: uuidv4 } = await import('uuid');
  const { buildProductionRows, buildCaptionsRow } = await import('./export-builder');

  const auth = getAuthorizedClient();
  const sheets = google.sheets({ version: 'v4', auth });

  const spreadsheetId = getSetting('master_pipeline_sheet_id');
  if (!spreadsheetId) return { skip: true, reason: 'No Master Pipeline Sheet configured' };

  // Read Ideation tab from G Sheet to find pending ideas
  let ideationRows;
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'Ideation!A:X' });
    ideationRows = res.data.values || [];
  } catch {
    return { skip: true, reason: 'Cannot read Ideation tab' };
  }

  if (ideationRows.length <= 1) return { skip: true, reason: 'No ideas in Ideation tab' };

  const headers = ideationRows[0];
  const pipelineStatusIdx = headers.indexOf('pipeline_status');
  const sysIdeaIdIdx = headers.indexOf('sys_idea_id');
  const batchIdIdx = headers.indexOf('batch_id');

  if (pipelineStatusIdx === -1 || sysIdeaIdIdx === -1) {
    return { skip: true, reason: 'Missing pipeline_status or sys_idea_id columns in Ideation tab' };
  }

  // Find first idea with pipeline_status = "ideated" (pending production)
  let targetRow = null;
  let targetRowNum = -1;
  for (let i = 1; i < ideationRows.length; i++) {
    const status = (ideationRows[i][pipelineStatusIdx] || '').toLowerCase().trim();
    if (status === 'ideated' || status === 'pending') {
      targetRow = ideationRows[i];
      targetRowNum = i + 1;
      break;
    }
  }

  if (!targetRow) return { skip: true, reason: 'No pending ideas for production' };

  const ideaId = targetRow[sysIdeaIdIdx];
  const batchId = targetRow[batchIdIdx] || '';
  if (!ideaId) return { skip: true, reason: 'No sys_idea_id found' };

  const idea = getIdea(ideaId);
  if (!idea) return { skip: true, reason: `Idea ${ideaId} not found in local DB` };

  // Mark as "producing" in sheet
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Ideation!${String.fromCharCode(65 + pipelineStatusIdx)}${targetRowNum}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['producing']] },
  });

  const kbs = await getAllKnowledgeBasesWithContent();
  if (kbs.length === 0) return { skip: true, reason: 'No Knowledge Bases available' };

  try {
    const result = await executeWithKeyPool(1, async (apiKey) => {
      const { getGeminiModel } = await import('./gemini');
      const model = await getGeminiModel(apiKey);
      const prompt = buildProductionPrompt(
        kbs.map(kb => ({ name: kb.name, content: kb.content })),
        idea,
        { prompt_output_format: idea.prompt_output_format || 'json' }
      );
      const res = await model.generateContent(prompt);
      return res.response.text();
    });

    const parsed = parseGeminiJSON(result);

    // Save to DB
    const asset = {
      asset_id: uuidv4(),
      idea_id: ideaId,
      storyboard: JSON.stringify(parsed.storyboard || []),
      t2i_prompts: JSON.stringify(parsed.t2i_prompts || []),
      i2v_prompts: JSON.stringify(parsed.i2v_prompts || []),
      tiktok_caption: parsed.tiktok_caption || '',
      ig_caption: parsed.ig_caption || '',
      yt_title: parsed.yt_title || '',
      yt_desc: parsed.yt_desc || '',
      raw_response: result,
    };
    createAsset(asset);
    updateIdeaStatus(ideaId, 'Generated');

    // Update sheet status to "produced"
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Ideation!${String.fromCharCode(65 + pipelineStatusIdx)}${targetRowNum}`,
      valueInputOption: 'RAW',
      requestBody: { values: [['produced']] },
    });

    // Write Production rows to Production tab
    try {
      const storyboard = parsed.storyboard || [];
      const fullResult = {
        ...asset, storyboard,
        voiceover: storyboard.map((s, i) => ({ scene: s.scene || i + 1, narration: s.narration || '', duration: s.duration || '' })),
        t2i_prompts: parsed.t2i_prompts || [],
        i2v_prompts: parsed.i2v_prompts || [],
      };
      const prodRows = buildProductionRows(fullResult, idea, batchId);
      if (prodRows.length > 0) {
        await sheets.spreadsheets.values.append({
          spreadsheetId, range: 'Production!A1', valueInputOption: 'RAW',
          requestBody: { values: prodRows },
        });
      }
      const captionRow = buildCaptionsRow(fullResult, idea, batchId);
      await sheets.spreadsheets.values.append({
        spreadsheetId, range: 'Captions!A1', valueInputOption: 'RAW',
        requestBody: { values: [captionRow] },
      });
    } catch (syncErr) {
      console.error('[Scheduler] Production sheet sync error:', syncErr.message);
    }

    return { processed: true, asset_id: asset.asset_id, idea: idea.topik };
  } catch (error) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Ideation!${String.fromCharCode(65 + pipelineStatusIdx)}${targetRowNum}`,
      valueInputOption: 'RAW',
      requestBody: { values: [['error']] },
    });
    throw error;
  }
}


// ========================
// 6. RE CAMPAIGN SCRAPER (Cost: 0) — V5
// Downloads 1 pending video from re_campaign_items
// ========================
export async function processReScraper(payload, job) {
  const { downloadFromUrl, moveToLibrary, generateThumbnail, getFileSize } = await import('./video-downloader');
  const { getNextPendingScrapeItem, updateReCampaignItem } = await import('./db');
  const path = await import('path');
  const { v4: uuidv4 } = await import('uuid');

  const itemId = payload?.item_id;
  let item;
  if (itemId) {
    const { getDb } = await import('./db');
    const db = getDb();
    item = await db.prepare('SELECT * FROM re_campaign_items WHERE id = ?').get(itemId);
  } else {
    item = getNextPendingScrapeItem();
  }
  if (!item) return { skip: true, reason: itemId ? `Item ${itemId} not found` : 'No pending RE campaign videos to scrape' };

  try {
    const dlResult = await downloadFromUrl(item.source_url);
    const videoId = uuidv4();
    const ext = path.extname(dlResult.filename) || '.mp4';
    const filename = `${videoId}${ext}`;
    const localPath = await moveToLibrary(dlResult.filePath, filename);
    try { await generateThumbnail(localPath, `${videoId}.jpg`); } catch { }

    updateReCampaignItem(item.id, {
      scrape_status: 'downloaded',
      local_video_path: localPath,
    });

    return { processed: true, item_id: item.id, source_url: item.source_url };
  } catch (error) {
    updateReCampaignItem(item.id, { scrape_status: 'failed' });
    const { logSystemError } = await import('./error-logger');
    logSystemError('RE Scraper', error, item.campaign_id);
    throw error;
  }
}


// ========================
// 7. RE CAMPAIGN ANALYZER (Cost: 1) — V5
// Analyzes 1 downloaded video, exports to campaign Sheet + Drive Markdown
// ========================
export async function processReAnalyzer(payload, job) {
  const { parseGeminiJSON } = await import('./json-parser');
  const {
    getNextPendingAnalyzeItem, updateReCampaignItem,
    getReCampaign, updateReCampaign, getReCampaignStats,
    getSetting: getS,
  } = await import('./db');
  const { buildReverseEngineeringPrompt, WARDROBE_PRESETS, DEMOGRAPHIC_PRESETS, LIGHTING_PRESETS } = await import('./prompts');
  const { uploadVideoToGemini, generateWithVideo } = await import('./gemini');
  const {
    generateREBatchId, buildREResultRow, buildREStoryboardRows,
    buildREVoiceoverRows, buildREPromptRows, buildRECaptionsRow, buildMarkdownContent,
    RE_PIPELINE_HEADERS,
  } = await import('./export-builder');
  const { createSpreadsheet, uploadREMarkdownToDrive } = await import('./drive-uploader');
  const { v4: uuidv4 } = await import('uuid');

  const itemId = payload?.item_id;
  const { getDb } = await import('./db');
  const db = getDb();
  let item;
  if (itemId) {
    item = await db.prepare('SELECT * FROM re_campaign_items WHERE id = ?').get(itemId);
  } else {
    item = getNextPendingAnalyzeItem();
  }
  if (!item) return { skip: true, reason: itemId ? `Item ${itemId} not found` : 'No downloaded RE campaign items to analyze' };

  const campaign = await getReCampaign(item.campaign_id);
  if (!campaign) return { skip: true, reason: `Campaign ${item.campaign_id} not found` };

  let sheets = null;
  const { shouldSyncGoogleSheets } = await import('./google-auth.js');
  const uploadSpreadsheet = shouldSyncGoogleSheets();
  if (uploadSpreadsheet) {
    try {
      const auth = getAuthorizedClient();
      sheets = google.sheets({ version: 'v4', auth });
    } catch (e) {
      console.warn('[RE Analyzer] Google Sheets auth skipped:', e.message);
    }
  }

  // Ensure campaign has a Google Sheet if spreadsheet upload is active
  let spreadsheetId = campaign.target_spreadsheet_id;
  if (uploadSpreadsheet && sheets && !spreadsheetId) {
    try {
      const created = await createSpreadsheet(campaign.campaign_name);
      spreadsheetId = created.spreadsheetId;
      updateReCampaign(campaign.id, { target_spreadsheet_id: spreadsheetId });

      // Write headers to each tab
      const headerMap = {
        'RE Results': RE_PIPELINE_HEADERS.results,
        Storyboard: RE_PIPELINE_HEADERS.storyboard,
        Voiceover: RE_PIPELINE_HEADERS.voiceover,
        Prompts: RE_PIPELINE_HEADERS.prompts,
        Captions: RE_PIPELINE_HEADERS.captions,
      };
      for (const [tab, headers] of Object.entries(headerMap)) {
        await sheets.spreadsheets.values.update({
          spreadsheetId, range: `'${tab}'!A1`,
          valueInputOption: 'RAW',
          requestBody: { values: [headers] },
        });
      }
    } catch (err) {
      console.warn('[RE Analyzer] Failed to create campaign spreadsheet:', err.message);
    }
  }

  try {
    let productData = null;
    if (campaign.is_bridging_active && item.product_url && item.product_url.trim() !== '') {
      const product = await db.prepare('SELECT * FROM product_extractions WHERE input_source = ? OR source_url = ?').get(item.product_url, item.product_url);
      if (product) {
        campaign.bridging_mode = 'select_existing';
        campaign.target_product_id = product.id;
        if (product.photo_url) {
          campaign.product_ref_image_path = product.photo_url;
          campaign.product_filename_declare = path.basename(product.photo_url);
        }
        console.log(`[RE Analyzer] Item #${item.id}: Menggunakan produk spesifik baris dari cache database: "${product.product_name}"`);
      } else {
        console.warn(`[RE Analyzer] Item #${item.id}: Produk dengan URL ${item.product_url} tidak ditemukan di database. Menggunakan produk global.`);
      }
    }

    // Brand DNA Injection for RE Campaign
    let brandConfig = null;
    if (campaign.brand_profile_id) {
      const { getBrandProfile } = await import('./db');
      brandConfig = await getBrandProfile(campaign.brand_profile_id);
    }

    // Load KBs
    const { getAllKnowledgeBasesWithContent } = await import('./db');
    const kbs = await getAllKnowledgeBasesWithContent();

    // Parse visual overrides
    let visualOverrides = null;
    if (campaign.visual_overrides_json) {
      try {
        visualOverrides = JSON.parse(campaign.visual_overrides_json);
        if (visualOverrides) {
          const subjectDemographic = visualOverrides.subject_demographic || 'syari_classic';
          let wardrobePresets = [];
          if (subjectDemographic === 'stylized_3d_muslimah') {
            wardrobePresets = ['3d_fem_emerald', '3d_fem_pastel_pink', '3d_fem_jetblack', '3d_fem_mocca'];
          } else if (subjectDemographic === 'stylized_3d_male') {
            wardrobePresets = ['3d_male_tan_knit', '3d_male_sage_jacket', '3d_male_charcoal_tshirt', '3d_male_terracotta_flannel'];
          } else if (subjectDemographic === 'stylized_3d_duo') {
            wardrobePresets = ['3d_duo_earth', '3d_duo_contrast', '3d_duo_monochrome', '3d_duo_pastel', '3d_duo_cool'];
          } else if (subjectDemographic === 'caucasian_male') {
            wardrobePresets = [
              'male_terracotta', 'male_caramel', 'male_khaki_tan', 'male_navy_blue',
              'male_forest_green', 'male_charcoal', 'male_burgundy', 'male_sage_muted',
              'male_steel_blue', 'male_cloud_dancer'
            ];
          } else {
            wardrobePresets = [
              'amber_terracotta', 'mocca_caramel', 'warm_grey', 'sage_muted',
              'lavender_lilac', 'butter_yellow', 'teal_navy', 'olive_modern',
              'mahogany_maroon', 'cloud_dancer'
            ];
          }

          if (visualOverrides.wardrobe_style === 'random') {
            visualOverrides.wardrobe_style = wardrobePresets[Math.floor(Math.random() * wardrobePresets.length)];
          } else if (visualOverrides.wardrobe_style === 'sequential') {
            const siblingItems = await db.prepare('SELECT id FROM re_campaign_items WHERE campaign_id = ? ORDER BY id ASC').all(campaign.id);
            const itemIndex = siblingItems.findIndex(x => x.id === item.id);
            const rowNum = itemIndex !== -1 ? (itemIndex + 1) : 1;
            const idx = (rowNum - 1) % wardrobePresets.length;
            visualOverrides.wardrobe_style = wardrobePresets[idx];
          }

          if (visualOverrides.lighting_style === 'random') {
            const lightingPresets = [
              'window_daylight', 'golden_hour', 'studio_softbox', 'cyber_neon'
            ];
            visualOverrides.lighting_style = lightingPresets[Math.floor(Math.random() * lightingPresets.length)];
          }
        }
      } catch (e) {
        console.warn('[RE Analyzer] Failed to parse visual_overrides_json:', e.message);
      }
    }

    const result = await executeWithKeyPool(1, async (apiKey) => {
      const { getMimeType } = await import('./video-downloader');
      const mimeType = getMimeType(item.local_video_path);
      const upload = await uploadVideoToGemini(item.local_video_path, mimeType, apiKey);

      let prompt;
      if (campaign.is_bridging_active) {
        // Resolve product data first
        productData = await resolveProductData(campaign);
        const { buildReverseEngineeringBridgePrompt } = await import('./prompts');
        prompt = buildReverseEngineeringBridgePrompt(kbs, {
          aspect_ratio: campaign.aspect_ratio || '9:16',
          target_ai: campaign.target_ai || 'Google Veo (8s)',
          custom_instruction: campaign.custom_instruction || '',
          target_clips_count: campaign.target_clips_count || 5,
          bridge_at_clip: campaign.bridge_at_clip || 3,
          bridge_duration_clips: campaign.bridge_duration_clips || 0,
          brand_profile: brandConfig,
          product_data: productData,
          promotion_style: campaign.promotion_style || 'Softselling',
          words_per_clip: campaign.words_per_clip || '17-19 kata',
          face_visibility: campaign.face_visibility || 'Faceless',
          visual_mode: campaign.visual_mode || 'hybrid_lock',
          visual_overrides: visualOverrides,
          target_language: campaign.target_language || 'id-ID',
          tts_model_quality: campaign.tts_model_quality || 'speech-2.8-turbo',
          visual_style: campaign.visual_style || 'Cinematic',
          sfx_setting: campaign.sfx_setting || 'without_sfx',
          enable_audio_segment: campaign.enable_audio_segment === 1,
          voice_cast_json: campaign.voice_cast_json,
          voice_provider: campaign.voice_provider || 'gemini'
        });
      } else {
        prompt = buildReverseEngineeringPrompt(kbs, {
          aspect_ratio: campaign.aspect_ratio || '9:16', target_ai: campaign.target_ai || 'Google Veo (8s)',
          custom_instruction: campaign.custom_instruction || '', prompt_output_format: 'plain_text',
          brand_profile: brandConfig,
          words_per_clip: campaign.words_per_clip || '17-19 kata',
          face_visibility: campaign.face_visibility || 'Faceless',
          visual_overrides: visualOverrides,
          target_clips_count: campaign.target_clips_count || 5,
          target_language: campaign.target_language || 'id-ID',
          visual_style: campaign.visual_style || 'Cinematic',
          sfx_setting: campaign.sfx_setting || 'without_sfx',
          visual_mode: campaign.visual_mode || 'hybrid_lock',
          enable_audio_segment: campaign.enable_audio_segment === 1,
          voice_cast_json: campaign.voice_cast_json,
          voice_provider: campaign.voice_provider || 'gemini',
          narrative_mode: campaign.narrative_mode || 'Storytelling'
        });
      }

      const { generateContentFlexible } = await import('./gemini');
      return await generateContentFlexible({
        prompt,
        videoPayload: {
          fileUri: upload.fileUri,
          mimeType: upload.mimeType
        },
        apiKey
      });
    });

    const parsed = parseGeminiJSON(result, campaign.voice_provider || 'gemini');
    const reId = uuidv4();

    const newVideoPlan = parsed.new_video_plan || (Array.isArray(parsed) ? parsed[0]?.clips : (parsed.clips || []));

    const applyReplacements = (promptStr) => {
      if (!promptStr) return '';
      let s = promptStr;
      if (visualOverrides) {
        const isMascotUniverse = visualOverrides.subject_demographic?.startsWith('mascot_universe_');
        const targetCharacter = isMascotUniverse
          ? 'a 3D stylized cartoon character'
          : (visualOverrides.subject_demographic === 'custom'
            ? visualOverrides.subject_demographic_custom
            : (DEMOGRAPHIC_PRESETS[visualOverrides.subject_demographic] || 'a graceful Muslimah'));
        const targetWardrobe = isMascotUniverse
          ? 'organic clay textures'
          : (visualOverrides.wardrobe_style === 'custom'
            ? visualOverrides.wardrobe_style_custom
            : (WARDROBE_PRESETS[visualOverrides.wardrobe_style] || 'modest clothing'));
        const targetLighting = visualOverrides.lighting_style === 'custom'
          ? visualOverrides.lighting_style_custom
          : (LIGHTING_PRESETS[visualOverrides.lighting_style] || 'soft natural light');

        s = s.replace(/\[Subject Anchor\]/g, targetCharacter);
        s = s.replace(/\[MANDATE 29 - 3-Point Character Lock\]/g, targetCharacter);
        s = s.replace(/\[Wardrobe Lock\]/g, targetWardrobe);
        s = s.replace(/\[Lighting Mood\]/g, targetLighting);

        // Only perform force-overwrite regex replacements for human demographics
        if (!isMascotUniverse) {
          s = s.replace(/\((?:Biometric Anchor|Anchor|Subject):\s*.*?\)(?=\s*(?:,|\.|\[|\(|\n|$))/gi, `(Biometric Anchor: ${targetCharacter})`);
          s = s.replace(/\(Wardrobe:\s*.*?\)(?=\s*(?:,|\.|\[|\(|\n|$))/gi, `(Wardrobe: ${targetWardrobe})`);
          s = s.replace(/\(Lighting:\s*.*?\)(?=\s*(?:,|\.|\[|\(|\n|$))/gi, `(Lighting: ${targetLighting})`);
        }
      }
      return s;
    };

    if (newVideoPlan && newVideoPlan.length > 0) {
      newVideoPlan.forEach(p => {
        p.t2i_prompt = applyReplacements(p.t2i_prompt || '');
        p.t2v_prompt = applyReplacements(p.t2v_prompt || '');
        p.i2v_prompt = applyReplacements(p.i2v_prompt || '');
      });
    }

    const videoDna = parsed.video_dna || {};
    const originalDeconstruction = parsed.original_deconstruction || [];

    // Map to old format for backward compatibility
    // Map to old format for backward compatibility
    const storyboard = newVideoPlan.map((p, idx) => ({
      scene: p.clip_index || (idx + 1),
      duration: "8s",
      visual_description: p.visual_action || p.i2v_prompt || p.t2v_prompt || p.t2i_prompt || "",
      camera_movement: "",
      audio_mood: ""
    }));

    const voiceover = newVideoPlan.map((p, idx) => ({
      scene: p.clip_index || (idx + 1),
      narration: p.new_vo || "",
      duration: "8s",
      cta_facebook: p.cta_facebook || "",
      cta_tiktok: p.cta_tiktok || "",
      voice_segments: p.voice_segments || null
    }));

    const t2v_prompts = newVideoPlan.map((p, idx) => ({
      clip: p.clip_index || (idx + 1),
      prompt: typeof p.t2v_prompt === 'object' ? JSON.stringify(p.t2v_prompt) : (p.t2v_prompt || "")
    }));

    const t2i_prompts = newVideoPlan.map((p, idx) => ({
      clip: p.clip_index || (idx + 1),
      prompt: typeof p.t2i_prompt === 'object' ? JSON.stringify(p.t2i_prompt) : (p.t2i_prompt || "")
    }));

    const i2v_prompts = newVideoPlan.map((p, idx) => ({
      clip: p.clip_index || (idx + 1),
      prompt: typeof p.i2v_prompt === 'object' ? JSON.stringify(p.i2v_prompt) : (p.i2v_prompt || "")
    }));

    const oldFormatResult = {
      ...parsed,
      storyboard,
      voiceover,
      t2v_prompts,
      t2i_prompts,
      i2v_prompts
    };

    // JIT Dynamic Voice Cast Registration for RE Campaigns
    if (campaign.enable_audio_segment === 1) {
      console.log(`[JIT Voice Cast] RE Item #${item.id}: Memeriksa naskah untuk pendaftaran karakter otonom...`);
      const { registerJitVoiceCast } = await import('./minimax-tts');
      const updatedVoiceCastJson = registerJitVoiceCast(
        campaign.voice_cast_json,
        voiceover,
        campaign.target_language || 'id-ID',
        campaign.voice_provider || 'gemini'
      );
      if (updatedVoiceCastJson) {
        console.log(`[JIT Voice Cast] RE Item #${item.id}: Karakter baru ditemukan! Mendaftarkan ke database kampanye...`);
        await db.prepare('UPDATE re_campaigns SET voice_cast_json = ? WHERE id = ?').run(updatedVoiceCastJson, campaign.id);
        campaign.voice_cast_json = updatedVoiceCastJson;
      }
    }

    if (campaign.angle_multiplier && Number(campaign.angle_multiplier) > 0) {
      updateReCampaignItem(item.id, {
        result_json: JSON.stringify(oldFormatResult),
        original_deconstruction_json: JSON.stringify(originalDeconstruction),
        new_video_plan_json: JSON.stringify(newVideoPlan),
        video_dna_json: JSON.stringify(videoDna),
      });
      await processItemMultiAngle(item.id, Number(campaign.angle_multiplier));
      return { processed: true, item_id: item.id, message: 'Multiplied angles successfully', campaign_id: campaign.id };
    }
    const t2iImagePaths = [];
    const targetClips = campaign.target_clips_count || 5;
    const bridgeAtClip = campaign.bridge_at_clip || 3;
    const bridgeDurationClips = campaign.bridge_duration_clips || 0;

    // 1. Run VO compliance checker if enabled
    if (campaign.enable_vo_audit === 1) {
      try {
        console.log(`[RE Analyzer] Item #${item.id}: Running TikTok safe VO compliance checker...`);
        const fullOriginalVo = voiceover.map(v => v.narration || '').join('\n');
        const captionText = parsed.caption || parsed.new_caption || '';

        const { auditScriptForTikTok } = await import('./tiktok-compliance-service.js');
        const auditResult = await auditScriptForTikTok(fullOriginalVo, captionText);

        const safeVoiceover = voiceover.map((v, idx) => ({
          ...v,
          narration: (auditResult.revised_script && auditResult.revised_script[idx] !== undefined)
            ? auditResult.revised_script[idx]
            : (v.narration || '')
        }));

        updateReCampaignItem(item.id, {
          original_voiceover: JSON.stringify(voiceover),
          tiktok_safe_voiceover: JSON.stringify(safeVoiceover),
          compliance_status: auditResult.verdict,
          compliance_score: auditResult.risk_score,
          compliance_log_json: JSON.stringify(auditResult),
          selected_vo_version: 'original'
        });

        console.log(`[RE Analyzer] Item #${item.id}: Compliance audit finished with verdict ${auditResult.verdict}`);
      } catch (err) {
        console.error('[RE Analyzer] Compliance audit failed:', err.message);
        updateReCampaignItem(item.id, {
          compliance_status: 'failed',
          compliance_log_json: JSON.stringify({ error: err.message })
        });
      }
    } else {
      updateReCampaignItem(item.id, {
        original_voiceover: JSON.stringify(voiceover),
        tiktok_safe_voiceover: JSON.stringify(voiceover),
        compliance_status: 'skipped'
      });
    }

    // Force Double-Pass T2I + I2V start frames generation for all campaigns on Phase 1
    {
      updateReCampaignItem(item.id, { analyze_status: 'generating_t2i' });
      const imageModel = getS('webhook_image_model') || 'nano_banana_pro';
      const { generateImage, getTaskStatus, getFileUrl } = await import('./webhook-client');
      const brandProfile = await db.prepare('SELECT * FROM brand_profiles WHERE LOWER(brand_name) = LOWER(?)').get(campaign.account_name || '');
      const fs = await import('fs');
      const path = await import('path');

      const fileToBase64 = (filePath) => {
        const absolutePath = (!path.isAbsolute(filePath) || !fs.existsSync(filePath)) ? path.join(process.cwd(), 'public', filePath.startsWith('/') ? filePath.slice(1) : filePath) : filePath;
        if (!fs.existsSync(absolutePath)) return null;
        const buffer = fs.readFileSync(absolutePath);
        let mimeType = 'image/png';
        if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
          mimeType = 'image/jpeg';
        } else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
          mimeType = 'image/png';
        } else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
          mimeType = 'image/webp';
        }
        return `data:${mimeType};base64,${buffer.toString('base64')}`;
      };

      const productBase64 = resolveProductBase64(campaign, productData);

      const t2iPattern = getS('webhook_t2i_pattern') || 'threading';
      console.log(`[RE Analyzer T2I] Using Pola T2I: ${t2iPattern}`);
      const bridgeDuration = campaign.bridge_duration_clips !== undefined ? Number(campaign.bridge_duration_clips) : 0;
      const productEndClip = bridgeDuration > 0 ? (bridgeAtClip + bridgeDuration - 1) : bridgeAtClip;

      if (t2iPattern === 'sequential') {
        for (let c = 1; c <= targetClips; c++) {
          const t2iPromptText = newVideoPlan.find(p => Number(p.clip_index) === c)?.t2i_prompt || "";
          if (t2iPromptText) {
            try {
              console.log(`[RE Analyzer T2I] [Sequential] Submitting T2I task for clip ${c}...`);
              const isBridge = (c >= bridgeAtClip && c <= productEndClip);
              const t2iResult = await generateImage({
                prompt: t2iPromptText,
                model: imageModel,
                aspect_ratio: campaign.aspect_ratio || '9:16',
                reference_images: (isBridge && productBase64) ? [productBase64] : undefined,
                webhookOverride: brandProfile
              });

              if (t2iResult?.task_id) {
                const t2iTaskId = t2iResult.task_id;
                console.log(`[RE Analyzer T2I] [Sequential] T2I task ${t2iTaskId} submitted. Polling status...`);

                // Immediately poll for this clip status
                let isCompleted = false;
                const maxAttempts = 30; // 30 * 2 seconds = 60 seconds max
                for (let attempt = 0; attempt < maxAttempts; attempt++) {
                  await new Promise(resolve => setTimeout(resolve, 2000));
                  const statusResult = await getTaskStatus(t2iTaskId);
                  const taskStatus = (statusResult?.status || '').toLowerCase();

                  if (taskStatus === 'completed') {
                    const files = statusResult.results || statusResult.files || [];
                    let imageFile = files.find(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')) || files[0];
                    if (imageFile && (imageFile.startsWith('http://') || imageFile.startsWith('https://'))) {
                      imageFile = imageFile.split('/').pop();
                    }
                    if (imageFile) {
                      const completedUrl = getFileUrl(imageFile, t2iTaskId);
                      // Download the image to public/uploads/start_frames/
                      try {
                        const imgResponse = await fetch(completedUrl);
                        if (imgResponse.ok) {
                          const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
                          const startFrameFilename = `start_frame_${item.id}_clip_${c}.png`;
                          const startFrameDir = path.join(process.cwd(), 'public', 'uploads', 'start_frames');
                          const startFrameLocalPath = path.join(startFrameDir, startFrameFilename);
                          if (!fs.existsSync(startFrameDir)) {
                            fs.mkdirSync(startFrameDir, { recursive: true });
                          }
                          fs.writeFileSync(startFrameLocalPath, imgBuffer);
                          t2iImagePaths[c - 1] = `/uploads/start_frames/${startFrameFilename}`;
                          console.log(`[RE Analyzer T2I] [Sequential] Saved image to local folder for clip ${c}: ${t2iImagePaths[c - 1]}`);
                        } else {
                          console.warn(`[RE Analyzer T2I] [Sequential] Failed to download image for clip ${c}: status ${imgResponse.status}`);
                        }
                      } catch (err) {
                        console.warn(`[RE Analyzer T2I] [Sequential] Failed to download image for clip ${c}:`, err.message);
                      }
                      isCompleted = true;
                      break;
                    }
                  } else if (taskStatus === 'failed') {
                    console.error(`[RE Analyzer T2I] [Sequential] T2I task ${t2iTaskId} failed for clip ${c}`);
                    isCompleted = true;
                    break;
                  }
                }
              }
            } catch (err) {
              console.error(`[RE Analyzer T2I] [Sequential] Error processing clip ${c}:`, err.message);
            }
          }
        }
      } else {
        // --- THREADING PATTERN (Default) ---
        const submittedTasks = []; // { clipIndex, taskId, completed, imageUrl, failed }

        for (let c = 1; c <= targetClips; c++) {
          const t2iPromptText = newVideoPlan.find(p => Number(p.clip_index) === c)?.t2i_prompt || "";
          if (t2iPromptText) {
            try {
              console.log(`[RE Analyzer T2I] [Threading] Submitting T2I task for clip ${c}...`);
              const isBridge = (c >= bridgeAtClip && c <= productEndClip);
              const t2iResult = await generateImage({
                prompt: t2iPromptText,
                model: imageModel,
                aspect_ratio: campaign.aspect_ratio || '9:16',
                reference_images: (isBridge && productBase64) ? [productBase64] : undefined,
                webhookOverride: brandProfile
              });

              if (t2iResult?.task_id) {
                const t2iTaskId = t2iResult.task_id;
                console.log(`[RE Analyzer T2I] [Threading] T2I task ${t2iTaskId} submitted for clip ${c}.`);
                submittedTasks.push({ clipIndex: c, taskId: t2iTaskId, completed: false, imageUrl: null, failed: false });
              } else {
                console.warn(`[RE Analyzer T2I] [Threading] G-Labs response has no task_id for clip ${c}:`, JSON.stringify(t2iResult));
              }
            } catch (err) {
              console.warn(`[RE Analyzer T2I] [Threading] Failed to submit T2I for clip ${c}:`, err.message);
            }

            // Safety delay between submissions: 10-20s, unless it is the last clip
            if (c < targetClips) {
              const delayMs = 10000 + Math.floor(Math.random() * 10000);
              console.log(`[RE Analyzer T2I] [Threading] Safety delay: waiting ${Math.round(delayMs / 1000)}s before next submission...`);
              await new Promise(resolve => setTimeout(resolve, delayMs));
            }
          }
        }

        // Now poll for completion of all submitted tasks
        if (submittedTasks.length > 0) {
          console.log(`[RE Analyzer T2I] [Threading] Starting batch polling for ${submittedTasks.length} T2I tasks...`);
          const maxT2iAttempts = 40; // 80s max wait
          for (let attempt = 0; attempt < maxT2iAttempts; attempt++) {
            let allFinished = true;
            for (const task of submittedTasks) {
              if (task.completed || task.failed) continue;
              allFinished = false;

              try {
                const t2iStatusResult = await getTaskStatus(task.taskId);
                const t2iStatus = (t2iStatusResult?.status || '').toLowerCase();

                if (t2iStatus === 'completed') {
                  const files = t2iStatusResult.results || t2iStatusResult.files || [];
                  let imageFile = files.find(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')) || files[0];
                  if (imageFile && (imageFile.startsWith('http://') || imageFile.startsWith('https://'))) {
                    imageFile = imageFile.split('/').pop();
                  }
                  if (imageFile) {
                    task.imageUrl = getFileUrl(imageFile, task.taskId);
                    task.completed = true;
                    console.log(`[RE Analyzer T2I] [Threading] T2I task ${task.taskId} for clip ${task.clipIndex} completed!`);
                  }
                } else if (t2iStatus === 'failed') {
                  task.failed = true;
                  console.warn(`[RE Analyzer T2I] [Threading] T2I task ${task.taskId} for clip ${task.clipIndex} failed.`);
                }
              } catch (err) {
                console.warn(`[RE Analyzer T2I] [Threading] Error polling task ${task.taskId} for clip ${task.clipIndex}:`, err.message);
              }
            }

            if (allFinished) {
              break;
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
          }

          // Download all successfully completed start frame images
          for (const task of submittedTasks) {
            if (task.completed && task.imageUrl) {
              try {
                console.log(`[RE Analyzer T2I] [Threading] Downloading start frame for clip ${task.clipIndex} from ${task.imageUrl}...`);
                const imgResponse = await fetch(task.imageUrl);
                if (imgResponse.ok) {
                  const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
                  const startFrameFilename = `start_frame_${item.id}_clip_${task.clipIndex}.png`;
                  const startFrameLocalPath = path.join(process.cwd(), 'public', 'uploads', 'start_frames', startFrameFilename);
                  const startFrameDir = path.dirname(startFrameLocalPath);
                  if (!fs.existsSync(startFrameDir)) {
                    fs.mkdirSync(startFrameDir, { recursive: true });
                  }
                  fs.writeFileSync(startFrameLocalPath, imgBuffer);
                  t2iImagePaths[task.clipIndex - 1] = `/uploads/start_frames/${startFrameFilename}`;
                } else {
                  console.warn(`[RE Analyzer T2I] [Threading] Failed to download image for clip ${task.clipIndex}: status ${imgResponse.status}`);
                }
              } catch (err) {
                console.warn(`[RE Analyzer T2I] [Threading] Failed to download image for clip ${task.clipIndex}:`, err.message);
              }
            }
          }
        }
      }
    }

    const isFullAutopilot = campaign?.execution_mode === 'full_autopilot';

    updateReCampaignItem(item.id, {
      analyze_status: 'analyzed',
      result_json: JSON.stringify(oldFormatResult),
      original_deconstruction_json: JSON.stringify(originalDeconstruction),
      new_video_plan_json: JSON.stringify(newVideoPlan),
      video_dna_json: JSON.stringify(videoDna),
      t2i_images_json: JSON.stringify(t2iImagePaths),
      workflow_status: isFullAutopilot ? 'production_processing' : 'ready_for_review'
    });

    // Export to campaign Sheet
    let driveUrl = '';
    try {
      let batchId = '';
      if (uploadSpreadsheet && sheets && spreadsheetId) {
        const { ensureTabAndAppendRows, updateCell, getColumnLetter } = await import('./sheets-autopilot-worker');

        // Check CAMPAIGN_RE first for batch id sequence
        const headerRes = await sheets.spreadsheets.values.get({
          spreadsheetId, range: "'CAMPAIGN_RE'!1:1",
        }).catch(() => ({ data: { values: [] } }));
        const headers = headerRes.data?.values?.[0] || [];
        const batchIdIdx = headers.indexOf('batch_id') !== -1 ? headers.indexOf('batch_id') : 0;
        const colLetter = String.fromCharCode(65 + batchIdIdx);

        const existingRes = await sheets.spreadsheets.values.get({
          spreadsheetId, range: `'CAMPAIGN_RE'!${colLetter}:${colLetter}`,
        }).catch(() => ({ data: { values: [] } }));
        const existingIds = (existingRes.data?.values || []).flat().filter(v => v && v.startsWith('RE-'));
        batchId = generateREBatchId(existingIds, campaign.campaign_name);
      } else {
        // Fallback: Generate offline/local batchId if sheets are not connected
        batchId = generateREBatchId([], campaign.campaign_name);
      }

      const fullResult = {
        id: reId, source_type: 'url', source_url: item.source_url,
        video_filename: item.source_url.split('/').pop() || 'video',
        custom_instruction: campaign.custom_instruction || '', aspect_ratio: campaign.aspect_ratio || '9:16', target_ai: campaign.target_ai || 'Google Veo (8s)',
        storyboard: storyboard || [],
        voiceover: voiceover || [],
        t2v_prompts: t2v_prompts || [],
        t2i_prompts: t2i_prompts || [],
        i2v_prompts: i2v_prompts || [],
        tiktok_caption: parsed.tiktok_caption || '',
        ig_caption: parsed.ig_caption || '',
        yt_title: parsed.yt_title || '',
        yt_desc: parsed.yt_desc || '',
      };

      // Markdown to Drive/Nextcloud first
      let folderUrl = '';
      try {
        const markdownContent = buildMarkdownContent(fullResult, batchId);
        const filename = `${batchId}.md`;

        const storageProvider = getS('storage_provider') || 'gdrive';
        const { getReCampaign } = await import('./db');
        const dbCampaign = (await getReCampaign(campaign.id)) || campaign;
        const parentFolderName = getCampaignParentFolderName(dbCampaign, 'RE');
        if (storageProvider === 'nextcloud') {
          const { uploadBufferToNextcloud, getOrCreatePublicShareLink } = await import('./nextcloud-helper');
          const targetFolder = getCampaignNextcloudTargetFolder(dbCampaign, getS);
          const nextcloudBaseFolder = `${targetFolder}/${parentFolderName}/${batchId}`.replace(/\/+/g, '/');
          const targetPath = `${nextcloudBaseFolder}/${filename}`;
          await uploadBufferToNextcloud(Buffer.from(markdownContent, 'utf-8'), targetPath);
          folderUrl = await getOrCreatePublicShareLink(nextcloudBaseFolder);
        } else {
          const { getOrCreateCampaignFolder, getOrCreateFolderInFolder, uploadMarkdownToCampaignFolder } = await import('./drive-uploader');
          const campaignFolderId = await getOrCreateCampaignFolder(parentFolderName, '');
          const batchFolderId = await getOrCreateFolderInFolder(batchId, campaignFolderId);
          await uploadMarkdownToCampaignFolder(markdownContent, filename, batchFolderId);
          folderUrl = `https://drive.google.com/drive/folders/${batchFolderId}`;
        }
      } catch (mdErr) {
        console.error('[RE Analyzer] Markdown upload failed:', mdErr.message);
      }

      // 1. Update/Append main tab CAMPAIGN_RE matching url source
      if (uploadSpreadsheet && sheets && spreadsheetId) {
        const sheetName = 'CAMPAIGN_RE';
        const defaultHeaders = ['batch_id', 'url_source', 'pipeline_status', 'markdown_url', 'asset_url', 'processed_at'];

      let { rowIndex, headers: sheetHeaders } = await findRowByUrl(sheets, spreadsheetId, sheetName, item.source_url);

      // If tab does not exist, let's create it by ensuring headers
      if (rowIndex === -2 || sheetHeaders.length === 0) {
        // Tab not found or empty
        await ensureTabAndAppendRows(sheets, spreadsheetId, sheetName, defaultHeaders, []);
        const freshRes = await findRowByUrl(sheets, spreadsheetId, sheetName, item.source_url);
        rowIndex = freshRes.rowIndex;
        sheetHeaders = freshRes.headers.length > 0 ? freshRes.headers : defaultHeaders;
      }

      // Ensure all outputs are present in headers
      const requiredOutputs = ['batch_id', 'pipeline_status', 'markdown_url', 'asset_url', 'processed_at'];
      for (const req of requiredOutputs) {
        if (sheetHeaders.indexOf(req) === -1) {
          const nextColIndex = sheetHeaders.length;
          const colLetter = getColumnLetter(nextColIndex);
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `'${sheetName}'!${colLetter}1`,
            valueInputOption: 'RAW',
            requestBody: { values: [[req]] }
          });
          sheetHeaders.push(req);
        }
      }

      const urlSourceIdx = sheetHeaders.indexOf('url_source') !== -1 ? sheetHeaders.indexOf('url_source') : sheetHeaders.indexOf('url source') !== -1 ? sheetHeaders.indexOf('url source') : sheetHeaders.indexOf('source url') !== -1 ? sheetHeaders.indexOf('source url') : sheetHeaders.indexOf('source_url');

      if (rowIndex > 0) {
        // Match found, update row cells
        if (sheetHeaders.indexOf('batch_id') !== -1) {
          await updateCell(sheets, spreadsheetId, sheetName, sheetHeaders.indexOf('batch_id'), rowIndex, batchId);
        }
        if (sheetHeaders.indexOf('pipeline_status') !== -1) {
          await updateCell(sheets, spreadsheetId, sheetName, sheetHeaders.indexOf('pipeline_status'), rowIndex, 'Processing');
        }
        if (sheetHeaders.indexOf('asset_url') !== -1) {
          await updateCell(sheets, spreadsheetId, sheetName, sheetHeaders.indexOf('asset_url'), rowIndex, folderUrl);
        }
        if (sheetHeaders.indexOf('processed_at') !== -1) {
          await updateCell(sheets, spreadsheetId, sheetName, sheetHeaders.indexOf('processed_at'), rowIndex, new Date().toISOString());
        }

        // Write captions back to Campaign Tab if target columns exist (v10.16.0)
        const tiktokCaption = fullResult.tiktok_caption || '';
        const igCaption = fullResult.ig_caption || '';
        const tiktokSingleLine = tiktokCaption ? tiktokCaption.replace(/\r?\n/g, ' ').trim() : '';
        const igSingleLine = igCaption ? igCaption.replace(/\r?\n/g, ' ').trim() : '';

        const tiktokColAliases = ['tiktok_caption', 'tiktok caption', 'caption_tiktok', 'caption tiktok'];
        let tiktokColIdx = -1;
        for (const alias of tiktokColAliases) {
          const idx = sheetHeaders.indexOf(alias.toLowerCase());
          if (idx !== -1) {
            tiktokColIdx = idx;
            break;
          }
        }

        const igColAliases = ['ig_caption', 'ig caption', 'instagram_caption', 'instagram caption', 'caption_ig', 'caption ig'];
        let igColIdx = -1;
        for (const alias of igColAliases) {
          const idx = sheetHeaders.indexOf(alias.toLowerCase());
          if (idx !== -1) {
            igColIdx = idx;
            break;
          }
        }

        if (tiktokColIdx !== -1 && tiktokSingleLine) {
          await updateCell(sheets, spreadsheetId, sheetName, tiktokColIdx, rowIndex, tiktokSingleLine);
        }
        if (igColIdx !== -1 && igSingleLine) {
          await updateCell(sheets, spreadsheetId, sheetName, igColIdx, rowIndex, igSingleLine);
        }

        console.log(`[RE Analyzer Sheet Update] Successfully updated URL source row ${rowIndex} in ${sheetName}.`);
      } else {
        // Match not found, append a new row
        const newRow = sheetHeaders.map(h => {
          const cleanH = h.trim().toLowerCase();
          if (cleanH === 'batch_id') return batchId;
          if (cleanH === 'pipeline_status') return 'Processing';
          if (cleanH === 'asset_url') return folderUrl;
          if (cleanH === 'processed_at') return new Date().toISOString();
          const isUrlCol = cleanH === 'url_source' || cleanH === 'url source' || cleanH === 'source url' || cleanH === 'source_url';
          if (isUrlCol) return item.source_url;

          const tiktokColAliases = ['tiktok_caption', 'tiktok caption', 'caption_tiktok', 'caption tiktok'];
          if (tiktokColAliases.includes(cleanH)) {
            return (fullResult.tiktok_caption || '').replace(/\r?\n/g, ' ').trim();
          }

          const igColAliases = ['ig_caption', 'ig caption', 'instagram_caption', 'instagram caption', 'caption_ig', 'caption ig'];
          if (igColAliases.includes(cleanH)) {
            return (fullResult.ig_caption || '').replace(/\r?\n/g, ' ').trim();
          }

          return '';
        });
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `'${sheetName}'!A1`,
          valueInputOption: 'RAW',
          requestBody: { values: [newRow] }
        });
        console.log(`[RE Analyzer Sheet Update] URL source not found. Appended new row to ${sheetName}.`);
      }

      // 2. Format copy result rows to match Autopilot Worker formats
      const storyboardRows = (parsed.new_video_plan || []).map((s, idx) => {
        const sceneNum = s.clip_index || (idx + 1);
        const sceneId = `${batchId}_S${String(sceneNum).padStart(2, '0')}`;
        return [
          batchId,
          sceneId,
          sceneNum,
          '8s',
          s.visual_action || '',
          '',
          ''
        ];
      });

      const voiceoverRows = (parsed.new_video_plan || []).map((s, idx) => {
        const sceneNum = s.clip_index || (idx + 1);
        const sceneId = `${batchId}_S${String(sceneNum).padStart(2, '0')}`;
        return [
          batchId,
          sceneId,
          sceneNum,
          s.new_vo || ''
        ];
      });

      const promptsRows = (parsed.new_video_plan || []).map((s, idx) => {
        const sceneNum = s.clip_index || (idx + 1);
        const sceneId = `${batchId}_S${String(sceneNum).padStart(2, '0')}`;
        return [
          batchId,
          sceneId,
          sceneNum,
          s.t2v_prompt || '',
          s.t2i_prompt || '',
          s.i2v_prompt || ''
        ];
      });

      const captionsRows = [
        [
          batchId,
          parsed.tiktok_caption || '',
          parsed.ig_caption || '',
          parsed.yt_title || '',
          parsed.yt_desc || ''
        ]
      ];

      // Write results to copy tabs
      await ensureTabAndAppendRows(sheets, spreadsheetId, 'Storyboard', ['batch_id', 'scene_id', 'scene_number', 'duration', 'visual_description', 'camera_movement', 'audio_mood'], storyboardRows);
      await ensureTabAndAppendRows(sheets, spreadsheetId, 'Voiceover', ['batch_id', 'scene_id', 'scene_number', 'narration'], voiceoverRows);
      await ensureTabAndAppendRows(sheets, spreadsheetId, 'Prompt', ['batch_id', 'scene_id', 'scene_number', 't2v_prompt', 't2i_prompt', 'i2v_prompt'], promptsRows);
      await ensureTabAndAppendRows(sheets, spreadsheetId, 'Captions', ['batch_id', 'tiktok_caption', 'ig_caption', 'yt_title', 'yt_desc'], captionsRows);
      }
    } catch (sheetErr) {
      console.warn('[RE Analyzer] Sheet export skipped:', sheetErr.message);
    }

    // Campaign completion is now automatically handled after FFmpeg/Social stages via DB triggers.

    return { processed: true, item_id: item.id, re_id: reId, campaign_id: campaign.id };
  } catch (error) {
    updateReCampaignItem(item.id, { analyze_status: 'failed' });
    const { logSystemError } = await import('./error-logger');
    logSystemError('RE Analyzer', error, item.campaign_id);
    throw error;
  }
}


// ========================
// 8. G LABS CAMPAIGN PROCESSOR (Cost: 0) — V5
// 3-Phase Polling Loop across all active glabs_campaigns
// ========================
export async function processGLabsCampaign(payload, job) {
  const { generateVideo, getTaskStatus, getFileUrl } = await import('./webhook-client');
  const { listGlabsCampaigns, updateGlabsCampaign } = await import('./db');
  const { uploadVideoToFolder } = await import('./drive-uploader');
  const path = await import('path');
  const fs = await import('fs');

  const campaigns = listGlabsCampaigns().filter(c => c.status === 'active');
  if (campaigns.length === 0) return { skip: true, reason: 'No active G Labs campaigns' };

  const auth = getAuthorizedClient();
  const sheets = google.sheets({ version: 'v4', auth });

  let totalProcessed = 0;

  for (const campaign of campaigns) {
    const spreadsheetId = campaign.source_spreadsheet_id;

    // Read source sheet
    let rows;
    try {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'A:Z' });
      rows = res.data.values || [];
    } catch (err) {
      console.error(`[GLabs Campaign] Cannot read sheet ${spreadsheetId}:`, err.message);
      continue;
    }
    if (rows.length <= 1) continue;

    const headers = rows[0];
    // Support both 'prompt' and 't2v_prompt' column names
    const promptIdx = headers.indexOf('prompt') !== -1 ? headers.indexOf('prompt') : headers.indexOf('t2v_prompt');
    const statusIdx = headers.indexOf('status');
    const taskIdIdx = headers.indexOf('video_task_id');
    const videoUrlIdx = headers.indexOf('video_url');

    if (promptIdx === -1 || statusIdx === -1) {
      console.error(`[GLabs Campaign] Missing required columns (status/prompt) in sheet ${spreadsheetId}`);
      continue;
    }

    const colLetter = (i) => String.fromCharCode(65 + i);
    const updateCell = async (rowNum, colIdx, value) => {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${colLetter(colIdx)}${rowNum}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[value]] },
      });
    };

    // === PHASE 1: Status Polling ===
    for (let i = 1; i < rows.length; i++) {
      const rowStatus = (rows[i][statusIdx] || '').toLowerCase().trim();
      const taskId = taskIdIdx !== -1 ? (rows[i][taskIdIdx] || '') : '';
      if (rowStatus !== 'processing' || !taskId) continue;

      try {
        const taskResult = await getTaskStatus(taskId);
        const taskStatus = (taskResult?.status || '').toLowerCase();

        if (taskStatus === 'completed') {
          let driveUrl = '';
          try {
            const files = taskResult.results || taskResult.files || [];
            let videoFile = files.find(f => f.endsWith('.mp4')) || files[0];
            if (videoFile && (videoFile.startsWith('http://') || videoFile.startsWith('https://'))) {
              videoFile = videoFile.split('/').pop();
            }
            if (videoFile) {
              const storageProvider = getSetting('storage_provider') || 'gdrive';
              const fileUrl = getFileUrl(videoFile, taskId);
              const response = await fetch(fileUrl);

              if (response.ok) {
                const buffer = Buffer.from(await response.arrayBuffer());
                const filename = videoFile.split('/').pop() || `${taskId}.mp4`;

                if (storageProvider === 'nextcloud') {
                  const { uploadBufferToNextcloud } = await import('./nextcloud-helper');
                  const targetFolder = campaign?.nextcloud_parent_folder ? `/${campaign.nextcloud_parent_folder.replace(/^\/+/, '')}` : (getSetting('nextcloud_target_folder') || '/MAKNA_Video_Generations');
                  const safeCampaignName = campaign.campaign_name.replace(/[^a-zA-Z0-9_]/g, '_');
                  const targetPath = `${targetFolder}/GLabs_Campaign_${safeCampaignName}/${filename}`.replace(/\/+/g, '/');
                  const uploaded = await uploadBufferToNextcloud(buffer, targetPath);
                  driveUrl = uploaded.fileUrl;
                } else if (campaign.target_drive_folder_id) {
                  const tmpPath = path.join(process.cwd(), 'data', `tmp_${taskId}.mp4`);
                  fs.writeFileSync(tmpPath, buffer);
                  const uploaded = await uploadVideoToFolder(tmpPath, filename, campaign.target_drive_folder_id);
                  driveUrl = uploaded.driveUrl;
                  fs.unlinkSync(tmpPath);
                }
              }
            }
          } catch (dlErr) {
            console.error('[GLabs Campaign] Video upload error:', dlErr.message);
          }
          await updateCell(i + 1, statusIdx, 'done');
          if (videoUrlIdx !== -1 && driveUrl) await updateCell(i + 1, videoUrlIdx, driveUrl);
          totalProcessed++;
        } else if (taskStatus === 'failed') {
          await updateCell(i + 1, statusIdx, 'failed');
          totalProcessed++;
        }
      } catch (pollErr) {
        console.error(`[GLabs Campaign] Polling error for task ${taskId}:`, pollErr.message);
      }
    }

    // Re-read rows after Phase 1 updates
    try {
      const res2 = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'A:Z' });
      rows = res2.data.values || [];
    } catch { }

    // === PHASE 2: Sequential Guard ===
    const processingCount = rows.slice(1).filter(r => (r[statusIdx] || '').toLowerCase().trim() === 'processing').length;
    if (processingCount > 0) {
      console.log(`[GLabs Campaign] ${processingCount} video(s) still processing — skipping submission`);
      continue;
    }

    // === PHASE 3: Batch Submission ===
    const pendingRows = [];
    for (let i = 1; i < rows.length; i++) {
      if ((rows[i][statusIdx] || '').toLowerCase().trim() === 'pending') {
        pendingRows.push({ rowNum: i + 1, row: rows[i] });
      }
    }
    if (pendingRows.length === 0) continue;

    for (let pi = 0; pi < pendingRows.length; pi++) {
      const { rowNum, row } = pendingRows[pi];
      const prompt = row[promptIdx] || '';
      if (!prompt) continue;

      try {
        await updateCell(rowNum, statusIdx, 'submitting');
        const videoResult = await generateVideo({ prompt });
        await updateCell(rowNum, statusIdx, 'processing');
        if (taskIdIdx !== -1 && videoResult?.task_id) {
          await updateCell(rowNum, taskIdIdx, videoResult.task_id);
        }
        totalProcessed++;
      } catch (submitErr) {
        console.error('[GLabs Campaign] Submit error:', submitErr.message);
        await updateCell(rowNum, statusIdx, 'error');
      }

      // Micro-pacing: 30s delay between scene submissions (skip after last)
      if (pi < pendingRows.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 30_000));
      }
    }

    updateGlabsCampaign(campaign.id, { current_batch: campaign.current_batch + 1 });
  }

  return { processed: true, campaigns_processed: campaigns.length, actions: totalProcessed };
}


// ========================
// 5. G LABS WEBHOOK PROCESSOR (Cost: 0)
// Sends prompts to GLabs for video generation
// ========================
export async function processGLabs(payload, job) {
  // Reuse existing glabs-queue logic
  const { generateVideo, getFileUrl } = await import('./webhook-client');

  const auth = getAuthorizedClient();
  const sheets = google.sheets({ version: 'v4', auth });

  const spreadsheetId = getSetting('master_re_sheet_id');
  if (!spreadsheetId) return { skip: true, reason: 'No Master RE Sheet configured' };

  // Read Prompts tab for pending video generation
  let promptRows;
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'Prompts'!A:N" });
    promptRows = res.data.values || [];
  } catch {
    return { skip: true, reason: 'Cannot read Prompts tab' };
  }

  if (promptRows.length <= 1) return { skip: true, reason: 'No data in Prompts tab' };

  const headers = promptRows[0];
  const videoStatusIdx = headers.indexOf('video_status');
  const promptIdx = headers.indexOf('t2v_prompt');
  const imageUrlIdx = headers.indexOf('image_url');
  const imageStatusIdx = headers.indexOf('image_status');

  if (videoStatusIdx === -1 || promptIdx === -1) {
    return { skip: true, reason: 'Missing required columns in Prompts tab' };
  }

  // Find first row with video_status = "pending" and image_status = "done" (if applicable)
  let targetRow = null;
  let targetRowNum = -1;
  for (let i = 1; i < promptRows.length; i++) {
    const vidStatus = (promptRows[i][videoStatusIdx] || '').toLowerCase().trim();
    if (vidStatus === 'pending') {
      targetRow = promptRows[i];
      targetRowNum = i + 1;
      break;
    }
  }

  if (!targetRow) return { skip: true, reason: 'No pending videos to generate' };

  const prompt = targetRow[promptIdx] || '';
  if (!prompt) return { skip: true, reason: 'Empty prompt' };

  // Mark as "generating"
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'Prompts'!${String.fromCharCode(65 + videoStatusIdx)}${targetRowNum}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['generating']] },
  });

  try {
    const webhookPort = getSetting('webhook_port') || '8765';
    const webhookApiKey = getSetting('webhook_api_key') || '';
    const videoModel = getSetting('webhook_video_model') || 'veo_31_lite_relaxed';

    const videoResult = await generateVideo({
      prompt,
      model: videoModel,
      port: webhookPort,
      apiKey: webhookApiKey,
    });

    // Update sheet with result
    const taskIdIdx = headers.indexOf('video_task_id');
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'Prompts'!${String.fromCharCode(65 + videoStatusIdx)}${targetRowNum}`,
      valueInputOption: 'RAW',
      requestBody: { values: [['submitted']] },
    });
    if (taskIdIdx !== -1 && videoResult?.task_id) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'Prompts'!${String.fromCharCode(65 + taskIdIdx)}${targetRowNum}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[videoResult.task_id]] },
      });
    }

    return { processed: true, task_id: videoResult?.task_id };
  } catch (error) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'Prompts'!${String.fromCharCode(65 + videoStatusIdx)}${targetRowNum}`,
      valueInputOption: 'RAW',
      requestBody: { values: [['error']] },
    });
    throw error;
  }
}

/**
 * Otomatis menyelesaikan input produk dari berbagai sumber menjadi satu format seragam.
 * @param {Object} campaignRow - Data baris kampanye dari SQLite (re_campaigns)
 * @returns {Promise<Object>} DNA Produk { product_name, product_description, unique_selling_point }
 */
export async function resolveProductData(campaignRow) {
  if (Number(campaignRow.is_bridging_active) !== 1) {
    return {
      product_name: '',
      product_description: '',
      unique_selling_point: ''
    };
  }
  const { bridging_mode, target_product_id, ephemeral_product_data } = campaignRow;
  const { getDb } = await import('./db');

  // MODE A: Memilih dari pustaka produk terdaftar
  if (bridging_mode === 'select_existing') {
    const db = getDb();
    const product = await db.prepare('SELECT * FROM product_extractions WHERE id = ?').get(target_product_id);
    if (!product) {
      throw new Error(`Produk dengan ID ${target_product_id} tidak ditemukan di database.`);
    }
    return {
      product_name: product.product_name || '',
      product_description: product.product_description || '',
      unique_selling_point: product.unique_selling_point || '',
      key_visuals_extracted: product.key_visuals_extracted || '',
      packaging_type: product.packaging_type || '',
      is_in_packaging: product.is_in_packaging || 0,
      clean_photo_t2i_prompt: product.clean_photo_t2i_prompt || '',
      photo_url: product.photo_url || '',
      clean_photo_url: product.clean_photo_url || '',
      cleaned_photo_url: product.cleaned_photo_url || '',
      generated_photo_url: product.generated_photo_url || '',
      active_photo: product.active_photo || 'photo_url',
      // [Fix v2.2.92] Sertakan filename & truth contract untuk buildProductTruthContractSection
      product_filename_declare: (product.clean_photo_url ? require('path').basename(product.clean_photo_url) : '') || '',
      product_truth: product.product_truth || product.clean_photo_t2i_prompt || '',
      geometric_truth: product.geometric_truth || '',
    };
  }

  // MODE B: Input detail manual instan
  if (bridging_mode === 'manual_input') {
    const manualData = JSON.parse(ephemeral_product_data);
    return {
      product_name: manualData.product_name || '',
      product_description: manualData.product_description || '',
      unique_selling_point: manualData.unique_selling_point || manualData.usp || ''
    };
  }

  // MODE C: Tempel URL -> Scraping & Ekstraksi AI Otomatis (Stage 1 Terintegrasi)
  if (bridging_mode === 'url_extract') {
    const targetUrl = ephemeral_product_data;
    const db = getDb();

    // JIKA USER MEMASUKKAN URL PRODUCT, CARI DULU KE DATABASE PRODUCT
    const existingProduct = await db.prepare('SELECT * FROM product_extractions WHERE input_source = ?').get(targetUrl);
    if (existingProduct) {
      console.log(`[resolveProductData] Found existing product data in database for URL: ${targetUrl}`);
      
      const isRe = await db.prepare('SELECT 1 FROM re_campaigns WHERE id = ?').get(campaignRow.id);
      const isBridge = await db.prepare('SELECT 1 FROM bridge_injector_campaigns WHERE id = ?').get(campaignRow.id);

      if (isRe) {
        await db.prepare("UPDATE re_campaigns SET bridging_mode = 'select_existing', target_product_id = ? WHERE id = ?")
          .run(existingProduct.id, campaignRow.id);
      } else if (isBridge) {
        await db.prepare("UPDATE bridge_injector_campaigns SET bridging_mode = 'select_existing', target_product_id = ? WHERE id = ?")
          .run(existingProduct.id, campaignRow.id);
      } else {
        await db.prepare("UPDATE pillar_campaigns SET bridging_mode = 'select_existing', target_product_id = ? WHERE id = ?")
          .run(existingProduct.id, campaignRow.id);
      }

      return {
        product_name: existingProduct.product_name || '',
        product_description: existingProduct.product_description || '',
        unique_selling_point: existingProduct.unique_selling_point || '',
        key_visuals_extracted: existingProduct.key_visuals_extracted || '',
        packaging_type: existingProduct.packaging_type || '',
        is_in_packaging: existingProduct.is_in_packaging || 0,
        clean_photo_t2i_prompt: existingProduct.clean_photo_t2i_prompt || '',
        photo_url: existingProduct.photo_url || '',
        clean_photo_url: existingProduct.clean_photo_url || '',
        cleaned_photo_url: existingProduct.cleaned_photo_url || '',
        generated_photo_url: existingProduct.generated_photo_url || '',
        active_photo: existingProduct.active_photo || 'photo_url',
        // [Fix v2.2.92] Sertakan filename & truth contract untuk buildProductTruthContractSection
        product_filename_declare: (existingProduct.clean_photo_url ? require('path').basename(existingProduct.clean_photo_url) : '') || '',
        product_truth: existingProduct.product_truth || existingProduct.clean_photo_t2i_prompt || '',
        geometric_truth: existingProduct.geometric_truth || '',
      };
    }

    const { scrapeUrl } = await import('./url-scraper');
    const { buildProductAgentPrompt } = await import('./prompts');
    const { getGeminiModel } = await import('./gemini');
    const { parseGeminiJSON } = await import('./json-parser');

    // 1. Scraping isi HTML web produk
    const scraped = await scrapeUrl(targetUrl);
    const sourceContent = scraped.fullText;

    // 2. Minta Gemini mengekstrak teks menjadi DNA Produk komersial
    const prompt = buildProductAgentPrompt(sourceContent, true);
    const model = await getGeminiModel();
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsed = parseGeminiJSON(responseText);
    const productData = parsed.product_data || parsed;

    // 3. Simpan permanen ke pustaka agar terekam dalam audit trail & dapat digunakan kembali
    const newProductId = `pe_${Date.now()}`;
    await db.prepare(`
      INSERT INTO product_extractions (id, input_source, is_url, product_name, product_description, unique_selling_point, raw_response)
      VALUES (?, ?, 1, ?, ?, ?, ?)
    `).run(
      newProductId,
      targetUrl,
      productData.product_name || '',
      productData.product_description || '',
      typeof productData.unique_selling_point === 'string'
        ? productData.unique_selling_point
        : JSON.stringify(productData.unique_selling_point || ''),
      responseText
    );

    // 4. Perbarui data kampanye agar merujuk ke ID produk baru yang sudah tersimpan
    const scrapedImageUrl = productData.scraped_image_url || '';
    let localImagePath = null;
    let safeFilename = null;

    if (campaignRow.visual_mode === 'hybrid_lock' && scrapedImageUrl) {
      const path = await import('path');
      const fs = await import('fs');
      const { downloadECommerceImage } = await import('./url-scraper');

      safeFilename = `product_ref_${campaignRow.id}_${Date.now()}.png`;
      localImagePath = `/uploads/products/${safeFilename}`;
      const absoluteLocalPath = path.join(process.cwd(), 'public', 'uploads', 'products', safeFilename);

      const uploadsDir = path.dirname(absoluteLocalPath);
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      try {
        console.log(`[resolveProductData] Downloading product image from ${scrapedImageUrl} to ${absoluteLocalPath}`);
        await downloadECommerceImage(scrapedImageUrl, absoluteLocalPath);
      } catch (error) {
        console.error(`[resolveProductData] Failed to download product image:`, error);
        localImagePath = null;
        safeFilename = null;
      }
    }

    const isRe = await db.prepare('SELECT 1 FROM re_campaigns WHERE id = ?').get(campaignRow.id);
    const isBridge = await db.prepare('SELECT 1 FROM bridge_injector_campaigns WHERE id = ?').get(campaignRow.id);
    if (isRe) {
      if (localImagePath && safeFilename) {
        await db.prepare("UPDATE re_campaigns SET bridging_mode = 'select_existing', target_product_id = ?, product_ref_image_path = ?, product_filename_declare = ? WHERE id = ?")
          .run(newProductId, localImagePath, safeFilename, campaignRow.id);
      } else {
        await db.prepare("UPDATE re_campaigns SET bridging_mode = 'select_existing', target_product_id = ? WHERE id = ?")
          .run(newProductId, campaignRow.id);
      }
    } else if (isBridge) {
      await db.prepare("UPDATE bridge_injector_campaigns SET bridging_mode = 'select_existing', target_product_id = ? WHERE id = ?")
        .run(newProductId, campaignRow.id);
    } else {
      if (localImagePath && safeFilename) {
        await db.prepare("UPDATE pillar_campaigns SET bridging_mode = 'select_existing', target_product_id = ?, product_ref_image_path = ?, product_filename_declare = ? WHERE id = ?")
          .run(newProductId, localImagePath, safeFilename, campaignRow.id);
      } else {
        await db.prepare("UPDATE pillar_campaigns SET bridging_mode = 'select_existing', target_product_id = ? WHERE id = ?")
          .run(newProductId, campaignRow.id);
      }
    }

    return {
      product_name: productData.product_name || '',
      product_description: productData.product_description || '',
      unique_selling_point: productData.unique_selling_point || '',
      key_visuals_extracted: productData.key_visuals_extracted || '',
      packaging_type: productData.packaging_type || '',
      is_in_packaging: productData.is_in_packaging || 0,
      clean_photo_t2i_prompt: productData.clean_photo_t2i_prompt || '',
      photo_url: localImagePath || '',
      clean_photo_url: localImagePath || '',
      cleaned_photo_url: localImagePath || '',
      generated_photo_url: localImagePath || '',
      active_photo: 'photo_url',
      // [Fix v2.2.92] Sertakan filename untuk buildProductTruthContractSection
      product_filename_declare: safeFilename || '',
      product_truth: productData.product_truth || productData.clean_photo_t2i_prompt || '',
      geometric_truth: productData.geometric_truth || '',
    };
  }

  throw new Error("Metode bridging tidak dikenal atau tidak didukung.");
}


// ========================
// 8. RE CAMPAIGN TTS PROCESSOR (Cost: 0) — V6.5
// Synthesizes narration segment text to audio files
// ========================
export async function processReTts(payload, job) {
  const { getNextPendingReTtsItem, updateReCampaignItem, getReCampaign, createTtsBatch, createTtsClip, updateTtsClip, getDb, getSetting } = await import('./db');
  const db = getDb();
  const { generateMinimaxVO } = await import('./minimax-tts');
  const { callGeminiTtsApi } = await import('./gemini');
  const { convertPcmToWav } = await import('./audio-helper');
  const path = await import('path');
  const fs = await import('fs');

  const itemId = payload?.item_id;
  let item;
  if (itemId) {
    item = await db.prepare('SELECT * FROM re_campaign_items WHERE id = ?').get(itemId);
  } else {
    item = getNextPendingReTtsItem();
  }
  if (!item) return { skip: true, reason: itemId ? `Item ${itemId} not found` : 'No pending RE campaign items for TTS' };

  const campaign = await getReCampaign(item.campaign_id);
  if (!campaign) return { skip: true, reason: `Campaign ${item.campaign_id} not found` };

  if (campaign.enable_tts === 0) {
    updateReCampaignItem(item.id, { tts_status: 'skipped', tts_batch_id: 'skipped' });
    return { processed: true, item_id: item.id, message: 'Skipped TTS stage' };
  }

  updateReCampaignItem(item.id, { tts_status: 'processing' });

  try {
    const parsed = JSON.parse(item.result_json || '{}');
    const voiceover = parsed.voiceover || [];

    if (voiceover.length === 0) {
      updateReCampaignItem(item.id, { tts_status: 'completed', tts_batch_id: 'no_audio' });
      return { processed: true, item_id: item.id, message: 'Skipped TTS due to empty voiceover' };
    }

    const batchId = `ttsb_re_${item.id}_${Date.now()}`;
    const provider = campaign.voice_provider || 'gemini';
    const persona = campaign.voice_persona || 'Kore';
    const speed = campaign.voice_speed !== undefined ? Number(campaign.voice_speed) : 1.0;
    const volume = campaign.voice_volume !== undefined ? Number(campaign.voice_volume) : 1.0;

    createTtsBatch({
      id: batchId,
      source_type: 're_campaign',
      source_ref_id: item.id.toString(),
      provider_active: provider,
      voice_persona: persona,
      config_speed: speed,
      config_volume: volume
    });

    const tempDir = path.join(process.cwd(), 'public', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    let batchSuccess = false;
    if (provider !== 'minimax' && voiceover.length > 1 && campaign.enable_audio_segment !== 1) {
      try {
        const { generateGeminiBatchTTS } = await import('./gemini-tts-batch');
        const texts = voiceover.map(v => v.narration || '');
        const outputPaths = voiceover.map((_, i) => path.join(tempDir, `tts_studio_${batchId}_clip_${i}.wav`));

        const clipIds = [];
        for (let i = 0; i < voiceover.length; i++) {
          const clipId = `ttsc_re_${Date.now()}_${i}`;
          clipIds.push(clipId);
          createTtsClip({
            id: clipId,
            batch_id: batchId,
            clip_index: i,
            source_text: texts[i],
            audio_path: `/temp/tts_studio_${batchId}_clip_${i}.wav`,
            status: 'processing'
          });
        }

        await generateGeminiBatchTTS(texts, persona, outputPaths);

        for (const clipId of clipIds) {
          updateTtsClip(clipId, { status: 'completed' });
        }
        batchSuccess = true;
        console.log(`[RE TTS] Batch generation success for batch ${batchId}. Saved ${texts.length - 1} API requests.`);
      } catch (batchErr) {
        console.warn(`[RE TTS] Batch generation failed: ${batchErr.message}. Falling back to individual requests...`);
        await db.prepare('DELETE FROM tts_studio_clips WHERE batch_id = ?').run(batchId);
      }
    }

    if (!batchSuccess) {
      let voiceCast = null;
      if (campaign.voice_cast_json) {
        try {
          const parsed = typeof campaign.voice_cast_json === 'string'
            ? JSON.parse(campaign.voice_cast_json)
            : campaign.voice_cast_json;
          voiceCast = parsed?.characters?.length > 0 ? parsed : null;
        } catch (e) {
          console.warn(`[RE TTS] Failed to parse voice_cast_json: ${e.message}`);
        }
      }

      const { execSync } = await import('child_process');
      const concatAudioSegments = async (segmentPaths, outputPath) => {
        if (segmentPaths.length === 1) {
          fs.copyFileSync(segmentPaths[0], outputPath);
          return;
        }
        const filterStr = segmentPaths.map((_, idx) => `[${idx}:a]`).join('') + `concat=n=${segmentPaths.length}:v=0:a=1[a]`;
        let cmd = `ffmpeg -y `;
        segmentPaths.forEach(p => { cmd += `-i "${p}" `; });
        cmd += `-filter_complex "${filterStr}" -map "[a]" "${outputPath}"`;
        execSync(cmd);
      };

      for (let i = 0; i < voiceover.length; i++) {
        const clipId = `ttsc_re_${Date.now()}_${i}`;
        const clip = voiceover[i];
        const text = clip.narration || '';
        const ext = provider === 'minimax' ? 'mp3' : 'wav';
        const outputFileName = `tts_studio_${batchId}_clip_${i}.${ext}`;
        const localPath = path.join(tempDir, outputFileName);
        const publicPath = `/temp/${outputFileName}`;

        createTtsClip({
          id: clipId,
          batch_id: batchId,
          clip_index: i,
          source_text: text,
          audio_path: publicPath,
          status: 'processing'
        });

        try {
          if (clip.voice_segments && clip.voice_segments.length > 1 && voiceCast) {
            console.log(`[RE TTS] [Multi-Voice] Klip ${i + 1}: rendering ${clip.voice_segments.length} segmen dialog...`);
            const segmentPaths = [];
            for (let s = 0; s < clip.voice_segments.length; s++) {
              const seg = clip.voice_segments[s];
              const charEntry = voiceCast.characters.find(ch => ch.id === seg.character_id);
              const segVoiceId = (provider === 'minimax' ? charEntry?.minimax_voice_id : charEntry?.gemini_voice_id) || persona;
              const segExt = provider === 'minimax' ? 'mp3' : 'wav';
              const segPath = path.join(tempDir, `seg_re_${batchId}_c${i}_${s}_${seg.character_id || s}.${segExt}`);

              console.log(`  → Segmen ${s + 1}: character="${seg.character_id}" voice="${segVoiceId}" text="${(seg.text || '').slice(0, 40)}..."`);
              if (provider === 'minimax') {
                await generateMinimaxVO(seg.text || '', segVoiceId, segPath, {
                  speed,
                  volume,
                  model: campaign.tts_model_quality,
                  language: campaign.target_language || 'id-ID'
                });
              } else {
                const { convertPcmToWav } = await import('./audio-helper');
                const rawPcm = await callGeminiTtsApi(seg.text || '', segVoiceId, { speed, volume });
                const wavBuffer = convertPcmToWav(rawPcm, 24000);
                fs.writeFileSync(segPath, wavBuffer);
              }
              segmentPaths.push(segPath);
            }
            console.log(`  → Menggabungkan ${segmentPaths.length} segmen dialog menjadi 1 audio klip...`);
            await concatAudioSegments(segmentPaths, localPath);
            console.log(`  ✓ Klip ${i + 1} multi-voice selesai.`);
          } else {
            if (provider === 'minimax') {
              await generateMinimaxVO(text, persona, localPath, { speed, volume, model: campaign.tts_model_quality, language: campaign.target_language });
            } else {
              const { generateGeminiExact8sAudio } = await import('./gemini-8s-tts');
              await generateGeminiExact8sAudio(text, persona, localPath);
            }
          }
          updateTtsClip(clipId, { status: 'completed' });

          // Pacing delay to avoid hitting Gemini TTS 3 RPM rate limits (except for minimax or last clip)
          if (provider !== 'minimax' && i < voiceover.length - 1) {
            console.log(`[RE TTS] Pacing delay: waiting 8s before processing next clip...`);
            await new Promise(resolve => setTimeout(resolve, 8000));
          }
        } catch (clipErr) {
          console.error(`[RE TTS] Failed to render clip #${i} in batch ${batchId}:`, clipErr.message);
          updateTtsClip(clipId, { status: 'failed' });
          throw clipErr;
        }
      }
    }

    updateReCampaignItem(item.id, {
      tts_status: 'completed',
      tts_batch_id: batchId
    });

    return { processed: true, item_id: item.id, tts_batch_id: batchId };
  } catch (error) {
    updateReCampaignItem(item.id, { tts_status: 'failed' });
    const { logSystemError } = await import('./error-logger');
    logSystemError('RE TTS', error, item.campaign_id);
    throw error;
  }
}


// ========================
// 9. RE CAMPAIGN GLABS PROCESSOR (Cost: 0) — V6.5
// Triggers scene video rendering on GLabs (Veo) and polls status
// ========================
export async function processReGlabs(payload, job) {
  const { getNextPendingReGlabsItem, updateReCampaignItem, getSetting, setSetting, getDb, insertGlabsTask, updateGlabsTaskStatus } = await import('./db');
  const { generateVideo, generateImage, getTaskStatus, getFileUrl } = await import('./webhook-client');
  const path = await import('path');
  const fs = await import('fs');

  const db = getDb();
  const productData = null;

  if (payload?.target_type === 'angle_variant') {
    const variantId = payload.variant_id;
    const variant = await db.prepare('SELECT * FROM re_item_angle_variants WHERE id = ?').get(variantId);
    if (!variant) {
      throw new Error(`Angle variant ${variantId} not found`);
    }

    const parentItem = await db.prepare('SELECT * FROM re_campaign_items WHERE id = ?').get(variant.re_item_id);
    const campaign = await db.prepare('SELECT * FROM re_campaigns WHERE id = ?').get(parentItem.campaign_id);
    const brandProfile = await db.prepare('SELECT * FROM brand_profiles WHERE LOWER(brand_name) = LOWER(?)').get(campaign.account_name || '');

    const enableTts = payload.enable_tts !== false && campaign.enable_tts !== 0;
    const enableFfmpeg = payload.enable_ffmpeg !== false;

    console.log(`[RE+AM Render] Starting rendering for angle variant ${variant.angle_name} (ID: ${variant.id})`);

    // 1. TTS Generation Stage
    let ttsBatchId = variant.tts_batch_id || null;
    if (enableTts && variant.tts_status !== 'completed') {
      await db.prepare("UPDATE re_item_angle_variants SET tts_status = 'processing' WHERE id = ?").run(variantId);
      try {
        const clips = JSON.parse(variant.visual_tasks_json || '[]');
        ttsBatchId = `ttsb_reav_${variant.id}_${Date.now()}`;
        const provider = campaign.voice_provider || 'gemini';
        let persona = variant.voice_persona_assigned || campaign.voice_persona || 'Kore';
        if (persona === 'none') {
          persona = campaign.voice_persona || 'Kore';
        }
        const speed = campaign.voice_speed !== undefined ? Number(campaign.voice_speed) : 1.0;
        const volume = campaign.voice_volume !== undefined ? Number(campaign.voice_volume) : 1.0;

        const { createTtsBatch, createTtsClip, updateTtsClip } = await import('./db');
        const { generateMinimaxVO } = await import('./minimax-tts');
        const { generateGeminiExact8sAudio } = await import('./gemini-8s-tts');

        createTtsBatch({
          id: ttsBatchId,
          source_type: 're_angle_variant',
          source_ref_id: variant.id,
          provider_active: provider,
          voice_persona: persona,
          config_speed: speed,
          config_volume: volume
        });

        const tempDir = path.join(process.cwd(), 'public', 'temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        let batchSuccess = false;
        if (provider !== 'minimax' && clips.length > 1) {
          try {
            const { generateGeminiBatchTTS } = await import('./gemini-tts-batch');
            const texts = clips.map(c => c.voiceover || '');
            const outputPaths = clips.map((_, i) => path.join(tempDir, `tts_reav_${variant.id}_clip_${i}.wav`));

            const clipIds = [];
            for (let i = 0; i < clips.length; i++) {
              const clipId = `ttsc_reav_${variant.id}_${Date.now()}_${i}`;
              clipIds.push(clipId);
              createTtsClip({
                id: clipId,
                batch_id: ttsBatchId,
                clip_index: i,
                source_text: texts[i],
                audio_path: `/temp/tts_reav_${variant.id}_clip_${i}.wav`,
                status: 'processing'
              });
            }

            await generateGeminiBatchTTS(texts, persona, outputPaths);

            for (const clipId of clipIds) {
              updateTtsClip(clipId, { status: 'completed' });
            }
            batchSuccess = true;
            console.log(`[RE G-Labs Angle Variant TTS] Batch generation success for batch ${ttsBatchId}. Saved ${texts.length - 1} API requests.`);
          } catch (batchErr) {
            console.warn(`[RE G-Labs Angle Variant TTS] Batch generation failed: ${batchErr.message}. Falling back to individual requests...`);
            await db.prepare('DELETE FROM tts_studio_clips WHERE batch_id = ?').run(ttsBatchId);
          }
        }

        if (!batchSuccess) {
          for (let i = 0; i < clips.length; i++) {
            const clipId = `ttsc_reav_${variant.id}_${Date.now()}_${i}`;
            const text = clips[i].voiceover || '';
            const ext = provider === 'minimax' ? 'mp3' : 'wav';
            const outputFileName = `tts_reav_${variant.id}_clip_${i}.${ext}`;
            const localPath = path.join(tempDir, outputFileName);
            const publicPath = `/temp/${outputFileName}`;

            createTtsClip({
              id: clipId,
              batch_id: ttsBatchId,
              clip_index: i,
              source_text: text,
              audio_path: publicPath,
              status: 'processing'
            });

            try {
              if (provider === 'minimax') {
                await generateMinimaxVO(text, persona, localPath, { speed, volume, model: campaign.tts_model_quality, language: campaign.target_language });
              } else {
                await generateGeminiExact8sAudio(text, persona, localPath);
              }
              updateTtsClip(clipId, { status: 'completed' });

              if (provider !== 'minimax' && i < clips.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 8000));
              }
            } catch (err) {
              updateTtsClip(clipId, { status: 'failed' });
              throw err;
            }
          }
        }

        await db.prepare("UPDATE re_item_angle_variants SET tts_status = 'completed', tts_batch_id = ? WHERE id = ?").run(ttsBatchId, variantId);
      } catch (ttsErr) {
        await db.prepare("UPDATE re_item_angle_variants SET tts_status = 'failed' WHERE id = ?").run(variantId);
        const { logSystemError } = await import('./error-logger');
        logSystemError('RE G-Labs Angle Variant TTS', ttsErr, campaign.id);
        throw ttsErr;
      }
    } else if (!enableTts) {
      await db.prepare("UPDATE re_item_angle_variants SET tts_status = 'skipped' WHERE id = ?").run(variantId);
    }

    // 2. G-Labs Video Task Submission Stage
    let glabsTaskIds = [];
    const existingTaskIds = [];
    try {
      if (variant.glabs_task_ids) {
        const parsed = JSON.parse(variant.glabs_task_ids);
        if (Array.isArray(parsed)) {
          existingTaskIds.push(...parsed);
        }
      }
    } catch (e) {
      console.warn(`[RE+AM Render] Failed to parse existing glabs_task_ids:`, e.message);
    }

    await db.prepare("UPDATE re_item_angle_variants SET visual_status = 'processing' WHERE id = ?").run(variantId);
    try {
      const clips = JSON.parse(variant.visual_tasks_json || '[]');
      const videoModel = campaign.video_model || getSetting('webhook_video_model') || 'veo_31_lite';
      const imageModel = getSetting('webhook_image_model') || 'nano_banana_pro';
      const bridgeAtClip = campaign.bridge_at_clip || 3;
      const bridgeDurationClips = campaign.bridge_duration_clips || 0;
      const visualMode = campaign.visual_mode || 'pure_t2v';

      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i];
        const cNum = i + 1;
        const isHybridLockClip = (visualMode === 'hybrid_lock');
        const promptText = isHybridLockClip ? (clip.i2v_prompt || '') : (clip.t2v_prompt || '');

        // Check if we can reuse an existing completed task
        const existingTaskId = existingTaskIds[i];
        let reuseCompletedTask = false;
        if (existingTaskId) {
          let existingTask = await db.prepare('SELECT * FROM glabs_tasks WHERE task_id = ?').get(existingTaskId);
          if (existingTask) {
            // If task is still marked as processing, query G-Labs for its final status
            if (existingTask.status === 'processing') {
              try {
                console.log(`[RE+AM Render] Checking final status of processing task ${existingTaskId} on G-Labs...`);
                const taskResult = await getTaskStatus(existingTaskId);
                const taskStatus = (taskResult?.status || '').toLowerCase();
                if (taskStatus === 'completed') {
                  const files = taskResult.results || taskResult.files || [];
                  let videoFile = files.find(f => f.endsWith('.mp4')) || files[0];
                  if (videoFile && (videoFile.startsWith('http://') || videoFile.startsWith('https://'))) {
                    videoFile = videoFile.split('/').pop();
                  }
                  if (videoFile) {
                    const completedUrl = getFileUrl(videoFile, existingTaskId);
                    updateGlabsTaskStatus(existingTaskId, 'completed', completedUrl);
                    existingTask = await db.prepare('SELECT * FROM glabs_tasks WHERE task_id = ?').get(existingTaskId);
                  }
                } else if (taskStatus === 'failed') {
                  updateGlabsTaskStatus(existingTaskId, 'failed');
                  existingTask = await db.prepare('SELECT * FROM glabs_tasks WHERE task_id = ?').get(existingTaskId);
                }
              } catch (err) {
                console.warn(`[RE+AM Render] Failed to poll final status for task ${existingTaskId}:`, err.message);
              }
            }

            if (existingTask.status === 'completed' && existingTask.video_url && existingTask.prompt === promptText) {
              console.log(`[RE+AM Render] Clip #${i + 1} already completed in task ${existingTaskId}. Reusing video: ${existingTask.video_url}`);
              glabsTaskIds.push(existingTaskId);
              reuseCompletedTask = true;
            }
          }
        }

        if (reuseCompletedTask) {
          continue;
        }

        let t2vResult = null;

        if (isHybridLockClip) {
          // Double-pass: T2I imageModel -> I2V veo_31_lite
          const t2iPromptText = clip.t2i_prompt || '';
          if (!t2iPromptText) {
            throw new Error(`T2I prompt for clip ${cNum} not found in variant clips`);
          }

          const startFrameFilename = `start_frame_variant_${variant.id}_clip_${cNum}.png`;
          const startFrameLocalPath = path.join(process.cwd(), 'public', 'uploads', 'start_frames', startFrameFilename);
          const relativeStartFramePath = `/uploads/start_frames/${startFrameFilename}`;

          let startFrameExists = fs.existsSync(startFrameLocalPath);
          if (startFrameExists) {
            console.log(`[RE+AM Render] Start frame already exists locally for variant clip ${cNum}: ${relativeStartFramePath}. Skipping T2I stage.`);
          } else {
            const productBase64 = resolveProductBase64(campaign, productData);

            console.log(`[RE+AM Render] Submitting T2I task for variant clip ${cNum}...`);
            const { generateImage } = await import('./webhook-client');
            const bridgeDuration = campaign.bridge_duration_clips !== undefined ? Number(campaign.bridge_duration_clips) : 0;
            const productEndClip = bridgeDuration > 0 ? (bridgeAtClip + bridgeDuration - 1) : bridgeAtClip;
            const isBridge = (cNum >= bridgeAtClip && cNum <= productEndClip);

            const t2iResult = await generateImage({
              prompt: t2iPromptText,
              model: imageModel,
              aspect_ratio: campaign.aspect_ratio || '9:16',
              reference_images: (isBridge && productBase64) ? [productBase64] : undefined,
              webhookOverride: brandProfile
            });

            if (!t2iResult?.task_id) {
              throw new Error(`Failed to submit T2I task for variant clip ${cNum}`);
            }

            const t2iTaskId = t2iResult.task_id;
            console.log(`[RE+AM Render] T2I task ${t2iTaskId} submitted. Polling for completion...`);

            // Poll T2I task until complete
            let t2iCompleted = false;
            let t2iImageUrl = null;
            const maxT2iAttempts = 30; // 30 * 2s = 60s max wait
            for (let attempt = 0; attempt < maxT2iAttempts; attempt++) {
              await new Promise(resolve => setTimeout(resolve, 2000));
              const t2iStatusResult = await getTaskStatus(t2iTaskId);
              const t2iStatus = (t2iStatusResult?.status || '').toLowerCase();

              if (t2iStatus === 'completed') {
                const files = t2iStatusResult.results || t2iStatusResult.files || [];
                let imageFile = files.find(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')) || files[0];
                if (imageFile && (imageFile.startsWith('http://') || imageFile.startsWith('https://'))) {
                  imageFile = imageFile.split('/').pop();
                }
                if (imageFile) {
                  t2iImageUrl = getFileUrl(imageFile, t2iTaskId);
                  t2iCompleted = true;
                  break;
                }
              } else if (t2iStatus === 'failed') {
                const rawErr = t2iStatusResult?.error || t2iStatusResult?.error_detail || t2iStatusResult?.message || '';
                throw new Error(`T2I task ${t2iTaskId} failed on GLabs: ${rawErr}`);
              }
            }

            if (!t2iCompleted || !t2iImageUrl) {
              throw new Error(`T2I task ${t2iTaskId} timed out or failed to return image URL`);
            }

            // Download start frame
            console.log(`[RE+AM Render] Downloading start frame from ${t2iImageUrl}...`);
            const imgResponse = await fetch(t2iImageUrl);
            if (!imgResponse.ok) {
              throw new Error(`Failed to download start frame from ${t2iImageUrl}`);
            }
            const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());

            fs.writeFileSync(startFrameLocalPath, imgBuffer);

            console.log(`[RE Variant Start Frame] Saved locally at ${relativeStartFramePath}`);
          }

          // Submit I2V using the generated start frame
          const fileToBase64 = (filePath) => {
            const fs = require('fs');
            const path = require('path');
            const absolutePath = (!path.isAbsolute(filePath) || !fs.existsSync(filePath)) ? path.join(process.cwd(), 'public', filePath.startsWith('/') ? filePath.slice(1) : filePath) : filePath;
            if (!fs.existsSync(absolutePath)) return null;
            const buffer = fs.readFileSync(absolutePath);

            // Detect MIME type by magic bytes
            let mimeType = 'image/png'; // default fallback
            if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
              mimeType = 'image/jpeg';
            } else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
              mimeType = 'image/png';
            } else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
              mimeType = 'image/webp';
            }

            return `data:${mimeType};base64,${buffer.toString('base64')}`;
          };
          const startFrameBase64 = fileToBase64(relativeStartFramePath);
          const i2vPromptText = clip.i2v_prompt || '';
          if (!i2vPromptText) {
            throw new Error(`I2V prompt for clip ${cNum} not found in variant clips`);
          }

          console.log(`[RE+AM Render] Submitting I2V task for variant clip ${cNum} using model: veo_31_lite...`);
          t2vResult = await generateVideo({
            prompt: i2vPromptText,
            model: 'veo_31_lite',
            aspect_ratio: campaign.aspect_ratio || '9:16',
            mode: 'start_image',
            reference_images: [startFrameBase64],
            webhookOverride: brandProfile
          });
        } else {
          // Standard T2V
          console.log(`[RE+AM Render] Submitting T2V task for Clip #${i + 1}: "${promptText.slice(0, 60)}..."`);
          t2vResult = await generateVideo({
            prompt: promptText,
            model: videoModel,
            aspect_ratio: campaign.aspect_ratio || '9:16',
            webhookOverride: brandProfile
          });
        }

        if (!t2vResult?.task_id) {
          throw new Error(`Failed to submit video task for clip ${i + 1}`);
        }

        glabsTaskIds.push(t2vResult.task_id);
        try {
          insertGlabsTask({
            task_id: t2vResult.task_id,
            campaign_id: campaign.id,
            item_id: parentItem.id,
            clip_index: i,
            prompt: promptText,
            status: 'processing'
          });
        } catch (dbErr) {
          console.warn(`[RE+AM Render] Failed to insert glabs task to DB:`, dbErr.message);
        }

        // Delay between submissions only if we actually submitted a task
        if (i < clips.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      }

      await db.prepare("UPDATE re_item_angle_variants SET glabs_task_ids = ? WHERE id = ?").run(JSON.stringify(glabsTaskIds), variantId);
    } catch (glabsSubmitErr) {
      await db.prepare("UPDATE re_item_angle_variants SET visual_status = 'failed' WHERE id = ?").run(variantId);
      throw glabsSubmitErr;
    }

    // 3. Polling G-Labs Tasks until completion
    console.log(`[RE+AM Render] Polling ${glabsTaskIds.length} video tasks...`);

    const completedUrls = [];
    let attempts = 0;
    const maxAttempts = 60; // 10 minutes max

    while (attempts < maxAttempts) {
      attempts++;
      let allDone = true;

      for (let i = 0; i < glabsTaskIds.length; i++) {
        if (completedUrls[i]) continue;

        const taskId = glabsTaskIds[i];
        try {
          // Check DB cache first
          const cachedTask = await db.prepare('SELECT status, video_url FROM glabs_tasks WHERE task_id = ?').get(taskId);
          if (cachedTask && cachedTask.status === 'completed' && cachedTask.video_url) {
            completedUrls[i] = cachedTask.video_url;
            continue;
          }

          const taskResult = await getTaskStatus(taskId);
          const taskStatus = (taskResult?.status || '').toLowerCase();

          if (taskStatus === 'completed') {
            const files = taskResult.results || taskResult.files || [];
            let videoFile = files.find(f => f.endsWith('.mp4')) || files[0];
            if (videoFile && (videoFile.startsWith('http://') || videoFile.startsWith('https://'))) {
              videoFile = videoFile.split('/').pop();
            }
            if (videoFile) {
              completedUrls[i] = getFileUrl(videoFile, taskId);
              try { updateGlabsTaskStatus(taskId, 'completed', completedUrls[i]); } catch { }
            } else {
              allDone = false;
            }
          } else if (taskStatus === 'failed') {
            try { updateGlabsTaskStatus(taskId, 'failed'); } catch { }
          } else {
            allDone = false;
          }
        } catch (pollErr) {
          allDone = false;
          console.warn(`[RE+AM Render] Error polling task ${taskId}:`, pollErr.message);
        }
      }

      // Check if all tasks have recorded statuses (either completed or failed)
      let anyGlabsFailed = false;
      let allStatusesRecorded = true;
      for (const taskId of glabsTaskIds) {
        const t = await db.prepare('SELECT status FROM glabs_tasks WHERE task_id = ?').get(taskId);
        if (!t || t.status === 'processing') {
          allStatusesRecorded = false;
        } else if (t.status === 'failed') {
          anyGlabsFailed = true;
        }
      }

      if (allStatusesRecorded) {
        if (anyGlabsFailed) {
          await db.prepare("UPDATE re_item_angle_variants SET visual_status = 'failed' WHERE id = ?").run(variantId);
          throw new Error(`One or more video tasks failed on G-Labs`);
        }
        break;
      }

      console.log(`[RE+AM Render] Polling attempt ${attempts}/${maxAttempts}: not all completed yet. Waiting 10s...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    if (completedUrls.filter(Boolean).length !== glabsTaskIds.length) {
      await db.prepare("UPDATE re_item_angle_variants SET visual_status = 'failed' WHERE id = ?").run(variantId);
      throw new Error(`Polling timed out or some tasks failed.`);
    }

    // Download video clips to localtemp
    console.log(`[RE+AM Render] Downloading visual clips...`);
    const localPaths = [];
    const tempDir = path.join(process.cwd(), 'public', 'temp');
    for (let i = 0; i < completedUrls.length; i++) {
      const url = completedUrls[i];
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download clip ${i} from URL: ${url}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const filename = `reav_${variant.id}_clip_${i}.mp4`;
      const localPath = path.join(tempDir, filename);
      fs.writeFileSync(localPath, buffer);
      localPaths.push(`/temp/${filename}`);
    }

    await db.prepare("UPDATE re_item_angle_variants SET visual_status = 'completed', visual_clip_paths = ? WHERE id = ?").run(JSON.stringify(localPaths), variantId);

    // 4. FFmpeg Muxing & Upload Stage
    let finalVideoPath = null;
    let driveUrl = '';

    if (enableFfmpeg) {
      await db.prepare("UPDATE re_item_angle_variants SET ffmpeg_status = 'processing' WHERE id = ?").run(variantId);
      try {
        const { processTtsStudioMuxing } = await import('./video-studio-processor');
        const finalVideoFileName = `reav_final_${variant.id}.mp4`;
        finalVideoPath = path.join(tempDir, finalVideoFileName);

        await processTtsStudioMuxing({
          id: `reav_${variant.id}`,
          videoPath: JSON.stringify(localPaths),
          batchId: ttsBatchId,
          syncOption: campaign.ffmpeg_sync_option || 'shortest',
          bridgeAtClip: campaign.bridge_at_clip !== undefined ? Number(campaign.bridge_at_clip) : 3,
          bgmPath: null,
          bgmVolume: campaign.ffmpeg_bgm_volume !== undefined ? Number(campaign.ffmpeg_bgm_volume) : 0.15,
          sfxVolume: campaign.sfx_setting === 'without_sfx' ? 0.0 : (campaign.ffmpeg_sfx_volume !== undefined ? Number(campaign.ffmpeg_sfx_volume) : 0.0),
          videoScale: campaign.ffmpeg_video_scale !== undefined ? Number(campaign.ffmpeg_video_scale) : 1.0,
          outputPath: finalVideoPath
        });

        if (!fs.existsSync(finalVideoPath)) {
          throw new Error(`Muxed output file not found at ${finalVideoPath}`);
        }

        await db.prepare("UPDATE re_item_angle_variants SET ffmpeg_status = 'completed', ffmpeg_output_path = ?, upload_status = 'uploading' WHERE id = ?").run(`/temp/${finalVideoFileName}`, variantId);
      } catch (ffmpegMuxErr) {
        await db.prepare("UPDATE re_item_angle_variants SET ffmpeg_status = 'failed' WHERE id = ?").run(variantId);
        throw ffmpegMuxErr;
      }
    } else {
      await db.prepare("UPDATE re_item_angle_variants SET ffmpeg_status = 'skipped', upload_status = 'uploading' WHERE id = ?").run(variantId);
    }

    // Upload to Google Drive / Nextcloud with custom folder structure & Penamaan Terstruktur
    console.log(`[RE+AM Render] Uploading result files to Cloud storage...`);
    try {
      const storageProvider = getSetting('storage_provider') || 'gdrive';

      const baseBatchId = await getReBatchId(campaign, parentItem, db);
      const filePrefix = `${getFilePrefixFromBatchId(baseBatchId)}-Angle-${variant.angle_name}`;
      const batchFolderName = `${baseBatchId}-Angle-${variant.angle_name}`;

      if (storageProvider === 'nextcloud') {
        const { uploadBufferToNextcloud } = await import('./nextcloud-helper');
        const parentFolderName = getCampaignParentFolderName(campaign, 'RE');
        const targetFolder = getCampaignNextcloudTargetFolder(campaign);
        const basePath = `/${targetFolder}/${parentFolderName}/${batchFolderName}`.replace(/\/+/g, '/');

        // Upload start frame images to Nextcloud
        for (let i = 0; i < localPaths.length; i++) {
          const startFrameFilename = `start_frame_variant_${variant.id}_clip_${i + 1}.png`;
          const startFrameLocalPath = path.join(process.cwd(), 'public', 'uploads', 'start_frames', startFrameFilename);
          if (fs.existsSync(startFrameLocalPath)) {
            const startFrameBuffer = fs.readFileSync(startFrameLocalPath);
            const cloudStartFrameName = `${filePrefix}_start_frame_${i + 1}.png`;
            await uploadBufferToNextcloud(startFrameBuffer, `${basePath}/${cloudStartFrameName}`);
          }
        }

        if (enableFfmpeg && finalVideoPath) {
          const finalFileName = `${filePrefix}_video_final.mp4`;
          const fileBuffer = fs.readFileSync(finalVideoPath);
          const uploaded = await uploadBufferToNextcloud(fileBuffer, `${basePath}/${finalFileName}`);
          driveUrl = uploaded.fileUrl;

          // ALSO upload all individual video clips to Nextcloud
          for (let i = 0; i < localPaths.length; i++) {
            const clipPath = path.join(process.cwd(), 'public', localPaths[i]);
            const clipFileName = `${filePrefix}_video_clip_${i + 1}.mp4`;
            if (fs.existsSync(clipPath)) {
              const clipBuffer = fs.readFileSync(clipPath);
              await uploadBufferToNextcloud(clipBuffer, `${basePath}/${clipFileName}`);
            }
          }
        } else {
          for (let i = 0; i < localPaths.length; i++) {
            const clipPath = path.join(process.cwd(), 'public', localPaths[i]);
            const clipFileName = `${filePrefix}_video_clip_${i + 1}.mp4`;
            const fileBuffer = fs.readFileSync(clipPath);
            const uploaded = await uploadBufferToNextcloud(fileBuffer, `${basePath}/${clipFileName}`);
            if (i === 0) driveUrl = uploaded.fileUrl;
          }
        }

        // Upload audio clips to Nextcloud if they exist
        if (variant.tts_batch_id && variant.tts_batch_id !== 'skipped') {
          try {
            const ttsClips = await db.prepare("SELECT * FROM tts_studio_clips WHERE batch_id = ? AND status = 'completed'").all(variant.tts_batch_id);
            for (const clip of ttsClips) {
              if (clip.audio_path) {
                const audioLocalPath = path.join(process.cwd(), 'public', clip.audio_path);
                if (fs.existsSync(audioLocalPath)) {
                  const audioFileName = `${filePrefix}_audio_clip_${clip.clip_index + 1}.mp3`;
                  const audioBuffer = fs.readFileSync(audioLocalPath);
                  await uploadBufferToNextcloud(audioBuffer, `${basePath}/${audioFileName}`);
                }
              }
            }
          } catch (audioErr) {
            console.error(`[RE Variant Nextcloud Audio Upload] Failed to upload audio files:`, audioErr.message);
          }
        }
      } else {
        const { uploadVideoToFolder, uploadLocalFileToFolder } = await import('./drive-uploader');
        const { getAuthorizedClient } = await import('./google-auth');
        const { google } = await import('googleapis');
        const auth = getAuthorizedClient();
        const drive = google.drive({ version: 'v3', auth });

        const brandProfile = await db.prepare('SELECT * FROM brand_profiles WHERE LOWER(brand_name) = LOWER(?)').get(campaign.account_name || '');
        let targetFolderId = brandProfile?.drive_glabs_folder_id;
        const rootFolderName = brandProfile?.drive_target_folder || 'MAKNA Assets';

        if (!targetFolderId) {
          targetFolderId = getSetting('drive_assets_folder_id');
          if (!targetFolderId || rootFolderName !== 'MAKNA Assets') {
            const search = await drive.files.list({
              q: `name='${rootFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
              fields: 'files(id)',
              spaces: 'drive',
            });
            if (search.data.files?.length) {
              targetFolderId = search.data.files[0].id;
            } else {
              const created = await drive.files.create({
                requestBody: { name: rootFolderName, mimeType: 'application/vnd.google-apps.folder' },
                fields: 'id',
              });
              targetFolderId = created.data.id;
            }
            if (rootFolderName === 'MAKNA Assets') {
              setSetting('drive_assets_folder_id', targetFolderId);
            }
          }
        }

        const parentFolderName = getCampaignParentFolderName(campaign, 'RE');
        let campaignFolderId = null;
        const searchSub = await drive.files.list({
          q: `name='${parentFolderName}' and '${targetFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: 'files(id)',
          spaces: 'drive',
        });
        if (searchSub.data.files?.length) {
          campaignFolderId = searchSub.data.files[0].id;
        } else {
          const createdSub = await drive.files.create({
            requestBody: { name: parentFolderName, mimeType: 'application/vnd.google-apps.folder', parents: [targetFolderId] },
            fields: 'id',
          });
          campaignFolderId = createdSub.data.id;
        }

        let batchFolderId = null;
        const searchBatch = await drive.files.list({
          q: `name='${batchFolderName}' and '${campaignFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: 'files(id)',
          spaces: 'drive',
        });
        if (searchBatch.data.files?.length) {
          batchFolderId = searchBatch.data.files[0].id;
        } else {
          const createdBatch = await drive.files.create({
            requestBody: { name: batchFolderName, mimeType: 'application/vnd.google-apps.folder', parents: [campaignFolderId] },
            fields: 'id',
          });
          batchFolderId = createdBatch.data.id;

          try {
            await drive.permissions.create({
              fileId: batchFolderId,
              requestBody: { role: 'reader', type: 'anyone' },
            });
          } catch (permErr) { }
        }

        // Upload start frame images to Google Drive
        for (let i = 0; i < localPaths.length; i++) {
          const startFrameFilename = `start_frame_variant_${variant.id}_clip_${i + 1}.png`;
          const startFrameLocalPath = path.join(process.cwd(), 'public', 'uploads', 'start_frames', startFrameFilename);
          if (fs.existsSync(startFrameLocalPath)) {
            const cloudStartFrameName = `${filePrefix}_start_frame_${i + 1}.png`;
            await uploadLocalFileToFolder(startFrameLocalPath, cloudStartFrameName, batchFolderId, 'image/png');
          }
        }

        if (enableFfmpeg && finalVideoPath) {
          const finalFileName = `${filePrefix}_video_final.mp4`;
          const uploaded = await uploadVideoToFolder(finalVideoPath, finalFileName, batchFolderId);
          driveUrl = uploaded.driveUrl;
        } else {
          for (let i = 0; i < localPaths.length; i++) {
            const clipPath = path.join(process.cwd(), 'public', localPaths[i]);
            const clipFileName = `${filePrefix}_video_clip_${i + 1}.mp4`;
            await uploadVideoToFolder(clipPath, clipFileName, batchFolderId);
          }
          driveUrl = `https://drive.google.com/drive/folders/${batchFolderId}`;
        }

        // Upload audio clips to Google Drive if they exist
        if (variant.tts_batch_id && variant.tts_batch_id !== 'skipped') {
          try {
            const ttsClips = await db.prepare("SELECT * FROM tts_studio_clips WHERE batch_id = ? AND status = 'completed'").all(variant.tts_batch_id);
            for (const clip of ttsClips) {
              if (clip.audio_path) {
                const audioLocalPath = path.join(process.cwd(), 'public', clip.audio_path);
                if (fs.existsSync(audioLocalPath)) {
                  const audioFileName = `${filePrefix}_audio_clip_${clip.clip_index + 1}.mp3`;
                  await uploadLocalFileToFolder(audioLocalPath, audioFileName, batchFolderId, 'audio/mpeg');
                }
              }
            }
          } catch (audioErr) {
            console.error(`[RE Variant Drive Audio Upload] Failed to upload audio files:`, audioErr.message);
          }
        }
      }

      // Save copy to local storage
      const subPath = `${parentFolderName}/${batchFolderName}`;
      if (enableFfmpeg && finalVideoPath) {
        const finalFileName = `${filePrefix}_video_final.mp4`;
        await saveFileToLocalStorage(finalVideoPath, subPath, finalFileName);
      } else {
        for (let i = 0; i < localPaths.length; i++) {
          const clipPath = path.join(process.cwd(), 'public', localPaths[i]);
          const clipFileName = `${filePrefix}_video_clip_${i + 1}.mp4`;
          await saveFileToLocalStorage(clipPath, subPath, clipFileName);
        }
      }

      // Save copies of audios to local storage
      if (variant.tts_batch_id && variant.tts_batch_id !== 'skipped') {
        try {
          const ttsClips = await db.prepare("SELECT * FROM tts_studio_clips WHERE batch_id = ? AND status = 'completed'").all(variant.tts_batch_id);
          for (const clip of ttsClips) {
            if (clip.audio_path) {
              const audioLocalPath = path.join(process.cwd(), 'public', clip.audio_path);
              const audioFileName = `RE-${campaign.campaign_name}-${paddedIndex}-Angle-${variant.angle_name}_audio_clip_${clip.clip_index + 1}.mp3`;
              await saveFileToLocalStorage(audioLocalPath, subPath, audioFileName);
            }
          }
        } catch (localAudioErr) {
          console.error(`[RE Variant Local Audio Sync] Failed to copy audio to local storage:`, localAudioErr.message);
        }
      }

      await db.prepare("UPDATE re_item_angle_variants SET upload_status = 'completed', drive_link = ? WHERE id = ?").run(driveUrl, variantId);
      console.log(`[RE+AM Render] Successfully completed all rendering and upload steps for variant: ${variant.angle_name}`);
    } catch (uploadErr) {
      await db.prepare("UPDATE re_item_angle_variants SET upload_status = 'failed' WHERE id = ?").run(variantId);
      const { logSystemError } = await import('./error-logger');
      logSystemError('RE G-Labs Angle Variant Upload', uploadErr, campaign.id);
      throw uploadErr;
    }

    return { processed: true, variant_id: variant.id, drive_link: driveUrl };
  }

  const fileToBase64 = (filePath) => {
    if (!filePath) return null;
    let absolutePath = filePath;
    if (!fs.existsSync(absolutePath)) {
      const relativePart = filePath.startsWith('/') ? filePath.slice(1) : filePath;
      absolutePath = path.join(process.cwd(), 'public', relativePart);
    }
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found for base64 conversion: ${filePath} (checked path: ${absolutePath})`);
    }
    const fileBuffer = fs.readFileSync(absolutePath);

    // Detect MIME type by magic bytes
    let mimeType = 'image/png'; // default fallback
    if (fileBuffer[0] === 0xFF && fileBuffer[1] === 0xD8 && fileBuffer[2] === 0xFF) {
      mimeType = 'image/jpeg';
    } else if (fileBuffer[0] === 0x89 && fileBuffer[1] === 0x50 && fileBuffer[2] === 0x4E && fileBuffer[3] === 0x47) {
      mimeType = 'image/png';
    } else if (fileBuffer[0] === 0x52 && fileBuffer[1] === 0x49 && fileBuffer[2] === 0x46 && fileBuffer[3] === 0x46) {
      mimeType = 'image/webp';
    }

    return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
  };

  const itemId = payload?.item_id;

  // Phase 1: Poll processing tasks first
  let item = null;
  if (itemId) {
    // If itemId is specified, check if that item is in 'processing' status to poll it
    item = await db.prepare(
      "SELECT * FROM re_campaign_items WHERE id = ? AND visual_status = 'processing'"
    ).get(itemId);
  } else {
    // Otherwise, find the next active item that is processing and not managed by local scheduler
    item = await db.prepare(
      "SELECT i.* FROM re_campaign_items i JOIN re_campaigns c ON i.campaign_id = c.id WHERE i.visual_status = 'processing' AND c.status = 'running' AND c.local_scheduler = 0 ORDER BY i.id ASC LIMIT 1"
    ).get();
  }

  if (item) {
    const taskIds = JSON.parse(item.visual_tasks_json || '[]');
    if (taskIds.length === 0) {
      updateReCampaignItem(item.id, { visual_status: 'pending' });
      return { processed: true, message: 'Reset visual_status to pending due to empty task list' };
    }

    let localPaths = [];
    try {
      localPaths = JSON.parse(item.visual_clip_paths || '[]');
    } catch { }
    if (!Array.isArray(localPaths) || localPaths.length !== taskIds.length) {
      localPaths = Array(taskIds.length).fill(null);
    }

    const campaign = await db.prepare('SELECT * FROM re_campaigns WHERE id = ?').get(item.campaign_id);

    let allCompleted = true;
    let anyFailed = false;
    let errorDetail = '';

    for (let i = 0; i < taskIds.length; i++) {
      if (localPaths[i]) {
        const localPath = path.join(process.cwd(), 'public', localPaths[i]);
        if (fs.existsSync(localPath)) {
          continue;
        }
      }

      const taskId = taskIds[i];
      try {
        // Check DB cache first
        const cachedTask = await db.prepare('SELECT status, video_url FROM glabs_tasks WHERE task_id = ?').get(taskId);
        if (cachedTask && cachedTask.status === 'completed' && cachedTask.video_url) {
          await downloadAndUploadReClip(item, campaign, i, cachedTask.video_url, localPaths, db, false, null);
          continue;
        }

        const taskResult = await getTaskStatus(taskId);
        const taskStatus = (taskResult?.status || '').toLowerCase();

        if (taskResult?.error) {
          anyFailed = true;
          errorDetail = `Task ${taskId} error on GLabs: ${taskResult.error}`;
          try {
            updateGlabsTaskStatus(taskId, 'failed');
          } catch (dbErr) {
            console.error(`[RE Glabs] Failed to update task status to DB:`, dbErr.message);
          }
        } else if (taskStatus === 'completed') {
          const files = taskResult.results || taskResult.files || [];
          let videoFile = files.find(f => f.endsWith('.mp4')) || files[0];
          if (videoFile && (videoFile.startsWith('http://') || videoFile.startsWith('https://'))) {
            videoFile = videoFile.split('/').pop();
          }
          if (videoFile) {
            const completedUrl = getFileUrl(videoFile, taskId);
            try {
              updateGlabsTaskStatus(taskId, 'completed', completedUrl);
            } catch (dbErr) {
              console.error(`[RE Glabs] Failed to update task status to DB:`, dbErr.message);
            }
            await downloadAndUploadReClip(item, campaign, i, completedUrl, localPaths, db, false, null);
          } else {
            allCompleted = false;
          }
        } else if (taskStatus === 'failed') {
          anyFailed = true;
          const rawErr = taskResult?.error || taskResult?.error_detail || taskResult?.message || '';
          errorDetail = `Task ${taskId} failed on GLabs: ${rawErr}`;

          try {
            updateGlabsTaskStatus(taskId, 'failed');
          } catch (dbErr) {
            console.error(`[RE Glabs] Failed to update task status to DB:`, dbErr.message);
          }
        } else {
          allCompleted = false;
        }
      } catch (pollErr) {
        allCompleted = false;
        console.error(`[RE Glabs] Polling error for task ${taskId}:`, pollErr.message);
      }
    }

    if (anyFailed) {
      updateReCampaignItem(item.id, { visual_status: 'failed' });
      throw new Error(`Visual generation failed: ${errorDetail}`);
    }

    const allDone = localPaths.every(Boolean);
    if (allDone) {
      let uploadLink = '';
      try {
        const storageProvider = getSetting('storage_provider') || 'gdrive';
        const campaignItems = await db.prepare('SELECT id FROM re_campaign_items WHERE campaign_id = ? ORDER BY id ASC').all(item.campaign_id);
        const itemIndex = campaignItems.findIndex(i => i.id === item.id);
        const sequenceNumber = itemIndex !== -1 ? itemIndex + 1 : 1;
        const paddedIndex = String(sequenceNumber).padStart(3, '0');
        const batchFolderName = `RE-${campaign.campaign_name}-${paddedIndex}`;

        if (storageProvider === 'nextcloud') {
          const targetFolder = getCampaignNextcloudTargetFolder(campaign);
          uploadLink = `${targetFolder}/RE_Campaign_${campaign.id}/${batchFolderName}`.replace(/\/+/g, '/');
        } else {
          const { google } = await import('googleapis');
          const { getAuthorizedClient } = await import('./google-auth');
          const auth = getAuthorizedClient();
          const drive = google.drive({ version: 'v3', auth });

          let targetFolderId = getSetting('drive_assets_folder_id');
          if (!targetFolderId) {
            const search = await drive.files.list({
              q: `name='MAKNA Assets' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
              fields: 'files(id)',
              spaces: 'drive',
            });
            if (search.data.files?.length) {
              targetFolderId = search.data.files[0].id;
            } else {
              const created = await drive.files.create({
                requestBody: { name: 'MAKNA Assets', mimeType: 'application/vnd.google-apps.folder' },
                fields: 'id',
              });
              targetFolderId = created.data.id;
            }
            setSetting('drive_assets_folder_id', targetFolderId);
          }

          const campaignFolderName = `RE_Campaign_${campaign.campaign_name.replace(/[^a-zA-Z0-9_]/g, '_')}`;
          let campaignFolderId = null;
          const searchSub = await drive.files.list({
            q: `name='${campaignFolderName}' and '${targetFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id)',
            spaces: 'drive',
          });

          if (searchSub.data.files?.length) {
            campaignFolderId = searchSub.data.files[0].id;
          } else {
            const createdSub = await drive.files.create({
              requestBody: {
                name: campaignFolderName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [targetFolderId]
              },
              fields: 'id',
            });
            campaignFolderId = createdSub.data.id;
          }

          const batchFolderName = `RE-${campaign.campaign_name}-${paddedIndex}`;
          const searchBatch = await drive.files.list({
            q: `name='${batchFolderName}' and '${campaignFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id)',
            spaces: 'drive',
          });

          if (searchBatch.data.files?.length) {
            batchFolderId = searchBatch.data.files[0].id;
          } else {
            const createdBatch = await drive.files.create({
              requestBody: {
                name: batchFolderName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [campaignFolderId]
              },
              fields: 'id',
            });
            batchFolderId = createdBatch.data.id;

            try {
              await drive.permissions.create({
                fileId: batchFolderId,
                requestBody: {
                  role: 'reader',
                  type: 'anyone',
                },
              });
            } catch (permErr) {
              console.warn('[RE Glabs Upload] Failed to set batch folder permissions:', permErr.message);
            }
          }

          uploadLink = `https://drive.google.com/drive/folders/${batchFolderId}`;
        }
      } catch (driveErr) {
        console.error(`[RE Glabs Folder Link Resolution] Failed:`, driveErr.message);
      }

      updateReCampaignItem(item.id, {
        visual_status: 'completed',
        visual_clip_paths: JSON.stringify(localPaths),
        drive_link: uploadLink || null,
        upload_status: uploadLink ? 'completed' : 'failed'
      });

      return { processed: true, item_id: item.id, clips: localPaths, folder_url: uploadLink };
    }

    return { skip: true, reason: `Visual tasks still processing for item #${item.id}` };
  }

  // Phase 2: Submit pending tasks
  if (itemId) {
    item = await db.prepare('SELECT * FROM re_campaign_items WHERE id = ?').get(itemId);
  } else {
    item = getNextPendingReGlabsItem();
  }
  if (!item) return { skip: true, reason: itemId ? `Item ${itemId} not found` : 'No pending RE campaign items to generate visuals' };

  const campaign = await db.prepare('SELECT * FROM re_campaigns WHERE id = ?').get(item.campaign_id);
  if (!campaign) return { skip: true, reason: `Campaign ${item.campaign_id} not found` };
  const brandProfile = await db.prepare('SELECT * FROM brand_profiles WHERE LOWER(brand_name) = LOWER(?)').get(campaign.account_name || '');

  if (campaign.is_bridging_active && item.product_url && item.product_url.trim() !== '') {
    const product = await db.prepare('SELECT * FROM product_extractions WHERE input_source = ? OR source_url = ?').get(item.product_url, item.product_url);
    if (product) {
      campaign.bridging_mode = 'select_existing';
      campaign.target_product_id = product.id;
      if (product.photo_url) {
        campaign.product_ref_image_path = product.photo_url;
        campaign.product_filename_declare = path.basename(product.photo_url);
      }
      console.log(`[RE Glabs] Item #${item.id}: Menggunakan produk spesifik baris dari cache database: "${product.product_name}"`);
    }
  }

  if (campaign.enable_glabs === 0) {
    updateReCampaignItem(item.id, {
      visual_status: 'skipped',
      visual_clip_paths: JSON.stringify([])
    });
    return { processed: true, item_id: item.id, message: 'G-Labs is inactive. Skipped visuals stage.' };
  }

  const parsed = JSON.parse(item.result_json || '{}');

  const targetClips = campaign.target_clips_count || 5;
  const bridgeAtClip = campaign.bridge_at_clip || 3;
  const bridgeDurationClips = campaign.bridge_duration_clips || 0;
  const visualMode = campaign.visual_mode || 'pure_t2v';

  // Basic sanity check: make sure we have visual prompts generated
  if (!parsed.t2v_prompts && !parsed.t2i_prompts && !parsed.i2v_prompts) {
    updateReCampaignItem(item.id, {
      visual_status: 'completed',
      visual_clip_paths: JSON.stringify([])
    });
    return { processed: true, item_id: item.id, message: 'Completed immediately because of 0 prompts' };
  }

  // Parse existing tasks from visual_tasks_json
  const existingTaskIds = [];
  try {
    if (item.visual_tasks_json) {
      const parsedTasks = JSON.parse(item.visual_tasks_json);
      if (Array.isArray(parsedTasks)) {
        existingTaskIds.push(...parsedTasks);
      }
    }
  } catch (e) {
    console.error(`[RE Glabs] Failed to parse existing tasks:`, e.message);
  }

  updateReCampaignItem(item.id, { visual_status: 'processing' });

  const webhookPort = getSetting('webhook_port') || '8765';
  const webhookApiKey = getSetting('webhook_api_key') || '';
  const videoModel = campaign.video_model || getSetting('webhook_video_model') || 'veo_31_lite';
  const imageModel = getSetting('webhook_image_model') || 'nano_banana_pro';

  const taskIds = [];
  try {
    for (let c = 1; c <= targetClips; c++) {
      let videoResult = null;
      let promptText = '';

      const isHybridLockClip = (visualMode === 'hybrid_lock');

      // Verify if we can reuse an existing completed task for this clip index
      const existingTaskId = existingTaskIds[c - 1];
      let reuseCompletedTask = false;
      if (existingTaskId) {
        let existingTask = await db.prepare('SELECT * FROM glabs_tasks WHERE task_id = ?').get(existingTaskId);
        if (existingTask) {
          // If task is still marked as processing, query G-Labs for its final status
          if (existingTask.status === 'processing') {
            try {
              console.log(`[RE Glabs] Checking final status of processing task ${existingTaskId} on G-Labs...`);
              const taskResult = await getTaskStatus(existingTaskId);
              const taskStatus = (taskResult?.status || '').toLowerCase();
              if (taskStatus === 'completed') {
                const files = taskResult.results || taskResult.files || [];
                let videoFile = files.find(f => f.endsWith('.mp4')) || files[0];
                if (videoFile && (videoFile.startsWith('http://') || videoFile.startsWith('https://'))) {
                  videoFile = videoFile.split('/').pop();
                }
                if (videoFile) {
                  const completedUrl = getFileUrl(videoFile, existingTaskId);
                  updateGlabsTaskStatus(existingTaskId, 'completed', completedUrl);
                  existingTask = await db.prepare('SELECT * FROM glabs_tasks WHERE task_id = ?').get(existingTaskId);
                }
              } else if (taskStatus === 'failed') {
                updateGlabsTaskStatus(existingTaskId, 'failed');
                existingTask = await db.prepare('SELECT * FROM glabs_tasks WHERE task_id = ?').get(existingTaskId);
              }
            } catch (err) {
              console.warn(`[RE Glabs] Failed to poll final status for task ${existingTaskId}:`, err.message);
            }
          }

          if (existingTask.status === 'completed' && existingTask.video_url) {
            const expectedPrompt = isHybridLockClip ?
              ((parsed.i2v_prompts || []).find(p => Number(p.clip) === c)?.prompt || '') :
              ((parsed.t2v_prompts || []).find(p => Number(p.clip) === c)?.prompt || '');

            if (existingTask.prompt === expectedPrompt) {
              console.log(`[RE Glabs] Reusing completed video task ${existingTaskId} for clip ${c}`);
              taskIds.push(existingTaskId);
              reuseCompletedTask = true;
            }
          }
        }
      }

      if (reuseCompletedTask) {
        updateReCampaignItem(item.id, {
          visual_tasks_json: JSON.stringify(taskIds)
        });
        continue;
      }

      if (isHybridLockClip) {
        const t2iPromptObj = (parsed.t2i_prompts || []).find(p => Number(p.clip) === c);
        const t2iPromptText = t2iPromptObj ? t2iPromptObj.prompt : '';
        if (!t2iPromptText) {
          throw new Error(`T2I prompt for clip ${c} not found in Gemini output`);
        }

        // 1. Check if the start frame image already exists locally to skip T2I generation
        const startFrameFilename = `start_frame_${item.id}_clip_${c}.png`;
        const startFrameLocalPath = path.join(process.cwd(), 'public', 'uploads', 'start_frames', startFrameFilename);
        const relativeStartFramePath = `/uploads/start_frames/${startFrameFilename}`;

        let startFrameExists = fs.existsSync(startFrameLocalPath);

        if (startFrameExists) {
          console.log(`[RE Glabs] Start frame already exists locally for clip ${c}: ${relativeStartFramePath}. Skipping T2I stage.`);
        } else {
          const productBase64 = resolveProductBase64(campaign, productData);

          console.log(`[RE Glabs] Submitting T2I task for clip ${c}...`);
          const { generateImage } = await import('./webhook-client');
          const t2iResult = await generateImage({
            prompt: t2iPromptText,
            model: imageModel,
            aspect_ratio: campaign.aspect_ratio || '9:16',
            reference_images: productBase64 ? [productBase64] : undefined,
            webhookOverride: brandProfile
          });

          if (!t2iResult?.task_id) {
            throw new Error(`Failed to submit T2I task for clip ${c}`);
          }

          const t2iTaskId = t2iResult.task_id;
          console.log(`[RE Glabs] T2I task ${t2iTaskId} submitted. Polling for completion...`);

          // Poll T2I task until complete
          let t2iCompleted = false;
          let t2iImageUrl = null;
          const maxT2iAttempts = 30; // 30 * 2s = 60s max wait
          for (let attempt = 0; attempt < maxT2iAttempts; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const t2iStatusResult = await getTaskStatus(t2iTaskId);
            const t2iStatus = (t2iStatusResult?.status || '').toLowerCase();

            if (t2iStatus === 'completed') {
              const files = t2iStatusResult.results || t2iStatusResult.files || [];
              let imageFile = files.find(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')) || files[0];
              if (imageFile && (imageFile.startsWith('http://') || imageFile.startsWith('https://'))) {
                imageFile = imageFile.split('/').pop();
              }
              if (imageFile) {
                t2iImageUrl = getFileUrl(imageFile, t2iTaskId);
                t2iCompleted = true;
                break;
              }
            } else if (t2iStatus === 'failed') {
              const rawErr = t2iStatusResult?.error || t2iStatusResult?.error_detail || t2iStatusResult?.message || '';
              throw new Error(`T2I task ${t2iTaskId} failed on GLabs: ${rawErr}`);
            }
          }

          if (!t2iCompleted || !t2iImageUrl) {
            throw new Error(`T2I task ${t2iTaskId} timed out or failed to return image URL`);
          }

          // Download start frame
          console.log(`[RE Glabs] Downloading start frame from ${t2iImageUrl}...`);
          const imgResponse = await fetch(t2iImageUrl);
          if (!imgResponse.ok) {
            throw new Error(`Failed to download start frame from ${t2iImageUrl}`);
          }
          const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());

          fs.writeFileSync(startFrameLocalPath, imgBuffer);

          console.log(`[RE Start Frame] Saved locally at ${relativeStartFramePath}`);
        }

        updateReCampaignItem(item.id, { t2i_start_frame_path: relativeStartFramePath });

        // 2. Submit I2V using the generated start frame
        const startFrameBase64 = fileToBase64(relativeStartFramePath);
        const i2vPromptObj = (parsed.i2v_prompts || []).find(p => Number(p.clip) === c);
        const i2vPromptText = i2vPromptObj ? i2vPromptObj.prompt : '';
        if (!i2vPromptText) {
          throw new Error(`I2V prompt for clip ${c} not found in Gemini output`);
        }

        promptText = i2vPromptText;
        console.log(`[RE Glabs] Submitting I2V task for clip ${c} using model: veo_31_lite...`);
        videoResult = await generateVideo({
          prompt: i2vPromptText,
          model: 'veo_31_lite',
          aspect_ratio: campaign.aspect_ratio || '9:16',
          mode: 'start_image',
          reference_images: [startFrameBase64],
          webhookOverride: brandProfile
        });
      } else {
        // Standard T2V
        const t2vPromptObj = (parsed.t2v_prompts || []).find(p => Number(p.clip) === c);
        const t2vPromptText = t2vPromptObj ? t2vPromptObj.prompt : '';
        if (!t2vPromptText) {
          throw new Error(`T2V prompt for clip ${c} not found in Gemini output`);
        }

        promptText = t2vPromptText;
        console.log(`[RE Glabs] Submitting T2V task for clip ${c}...`);
        videoResult = await generateVideo({
          prompt: t2vPromptText,
          model: videoModel,
          aspect_ratio: campaign.aspect_ratio || '9:16',
          webhookOverride: brandProfile
        });
      }

      if (!videoResult?.task_id) {
        throw new Error(`No task ID returned from GLabs for prompt clip ${c}`);
      }
      taskIds.push(videoResult.task_id);
      updateReCampaignItem(item.id, {
        visual_tasks_json: JSON.stringify(taskIds)
      });

      try {
        insertGlabsTask({
          task_id: videoResult.task_id,
          campaign_id: item.campaign_id,
          item_id: item.id,
          clip_index: c - 1,
          prompt: promptText,
          status: 'processing'
        });
      } catch (dbErr) {
        console.error(`[RE Glabs] Failed to insert task to DB:`, dbErr.message);
      }

      // Micro-pacing pacing delay: 10s delay between submissions (except the last one)
      if (c < targetClips) {
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }

    updateReCampaignItem(item.id, {
      visual_tasks_json: JSON.stringify(taskIds)
    });

    return { processed: true, item_id: item.id, task_ids: taskIds };
  } catch (err) {
    updateReCampaignItem(item.id, {
      visual_status: 'failed',
      visual_tasks_json: JSON.stringify(taskIds)
    });
    const { logSystemError } = await import('./error-logger');
    logSystemError('RE G-Labs', err, item.campaign_id);
    throw err;
  }
}


// ========================
// 10. RE CAMPAIGN FFMPEG PROCESSOR (Cost: 0) — V6.5
// Muxes visual and audio files into a final MP4 and uploads to Cloud
// ========================
export async function processReFfmpeg(payload, job) {
  const { getNextPendingReFfmpegItem, updateReCampaignItem, getReCampaign, getSetting, setSetting, getDb } = await import('./db');
  const { processTtsStudioMuxing } = await import('./video-studio-processor');
  const { google } = await import('googleapis');
  const { getAuthorizedClient } = await import('./google-auth');
  const path = await import('path');
  const fs = await import('fs');

  const db = getDb();
  const itemId = payload?.item_id;
  let item;
  if (itemId) {
    item = await db.prepare('SELECT * FROM re_campaign_items WHERE id = ?').get(itemId);
  } else {
    item = getNextPendingReFfmpegItem();
  }
  if (!item) return { skip: true, reason: itemId ? `Item ${itemId} not found` : 'No pending RE campaign items for FFmpeg muxing' };

  const campaign = await getReCampaign(item.campaign_id);
  if (!campaign) return { skip: true, reason: `Campaign ${item.campaign_id} not found` };

  const isSocialActive = campaign.enable_social_post === 1 || campaign.post_facebook_draft === 1;
  const finalSocialPostStatus = isSocialActive ? (campaign.fb_draft_mode === 'manual' ? 'skipped' : 'pending') : 'skipped';
  if (campaign.enable_glabs === 0 || campaign.enable_tts === 0) {
    updateReCampaignItem(item.id, {
      ffmpeg_status: 'skipped',
      ffmpeg_output_path: 'skipped',
      social_post_status: finalSocialPostStatus
    });
    return { processed: true, item_id: item.id, message: `Workflow dependencies (G-Labs/TTS) are inactive. Skipped FFmpeg stage. Social posting set to ${finalSocialPostStatus}.` };
  }

  if (campaign.enable_ffmpeg === 0) {
    if (campaign.enable_tts === 0 && campaign.enable_social_post === 0) {
      // PREVENT DUPLICATE UPLOAD: Jika klip sudah sukses diunggah pada tahap G Labs
      if (item.upload_status === 'completed' && item.drive_link) {
        updateReCampaignItem(item.id, {
          ffmpeg_status: 'completed',
          ffmpeg_output_path: 'skipped',
          social_post_status: 'skipped'
        });
        return { processed: true, item_id: item.id, message: 'All 3 stages disabled. Clips already uploaded during visual retrieval.', folder_url: item.drive_link };
      }

      updateReCampaignItem(item.id, { ffmpeg_status: 'processing' });
      try {
        const campaignItems = await db.prepare('SELECT id FROM re_campaign_items WHERE campaign_id = ? ORDER BY id ASC').all(item.campaign_id);
        const itemIndex = campaignItems.findIndex(i => i.id === item.id);
        const sequenceNumber = itemIndex !== -1 ? itemIndex + 1 : 1;
        const paddedIndex = String(sequenceNumber).padStart(3, '0');

        const { uploadVideoToFolder } = await import('./drive-uploader');
        const auth = getAuthorizedClient();
        const drive = google.drive({ version: 'v3', auth });

        let targetFolderId = getSetting('drive_assets_folder_id');
        if (!targetFolderId) {
          const search = await drive.files.list({
            q: `name='MAKNA Assets' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id)',
            spaces: 'drive',
          });
          if (search.data.files?.length) {
            targetFolderId = search.data.files[0].id;
          } else {
            const created = await drive.files.create({
              requestBody: { name: 'MAKNA Assets', mimeType: 'application/vnd.google-apps.folder' },
              fields: 'id',
            });
            targetFolderId = created.data.id;
          }
          setSetting('drive_assets_folder_id', targetFolderId);
        }

        const campaignFolderName = `RE_Campaign_${campaign.campaign_name.replace(/[^a-zA-Z0-9_]/g, '_')}`;
        let campaignFolderId = null;
        const searchSub = await drive.files.list({
          q: `name='${campaignFolderName}' and '${targetFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: 'files(id)',
          spaces: 'drive',
        });

        if (searchSub.data.files?.length) {
          campaignFolderId = searchSub.data.files[0].id;
        } else {
          const createdSub = await drive.files.create({
            requestBody: {
              name: campaignFolderName,
              mimeType: 'application/vnd.google-apps.folder',
              parents: [targetFolderId]
            },
            fields: 'id',
          });
          campaignFolderId = createdSub.data.id;
        }

        const batchFolderName = `RE-${campaign.campaign_name}-${paddedIndex}`;
        let batchFolderId = null;
        const searchBatch = await drive.files.list({
          q: `name='${batchFolderName}' and '${campaignFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: 'files(id)',
          spaces: 'drive',
        });

        if (searchBatch.data.files?.length) {
          batchFolderId = searchBatch.data.files[0].id;
        } else {
          const createdBatch = await drive.files.create({
            requestBody: {
              name: batchFolderName,
              mimeType: 'application/vnd.google-apps.folder',
              parents: [campaignFolderId]
            },
            fields: 'id',
          });
          batchFolderId = createdBatch.data.id;

          try {
            await drive.permissions.create({
              fileId: batchFolderId,
              requestBody: {
                role: 'reader',
                type: 'anyone',
              },
            });
          } catch (permErr) {
            console.warn('[RE FFmpeg] Failed to set batch folder permissions:', permErr.message);
          }
        }

        const clips = JSON.parse(item.visual_clip_paths || '[]');
        const uploadedLinks = [];
        for (let i = 0; i < clips.length; i++) {
          const clipRelativePath = clips[i];
          const localVideoPath = path.join(process.cwd(), 'public', clipRelativePath);
          const clipFileName = path.basename(localVideoPath);
          const uploaded = await uploadVideoToFolder(localVideoPath, clipFileName, batchFolderId);
          uploadedLinks.push(uploaded.driveUrl);
        }

        // Upload audio clips to Google Drive if they exist
        if (item.tts_batch_id && item.tts_batch_id !== 'skipped') {
          try {
            const { uploadLocalFileToFolder } = await import('./drive-uploader');
            const ttsClips = await db.prepare("SELECT * FROM tts_studio_clips WHERE batch_id = ? AND status = 'completed'").all(item.tts_batch_id);
            for (const clip of ttsClips) {
              if (clip.audio_path) {
                const audioLocalPath = path.join(process.cwd(), 'public', clip.audio_path);
                if (fs.existsSync(audioLocalPath)) {
                  const audioFileName = `RE-${campaign.campaign_name}-${paddedIndex}-Audio-${clip.clip_index + 1}.mp3`;
                  await uploadLocalFileToFolder(audioLocalPath, audioFileName, batchFolderId, 'audio/mpeg');
                }
              }
            }
          } catch (audioErr) {
            console.error(`[RE FFmpeg Clips Drive Audio Upload] Failed to upload audio files:`, audioErr.message);
          }
        }

        const uploadLink = `https://drive.google.com/drive/folders/${batchFolderId}`;

        const finalSocialPostStatus = isSocialActive ? (campaign.fb_draft_mode === 'manual' ? 'skipped' : 'pending') : 'skipped';
        updateReCampaignItem(item.id, {
          ffmpeg_status: 'completed',
          ffmpeg_output_path: 'skipped',
          upload_status: 'completed',
          drive_link: uploadLink,
          social_post_status: finalSocialPostStatus
        });

        return { processed: true, item_id: item.id, message: 'All 3 stages disabled. Clips uploaded to batch folder.', folder_url: uploadLink };
      } catch (err) {
        updateReCampaignItem(item.id, { ffmpeg_status: 'failed', upload_status: 'failed' });
        const { logSystemError } = await import('./error-logger');
        logSystemError('RE FFmpeg', err, item.campaign_id);
        throw err;
      }
    } else {
      const finalSocialPostStatus = isSocialActive ? (campaign.fb_draft_mode === 'manual' ? 'skipped' : 'pending') : 'skipped';
      updateReCampaignItem(item.id, {
        ffmpeg_status: 'skipped',
        ffmpeg_output_path: 'skipped',
        upload_status: 'completed',
        social_post_status: finalSocialPostStatus
      });
      return { processed: true, item_id: item.id, message: 'Skipped FFmpeg stage' };
    }
  }

  updateReCampaignItem(item.id, { ffmpeg_status: 'processing' });

  const tempDir = path.join(process.cwd(), 'public', 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const finalVideoFileName = `re_final_${item.id}.mp4`;
  const finalVideoPath = path.join(tempDir, finalVideoFileName);

  try {
    await processTtsStudioMuxing({
      id: item.id.toString(),
      videoPath: item.visual_clip_paths,
      batchId: item.tts_batch_id,
      syncOption: campaign.ffmpeg_sync_option || 'shortest',
      bridgeAtClip: campaign.bridge_at_clip !== undefined ? Number(campaign.bridge_at_clip) : 3,
      bgmPath: null,
      bgmVolume: campaign.ffmpeg_bgm_volume !== undefined ? Number(campaign.ffmpeg_bgm_volume) : 0.15,
      sfxVolume: campaign.sfx_setting === 'without_sfx' ? 0.0 : (campaign.ffmpeg_sfx_volume !== undefined ? Number(campaign.ffmpeg_sfx_volume) : 0.0),
      videoScale: campaign.ffmpeg_video_scale !== undefined ? Number(campaign.ffmpeg_video_scale) : 1.0,
      outputPath: finalVideoPath
    });

    if (!fs.existsSync(finalVideoPath)) {
      throw new Error(`Muxed output file not found at ${finalVideoPath}`);
    }

    updateReCampaignItem(item.id, {
      ffmpeg_status: 'completed',
      ffmpeg_output_path: `/temp/${finalVideoFileName}`,
      upload_status: 'uploading'
    });

    const batchId = await getReBatchId(campaign, item, db);

    let uploadLink = '';
    const storageProvider = getSetting('storage_provider') || 'gdrive';

    // A. ALWAYS upload all assets to Nextcloud if Nextcloud is configured
    const hasNextcloud = !!getSetting('nextcloud_url');
    if (hasNextcloud) {
      try {
        const { uploadBufferToNextcloud } = await import('./nextcloud-helper');
        const parentFolderName = getCampaignParentFolderName(campaign, 'RE');
        const targetFolder = getCampaignNextcloudTargetFolder(campaign);
        const filePrefix = getFilePrefixFromBatchId(batchId);
        const batchFolderName = batchId;
        const nextcloudBaseFolder = `/${targetFolder}/${parentFolderName}/${batchFolderName}`.replace(/\/+/g, '/');

        // 1. Upload video final
        const finalVideoNextcloudPath = `${nextcloudBaseFolder}/${filePrefix}_video_final.mp4`;
        const fileBuffer = fs.readFileSync(finalVideoPath);
        const uploadedFinal = await uploadBufferToNextcloud(fileBuffer, finalVideoNextcloudPath);
        
        // Backup copy for backward compatibility
        try {
          await uploadBufferToNextcloud(fileBuffer, `${nextcloudBaseFolder}/video_final.mp4`);
        } catch (_) {}

        if (storageProvider === 'nextcloud') {
          const { getOrCreatePublicShareLink } = await import('./nextcloud-helper');
          uploadLink = await getOrCreatePublicShareLink(nextcloudBaseFolder);
        }

        // 2. Upload naskah.md
        const parsedResult = JSON.parse(item.result_json || '{}');
        const { buildMarkdownContent } = await import('./export-builder');
        const markdownContent = buildMarkdownContent(parsedResult, batchId);
        const markdownNextcloudPath = `${nextcloudBaseFolder}/${filePrefix}_naskah.md`;
        await uploadBufferToNextcloud(Buffer.from(markdownContent, 'utf-8'), markdownNextcloudPath);

        // Backup copy for backward compatibility
        try {
          await uploadBufferToNextcloud(Buffer.from(markdownContent, 'utf-8'), `${nextcloudBaseFolder}/naskah.md`);
        } catch (_) {}

        // 3. Upload video clips per clip
        let clips = [];
        try {
          clips = JSON.parse(item.visual_clip_paths || '[]');
        } catch { }
        for (let i = 0; i < clips.length; i++) {
          const clipRelativePath = clips[i];
          const clipPath = path.join(process.cwd(), 'public', clipRelativePath);
          if (fs.existsSync(clipPath)) {
            const clipBuffer = fs.readFileSync(clipPath);
            const targetVideoClipPath = `${nextcloudBaseFolder}/${filePrefix}_video_clip_${i + 1}.mp4`;
            await uploadBufferToNextcloud(clipBuffer, targetVideoClipPath);
          }
        }

        // 3.b Upload start frame images to Nextcloud
        for (let i = 0; i < clips.length; i++) {
          const startFrameFilename = `start_frame_${item.id}_clip_${i + 1}.png`;
          const startFrameLocalPath = path.join(process.cwd(), 'public', 'uploads', 'start_frames', startFrameFilename);
          if (fs.existsSync(startFrameLocalPath)) {
            const startFrameBuffer = fs.readFileSync(startFrameLocalPath);
            const cloudStartFrameName = `${filePrefix}_start_frame_${i + 1}.png`;
            const targetStartFramePath = `${nextcloudBaseFolder}/${cloudStartFrameName}`;
            await uploadBufferToNextcloud(startFrameBuffer, targetStartFramePath);
          }
        }

        // 4. Upload audio clips per clip
        if (item.tts_batch_id && item.tts_batch_id !== 'skipped') {
          const ttsClips = await db.prepare("SELECT * FROM tts_studio_clips WHERE batch_id = ? AND status = 'completed'").all(item.tts_batch_id);
          for (const clip of ttsClips) {
            if (clip.audio_path) {
              const audioLocalPath = path.join(process.cwd(), 'public', clip.audio_path);
              if (fs.existsSync(audioLocalPath)) {
                const extension = clip.audio_path.split('.').pop() || 'mp3';
                const targetAudioClipPath = `${nextcloudBaseFolder}/${filePrefix}_audio_clip_${clip.clip_index + 1}.${extension}`;
                const audioBuffer = fs.readFileSync(audioLocalPath);
                await uploadBufferToNextcloud(audioBuffer, targetAudioClipPath);
              }
            }
          }
        }
        console.log(`[RE FFmpeg] Successfully uploaded all assets to Nextcloud folder: ${nextcloudBaseFolder}`);
      } catch (ncErr) {
        console.error('[RE FFmpeg] Nextcloud asset upload workflow failed:', ncErr.message);
      }
    }

    const filePrefix = getFilePrefixFromBatchId(batchId);
    const batchFolderName = batchId;

    if (storageProvider === 'nextcloud' && !hasNextcloud) {
      // Fallback if Nextcloud is selected as provider but not configured
      console.warn('[RE FFmpeg] Nextcloud selected as storage provider but nextcloud_url is not configured.');
    } else if (storageProvider !== 'nextcloud') {
      const { uploadVideoToFolder, uploadLocalFileToFolder, getOrCreateCampaignFolder, getOrCreateFolderInFolder } = await import('./drive-uploader');

      const parentFolderName = getCampaignParentFolderName(campaign, 'RE');
      const campaignFolderId = await getOrCreateCampaignFolder(parentFolderName, '');
      const batchFolderId = await getOrCreateFolderInFolder(batchFolderName, campaignFolderId);

      const finalVideoFileNameCloud = `${filePrefix}_video_final.mp4`;
      const uploaded = await uploadVideoToFolder(finalVideoPath, finalVideoFileNameCloud, batchFolderId);
      uploadLink = `https://drive.google.com/drive/folders/${batchFolderId}`;

      // Upload individual video clips to Google Drive
      let clips = [];
      try {
        clips = JSON.parse(item.visual_clip_paths || '[]');
      } catch { }
      for (let i = 0; i < clips.length; i++) {
        const clipRelativePath = clips[i];
        const clipPath = path.join(process.cwd(), 'public', clipRelativePath);
        if (fs.existsSync(clipPath)) {
          const clipFileName = `${filePrefix}_video_clip_${i + 1}.mp4`;
          await uploadLocalFileToFolder(clipPath, clipFileName, batchFolderId, 'video/mp4');
        }
      }

      // Upload start frame images to Google Drive
      for (let i = 0; i < clips.length; i++) {
        const startFrameFilename = `start_frame_${item.id}_clip_${i + 1}.png`;
        const startFrameLocalPath = path.join(process.cwd(), 'public', 'uploads', 'start_frames', startFrameFilename);
        if (fs.existsSync(startFrameLocalPath)) {
          const cloudStartFrameName = `${filePrefix}_start_frame_${i + 1}.png`;
          await uploadLocalFileToFolder(startFrameLocalPath, cloudStartFrameName, batchFolderId, 'image/png');
        }
      }

      // Upload audio clips to Google Drive if they exist
      if (item.tts_batch_id && item.tts_batch_id !== 'skipped') {
        try {
          const ttsClips = await db.prepare("SELECT * FROM tts_studio_clips WHERE batch_id = ? AND status = 'completed'").all(item.tts_batch_id);
          for (const clip of ttsClips) {
            if (clip.audio_path) {
              const audioLocalPath = path.join(process.cwd(), 'public', clip.audio_path);
              if (fs.existsSync(audioLocalPath)) {
                const audioFileName = `${filePrefix}_audio_clip_${clip.clip_index + 1}.mp3`;
                await uploadLocalFileToFolder(audioLocalPath, audioFileName, batchFolderId, 'audio/mpeg');
              }
            }
          }
        } catch (audioErr) {
          console.error(`[RE FFmpeg Drive Audio Upload] Failed to upload audio files:`, audioErr.message);
        }
      }

      // Upload naskah.md ke Google Drive jika result_json ada
      if (item.result_json) {
        try {
          const parsedResult = JSON.parse(item.result_json || '{}');
          const { buildMarkdownContent } = await import('./export-builder');
          const markdownContent = buildMarkdownContent(parsedResult, batchId);
          const tempMdPath = path.join(process.cwd(), 'public', 'temp', `${filePrefix}_naskah.md`);
          fs.writeFileSync(tempMdPath, markdownContent, 'utf-8');
          await uploadLocalFileToFolder(tempMdPath, `${filePrefix}_naskah.md`, batchFolderId, 'text/markdown');
          try {
            fs.unlinkSync(tempMdPath);
          } catch (_) {}
          console.log(`[RE FFmpeg] Successfully uploaded naskah.md to Google Drive: ${batchFolderId}`);
        } catch (mdErr) {
          console.error(`[RE FFmpeg Drive MD Upload] Failed:`, mdErr.message);
        }
      }
    }

    // Save copy to local storage
    const parentFolderName = getCampaignParentFolderName(campaign, 'RE');
    await saveFileToLocalStorage(finalVideoPath, `${parentFolderName}/${batchFolderName}`, `${filePrefix}_video_final.mp4`);

    // Save copies of audios to local storage
    if (item.tts_batch_id && item.tts_batch_id !== 'skipped') {
      try {
        const ttsClips = await db.prepare("SELECT * FROM tts_studio_clips WHERE batch_id = ? AND status = 'completed'").all(item.tts_batch_id);
        const subPath = `${parentFolderName}/${batchFolderName}`;
        for (const clip of ttsClips) {
          if (clip.audio_path) {
            const audioLocalPath = path.join(process.cwd(), 'public', clip.audio_path);
            const audioFileName = `${filePrefix}_audio_clip_${clip.clip_index + 1}.mp3`;
            await saveFileToLocalStorage(audioLocalPath, subPath, audioFileName);
          }
        }
      } catch (localAudioErr) {
        console.error(`[RE FFmpeg Local Audio Sync] Failed to copy audio to local storage:`, localAudioErr.message);
      }
    }

    const isSocialActive = campaign.enable_social_post === 1 || campaign.post_facebook_draft === 1;
    const finalSocialPostStatus = isSocialActive ? (campaign.fb_draft_mode === 'manual' ? 'skipped' : 'pending') : 'skipped';
    if (isSocialActive && campaign.fb_draft_mode === 'manual') {
      console.log(`[RE FFmpeg] FB Draft Mode is MANUAL. Skipping automatic social post step for item ${item.id}.`);
    }

    updateReCampaignItem(item.id, {
      upload_status: 'completed',
      drive_link: uploadLink,
      social_post_status: finalSocialPostStatus
    });

    // Update Google Sheet if target_spreadsheet_id is set
    if (campaign.target_spreadsheet_id) {
      try {
        const { getAuthorizedClient } = await import('./google-auth');
        const { google } = await import('googleapis');
        const { updateCell } = await import('./sheets-autopilot-worker');
        const auth = getAuthorizedClient();
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = campaign.target_spreadsheet_id;
        const sheetName = 'CAMPAIGN_RE';

        const { rowIndex, headers } = await findRowByUrl(sheets, spreadsheetId, sheetName, item.source_url);
        if (rowIndex > 0) {
          const statusIdx = headers.indexOf('pipeline_status');
          if (statusIdx !== -1) {
            await updateCell(sheets, spreadsheetId, sheetName, statusIdx, rowIndex, 'Completed');
          }
          const assetIdx = headers.indexOf('asset_url');
          if (assetIdx !== -1) {
            await updateCell(sheets, spreadsheetId, sheetName, assetIdx, rowIndex, uploadLink);
          }
          console.log(`[RE FFmpeg Sheet Update] Successfully updated status and video link on row ${rowIndex} in ${sheetName}.`);
        }
      } catch (sheetErr) {
        console.error('[RE FFmpeg Sheet Update] Failed to update Google Sheet:', sheetErr.message);
      }
    }

    // Auto-ingest completed RE video item to Content Flow API
    try {
      const { syncCampaignToContentFlow } = await import('./contentflow-ingest');
      await syncCampaignToContentFlow(item.campaign_id);
    } catch (cfErr) {
      console.warn('[RE FFmpeg Content Flow Sync] Warning:', cfErr.message);
    }

    return { processed: true, item_id: item.id, video_path: finalVideoPath, cloud_url: uploadLink };
  } catch (err) {
    updateReCampaignItem(item.id, { ffmpeg_status: 'failed', upload_status: 'failed' });
    const { logSystemError } = await import('./error-logger');
    logSystemError('RE FFmpeg', err, item.campaign_id);
    throw err;
  }
}


// ========================
// 11. RE CAMPAIGN SOCIAL POSTER PROCESSOR (Cost: 0) — V6.5
// Posts finalized video as drafts to active social accounts (YouTube, TikTok, Facebook)
// ========================
export async function processReSocialPoster(payload, job) {
  const { getNextPendingSocialPostItem, updateReCampaignItem, getReCampaign } = await import('./db');
  const { google } = await import('googleapis');
  const { getAuthorizedClient } = await import('./google-auth');
  const path = await import('path');

  const itemId = payload?.item_id;
  let item;
  if (itemId) {
    const { getDb } = await import('./db');
    const db = getDb();
    item = await db.prepare('SELECT * FROM re_campaign_items WHERE id = ?').get(itemId);
  } else {
    item = getNextPendingSocialPostItem();
  }
  if (!item) return { skip: true, reason: itemId ? `Item ${itemId} not found` : 'No pending RE campaign items for social posting' };

  const campaign = await getReCampaign(item.campaign_id);
  if (!campaign) return { skip: true, reason: `Campaign ${item.campaign_id} not found` };

  const isSocialActive = campaign.enable_social_post === 1 || campaign.post_facebook_draft === 1;
  if (!isSocialActive) {
    updateReCampaignItem(item.id, { social_post_status: 'skipped' });
    return { processed: true, item_id: item.id, message: 'Social Post is inactive. Skipped Social Post stage.' };
  }

  updateReCampaignItem(item.id, { social_post_status: 'processing' });

  const postYoutube = campaign.post_youtube_draft;
  const postTiktok = campaign.post_tiktok_draft;
  const postFacebook = campaign.post_facebook_draft;

  const parsed = JSON.parse(item.result_json || '{}');
  const results = {};

  try {
    // 1. YouTube Draft
    if (postYoutube === 1) {
      try {
        const auth = getAuthorizedClient();
        const youtube = google.youtube({ version: 'v3', auth });
        const { createReadStream } = await import('fs');

        const localVideoPath = path.join(process.cwd(), 'public', item.ffmpeg_output_path);

        const res = await youtube.videos.insert({
          part: 'snippet,status',
          requestBody: {
            snippet: {
              title: parsed.yt_title || `RE Campaign Video #${item.id}`,
              description: parsed.yt_desc || '',
              categoryId: '22'
            },
            status: {
              privacyStatus: 'private' // YouTube Draft
            }
          },
          media: {
            mimeType: 'video/mp4',
            body: createReadStream(localVideoPath)
          }
        });

        results.youtube = `https://studio.youtube.com/video/${res.data.id}/edit`;
      } catch (ytErr) {
        console.error('[Social Poster] YouTube upload failed:', ytErr.message);
        results.youtube_error = ytErr.message;
      }
    }

    // 2. TikTok Draft (Simulated Link since client-app review requires registered domain)
    if (postTiktok === 1) {
      results.tiktok = 'https://www.tiktok.com/creator-center/upload';
    }

    // 3. Real Facebook Page Draft Upload
    if (postFacebook === 1 || campaign.enable_social_post === 1) {
      try {
        const { postDraftToFacebookPage } = await import('./facebook-helper');
        const { getSetting } = await import('./db');

        let caption = parsed.ig_caption || parsed.instagram_caption || parsed.distribution_assets?.instagram_caption || parsed.distribution_assets?.ig_caption || parsed.caption_ig || parsed.headline || parsed.caption || parsed.script || parsed.short_desc || '';
        if (!caption && item.result_json) {
          try {
            const raw = JSON.parse(item.result_json);
            caption = raw.ig_caption || raw.instagram_caption || raw.distribution_assets?.instagram_caption || raw.distribution_assets?.ig_caption || raw.script || raw.headline || '';
          } catch (_) { }
        }
        if (!caption) {
          caption = `Draf Video RE Campaign - ${campaign.campaign_name} #${item.id}`;
        }

        let mediaType = 'text_only';
        let mediaUrl = null;

        const hasVideoFile = item.ffmpeg_output_path && item.ffmpeg_output_path !== 'skipped';
        if (hasVideoFile) {
          const publicServerUrl = campaign.facebook_server_url ? campaign.facebook_server_url.trim() : (getSetting('fb_server_url') || '').trim();
          if (publicServerUrl) {
            const cleanBase = publicServerUrl.endsWith('/') ? publicServerUrl.slice(0, -1) : publicServerUrl;
            const storageProvider = getSetting('storage_provider') || 'gdrive';

            if (storageProvider === 'nextcloud' && item.drive_link && item.drive_link.includes('/index.php/s/')) {
              const urlParts = item.drive_link.split('/index.php/s/');
              if (urlParts.length > 1) {
                const sharePath = '/index.php/s/' + urlParts[1];
                mediaUrl = cleanBase + sharePath;
                if (!mediaUrl.endsWith('/download')) {
                  mediaUrl = mediaUrl.endsWith('/') ? mediaUrl + 'download' : mediaUrl + '/download';
                }
                mediaType = 'video';
                console.log(`[RE Social Poster] Resolved Nextcloud public video URL: ${mediaUrl}`);
              }
            }

            if (!mediaUrl) {
              const cleanPath = item.ffmpeg_output_path.startsWith('/') ? item.ffmpeg_output_path : '/' + item.ffmpeg_output_path;
              mediaUrl = cleanBase + cleanPath;
              mediaType = 'video';
              console.log(`[RE Social Poster] Dispatching local video draft URL: ${mediaUrl}`);
            }
          } else {
            console.warn(`[RE Social Poster] Public server URL not configured. Bypassing video draft upload.`);
          }
        }

        const fbResult = await postDraftToFacebookPage({
          message: caption,
          mediaUrl,
          mediaType,
          pageId: campaign.facebook_page_id,
        });

        if (fbResult.success) {
          const firstPageId = (getSetting('fb_page_ids') || '').split(',')[0].trim();
          results.facebook = `https://business.facebook.com/latest/home?asset_id=${campaign.facebook_page_id || getSetting('fb_page_id') || firstPageId}`;
          results.fb_post_id = fbResult.fb_post_id;
        } else {
          results.facebook_error = fbResult.error;
        }
      } catch (fbErr) {
        console.error('[RE Social Poster] Facebook post draft error:', fbErr.message);
        results.facebook_error = fbErr.message;
      }
    }

    updateReCampaignItem(item.id, {
      social_post_status: 'completed',
      social_links_json: JSON.stringify(results)
    });

    return { processed: true, item_id: item.id, results };
  } catch (error) {
    updateReCampaignItem(item.id, { social_post_status: 'failed' });
    const { logSystemError } = await import('./error-logger');
    logSystemError('RE Social', error, item.campaign_id);
    throw error;
  }
}

// ========================
// 12. RE PLUS RECOMM PROCESSOR (Cost: 1) — V8.2
// Runs Google Search Grounding to source products from competitor URLs
// ========================
export async function processRePlusRecomm(payload, job) {
  const { runSourcingGroundingPipeline } = await import('./re-recomm-engine.js');
  let realPayload = payload;
  if (typeof realPayload === 'string') {
    try {
      realPayload = JSON.parse(realPayload);
    } catch (e) { }
  }
  const jobId = realPayload?.job_id;
  if (!jobId) {
    throw new Error('Payload must contain job_id');
  }
  await runSourcingGroundingPipeline(jobId);
  return { processed: true, job_id: jobId };
}

// ========================
// 13. RE MULTI-ANGLE GENERATION PROCESSOR (Cost: 1) — V8.3
// ========================
export async function processItemMultiAngle(itemId, angleCount) {
  const { getDb, updateReCampaignItem } = await import('./db');
  const { callGeminiAPI } = await import('./gemini');
  const { buildMultiAngleMultiplierPrompt } = await import('./prompts');
  const { parseGeminiJSON } = await import('./json-parser');

  const db = getDb();

  const item = await db.prepare(`
    SELECT i.*, c.target_product_id, c.campaign_name, c.is_bridging_active, c.visual_mode, c.bridge_at_clip, c.bridge_duration_clips, c.enable_tts, c.target_language
    FROM re_campaign_items i
    JOIN re_campaigns c ON i.campaign_id = c.id
    WHERE i.id = ?
  `).get(itemId);

  if (!item) {
    throw new Error(`Item ${itemId} not found`);
  }

  // Ambil data produk hanya jika is_bridging_active diaktifkan (bernilai 1)
  let product = null;
  if (item.is_bridging_active && item.target_product_id) {
    product = await db.prepare("SELECT * FROM product_extractions WHERE id = ?").get(item.target_product_id);
  }

  try {
    const originalAnalysis = item.result_json;
    const trendContext = item.campaign_name || "";

    // Kirim instruksi Multi-Angle ke Gemini
    const systemPrompt = buildMultiAngleMultiplierPrompt(
      originalAnalysis,
      angleCount,
      product,
      trendContext,
      item.visual_mode || 'pure_t2v',
      item.bridge_at_clip || 3,
      item.bridge_duration_clips || 0,
      item.enable_tts !== 0,
      item.target_language || 'id-ID'
    );

    // Call Gemini API
    const aiResponseText = await callGeminiAPI(systemPrompt);
    const generatedAngles = parseGeminiJSON(aiResponseText);

    // Simpan ke tabel isolasi
    await db.transaction(async () => {
      for (const angle of generatedAngles) {
        const angleVariantId = `reav_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        await db.prepare(`
          INSERT INTO re_item_angle_variants (
            id, re_item_id, angle_name, angle_category, matrix_strategy_used,
            system_targeting, voice_persona_assigned, angle_description, visual_tasks_json,
            tts_status, visual_status, ffmpeg_status, upload_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', 'pending', 'pending')
        `).run(
          angleVariantId,
          item.id,
          angle.angle_name,
          angle.angle_category,
          angle.matrix_strategy_used,
          angle.system_targeting,
          angle.voice_persona_assigned || 'none',
          angle.angle_description,
          JSON.stringify(angle.clips)
        );
      }
    })();

    // Tandai status parent item kampanye selesai agar local scheduler tidak tersendat
    updateReCampaignItem(item.id, {
      analyze_status: 'completed',
      tts_status: 'skipped',
      visual_status: 'skipped',
      ffmpeg_status: 'completed',
      upload_status: 'skipped',
      social_post_status: 'skipped'
    });
    console.log(`[RE+AM V8.3] Sukses melipatgandakan ${angleCount} variasi angle strategis untuk Item: ${itemId}`);
  } catch (error) {
    updateReCampaignItem(item.id, { analyze_status: 'failed' });
    console.error(`[RE+AM V8.3] Gagal membuat variasi angle untuk item ${itemId}:`, error);
    const { logSystemError } = await import('./error-logger');
    logSystemError('RE Multi-Angle', error, item.campaign_id);
    throw error;
  }
}

// ============================================================================
// V8.5: ORGANIC PILLAR CAMPAIGN PROCESSORS
// ============================================================================

export function overrideOPCCampaignIfMassProd(campaign, item) {
  if (campaign && Number(campaign.is_mass_production) === 1 && item.row_creative_payload) {
    try {
      const rowPayload = JSON.parse(item.row_creative_payload);
      campaign.content_pillar = rowPayload.content_pillar || campaign.content_pillar;
      campaign.custom_hook = rowPayload.custom_hook || campaign.custom_hook;
      campaign.visual_action_guideline = rowPayload.visual_action_guideline || campaign.visual_action_guideline;
      campaign.custom_instruction = (rowPayload.custom_instruction && rowPayload.custom_instruction.trim() !== '') ? rowPayload.custom_instruction : campaign.custom_instruction;
      if (rowPayload.product_ref_image_path) {
        campaign.product_ref_image_path = rowPayload.product_ref_image_path;
      }
      if (rowPayload.product_filename_declare) {
        campaign.product_filename_declare = rowPayload.product_filename_declare;
      }
    } catch (e) {
      console.warn('[OPC Scheduler] Failed to parse row_creative_payload:', e.message);
    }
  }
  return campaign;
}


export async function findOpcRowByHook(sheets, spreadsheetId, sheetName, headers, hookValue, defaultRowNum) {
  if (!spreadsheetId || !hookValue) {
    return defaultRowNum;
  }
  try {
    const hookIdx = headers.indexOf('hook');
    if (hookIdx === -1) {
      return defaultRowNum;
    }
    const rowsRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!A1:Z1000`
    });
    const rows = rowsRes.data.values;
    if (!rows) return defaultRowNum;

    const targetHook = hookValue.trim().toLowerCase();
    for (let r = 1; r < rows.length; r++) {
      const rowVal = (rows[r][hookIdx] || '').trim().toLowerCase();
      if (rowVal === targetHook) {
        console.log(`[OPC Sheets Match] Found matching row at index ${r + 1} for hook: "${hookValue.slice(0, 30)}..."`);
        return r + 1;
      }
    }
  } catch (err) {
    console.warn('[OPC Sheets Match] Failed to find row by hook:', err.message);
  }
  return defaultRowNum;
}


/**
 * Stage 0: JIT Product Sourcing for mass production campaigns
 */
export async function processRowProductSourcing(payload, job) {
  const { getPillarCampaignItem, updatePillarCampaignItem, getDb } = await import('./db');
  const { scrapeUrl, downloadECommerceImage } = await import('./url-scraper');
  const { buildProductSourcingPrompt } = await import('./prompts');
  const { executeWithKeyPool } = await import('./gemini');
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const { parseGeminiJSON } = await import('./json-parser');
  const path = await import('path');
  const fs = await import('fs');

  const db = getDb();
  const itemId = payload?.item_id;
  let item;
  if (itemId) {
    item = await db.prepare('SELECT * FROM pillar_campaign_items WHERE id = ?').get(itemId);
  } else {
    // global scheduler fallback
    item = await db.prepare(
      "SELECT i.* FROM pillar_campaign_items i JOIN pillar_campaigns c ON i.campaign_id = c.id WHERE i.generation_status = 'pending_sourcing' AND c.status = 'running' ORDER BY i.id ASC LIMIT 1"
    ).get();
  }

  if (!item) return { skip: true, reason: itemId ? `Item ${itemId} not found` : 'No pending sourcing items found' };

  let creativePayload;
  try {
    creativePayload = JSON.parse(item.row_creative_payload);
  } catch (e) {
    throw new Error(`Gagal memparse row_creative_payload untuk item ${item.id}: ${e.message}`);
  }

  const refImagePath = creativePayload.product_ref_image_path;
  const absoluteImagePath = refImagePath ? (refImagePath.startsWith('/') ? path.join(process.cwd(), 'public', refImagePath) : refImagePath) : null;
  const imageExists = absoluteImagePath && fs.existsSync(absoluteImagePath);

  // Cek apakah payload sudah memiliki nama produk (input manual) dan gambar produk yang benar-benar ada di disk
  if (
    creativePayload.product_name && creativePayload.product_name.trim() !== '' &&
    refImagePath && refImagePath.trim() !== '' &&
    imageExists
  ) {
    console.log(`[OPC Sourcing] Item ${item.id} sudah memiliki input produk manual dan gambar produk. Lewati sourcing.`);

    // Load missing packaging/visual prompt details from cache if URL is present
    const checkUrl = creativePayload.source_product_url;
    if (checkUrl && checkUrl.trim() !== '') {
      try {
        const existing = await db.prepare('SELECT * FROM product_extractions WHERE input_source = ? OR source_url = ?').get(checkUrl, checkUrl);
        if (existing) {
          creativePayload.packaging_type = creativePayload.packaging_type || existing.packaging_type || '';
          creativePayload.is_in_packaging = creativePayload.is_in_packaging !== undefined ? creativePayload.is_in_packaging : (existing.is_in_packaging || 0);
          creativePayload.t2i_prompt = creativePayload.t2i_prompt || existing.t2i_prompt || '';
          creativePayload.i2v_action_prompt = creativePayload.i2v_action_prompt || existing.i2v_action_prompt || '';
        }
      } catch (e) {
        console.error('[OPC Sourcing] Gagal memuat metadata tambahan saat bypass:', e.message);
      }
    }

    // Save to product_extractions if missing
    try {
      const url = creativePayload.source_product_url || 'Manual';
      const existing = await db.prepare('SELECT id FROM product_extractions WHERE product_name = ? AND (source_url = ? OR input_source = ?)').get(creativePayload.product_name, url, url);
      if (!existing) {
        const { createProductExtraction } = await import('./db.js');
        const { v4: uuidv4 } = await import('uuid');
        const dbProductData = {
          id: `pe_opc_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          input_source: url,
          is_url: url.startsWith('http') ? 1 : 0,
          product_name: creativePayload.product_name,
          product_description: creativePayload.product_desc || '',
          unique_selling_point: creativePayload.product_usp || '',
          target_audience: '',
          pain_point_solved: '',
          key_visuals_extracted: '[]',
          raw_response: 'OPC Bypassed Sourcing Auto-Save',
          category: 'OPC Campaign',
          tags: 'opc, manual-input',
          photo_url: refImagePath,
          source_url: url.startsWith('http') ? url : '',
          affiliate_link: '',
          raw_description: creativePayload.product_desc || ''
        };
        createProductExtraction(dbProductData);
        console.log(`[OPC Sourcing] Bypassed item saved product to database: ${dbProductData.id}`);
      }
    } catch (dbSaveErr) {
      console.error('[OPC Sourcing] Gagal menyimpan bypassed product ke database:', dbSaveErr.message);
    }

    updatePillarCampaignItem(item.id, {
      row_creative_payload: JSON.stringify(creativePayload),
      generation_status: 'pending'
    });
    return { success: true, bypassed: true };
  }

  const url = creativePayload.source_product_url;
  const directImgUrl = creativePayload.product_image_url;

  if ((!url || url.trim() === '') && directImgUrl && directImgUrl.trim() !== '') {
    console.log(`[OPC Sourcing] Mengunduh gambar produk langsung dari URL: ${directImgUrl}`);
    updatePillarCampaignItem(item.id, { generation_status: 'processing' });
    try {
      const safeFilename = `opc_${item.campaign_id}_row${creativePayload.row_number}_${Date.now()}.png`;
      const localImagePath = `/uploads/products/${safeFilename}`;
      const absoluteLocalPath = path.join(process.cwd(), 'public', 'uploads', 'products', safeFilename);

      const uploadsDir = path.dirname(absoluteLocalPath);
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      await downloadECommerceImage(directImgUrl, absoluteLocalPath);

      creativePayload.product_ref_image_path = localImagePath;
      creativePayload.product_filename_declare = safeFilename;

      updatePillarCampaignItem(item.id, {
        row_creative_payload: JSON.stringify(creativePayload),
        generation_status: 'pending'
      });

      console.log(`[OPC Sourcing] Pengunduhan gambar langsung berhasil untuk item ${item.id}. Status diubah ke pending.`);
      return { success: true };
    } catch (error) {
      updatePillarCampaignItem(item.id, { generation_status: 'failed' });
      console.error(`[OPC Sourcing] Gagal mengunduh gambar langsung untuk item ${item.id}:`, error);
      throw error;
    }
  }

  if (!url || url.trim() === '') {
    throw new Error(`Item ${item.id} dikonfigurasi untuk pending_sourcing tetapi source_product_url dan product_image_url keduanya kosong.`);
  }

  // === DATABASE CACHE CHECK ===
  // [Fix v2.2.89] Prioritas: clean_photo_url (dikurasi) > photo_url (raw/scraped)
  try {
    let existing = await db.prepare('SELECT * FROM product_extractions WHERE input_source = ? OR source_url = ?').get(url, url);

    // [Fix 3] Jika tidak ditemukan by URL, fallback by product_name (untuk produk yang sudah ada di DB)
    if (!existing) {
      const productNameToCheck = creativePayload.product_name?.trim();
      if (productNameToCheck) {
        existing = await db.prepare(
          'SELECT * FROM product_extractions WHERE LOWER(product_name) = LOWER(?) AND (clean_photo_url IS NOT NULL OR photo_url IS NOT NULL) ORDER BY created_at DESC LIMIT 1'
        ).get(productNameToCheck);
        if (existing) {
          console.log(`[OPC Sourcing] Fallback: menemukan cache produk by product_name "${productNameToCheck}" (tidak match by URL).`);
        }
      }
    }

    if (existing) {
      console.log(`[OPC Sourcing] Menemukan cache produk di database untuk URL: ${url}. Melewati JIT Sourcing.`);

      // [Fix 1] Prioritaskan clean_photo_url (gambar dikurasi) atas photo_url (gambar raw dari scrape)
      const bestRefImage = existing.clean_photo_url || existing.photo_url || null;

      creativePayload.product_name = creativePayload.product_name?.trim() || existing.product_name;
      creativePayload.product_desc = creativePayload.product_desc?.trim() || existing.product_description || '';
      creativePayload.product_usp = creativePayload.product_usp?.trim() || existing.unique_selling_point || '';
      creativePayload.product_ref_image_path = creativePayload.product_ref_image_path || bestRefImage;
      creativePayload.packaging_type = creativePayload.packaging_type || existing.packaging_type || '';
      creativePayload.is_in_packaging = creativePayload.is_in_packaging !== undefined ? creativePayload.is_in_packaging : (existing.is_in_packaging || 0);
      creativePayload.t2i_prompt = creativePayload.t2i_prompt || existing.t2i_prompt || '';
      creativePayload.i2v_action_prompt = creativePayload.i2v_action_prompt || existing.i2v_action_prompt || '';
      // Juga bawa product_truth & geometric_truth jika ada di DB
      creativePayload.product_truth = creativePayload.product_truth || existing.product_truth || '';
      creativePayload.geometric_truth = creativePayload.geometric_truth || existing.geometric_truth || '';

      // Extract filename dari best ref image
      if (!creativePayload.product_filename_declare && bestRefImage) {
        creativePayload.product_filename_declare = path.basename(bestRefImage);
      }

      updatePillarCampaignItem(item.id, {
        row_creative_payload: JSON.stringify(creativePayload),
        generation_status: 'pending'
      });

      return { success: true, cached: true };
    }
  } catch (dbCacheErr) {
    console.error('[OPC Sourcing] Gagal memproses pencarian cache produk:', dbCacheErr.message);
  }

  console.log(`[OPC Sourcing] Memulai JIT sourcing untuk item ${item.id} dengan URL: ${url}`);
  updatePillarCampaignItem(item.id, { generation_status: 'processing' });

  try {
    // 1. Scrape URL
    const scrapeResult = await scrapeUrl(url);

    // 2. Gemini Extraction
    const extractedData = await executeWithKeyPool(1, async (apiKey) => {
      const prompt = buildProductSourcingPrompt(scrapeResult.fullText, url);
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: GEMINI_MODELS.PRIMARY,
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json'
        }
      });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return parseGeminiJSON(text);
    });

    if (!extractedData.product_name) {
      throw new Error(`Gemini gagal mengekstrak product_name dari halaman produk.`);
    }

    if (!extractedData.scraped_image_url) {
      throw new Error(`Gemini gagal mengekstrak scraped_image_url dari halaman produk.`);
    }

    // 3. Download product image
    const safeFilename = `opc_${item.campaign_id}_row${creativePayload.row_number}_${Date.now()}.png`;
    const localImagePath = `/uploads/products/${safeFilename}`;
    const absoluteLocalPath = path.join(process.cwd(), 'public', 'uploads', 'products', safeFilename);

    console.log(`[OPC Sourcing] Mengunduh gambar produk dari ${extractedData.scraped_image_url} ke ${absoluteLocalPath}`);
    await downloadECommerceImage(extractedData.scraped_image_url, absoluteLocalPath);

    // 4. Update creative payload (preserve user manual inputs if they already exist in the CSV row)
    creativePayload.product_name = creativePayload.product_name?.trim() || extractedData.product_name;
    creativePayload.product_desc = creativePayload.product_desc?.trim() || extractedData.product_description || '';
    creativePayload.product_usp = creativePayload.product_usp?.trim() || extractedData.unique_selling_point || '';
    creativePayload.product_ref_image_path = creativePayload.product_ref_image_path || localImagePath;
    creativePayload.product_filename_declare = creativePayload.product_filename_declare || safeFilename;
    creativePayload.packaging_type = creativePayload.packaging_type || extractedData.packaging_type || '';
    creativePayload.is_in_packaging = creativePayload.is_in_packaging !== undefined ? creativePayload.is_in_packaging : (extractedData.is_in_packaging ? 1 : 0);
    creativePayload.t2i_prompt = creativePayload.t2i_prompt || extractedData.t2i_prompt || '';
    creativePayload.i2v_action_prompt = creativePayload.i2v_action_prompt || extractedData.i2v_action_prompt || '';

    updatePillarCampaignItem(item.id, {
      row_creative_payload: JSON.stringify(creativePayload),
      generation_status: 'pending'
    });

    // 5. Also save to product_extractions (Product Database) for future reuse
    try {
      const existing = await db.prepare('SELECT id FROM product_extractions WHERE input_source = ?').get(url);
      if (!existing) {
        const { createProductExtraction } = await import('./db');
        const { v4: uuidv4 } = await import('uuid');

        const dbProductData = {
          id: `pe_jit_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          input_source: url,
          is_url: 1,
          product_name: creativePayload.product_name,
          product_description: creativePayload.product_desc,
          unique_selling_point: creativePayload.product_usp,
          target_audience: extractedData.target_audience || '',
          pain_point_solved: extractedData.pain_point_solved || '',
          key_visuals_extracted: JSON.stringify(extractedData.key_visuals_extracted || []),
          raw_response: JSON.stringify(extractedData),
          category: 'OPC Sourcing',
          tags: 'opc, auto-scraped',
          photo_url: localImagePath,
          // [Fix 2 v2.2.89] Isi clean_photo_url sejak awal agar future cache lookup bisa prioritaskan gambar ini
          clean_photo_url: localImagePath,
          // product_truth & geometric_truth dikosongkan — bisa diisi manual di Products page
          product_truth: '',
          geometric_truth: '',
          source_url: url,
          affiliate_link: '',
          raw_description: scrapeResult.bodyText || scrapeResult.description || ''
        };
        createProductExtraction(dbProductData);
        console.log(`[OPC Sourcing] Saved scraped product to database: ${dbProductData.id}`);
      }
    } catch (dbSaveErr) {
      console.error('[OPC Sourcing] Gagal menyimpan ke database produk:', dbSaveErr.message);
    }

    console.log(`[OPC Sourcing] JIT sourcing berhasil untuk item ${item.id}. Status diubah ke pending.`);
    return { success: true };
  } catch (error) {
    const { logSystemError } = await import('./error-logger');
    logSystemError('OPC Sourcing', error, item.campaign_id);
    updatePillarCampaignItem(item.id, { generation_status: 'failed' });
    console.error(`[OPC Sourcing] Gagal melakukan sourcing produk untuk item ${item.id}:`, error);
    throw error;
  }
}

export async function processPillarGenerator(payload, job) {
  const { parseGeminiJSON } = await import('./json-parser');
  const { getPillarCampaignItem, updatePillarCampaignItem, getPillarCampaign, getSetting, getNextPendingPillarGeneratorItem, getDb } = await import('./db');
  const { buildOrganicPillarPrompt, WARDROBE_PRESETS, DEMOGRAPHIC_PRESETS, LIGHTING_PRESETS } = await import('./prompts');
  const { executeWithKeyPool } = await import('./gemini');
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const path = await import('path');

  const db = getDb();
  const itemId = payload?.item_id;
  let item;
  if (itemId) {
    item = await db.prepare('SELECT * FROM pillar_campaign_items WHERE id = ?').get(itemId);
  } else {
    item = await getNextPendingPillarGeneratorItem();
  }
  if (!item) return { skip: true, reason: itemId ? `Item ${itemId} not found` : 'No pending OPC items to generate storyboard' };

  const campaign = await getPillarCampaign(item.campaign_id);
  if (!campaign) return { skip: true, reason: `Campaign ${item.campaign_id} not found` };

  overrideOPCCampaignIfMassProd(campaign, item);

  await updatePillarCampaignItem(item.id, { generation_status: 'processing' });

  try {
    let brandConfig = null;
    if (campaign.brand_profile_id) {
      const { getBrandProfile } = await import('./db');
      brandConfig = await getBrandProfile(campaign.brand_profile_id);
    }

    const { getAllKnowledgeBasesWithContent } = await import('./db');
    let kbs = await getAllKnowledgeBasesWithContent();

    const isMassProd = Number(campaign.is_mass_production) === 1;
    const rowPayload = item.row_creative_payload ? JSON.parse(item.row_creative_payload) : {};

    // Load cartoon KB files if content world is cartoon_universe (Tahap 2)
    const effectiveContentWorld = rowPayload?.content_world || campaign.content_world || 'real_world';
    if (effectiveContentWorld === 'cartoon_universe') {
      try {
        const { readKbFile } = await import('./kb-loader.js');
        const cartoonKbFiles = ['PET_CONTENT_KB.md', 'CARTOON_UNIVERSE_STORY_ENGINE.md', 'CARTOON_VISUAL_CONTINUITY_KB.md'];
        const universeProfile = rowPayload?.universe_profile || campaign.universe_profile;
        if (universeProfile) cartoonKbFiles.push(`universes/${universeProfile.toUpperCase()}_UNIVERSE_PROFILE.md`);
        for (const file of cartoonKbFiles) {
          const content = readKbFile(file);
          if (content) kbs.push({ name: file.replace('.md', '').replace(/\//g, '_').toUpperCase(), content });
        }
        console.log(`[OPC Cartoon] Loaded ${cartoonKbFiles.length} cartoon KB files for item ${item.id}`);
      } catch (kbErr) {
        console.warn('[OPC Cartoon] Failed to load cartoon KBs:', kbErr.message);
      }
    }

    let visualOverrides = null;
    if (campaign.visual_overrides_json) {
      try {
        visualOverrides = JSON.parse(campaign.visual_overrides_json);
        if (visualOverrides) {
          visualOverrides = resolveVisualOverrides({
            visualOverrides,
            itemIndex: Math.max(0, Number(rowPayload.row_number || 1) - 1),
            stableSeed: `${campaign.id}:${item.id}`,
            rowOverride: rowPayload.wardrobe_color || ''
          });

          if (visualOverrides.lighting_style === 'random') {
            const lightingPresets = [
              'window_daylight', 'golden_hour', 'studio_softbox', 'cyber_neon'
            ];
            visualOverrides.lighting_style = lightingPresets[Math.floor(Math.random() * lightingPresets.length)];
          }
        }
      } catch (e) {
        console.warn('[Pillar Generator] Failed to parse visual_overrides_json:', e.message);
      }
    }

    let productData = null;
    let tempCampaign = { ...campaign };

    if (isMassProd) {
      // [Fix v2.2.88] Jika rowPayload tidak membawa product_truth/geometric_truth,
      // lakukan DB lookup ke product_extractions berdasarkan product_name
      // agar AI selalu menerima Truth Contract yang rigid dan tidak berhalusinasi bentuk kemasan
      let resolvedProductTruth = rowPayload.product_truth || '';
      let resolvedGeometricTruth = rowPayload.geometric_truth || '';
      let resolvedPackagingType = rowPayload.packaging_type || '';

      if (!resolvedProductTruth || !resolvedGeometricTruth) {
        const productName = rowPayload.product_name || rowPayload.target_product_name || '';
        if (productName) {
          const dbProd = await db.prepare(
            'SELECT product_truth, geometric_truth, packaging_type FROM product_extractions WHERE LOWER(product_name) = LOWER(?) LIMIT 1'
          ).get(productName);
          if (dbProd) {
            resolvedProductTruth = resolvedProductTruth || dbProd.product_truth || '';
            resolvedGeometricTruth = resolvedGeometricTruth || dbProd.geometric_truth || '';
            resolvedPackagingType = resolvedPackagingType || dbProd.packaging_type || '';
            console.log(`[OPC MassProd] Resolved truth from DB for "${productName}": product_truth=${!!resolvedProductTruth}, geometric_truth=${!!resolvedGeometricTruth}`);
          }
        }
      }

      productData = {
        product_name: rowPayload.product_name || rowPayload.target_product_name || '',
        product_description: rowPayload.product_desc || rowPayload.target_product_desc || '',
        unique_selling_point: rowPayload.product_usp || rowPayload.target_product_usp || '',
        packaging_type: resolvedPackagingType,
        is_in_packaging: rowPayload.is_in_packaging !== undefined ? rowPayload.is_in_packaging : 0,
        product_truth: resolvedProductTruth,
        geometric_truth: resolvedGeometricTruth,
        t2i_prompt: rowPayload.t2i_prompt || '',
        i2v_action_prompt: rowPayload.i2v_action_prompt || '',
        // [Fix v2.2.92] Teruskan filename & ref image yang sudah di-resolve Fix 4
        // ke productData agar buildProductTruthContractSection dapat menyertakan
        // "(Product Reference File: 'namafile.jpg')" di mandaten T2I AI
        product_filename_declare: tempCampaign.product_filename_declare || '',
        clean_photo_url: tempCampaign.product_ref_image_path || '',
      };
      tempCampaign.content_pillar = rowPayload.content_pillar || campaign.content_pillar;
      tempCampaign.custom_hook = rowPayload.custom_hook || campaign.custom_hook;
      tempCampaign.visual_action_guideline = rowPayload.visual_action_guideline || campaign.visual_action_guideline;
      tempCampaign.custom_instruction = (rowPayload.custom_instruction && rowPayload.custom_instruction.trim() !== '') ? rowPayload.custom_instruction : campaign.custom_instruction;
      tempCampaign.ai_directive = (rowPayload.ai_directive && rowPayload.ai_directive.trim() !== '')
        ? rowPayload.ai_directive
        : (campaign.ai_directive || campaign.custom_instruction || '');
      tempCampaign.mandatory_outro_line = rowPayload.mandatory_outro_line || campaign.mandatory_outro_line || '';

      // Forward universe metadata from row payload to campaign for prompt builder (Tahap 2)
      tempCampaign._rowPayload = rowPayload;
      if (rowPayload.content_world) tempCampaign.content_world = rowPayload.content_world;
      if (!tempCampaign.content_world) tempCampaign.content_world = campaign.content_world || 'real_world';
      if (!tempCampaign.universe_profile) tempCampaign.universe_profile = campaign.universe_profile || rowPayload.universe_profile || null;
      if (!tempCampaign.universe_snapshot_json) tempCampaign.universe_snapshot_json = campaign.universe_snapshot_json || null;
      if (!tempCampaign.story_template) tempCampaign.story_template = campaign.story_template || rowPayload.story_template || null;

      if (rowPayload.product_ref_image_path) {
        tempCampaign.product_ref_image_path = rowPayload.product_ref_image_path;
      }
      if (rowPayload.product_filename_declare) {
        tempCampaign.product_filename_declare = rowPayload.product_filename_declare;
      }

      // [Fix 4 v2.2.89] Cross-check ref image dari DB berdasarkan product_name
      // Jika ada clean_photo_url di product_extractions, selalu gunakan itu
      // untuk mencegah cross-contamination image antar-produk
      const resolvedProductName = rowPayload.product_name || rowPayload.target_product_name || '';
      if (resolvedProductName) {
        try {
          const dbImg = await db.prepare(
            "SELECT clean_photo_url, photo_url FROM product_extractions WHERE LOWER(product_name) = LOWER(?) AND clean_photo_url IS NOT NULL AND clean_photo_url != '' LIMIT 1"
          ).get(resolvedProductName);
          if (dbImg?.clean_photo_url) {
            // Verifikasi file ada di disk sebelum override
            const imgPath = require('path').join(process.cwd(), 'public', dbImg.clean_photo_url.replace(/^\//, ''));
            if (require('fs').existsSync(imgPath)) {
              tempCampaign.product_ref_image_path = dbImg.clean_photo_url;
              tempCampaign.product_filename_declare = require('path').basename(dbImg.clean_photo_url);
              
              // Simpan berkas hasil koreksi ke database agar UI (Tab 1) tersinkronisasi secara otomatis
              await db.prepare('UPDATE pillar_campaigns SET product_ref_image_path = ? WHERE id = ?').run(dbImg.clean_photo_url, campaign.id);
              
              console.log(`[OPC MassProd] Fix4: Ref image overridden from DB clean_photo_url for "${resolvedProductName}": ${dbImg.clean_photo_url}`);
            }
          }
        } catch (refImgErr) {
          console.warn('[OPC MassProd] Fix4: Gagal cross-check ref image dari DB:', refImgErr.message);
        }
      }
    } else {
      productData = await resolveProductData(campaign);
    }


    const { generateContentFlexible } = await import('./gemini');
    const result = await executeWithKeyPool(1, async (apiKey) => {
      const prompt = buildOrganicPillarPrompt(kbs, tempCampaign, productData, brandConfig, visualOverrides);
      return await generateContentFlexible({
        prompt,
        modelName: GEMINI_MODELS.PRIMARY,
        timeoutMs: 180000,
        apiKey
      });
    });

    const parsedRaw = parseGeminiJSON(result, campaign.voice_provider || 'gemini');
    const { sanitizeAiDirectiveLeak, containsAiDirectiveLeak } = await import('./ai-directive.js');
    const effectiveAiDirective = tempCampaign.ai_directive || tempCampaign.custom_instruction || '';
    const parsed = sanitizeAiDirectiveLeak(parsedRaw, effectiveAiDirective);
    if (containsAiDirectiveLeak(parsed, effectiveAiDirective)) {
      throw new Error('AI_DIRECTIVE_LEAK_DETECTED');
    }

    // Cartoon continuity validation (Tahap 2) — non-blocking warnings
    if (effectiveContentWorld === 'cartoon_universe') {
      try {
        const { validateCartoonContinuity, logValidationResults } = await import('./cartoon-continuity-validator.js');
        let universeSnapshot = null;
        try {
          universeSnapshot = campaign.universe_snapshot_json ? JSON.parse(campaign.universe_snapshot_json) : null;
        } catch (_) {}
        const validationResult = validateCartoonContinuity(parsed, universeSnapshot, rowPayload);
        logValidationResults(item.id, validationResult);
      } catch (valErr) {
        console.warn('[OPC Cartoon] Continuity validation failed (non-blocking):', valErr.message);
      }
    }

    const visualMode = campaign.visual_mode || 'hybrid_lock';
    if (visualMode === 'hybrid_lock') {
      parsed.t2v_prompts = [];
    } else {
      parsed.t2i_prompts = [];
      parsed.i2v_prompts = [];
    }

    // Map output to unified new_video_plan_json format
    const storyboardList = parsed.storyboard || [];
    const voiceoverList = parsed.voiceover || [];
    const t2iPrompts = parsed.t2i_prompts || [];
    const t2vPrompts = parsed.t2v_prompts || [];
    const i2vPrompts = parsed.i2v_prompts || [];

    const applyReplacements = (promptStr) => {
      if (!promptStr) return '';
      let s = promptStr;
      if (visualOverrides) {
        const isMascotUniverse = visualOverrides.subject_demographic?.startsWith('mascot_universe_');
        const targetCharacter = isMascotUniverse
          ? 'a 3D stylized cartoon character'
          : (visualOverrides.subject_demographic === 'custom'
            ? visualOverrides.subject_demographic_custom
            : (DEMOGRAPHIC_PRESETS[visualOverrides.subject_demographic] || 'a graceful Muslimah'));
        const targetWardrobe = isMascotUniverse
          ? 'organic clay textures'
          : (visualOverrides.wardrobe_style === 'custom'
            ? visualOverrides.wardrobe_style_custom
            : (WARDROBE_PRESETS[visualOverrides.wardrobe_style] || 'modest clothing'));
        const targetLighting = visualOverrides.lighting_style === 'custom'
          ? visualOverrides.lighting_style_custom
          : (LIGHTING_PRESETS[visualOverrides.lighting_style] || 'soft natural light');

        s = s.replace(/\[Subject Anchor\]/g, targetCharacter);
        s = s.replace(/\[MANDATE 29 - 3-Point Character Lock\]/g, targetCharacter);
        s = s.replace(/\[Wardrobe Lock\]/g, targetWardrobe);
        s = s.replace(/\[Lighting Mood\]/g, targetLighting);

        // Only perform force-overwrite regex replacements for human demographics
        if (!isMascotUniverse) {
          if (!/\(Wardrobe:/i.test(s)) {
            s = s.replace(/\((?:Anchor|Biometric Anchor|Subject):\s*([^\)]+)\)(?=\s*(?:,|\.|\[|\(|\n|$))/i, `(Anchor: $1), (Wardrobe: ${targetWardrobe})`);
          } else {
            s = s.replace(/\(Wardrobe:\s*.*?\)(?=\s*(?:,|\.|\[|\(|\n|$))/gi, `(Wardrobe: ${targetWardrobe})`);
          }
          s = s.replace(/\((?:Biometric Anchor|Anchor|Subject):\s*.*?\)(?=\s*(?:,|\.|\[|\(|\n|$))/gi, `(Biometric Anchor: ${targetCharacter})`);
          s = s.replace(/\(Lighting:\s*.*?\)(?=\s*(?:,|\.|\[|\(|\n|$))/gi, `(Lighting: ${targetLighting})`);
        }
      }
      return s;
    };

    const newVideoPlan = storyboardList.map((s, idx) => {
      const clipNum = s.scene || (idx + 1);
      const voEntry = voiceoverList.find(v => Number(v.scene) === Number(clipNum)) || {};
      const vo = voEntry.narration || '';
      const voice_segments = voEntry.voice_segments || null;
      
      let rawT2i = '';
      const foundT2i = t2iPrompts.find(p => p && typeof p === 'object' && Number(p.clip) === Number(clipNum));
      if (foundT2i) {
        rawT2i = foundT2i.prompt || '';
      } else if (typeof t2iPrompts[clipNum - 1] === 'string') {
        rawT2i = t2iPrompts[clipNum - 1];
      } else if (t2iPrompts[clipNum - 1] && typeof t2iPrompts[clipNum - 1] === 'object') {
        rawT2i = t2iPrompts[clipNum - 1].prompt || '';
      }
      const t2i = applyReplacements(rawT2i);

      let rawT2v = '';
      const foundT2v = t2vPrompts.find(p => p && typeof p === 'object' && (Number(p.clip) === Number(clipNum) || (p.scenes_covered && p.scenes_covered.split(',').map(Number).includes(Number(clipNum)))));
      if (foundT2v) {
        rawT2v = foundT2v.prompt || '';
      } else if (typeof t2vPrompts[clipNum - 1] === 'string') {
        rawT2v = t2vPrompts[clipNum - 1];
      } else if (t2vPrompts[clipNum - 1] && typeof t2vPrompts[clipNum - 1] === 'object') {
        rawT2v = t2vPrompts[clipNum - 1].prompt || '';
      }
      const t2v = applyReplacements(rawT2v);

      let rawI2v = '';
      const foundI2v = i2vPrompts.find(p => p && typeof p === 'object' && Number(p.clip) === Number(clipNum));
      if (foundI2v) {
        rawI2v = foundI2v.prompt || '';
      } else if (typeof i2vPrompts[clipNum - 1] === 'string') {
        rawI2v = i2vPrompts[clipNum - 1];
      } else if (i2vPrompts[clipNum - 1] && typeof i2vPrompts[clipNum - 1] === 'object') {
        rawI2v = i2vPrompts[clipNum - 1].prompt || '';
      }
      const i2v = applyReplacements(rawI2v);

      return {
        clip_index: clipNum,
        visual_action: s.visual_description || '',
        new_vo: vo,
        voice_segments: voice_segments,
        t2i_prompt: t2i,
        t2v_prompt: t2v,
        i2v_prompt: i2v
      };
    });

    const videoDna = parsed.video_dna || {
      pilar_konten: campaign.content_pillar || '',
      hook_type: 'Pertanyaan',
      visual_style: campaign.visual_style || 'Cinematic',
      signature_moment: 'None',
      camera_pace: 'Static',
      primary_emotion: 'Santai',
      affiliate_integration: campaign.is_bridging_active ? 'Problem Solver' : 'None',
      affiliate_mention: campaign.is_bridging_active ? 'Both' : 'None',
      scene_count: campaign.target_clips_count || 4,
      cta_type: 'Buy Now'
    };

    const targetClips = campaign.target_clips_count || 4;
    // 1. Run VO compliance checker if enabled
    const voiceover = newVideoPlan.map((p, idx) => ({
      scene: p.clip_index || (idx + 1),
      narration: p.new_vo || "",
      duration: "8s",
      cta_facebook: p.cta_facebook || "",
      cta_tiktok: p.cta_tiktok || "",
      voice_segments: p.voice_segments || null
    }));

    // JIT Dynamic Voice Cast Registration for OPC Campaigns
    if (campaign.enable_audio_segment === 1) {
      console.log(`[JIT Voice Cast] OPC Item #${item.id}: Memeriksa naskah untuk pendaftaran karakter otonom...`);
      const { registerJitVoiceCast } = await import('./minimax-tts');
      const updatedVoiceCastJson = registerJitVoiceCast(
        campaign.voice_cast_json,
        voiceover,
        campaign.target_language || 'id-ID',
        campaign.voice_provider || 'minimax'
      );
      if (updatedVoiceCastJson) {
        console.log(`[JIT Voice Cast] OPC Item #${item.id}: Karakter baru ditemukan! Mendaftarkan ke database kampanye...`);
        await db.prepare('UPDATE pillar_campaigns SET voice_cast_json = ? WHERE id = ?').run(updatedVoiceCastJson, campaign.id);
        campaign.voice_cast_json = updatedVoiceCastJson;
      }
    }

    if (campaign.enable_vo_audit === 1) {
      try {
        console.log(`[OPC Generator] Item #${item.id}: Running TikTok safe VO compliance checker...`);
        const fullOriginalVo = voiceover.map(v => v.narration || '').join('\n');
        const captionText = parsed.caption || parsed.new_caption || '';

        const { auditScriptForTikTok } = await import('./tiktok-compliance-service.js');
        const auditResult = await auditScriptForTikTok(fullOriginalVo, captionText);

        const hasSafeRevisions = Array.isArray(auditResult.revised_script) && auditResult.revised_script.length > 0;
        const autoRewriteNeeded = (auditResult.status === 'revise' || auditResult.status === 'block' || auditResult.verdict === 'revise' || auditResult.verdict === 'block') && hasSafeRevisions;

        const safeVoiceover = voiceover.map((v, idx) => ({
          ...v,
          narration: (hasSafeRevisions && auditResult.revised_script[idx] !== undefined && auditResult.revised_script[idx].trim() !== '')
            ? auditResult.revised_script[idx].trim()
            : (v.narration || '')
        }));

        if (autoRewriteNeeded) {
          console.log(`[OPC Generator] Item #${item.id}: Applying Closed-Loop Auto-Rewrite for compliance (safe script applied).`);
          voiceover = safeVoiceover;
          if (parsed && Array.isArray(parsed.voiceover)) {
            parsed.voiceover = safeVoiceover;
          }
          newVideoPlan = newVideoPlan.map((vp, idx) => ({
            ...vp,
            narration: safeVoiceover[idx]?.narration || vp.narration
          }));
        }

        updatePillarCampaignItem(item.id, {
          original_voiceover: JSON.stringify(voiceover),
          tiktok_safe_voiceover: JSON.stringify(safeVoiceover),
          compliance_status: auditResult.status || auditResult.verdict || 'pass',
          compliance_score: auditResult.risk_level || auditResult.risk_score || 'low',
          compliance_log_json: JSON.stringify(auditResult),
          selected_vo_version: autoRewriteNeeded ? 'tiktok_safe' : 'original'
        });

        console.log(`[OPC Generator] Item #${item.id}: Compliance audit finished with verdict ${auditResult.status || auditResult.verdict || 'pass'}`);
      } catch (err) {
        console.error('[OPC Generator] Compliance audit failed:', err.message);
        updatePillarCampaignItem(item.id, {
          compliance_status: 'failed',
          compliance_log_json: JSON.stringify({ error: err.message })
        });
      }
    } else {
      updatePillarCampaignItem(item.id, {
        original_voiceover: JSON.stringify(voiceover),
        tiktok_safe_voiceover: JSON.stringify(voiceover),
        compliance_status: 'skipped'
      });
    }

    let t2iImagePaths = [];
    for (let c = 1; c <= targetClips; c++) {
      t2iImagePaths.push("");
    }

    const shouldRunT2i = campaign.visual_mode === 'hybrid_lock';
    if (shouldRunT2i) {
      console.log(`[OPC Analyzer T2I] Mode hybrid_lock aktif. Memulai pre-rendering T2I untuk seluruh ${targetClips} klip...`);
      try {
        const { generateImage, getTaskStatus, getFileUrl } = await import('./webhook-client');
        const brandProfile = await db.prepare('SELECT * FROM brand_profiles WHERE LOWER(brand_name) = LOWER(?)').get(campaign.account_name || '');
        const path = await import('path');
        const fs = await import('fs');

        const fileToBase64 = (filePath) => {
          if (!filePath) return null;
          const absolutePath = (!path.isAbsolute(filePath) || !fs.existsSync(filePath)) ? path.join(process.cwd(), 'public', filePath.startsWith('/') ? filePath.slice(1) : filePath) : filePath;
          if (!fs.existsSync(absolutePath)) return null;
          const buffer = fs.readFileSync(absolutePath);
          let mimeType = 'image/png';
          if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
            mimeType = 'image/jpeg';
          } else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
            mimeType = 'image/png';
          } else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
            mimeType = 'image/webp';
          }
          return `data:${mimeType};base64,${buffer.toString('base64')}`;
        };

        const imageModel = getSetting('webhook_image_model') || 'nano_banana_pro';
        const productBase64 = resolveProductBase64(tempCampaign, productData, rowPayload);
        if (productBase64) {
          console.log(`[OPC Analyzer T2I] ✅ Product Base64 resolved successfully for bridging clip reference.`);
        } else {
          console.log(`[OPC Analyzer T2I] ⚠️ Product Base64 null for campaign — bridging clips will render pure T2I.`);
        }

        const t2iPattern = getSetting('webhook_t2i_pattern') || 'threading';
        console.log(`[OPC Analyzer T2I] Using Pola T2I: ${t2iPattern}`);
        const bridgeAtClip = campaign.bridge_at_clip || 2;
        const bridgeDurationClips = campaign.bridge_duration_clips !== undefined ? Number(campaign.bridge_duration_clips) : 1;
        const productEndClip = bridgeDurationClips > 0 ? (bridgeAtClip + bridgeDurationClips - 1) : bridgeAtClip;

        if (t2iPattern === 'sequential') {
          // --- SEQUENTIAL PATTERN ---
          for (let c = 1; c <= targetClips; c++) {
            const t2iPromptText = newVideoPlan.find(p => Number(p.clip_index) === c)?.t2i_prompt || "";
            if (t2iPromptText) {
              try {
                console.log(`[OPC Analyzer T2I] [Sequential] Submitting T2I task for clip ${c}...`);
                const isBridge = (c >= bridgeAtClip && c <= productEndClip);
                const t2iResult = await generateImage({
                  prompt: t2iPromptText,
                  model: imageModel,
                  aspect_ratio: campaign.aspect_ratio || '9:16',
                  reference_images: (isBridge && productBase64) ? [productBase64] : undefined,
                  webhookOverride: brandProfile
                });

                if (t2iResult?.task_id) {
                  const t2iTaskId = t2iResult.task_id;
                  console.log(`[OPC Analyzer T2I] [Sequential] T2I task ${t2iTaskId} submitted. Polling status...`);

                  // Immediately poll for this clip status
                  let isCompleted = false;
                  const maxAttempts = 30; // 60s
                  for (let attempt = 0; attempt < maxAttempts; attempt++) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    const statusResult = await getTaskStatus(t2iTaskId);
                    const taskStatus = (statusResult?.status || '').toLowerCase();

                    if (taskStatus === 'completed') {
                      const files = statusResult.results || statusResult.files || [];
                      let imageFile = files.find(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')) || files[0];
                      if (imageFile && (imageFile.startsWith('http://') || imageFile.startsWith('https://'))) {
                        imageFile = imageFile.split('/').pop();
                      }
                      if (imageFile) {
                        const completedUrl = getFileUrl(imageFile, t2iTaskId);
                        try {
                          const imgResponse = await fetch(completedUrl);
                          if (imgResponse.ok) {
                            const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
                            const startFrameFilename = `opc_start_frame_${item.id}_clip_${c}.png`;
                            const startFrameLocalPath = path.join(process.cwd(), 'public', 'uploads', 'start_frames', startFrameFilename);
                            const startFrameDir = path.dirname(startFrameLocalPath);
                            if (!fs.existsSync(startFrameDir)) {
                              fs.mkdirSync(startFrameDir, { recursive: true });
                            }
                            fs.writeFileSync(startFrameLocalPath, imgBuffer);
                            t2iImagePaths[c - 1] = `/uploads/start_frames/${startFrameFilename}`;
                            console.log(`[OPC Analyzer T2I] [Sequential] Saved image for clip ${c}: ${t2iImagePaths[c - 1]}`);
                          } else {
                            console.warn(`[OPC Analyzer T2I] [Sequential] Failed to download image for clip ${c}: status ${imgResponse.status}`);
                          }
                        } catch (err) {
                          console.warn(`[OPC Analyzer T2I] [Sequential] Failed to download image for clip ${c}:`, err.message);
                        }
                        isCompleted = true;
                        break;
                      }
                    } else if (taskStatus === 'failed') {
                      console.error(`[OPC Analyzer T2I] [Sequential] T2I task ${t2iTaskId} failed for clip ${c}`);
                      isCompleted = true;
                      break;
                    }
                  }
                }
              } catch (err) {
                console.error(`[OPC Analyzer T2I] [Sequential] Error processing clip ${c}:`, err.message);
              }
            }
          }
        } else {
          // --- THREADING PATTERN (Default) ---
          const submittedTasks = [];
          for (let c = 1; c <= targetClips; c++) {
            const t2iPromptText = newVideoPlan.find(p => Number(p.clip_index) === c)?.t2i_prompt || "";
            if (t2iPromptText) {
              try {
                console.log(`[OPC Analyzer T2I] [Threading] Submitting T2I task for clip ${c}...`);
                const isBridge = (c >= bridgeAtClip && c <= productEndClip);
                const t2iResult = await generateImage({
                  prompt: t2iPromptText,
                  model: imageModel,
                  aspect_ratio: campaign.aspect_ratio || '9:16',
                  reference_images: (isBridge && productBase64) ? [productBase64] : undefined,
                  webhookOverride: brandProfile
                });

                if (t2iResult?.task_id) {
                  const t2iTaskId = t2iResult.task_id;
                  console.log(`[OPC Analyzer T2I] [Threading] T2I task ${t2iTaskId} submitted for clip ${c}.`);
                  submittedTasks.push({ clipIndex: c, taskId: t2iTaskId, completed: false, imageUrl: null, failed: false });
                }
              } catch (err) {
                console.warn(`[OPC Analyzer T2I] [Threading] Failed to submit T2I for clip ${c}:`, err.message);
              }

              // Safety delay 5-10s before next clip
              if (c < targetClips) {
                const delayMs = 5000 + Math.floor(Math.random() * 5000);
                await new Promise(resolve => setTimeout(resolve, delayMs));
              }
            }
          }

          if (submittedTasks.length > 0) {
            console.log(`[OPC Analyzer T2I] [Threading] Starting batch polling for ${submittedTasks.length} T2I tasks...`);
            const maxT2iAttempts = 40; // 80s
            for (let attempt = 0; attempt < maxT2iAttempts; attempt++) {
              let allFinished = true;
              for (const task of submittedTasks) {
                if (task.completed || task.failed) continue;
                allFinished = false;
                try {
                  const statusResult = await getTaskStatus(task.taskId);
                  const taskStatus = (statusResult?.status || '').toLowerCase();
                  if (taskStatus === 'completed') {
                    const files = statusResult.results || statusResult.files || [];
                    let imageFile = files.find(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')) || files[0];
                    if (imageFile && (imageFile.startsWith('http://') || imageFile.startsWith('https://'))) {
                      imageFile = imageFile.split('/').pop();
                    }
                    if (imageFile) {
                      task.imageUrl = getFileUrl(imageFile, task.taskId);
                      task.completed = true;
                      console.log(`[OPC Analyzer T2I] [Threading] T2I task ${task.taskId} for clip ${task.clipIndex} completed!`);
                    }
                  } else if (taskStatus === 'failed') {
                    task.failed = true;
                    console.warn(`[OPC Analyzer T2I] [Threading] T2I task ${task.taskId} for clip ${task.clipIndex} failed.`);
                  }
                } catch (err) {
                  console.warn(`[OPC Analyzer T2I] [Threading] Error polling task ${task.taskId}:`, err.message);
                }
              }
              if (allFinished) break;
              await new Promise(resolve => setTimeout(resolve, 2000));
            }

            for (const task of submittedTasks) {
              if (task.completed && task.imageUrl) {
                try {
                  console.log(`[OPC Analyzer T2I] [Threading] Downloading start frame for clip ${task.clipIndex} from ${task.imageUrl}...`);
                  const imgResponse = await fetch(task.imageUrl);
                  if (imgResponse.ok) {
                    const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
                    const startFrameFilename = `opc_start_frame_${item.id}_clip_${task.clipIndex}.png`;
                    const startFrameLocalPath = path.join(process.cwd(), 'public', 'uploads', 'start_frames', startFrameFilename);
                    const startFrameDir = path.dirname(startFrameLocalPath);
                    if (!fs.existsSync(startFrameDir)) {
                      fs.mkdirSync(startFrameDir, { recursive: true });
                    }
                    fs.writeFileSync(startFrameLocalPath, imgBuffer);
                    t2iImagePaths[task.clipIndex - 1] = `/uploads/start_frames/${startFrameFilename}`;
                  }
                } catch (err) {
                  console.warn(`[OPC Analyzer T2I] [Threading] Failed to download image for clip ${task.clipIndex}:`, err.message);
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('[OPC Analyzer T2I] Error during pre-rendering T2I:', err);
      }
    }

    if (visualOverrides) parsed.resolved_visual_overrides = visualOverrides;

    updatePillarCampaignItem(item.id, {
      generation_status: 'completed',
      result_json: JSON.stringify(parsed),
      new_video_plan_json: JSON.stringify(newVideoPlan),
      video_dna_json: JSON.stringify(videoDna),
      t2i_images_json: JSON.stringify(t2iImagePaths),
      workflow_status: campaign.execution_mode === 'full_autopilot' ? 'production_processing' : 'ready_for_review'
    });

    // OPC Google Drive & Spreadsheet Sync (v8.5.1)
    let driveUrl = '';
    const { shouldSyncGoogleSheets } = await import('./google-auth.js');
    const uploadSpreadsheet = shouldSyncGoogleSheets();
    const uploadMarkdown = true;

    if (uploadSpreadsheet || uploadMarkdown) {
      try {
        const { google } = await import('googleapis');
        const { getAuthorizedClient } = await import('./google-auth');
        const { createSpreadsheet, getOrCreateCampaignFolder, uploadMarkdownToCampaignFolder } = await import('./drive-uploader');
        const {
          buildMarkdownContent
        } = await import('./export-builder');

        const auth = getAuthorizedClient();
        const sheets = google.sheets({ version: 'v4', auth });

        const batchId = await getOpcBatchId(campaign, item, db);
        const campaignItems = await db.prepare('SELECT id FROM pillar_campaign_items WHERE campaign_id = ? ORDER BY id ASC').all(campaign.id);
        const itemIndex = campaignItems.findIndex(i => i.id === item.id);
        const sequenceNumber = itemIndex !== -1 ? itemIndex + 1 : 1;
        const paddedIndex = String(sequenceNumber).padStart(3, '0');

        const fullResult = {
          id: item.id.toString(),
          source_type: 'pillar_campaign',
          source_url: campaign.content_pillar || '',
          video_filename: campaign.campaign_name,
          custom_instruction: campaign.custom_instruction || '',
          aspect_ratio: campaign.aspect_ratio || '9:16',
          target_ai: campaign.target_ai || 'Google Veo (8s)',
          prompt_output_format: 'plain_text',
          storyboard: parsed.storyboard || [],
          voiceover: parsed.voiceover || [],
          t2v_prompts: parsed.t2v_prompts || [],
          t2i_prompts: parsed.t2i_prompts || [],
          i2v_prompts: parsed.i2v_prompts || [],
          tiktok_caption: parsed.tiktok_caption || '',
          ig_caption: parsed.ig_caption || '',
          yt_title: parsed.yt_title || '',
          yt_desc: parsed.yt_desc || '',
          tanggal_dibuat: new Date().toISOString()
        };

        let targetSpreadsheetId = campaign.target_spreadsheet_id;
        let folderUrl = '';

        const storageProvider = getSetting('storage_provider') || 'gdrive';
        const parentFolderName = getCampaignParentFolderName(campaign, 'OPC', db);

        if (uploadMarkdown) {
          console.log(`[Pillar Generator] Uploading markdown for batch ${batchId}...`);
          const markdownContent = buildMarkdownContent(fullResult, batchId);
          const filename = `${batchId}_naskah.md`;

          if (storageProvider === 'nextcloud') {
            const { uploadBufferToNextcloud, getOrCreatePublicShareLink } = await import('./nextcloud-helper');
            const targetFolder = getCampaignNextcloudTargetFolder(campaign);
            const nextcloudBaseFolder = `${targetFolder}/${parentFolderName}/${batchId}`.replace(/\/+/g, '/');
            const targetPath = `${nextcloudBaseFolder}/${filename}`;

            const uploaded = await uploadBufferToNextcloud(Buffer.from(markdownContent, 'utf-8'), targetPath);
            driveUrl = uploaded.fileUrl;
            folderUrl = await getOrCreatePublicShareLink(nextcloudBaseFolder);

            if (tempCampaign.product_ref_image_path) {
              const absoluteImagePath = path.join(process.cwd(), 'public', tempCampaign.product_ref_image_path);
              const { default: fs } = await import('fs');
              if (fs.existsSync(absoluteImagePath)) {
                console.log(`[Pillar Generator] Uploading product image to Nextcloud subfolder for batch ${batchId}...`);
                const imageBuffer = fs.readFileSync(absoluteImagePath);
                const imageFilename = `${batchId}_product_image.png`;
                await uploadBufferToNextcloud(imageBuffer, `${nextcloudBaseFolder}/${imageFilename}`);
              }
            }
          } else {
            const { getOrCreateCampaignFolder, getOrCreateFolderInFolder } = await import('./drive-uploader');
            const campaignFolderId = await getOrCreateCampaignFolder(parentFolderName, '');
            const batchFolderId = await getOrCreateFolderInFolder(batchId, campaignFolderId);
            folderUrl = `https://drive.google.com/drive/folders/${batchFolderId}`;

            // Upload product image to this subfolder if it exists
            if (tempCampaign.product_ref_image_path) {
              const { uploadLocalFileToFolder } = await import('./drive-uploader');
              const absoluteImagePath = path.join(process.cwd(), 'public', tempCampaign.product_ref_image_path);
              const { default: fs } = await import('fs');
              if (fs.existsSync(absoluteImagePath)) {
                console.log(`[Pillar Generator] Uploading product image to subfolder for batch ${batchId}...`);
                await uploadLocalFileToFolder(
                  absoluteImagePath,
                  `${batchId}_product_image.png`,
                  batchFolderId,
                  'image/png'
                );
              }
            }

            const mdUpload = await uploadMarkdownToCampaignFolder(markdownContent, filename, batchFolderId);
            driveUrl = mdUpload.driveUrl;
          }

          const { updatePillarCampaignItem } = await import('./db');
          updatePillarCampaignItem(item.id, { target_markdown_url: driveUrl });
        }

        if (uploadSpreadsheet) {
          const { ensureTabAndAppendRows, updateCell } = await import('./sheets-autopilot-worker');
          if (!targetSpreadsheetId) {
            console.log(`[Pillar Generator] Creating spreadsheet for campaign "${campaign.campaign_name}"...`);
            const createdSheet = await createSpreadsheet(campaign.campaign_name);
            targetSpreadsheetId = createdSheet.spreadsheetId;
            const { updatePillarCampaign } = await import('./db');
            updatePillarCampaign(campaign.id, { target_spreadsheet_id: targetSpreadsheetId });

            // Initialize target tabs with headers
            const headerMap = {
              'CAMPAIGN_OPC': ['pilar_content', 'hook', 'visual_action', 'nama_produk', 'product_desc', 'usp', 'custom_instruction', 'source_product_url', 'product_image_url', 'review_status', 'pipeline_status', 'markdown_url', 'asset_url', 'processed_at'],
              'Storyboard': ['batch_id', 'scene_id', 'scene_number', 'duration', 'visual_description', 'camera_movement', 'audio_mood'],
              'Voiceover': ['batch_id', 'scene_id', 'scene_number', 'narration'],
              'Prompt': ['batch_id', 'scene_id', 'scene_number', 't2v_prompt', 't2i_prompt', 'i2v_prompt'],
              'Captions': ['batch_id', 'tiktok_caption', 'ig_caption', 'yt_title', 'yt_desc']
            };
            for (const [tab, headers] of Object.entries(headerMap)) {
              await ensureTabAndAppendRows(sheets, targetSpreadsheetId, tab, headers, []);
            }
          }

          // Fetch headers of CAMPAIGN_OPC to make sure column indices are correct
          let opcHeaders = [];
          const sheetName = 'CAMPAIGN_OPC';
          try {
            const getMeta = await sheets.spreadsheets.get({ spreadsheetId: targetSpreadsheetId });
            const tabExists = getMeta.data.sheets.some(s => s.properties.title === sheetName);
            if (tabExists) {
              const getHeaders = await sheets.spreadsheets.values.get({ spreadsheetId: targetSpreadsheetId, range: `'${sheetName}'!A1:Z1` });
              opcHeaders = (getHeaders.data.values || [[]])[0].map(h => h.trim().toLowerCase());
            }
          } catch (e) {
            console.warn('[Pillar Generator] Failed to verify CAMPAIGN_OPC tab:', e.message);
          }

          // If mass production and rowPayload has row_number, update that specific row index in CAMPAIGN_OPC
          const targetRowNum = isMassProd && rowPayload.row_number ? rowPayload.row_number + 1 : -1;
          const hookVal = tempCampaign.custom_hook || '';
          const resolvedRowNum = await findOpcRowByHook(sheets, targetSpreadsheetId, sheetName, opcHeaders, hookVal, targetRowNum);

          if (resolvedRowNum !== -1 && opcHeaders.length > 0) {
            console.log(`[Pillar Generator] Updating row ${resolvedRowNum} in ${sheetName} for batch ${batchId}...`);
            const updateLocal = async (colName, val) => {
              const idx = opcHeaders.indexOf(colName.toLowerCase());
              if (idx !== -1) {
                await updateCell(sheets, targetSpreadsheetId, sheetName, idx, resolvedRowNum, val);
              }
            };
            await updateLocal('batch_id', batchId);
            await updateLocal('pipeline_status', 'Ready For Review');
            await updateLocal('asset_url', folderUrl || '');
            await updateLocal('processed_at', new Date().toISOString());
          } else {
            // Append as a new row in CAMPAIGN_OPC
            console.log(`[Pillar Generator] Appending row to ${sheetName} for batch ${batchId}...`);
            const pName = productData?.product_name || '';
            const pDesc = productData?.product_description || '';
            const pUsp = typeof productData?.unique_selling_point === 'string' ? productData.unique_selling_point : JSON.stringify(productData?.unique_selling_point || '');
            const newRow = [
              tempCampaign.content_pillar || '',
              tempCampaign.custom_hook || '',
              tempCampaign.visual_action_guideline || '',
              pName,
              pDesc,
              pUsp,
              tempCampaign.custom_instruction || '',
              isMassProd ? (rowPayload.source_product_url || '') : (campaign.bridging_mode === 'url_extract' ? campaign.ephemeral_product_data : ''),
              isMassProd ? (rowPayload.product_image_url || '') : '',
              'Approved',
              'Ready For Review',
              '', // markdown_url (leave empty)
              folderUrl || '', // asset_url (written directly)
              new Date().toISOString()
            ];
            await ensureTabAndAppendRows(
              sheets,
              targetSpreadsheetId,
              sheetName,
              ['pilar_content', 'hook', 'visual_action', 'nama_produk', 'product_desc', 'usp', 'custom_instruction', 'source_product_url', 'product_image_url', 'review_status', 'pipeline_status', 'markdown_url', 'asset_url', 'processed_at'],
              [newRow]
            );
          }

          // Write detail tabs: Storyboard, Voiceover, Prompt, Caption
          console.log(`[Pillar Generator] Writing detail tabs for batch ${batchId}...`);
          const storyboardRows = fullResult.storyboard.map((s, idx) => {
            const sceneNum = s.scene || (idx + 1);
            return [
              batchId,
              `${batchId}_S${String(sceneNum).padStart(2, '0')}`,
              sceneNum,
              '8s',
              s.visual_description || '',
              s.camera_movement || '',
              s.audio_mood || ''
            ];
          });
          const voiceoverRows = fullResult.voiceover.map((v, idx) => {
            const sceneNum = v.scene || (idx + 1);
            return [
              batchId,
              `${batchId}_S${String(sceneNum).padStart(2, '0')}`,
              sceneNum,
              v.narration || ''
            ];
          });
          const promptRows = fullResult.storyboard.map((s, idx) => {
            const sceneNum = s.scene || (idx + 1);
            const t2v = fullResult.t2v_prompts.find(p => Number(p.clip) === Number(sceneNum))?.prompt || '';
            const t2i = fullResult.t2i_prompts.find(p => Number(p.clip) === Number(sceneNum))?.prompt || '';
            const i2v = fullResult.i2v_prompts.find(p => Number(p.clip) === Number(sceneNum))?.prompt || '';
            return [
              batchId,
              `${batchId}_S${String(sceneNum).padStart(2, '0')}`,
              sceneNum,
              t2v,
              t2i,
              i2v
            ];
          });
          const captionRow = [
            batchId,
            fullResult.tiktok_caption || '',
            fullResult.ig_caption || '',
            fullResult.yt_title || '',
            fullResult.yt_desc || ''
          ];

          if (storyboardRows.length) {
            await ensureTabAndAppendRows(sheets, targetSpreadsheetId, 'Storyboard', ['batch_id', 'scene_id', 'scene_number', 'duration', 'visual_description', 'camera_movement', 'audio_mood'], storyboardRows);
          }
          if (voiceoverRows.length) {
            await ensureTabAndAppendRows(sheets, targetSpreadsheetId, 'Voiceover', ['batch_id', 'scene_id', 'scene_number', 'narration'], voiceoverRows);
          }
          if (promptRows.length) {
            await ensureTabAndAppendRows(sheets, targetSpreadsheetId, 'Prompt', ['batch_id', 'scene_id', 'scene_number', 't2v_prompt', 't2i_prompt', 'i2v_prompt'], promptRows);
          }
          await ensureTabAndAppendRows(sheets, targetSpreadsheetId, 'Captions', ['batch_id', 'tiktok_caption', 'ig_caption', 'yt_title', 'yt_desc'], [captionRow]);
        }
      } catch (err) {
        console.warn('[Pillar Generator] Failed to update Google Sheets:', err.message);
      }
    }

    // If G Labs is not active, save driveUrl directly as main drive_link & mark upload completed
    if (campaign.enable_glabs === 0 && driveUrl) {
      updatePillarCampaignItem(item.id, {
        drive_link: driveUrl,
        upload_status: 'completed'
      });
    }

    return { processed: true, item_id: item.id, campaign_id: campaign.id };
  } catch (error) {
    const { logSystemError } = await import('./error-logger');
    logSystemError('OPC Generator', error, item.campaign_id);
    updatePillarCampaignItem(item.id, { generation_status: 'failed' });
    console.error(`[Pillar Generator] Failed to generate storyboard for item ${itemId}:`, error);
    throw error;
  }
}

export async function processPillarTts(payload, job) {
  const { getNextPendingPillarTtsItem, updatePillarCampaignItem, getPillarCampaign, createTtsBatch, createTtsClip, updateTtsClip, getDb, getSetting } = await import('./db');
  const db = getDb();
  const { generateMinimaxVO } = await import('./minimax-tts');
  const { callGeminiTtsApi } = await import('./gemini');
  const path = await import('path');
  const fs = await import('fs');

  const itemId = payload?.item_id;
  let item;
  if (itemId) {
    item = await db.prepare('SELECT * FROM pillar_campaign_items WHERE id = ?').get(itemId);
  } else {
    item = await getNextPendingPillarTtsItem();
  }
  if (!item) return { skip: true, reason: itemId ? `Item ${itemId} not found` : 'No pending OPC campaign items for TTS' };

  const campaign = await getPillarCampaign(item.campaign_id);
  if (!campaign) return { skip: true, reason: `Campaign ${item.campaign_id} not found` };

  overrideOPCCampaignIfMassProd(campaign, item);

  if (campaign.enable_tts === 0) {
    updatePillarCampaignItem(item.id, { tts_status: 'skipped', tts_batch_id: 'skipped' });
    return { processed: true, item_id: item.id, message: 'Skipped TTS stage' };
  }

  updatePillarCampaignItem(item.id, { tts_status: 'processing' });

  try {
    const parsed = JSON.parse(item.result_json || '{}');
    const voiceover = parsed.voiceover || [];

    if (voiceover.length === 0) {
      updatePillarCampaignItem(item.id, { tts_status: 'completed', tts_batch_id: 'no_audio' });
      return { processed: true, item_id: item.id, message: 'Skipped TTS due to empty voiceover' };
    }

    const batchId = `ttsb_opc_${item.id}_${Date.now()}`;
    const provider = campaign.voice_provider || 'minimax';
    const persona = campaign.voice_persona || 'Indonesian_casual_reporter_vv2';

    await createTtsBatch({
      id: batchId,
      source_type: 'pillar_campaign',
      source_ref_id: item.id.toString(),
      provider_active: provider,
      voice_persona: persona,
      config_speed: campaign.voice_speed !== undefined ? campaign.voice_speed : 1.0,
      config_volume: campaign.voice_volume !== undefined ? campaign.voice_volume : 1.0
    });

    const tempDir = path.join(process.cwd(), 'public', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    let batchSuccess = false;
    if (provider !== 'minimax' && voiceover.length > 1 && campaign.enable_audio_segment !== 1) {
      try {
        const { generateGeminiBatchTTS } = await import('./gemini-tts-batch');
        const texts = voiceover.map(v => v.narration || '');
        const outputPaths = voiceover.map((_, i) => path.join(tempDir, `tts_opc_${batchId}_clip_${i}.wav`));

        const clipIds = [];
        for (let i = 0; i < voiceover.length; i++) {
          const clipId = `ttsc_opc_${Date.now()}_${i}`;
          clipIds.push(clipId);
          await createTtsClip({
            id: clipId,
            batch_id: batchId,
            clip_index: i,
            source_text: texts[i],
            audio_path: `/temp/tts_opc_${batchId}_clip_${i}.wav`,
            status: 'processing'
          });
        }

        await generateGeminiBatchTTS(texts, persona, outputPaths);

        for (const clipId of clipIds) {
          await updateTtsClip(clipId, { status: 'completed' });
        }
        batchSuccess = true;
        console.log(`[Pillar TTS] Batch generation success for batch ${batchId}. Saved ${texts.length - 1} API requests.`);
      } catch (batchErr) {
        console.warn(`[Pillar TTS] Batch generation failed: ${batchErr.message}. Falling back to individual requests...`);
        await db.prepare('DELETE FROM tts_studio_clips WHERE batch_id = ?').run(batchId);
      }
    }

    if (!batchSuccess) {
      let voiceCast = null;
      if (campaign.voice_cast_json) {
        try {
          const parsed = typeof campaign.voice_cast_json === 'string'
            ? JSON.parse(campaign.voice_cast_json)
            : campaign.voice_cast_json;
          voiceCast = parsed?.characters?.length > 0 ? parsed : null;
        } catch (e) {
          console.warn(`[Pillar TTS] Failed to parse voice_cast_json: ${e.message}`);
        }
      }

      const { execSync } = await import('child_process');
      const concatAudioSegments = async (segmentPaths, outputPath) => {
        if (segmentPaths.length === 1) {
          fs.copyFileSync(segmentPaths[0], outputPath);
          return;
        }
        const filterStr = segmentPaths.map((_, idx) => `[${idx}:a]`).join('') + `concat=n=${segmentPaths.length}:v=0:a=1[a]`;
        let cmd = `ffmpeg -y `;
        segmentPaths.forEach(p => { cmd += `-i "${p}" `; });
        cmd += `-filter_complex "${filterStr}" -map "[a]" "${outputPath}"`;
        execSync(cmd);
      };

      const speed = campaign.voice_speed !== undefined ? campaign.voice_speed : 1.0;
      const volume = campaign.voice_volume !== undefined ? campaign.voice_volume : 1.0;

      for (let i = 0; i < voiceover.length; i++) {
        const clipId = `ttsc_opc_${Date.now()}_${i}`;
        const clip = voiceover[i];
        const text = clip.narration || '';
        const ext = provider === 'minimax' ? 'mp3' : 'wav';
        const outputFileName = `tts_opc_${batchId}_clip_${i}.${ext}`;
        const localPath = path.join(tempDir, outputFileName);
        const publicPath = `/temp/${outputFileName}`;

        await createTtsClip({
          id: clipId,
          batch_id: batchId,
          clip_index: i,
          source_text: text,
          audio_path: publicPath,
          status: 'processing'
        });

        try {
          if (clip.voice_segments && clip.voice_segments.length > 1 && voiceCast) {
            console.log(`[Pillar TTS] [Multi-Voice] Klip ${i + 1}: rendering ${clip.voice_segments.length} segmen dialog...`);
            const segmentPaths = [];
            for (let s = 0; s < clip.voice_segments.length; s++) {
              const seg = clip.voice_segments[s];
              const charEntry = voiceCast.characters.find(ch => ch.id === seg.character_id);
              const segVoiceId = (provider === 'minimax' ? charEntry?.minimax_voice_id : charEntry?.gemini_voice_id) || persona;
              const segExt = provider === 'minimax' ? 'mp3' : 'wav';
              const segPath = path.join(tempDir, `seg_opc_${batchId}_c${i}_${s}_${seg.character_id || s}.${segExt}`);

              console.log(`  → Segmen ${s + 1}: character="${seg.character_id}" voice="${segVoiceId}" text="${(seg.text || '').slice(0, 40)}..."`);
              if (provider === 'minimax') {
                await generateMinimaxVO(seg.text || '', segVoiceId, segPath, {
                  speed,
                  volume,
                  model: campaign.tts_model_quality,
                  language: campaign.target_language
                });
              } else {
                const { convertPcmToWav } = await import('./audio-helper');
                const rawPcm = await callGeminiTtsApi(seg.text || '', segVoiceId, { speed, volume });
                const wavBuffer = convertPcmToWav(rawPcm, 24000);
                fs.writeFileSync(segPath, wavBuffer);
              }
              segmentPaths.push(segPath);
            }
            console.log(`  → Menggabungkan ${segmentPaths.length} segmen dialog menjadi 1 audio klip...`);
            await concatAudioSegments(segmentPaths, localPath);
            console.log(`  ✓ Klip ${i + 1} multi-voice selesai.`);
          } else {
            if (provider === 'minimax') {
              await generateMinimaxVO(text, persona, localPath, {
                speed,
                volume,
                model: campaign.tts_model_quality,
                language: campaign.target_language
              });
            } else {
              const { generateGeminiExact8sAudio } = await import('./gemini-8s-tts');
              await generateGeminiExact8sAudio(text, persona, localPath);
            }
          }
          await updateTtsClip(clipId, { status: 'completed' });

          if (provider !== 'minimax' && i < voiceover.length - 1) {
            console.log(`[Pillar TTS] Pacing delay: waiting 8s before next clip...`);
            await new Promise(resolve => setTimeout(resolve, 8000));
          }
        } catch (clipErr) {
          console.error(`[Pillar TTS] Failed to render clip #${i} in batch ${batchId}:`, clipErr.message);
          await updateTtsClip(clipId, { status: 'failed' });
          throw clipErr;
        }
      }
    }

    updatePillarCampaignItem(item.id, {
      tts_status: 'completed',
      tts_batch_id: batchId
    });

    return { processed: true, item_id: item.id, tts_batch_id: batchId };
  } catch (error) {
    const { logSystemError } = await import('./error-logger');
    logSystemError('OPC TTS', error, item.campaign_id);
    updatePillarCampaignItem(item.id, { tts_status: 'failed' });
    throw error;
  }
}

export async function processPillarGlabs(payload, job) {
  const { getNextPendingPillarGlabsItem, updatePillarCampaignItem, getPillarCampaign, getSetting, setSetting, getDb, insertGlabsTask, updateGlabsTaskStatus } = await import('./db');
  const { generateVideo, getTaskStatus, getFileUrl } = await import('./webhook-client');
  const path = await import('path');
  const fs = await import('fs');

  const db = getDb();
  const itemId = payload?.item_id;
  const productData = null;

  const fileToBase64 = (filePath) => {
    if (!filePath) return null;
    let absolutePath = filePath;
    if (!fs.existsSync(absolutePath)) {
      const relativePart = filePath.startsWith('/') ? filePath.slice(1) : filePath;
      absolutePath = path.join(process.cwd(), 'public', relativePart);
    }
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found for base64 conversion: ${filePath} (checked path: ${absolutePath})`);
    }
    const fileBuffer = fs.readFileSync(absolutePath);

    // Detect MIME type by magic bytes
    let mimeType = 'image/png'; // default fallback
    if (fileBuffer[0] === 0xFF && fileBuffer[1] === 0xD8 && fileBuffer[2] === 0xFF) {
      mimeType = 'image/jpeg';
    } else if (fileBuffer[0] === 0x89 && fileBuffer[1] === 0x50 && fileBuffer[2] === 0x4E && fileBuffer[3] === 0x47) {
      mimeType = 'image/png';
    } else if (fileBuffer[0] === 0x52 && fileBuffer[1] === 0x49 && fileBuffer[2] === 0x46 && fileBuffer[3] === 0x46) {
      mimeType = 'image/webp';
    }

    return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
  };

  // Phase 1: Poll processing tasks first
  let item = null;
  if (itemId) {
    item = await db.prepare(
      "SELECT * FROM pillar_campaign_items WHERE id = ? AND visual_status = 'processing'"
    ).get(itemId);
  } else {
    item = await db.prepare(
      "SELECT i.* FROM pillar_campaign_items i JOIN pillar_campaigns c ON i.campaign_id = c.id WHERE i.visual_status = 'processing' AND c.status = 'running' AND c.local_scheduler = 0 ORDER BY i.id ASC LIMIT 1"
    ).get();
  }

  if (item) {
    const campaign = await db.prepare('SELECT * FROM pillar_campaigns WHERE id = ?').get(item.campaign_id);
    const taskIds = JSON.parse(item.visual_tasks_json || '[]');
    if (taskIds.length === 0) {
      updatePillarCampaignItem(item.id, { visual_status: 'pending' });
      return { processed: true, message: 'Reset visual_status to pending due to empty task list' };
    }

    let localPaths = [];
    try {
      localPaths = JSON.parse(item.visual_clip_paths || '[]');
    } catch { }
    if (!Array.isArray(localPaths) || localPaths.length !== taskIds.length) {
      localPaths = Array(taskIds.length).fill(null);
    }

    let allCompleted = true;
    let anyFailed = false;
    let errorDetail = '';

    for (let i = 0; i < taskIds.length; i++) {
      if (localPaths[i]) {
        const localPath = path.join(process.cwd(), 'public', localPaths[i]);
        if (fs.existsSync(localPath)) {
          continue;
        }
      }

      const taskId = taskIds[i];
      try {
        const cachedTask = await db.prepare('SELECT status, video_url FROM glabs_tasks WHERE task_id = ?').get(taskId);
        if (cachedTask && cachedTask.status === 'completed' && cachedTask.video_url) {
          await downloadAndUploadPillarClip(item, campaign, i, cachedTask.video_url, localPaths, db);
          continue;
        }

        const taskResult = await getTaskStatus(taskId);
        const taskStatus = (taskResult?.status || '').toLowerCase();

        if (taskStatus === 'completed') {
          const files = taskResult.results || taskResult.files || [];
          let videoFile = files.find(f => f.endsWith('.mp4')) || files[0];
          if (videoFile && (videoFile.startsWith('http://') || videoFile.startsWith('https://'))) {
            videoFile = videoFile.split('/').pop();
          }
          if (videoFile) {
            const completedUrl = getFileUrl(videoFile, taskId);
            try {
              updateGlabsTaskStatus(taskId, 'completed', completedUrl);
            } catch { }
            await downloadAndUploadPillarClip(item, campaign, i, completedUrl, localPaths, db);
          } else {
            allCompleted = false;
          }
        } else if (taskStatus === 'failed') {
          anyFailed = true;
          const rawErr = taskResult?.error || taskResult?.error_detail || taskResult?.message || '';
          errorDetail = `Task ${taskId} failed on GLabs: ${rawErr}`;
          try {
            updateGlabsTaskStatus(taskId, 'failed');
          } catch { }
        } else {
          allCompleted = false;
        }
      } catch (pollErr) {
        allCompleted = false;
        console.error(`[Pillar Glabs] Polling error for task ${taskId}:`, pollErr.message);
      }
    }

    if (anyFailed) {
      updatePillarCampaignItem(item.id, { visual_status: 'failed' });
      throw new Error(`Visual generation failed: ${errorDetail}`);
    }

    const allDone = localPaths.every(Boolean);
    if (allDone) {
      let uploadLink = '';
      try {
        const storageProvider = getSetting('storage_provider') || 'gdrive';
        const campaignItems = await db.prepare('SELECT id FROM pillar_campaign_items WHERE campaign_id = ? ORDER BY id ASC').all(item.campaign_id);
        const itemIndex = campaignItems.findIndex(i => i.id === item.id);
        const sequenceNumber = itemIndex !== -1 ? itemIndex + 1 : 1;
        const paddedIndex = String(sequenceNumber).padStart(3, '0');

        const batchFolderName = campaign.is_mass_production === 1
          ? `OPC_${campaign.campaign_name.replace(/[^a-zA-Z0-9_]/g, '_')}_${paddedIndex}`
          : `OPC-${campaign.campaign_name}-${paddedIndex}`;

        if (storageProvider === 'nextcloud') {
          const targetFolder = getCampaignNextcloudTargetFolder(campaign);
          uploadLink = `${targetFolder}/OPC_Campaign_${campaign.id}/${batchFolderName}`.replace(/\/+/g, '/');
        } else {
          const { getOrCreateCampaignFolder, getOrCreateFolderInFolder } = await import('./drive-uploader');
          const campaignFolderId = await getOrCreateCampaignFolder(campaign.campaign_name, 'OPC_Campaign_');
          const batchFolderId = await getOrCreateFolderInFolder(batchFolderName, campaignFolderId);
          uploadLink = `https://drive.google.com/drive/folders/${batchFolderId}`;
        }
      } catch (driveErr) {
        console.error(`[Pillar Glabs Folder Link Resolution] Failed:`, driveErr.message);
      }

      updatePillarCampaignItem(item.id, {
        visual_status: 'completed',
        visual_clip_paths: JSON.stringify(localPaths),
        drive_link: uploadLink || null,
        upload_status: uploadLink ? 'completed' : 'failed'
      });

      return { processed: true, item_id: item.id, clips: localPaths, folder_url: uploadLink };
    }

    return { skip: true, reason: `Visual tasks still processing for item #${item.id}` };
  }

  // Phase 2: Submit pending tasks
  if (itemId) {
    item = await db.prepare('SELECT * FROM pillar_campaign_items WHERE id = ?').get(itemId);
  } else {
    item = getNextPendingPillarGlabsItem();
  }
  if (!item) return { skip: true, reason: itemId ? `Item ${itemId} not found` : 'No pending OPC items to generate visuals' };

  const campaign = await db.prepare('SELECT * FROM pillar_campaigns WHERE id = ?').get(item.campaign_id);
  if (!campaign) return { skip: true, reason: `Campaign ${item.campaign_id} not found` };
  // [Fix v2.2.87] pillar_campaigns tidak memiliki kolom account_name — gunakan brand_profile_id
  const brandProfile = campaign.brand_profile_id
    ? await db.prepare('SELECT * FROM brand_profiles WHERE id = ?').get(campaign.brand_profile_id)
    : null;

  overrideOPCCampaignIfMassProd(campaign, item);

  if (campaign.enable_glabs === 0) {
    updatePillarCampaignItem(item.id, {
      visual_status: 'skipped',
      visual_clip_paths: JSON.stringify([])
    });
    return { processed: true, item_id: item.id, message: 'G-Labs is inactive. Skipped visuals stage.' };
  }

  const parsed = JSON.parse(item.result_json || '{}');
  const targetClips = campaign.target_clips_count || 4;
  const bridgeAtClip = campaign.bridge_at_clip || 2;
  const visualMode = campaign.visual_mode || 'hybrid_lock';

  if (!parsed.t2v_prompts && !parsed.t2i_prompts && !parsed.i2v_prompts) {
    updatePillarCampaignItem(item.id, {
      visual_status: 'completed',
      visual_clip_paths: JSON.stringify([])
    });
    return { processed: true, item_id: item.id, message: 'Completed immediately because of 0 prompts' };
  }

  const existingTaskIds = [];
  try {
    if (item.visual_tasks_json) {
      const parsedTasks = JSON.parse(item.visual_tasks_json);
      if (Array.isArray(parsedTasks)) {
        existingTaskIds.push(...parsedTasks);
      }
    }
  } catch (e) {
    console.error(`[Pillar Glabs] Failed to parse existing tasks:`, e.message);
  }

  updatePillarCampaignItem(item.id, { visual_status: 'processing' });

  const webhookPort = getSetting('webhook_port') || '8765';
  const webhookApiKey = getSetting('webhook_api_key') || '';
  const videoModel = campaign.video_model || getSetting('webhook_video_model') || 'veo_31_lite';
  const imageModel = getSetting('webhook_image_model') || 'nano_banana_pro';

  const taskIds = [];
  try {
    for (let c = 1; c <= targetClips; c++) {
      let videoResult = null;
      let promptText = '';

      const isHybridLockClip = (visualMode === 'hybrid_lock');

      const storyboardObj = (parsed.storyboard || []).find(s => Number(s.scene) === c || Number(s.clip) === c);
      let clipCharacters = [];
      if (storyboardObj && Array.isArray(storyboardObj.characters)) {
        clipCharacters = storyboardObj.characters;
      } else {
        const rowPayload = item.row_creative_payload ? JSON.parse(item.row_creative_payload) : {};
        if (rowPayload.main_character) {
          const clean = rowPayload.main_character.trim().toLowerCase();
          if (clean === 'mochi') clipCharacters.push('mochi');
          else if (clean === 'dr. paw' || clean === 'dr paw') clipCharacters.push('dr_paw');
          else if (clean === 'coco') clipCharacters.push('coco');
          else if (clean === 'boba') clipCharacters.push('boba');
          else if (clean === 'tofu') clipCharacters.push('tofu');
        }
        clipCharacters = Array.from(new Set(clipCharacters));
      }

      const { normalizeCharacterId } = require('./universe-manifests.js');
      const normalizedClipChars = clipCharacters.map(normalizeCharacterId).filter(Boolean);
      const isCartoon = (campaign.content_world === 'cartoon_universe');
      const hasChars = normalizedClipChars.length > 0;

      const isHybridLockClip = isCartoon ? (hasChars || visualMode === 'hybrid_lock') : (visualMode === 'hybrid_lock');

      const existingTaskId = existingTaskIds[c - 1];
      let reuseCompletedTask = false;
      if (existingTaskId) {
        let existingTask = await db.prepare('SELECT * FROM glabs_tasks WHERE task_id = ?').get(existingTaskId);
        if (existingTask) {
          if (existingTask.status === 'processing') {
            try {
              console.log(`[Pillar Glabs] Checking final status of task ${existingTaskId}...`);
              const taskResult = await getTaskStatus(existingTaskId);
              const taskStatus = (taskResult?.status || '').toLowerCase();
              if (taskStatus === 'completed') {
                const files = taskResult.results || taskResult.files || [];
                let videoFile = files.find(f => f.endsWith('.mp4')) || files[0];
                if (videoFile && (videoFile.startsWith('http://') || videoFile.startsWith('https://'))) {
                  videoFile = videoFile.split('/').pop();
                }
                if (videoFile) {
                  const completedUrl = getFileUrl(videoFile, existingTaskId);
                  updateGlabsTaskStatus(existingTaskId, 'completed', completedUrl);
                  existingTask = await db.prepare('SELECT * FROM glabs_tasks WHERE task_id = ?').get(existingTaskId);
                }
              } else if (taskStatus === 'failed') {
                updateGlabsTaskStatus(existingTaskId, 'failed');
                existingTask = await db.prepare('SELECT * FROM glabs_tasks WHERE task_id = ?').get(existingTaskId);
              }
            } catch (err) {
              console.warn(`[Pillar Glabs] Failed to poll status:`, err.message);
            }
          }

          if (existingTask.status === 'completed' && existingTask.video_url) {
            const expectedPrompt = isHybridLockClip ?
              ((parsed.i2v_prompts || []).find(p => Number(p.clip) === c)?.prompt || '') :
              ((parsed.t2v_prompts || []).find(p => Number(p.clip) === c)?.prompt || '');

            if (existingTask.prompt === expectedPrompt) {
              console.log(`[Pillar Glabs] Reusing completed task ${existingTaskId} for clip ${c}`);
              taskIds.push(existingTaskId);
              reuseCompletedTask = true;
            }
          }
        }
      }

      if (reuseCompletedTask) {
        updatePillarCampaignItem(item.id, {
          visual_tasks_json: JSON.stringify(taskIds)
        });
        continue;
      }

      if (isHybridLockClip) {
        const t2iPromptObj = (parsed.t2i_prompts || []).find(p => Number(p.clip) === c);
        let t2iPromptText = t2iPromptObj ? t2iPromptObj.prompt : '';
        if (!t2iPromptText && isCartoon) {
          const t2vPromptObj = (parsed.t2v_prompts || []).find(p => Number(p.clip) === c);
          t2iPromptText = t2vPromptObj ? t2vPromptObj.prompt : '';
        }
        if (!t2iPromptText) {
          throw new Error(`T2I prompt for clip ${c} not found`);
        }

        const startFrameFilename = `opc_start_frame_${item.id}_clip_${c}.png`;
        const startFrameLocalPath = path.join(process.cwd(), 'public', 'uploads', 'start_frames', startFrameFilename);
        const relativeStartFramePath = `/uploads/start_frames/${startFrameFilename}`;

        let startFrameExists = fs.existsSync(startFrameLocalPath);

        if (startFrameExists) {
          console.log(`[Pillar Glabs] Start frame exists: ${relativeStartFramePath}`);
        } else {
          // Sync with active clean photo from product_extractions if target_product_id is linked
          if (campaign?.target_product_id) {
            try {
              const activeProd = await db.prepare('SELECT clean_photo_url, cleaned_photo_url, photo_url FROM product_extractions WHERE id = ?').get(campaign.target_product_id);
              const activeClean = activeProd?.cleaned_photo_url || activeProd?.clean_photo_url || activeProd?.photo_url;
              if (activeClean) {
                campaign.product_ref_image_path = activeClean;
              }
            } catch (_) {}
          }

          let productBase64 = resolveProductBase64(campaign, productData);
          if (!productBase64 && campaign.product_ref_image_path) {
            const relativePart = campaign.product_ref_image_path.startsWith('/') ? campaign.product_ref_image_path.slice(1) : campaign.product_ref_image_path;
            const absolutePath = path.join(process.cwd(), 'public', relativePart);

            if (!fs.existsSync(absolutePath)) {
              console.warn(`[Pillar Glabs] File gambar referensi hilang dari disk: ${absolutePath}. Menjalankan self-healing download...`);
              const rowPayload = item.row_creative_payload ? JSON.parse(item.row_creative_payload) : {};
              const shopeeUrl = rowPayload.source_product_url;
              const directImgUrl = rowPayload.product_image_url;

              if (directImgUrl && directImgUrl.trim() !== '') {
                const { downloadECommerceImage } = await import('./url-scraper');
                await downloadECommerceImage(directImgUrl, absolutePath);
              } else if (shopeeUrl && shopeeUrl.trim() !== '') {
                const { downloadECommerceImage } = await import('./url-scraper');
                const { scrapeUrlPlaywright } = await import('./playwright-scraper');
                console.log(`[Pillar Glabs Self-Healing] Melakukan scrape Shopee untuk mencari gambar: ${shopeeUrl}`);
                const scrapeResult = await scrapeUrlPlaywright(shopeeUrl);
                const cdnRegex = /(https:\/\/(?:images\.tokopedia\.net|cf\.shopee\.co\.id|down-id-id\.img\.susercontent\.com|down-id\.img\.susercontent\.com|down-tx-id\.img\.susercontent\.com|ecs7\.tokopedia\.net)[^\s"'<>\\}]*)/gi;
                let match = cdnRegex.exec(scrapeResult.html);
                if (match) {
                  const mainImgUrl = match[1].replace(/\\/g, '').replace(/[.,;:]$/, '');
                  await downloadECommerceImage(mainImgUrl, absolutePath);
                  console.log(`[Pillar Glabs Self-Healing] Gambar berhasil dipulihkan ke: ${absolutePath}`);
                } else {
                  throw new Error(`Self-healing gagal: Tidak ada gambar produk CDN yang ditemukan di HTML Shopee.`);
                }
              } else {
                throw new Error(`Self-healing gagal: Tidak ada source_product_url atau product_image_url di payload.`);
              }
            }

            productBase64 = resolveProductBase64(campaign, productData, rowPayload);
          }

          console.log(`[Pillar Glabs] Submitting T2I task for clip ${c}...`);
          const { generateImage } = await import('./webhook-client');

          let t2iCompleted = false;
          let t2iImageUrl = null;

          const runT2I = async (refs) => {
            const t2iResult = await generateImage({
              prompt: t2iPromptText,
              model: imageModel,
              aspect_ratio: campaign.aspect_ratio || '9:16',
              reference_images: refs && refs.length > 0 ? refs : undefined,
              webhookOverride: brandProfile
            });

            if (!t2iResult?.task_id) {
              throw new Error(`Failed T2I task for clip ${c}`);
            }

            const t2iTaskId = t2iResult.task_id;
            for (let attempt = 0; attempt < 30; attempt++) {
              await new Promise(resolve => setTimeout(resolve, 2000));
              const t2iStatusResult = await getTaskStatus(t2iTaskId);
              const t2iStatus = (t2iStatusResult?.status || '').toLowerCase();

              if (t2iStatus === 'completed') {
                const files = t2iStatusResult.results || t2iStatusResult.files || [];
                let imageFile = files.find(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')) || files[0];
                if (imageFile && (imageFile.startsWith('http://') || imageFile.startsWith('https://'))) {
                  imageFile = imageFile.split('/').pop();
                }
                if (imageFile) {
                  return getFileUrl(imageFile, t2iTaskId);
                }
              } else if (t2iStatus === 'failed') {
                throw new Error(`T2I task failed: ${t2iTaskId}`);
              }
            }
            throw new Error(`T2I task ${t2iTaskId} timed out`);
          };

          let resolvedRefs = { allReferences: [] };
          if (isCartoon) {
            const { resolveClipReferenceImages } = require('./cartoon-reference-resolver.js');
            let universeSnapshot = null;
            try {
              universeSnapshot = campaign.universe_snapshot_json ? JSON.parse(campaign.universe_snapshot_json) : null;
            } catch (_) {}
            resolvedRefs = resolveClipReferenceImages({
              contentWorld: 'cartoon_universe',
              universeProfile: campaign.universe_profile || 'pawville',
              universeSnapshot,
              clip: c,
              productReference: productBase64,
              productRevealBeat: campaign.product_reveal_beat || 'none',
              clipCharacters: normalizedClipChars
            });
          } else {
            const isBridge = (c >= bridgeAtClip && c <= (bridgeAtClip + (campaign.bridge_duration_clips || 1) - 1));
            if (isBridge && productBase64) {
              resolvedRefs = { allReferences: [productBase64] };
            }
          }

          try {
            t2iImageUrl = await runT2I(resolvedRefs.allReferences);
            t2iCompleted = true;
          } catch (err) {
            if (!isCartoon && resolvedRefs.allReferences.length > 0) {
              console.warn(`[Pillar Glabs] T2I task for clip ${c} failed: ${err.message}. Retrying without references...`);
              t2iImageUrl = await runT2I([]);
              t2iCompleted = true;
            } else {
              throw err;
            }
          }

          if (!t2iCompleted || !t2iImageUrl) {
            throw new Error(`T2I task failed or timed out`);
          }

          const imgResponse = await fetch(t2iImageUrl);
          const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
          fs.writeFileSync(startFrameLocalPath, imgBuffer);

          console.log(`[OPC Start Frame] Saved locally at ${relativeStartFramePath}`);
        }

        updatePillarCampaignItem(item.id, { t2i_start_frame_path: relativeStartFramePath });

        const startFrameBase64 = fileToBase64(relativeStartFramePath);
        const i2vPromptObj = (parsed.i2v_prompts || []).find(p => Number(p.clip) === c);
        let i2vPromptText = i2vPromptObj ? i2vPromptObj.prompt : '';
        if (!i2vPromptText && isCartoon) {
          i2vPromptText = "Animate the characters naturally with smooth movements.";
        }
        if (!i2vPromptText) {
          throw new Error(`I2V prompt for clip ${c} not found`);
        }

        promptText = i2vPromptText;
        videoResult = await generateVideo({
          prompt: i2vPromptText,
          model: videoModel,
          aspect_ratio: campaign.aspect_ratio || '9:16',
          mode: 'start_image',
          reference_images: [startFrameBase64],
          webhookOverride: brandProfile
        });
      } else {
        const t2vPromptObj = (parsed.t2v_prompts || []).find(p => Number(p.clip) === c);
        const t2vPromptText = t2vPromptObj ? t2vPromptObj.prompt : '';
        if (!t2vPromptText) {
          throw new Error(`T2V prompt for clip ${c} not found`);
        }

        promptText = t2vPromptText;
        videoResult = await generateVideo({
          prompt: t2vPromptText,
          model: videoModel,
          aspect_ratio: campaign.aspect_ratio || '9:16',
          webhookOverride: brandProfile
        });
      }

      if (!videoResult?.task_id) {
        throw new Error(`Failed to submit video task for clip ${c}`);
      }

      taskIds.push(videoResult.task_id);
      try {
        insertGlabsTask({
          task_id: videoResult.task_id,
          campaign_id: campaign.id,
          item_id: item.id,
          clip_index: c - 1,
          prompt: promptText,
          status: 'processing'
        });
      } catch { }

      updatePillarCampaignItem(item.id, {
        visual_tasks_json: JSON.stringify(taskIds)
      });

      if (c < targetClips) {
        const delayMs = 10000 + Math.floor(Math.random() * 10000);
        console.log(`[Pillar Glabs] Safety delay: waiting ${Math.round(delayMs / 1000)}s before next video task submission...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    updatePillarCampaignItem(item.id, {
      visual_tasks_json: JSON.stringify(taskIds)
    });

    return { processed: true, item_id: item.id, tasksSubmitted: taskIds.length };
  } catch (err) {
    const { logSystemError } = await import('./error-logger');
    logSystemError('OPC G-Labs', err, item.campaign_id);
    updatePillarCampaignItem(item.id, {
      visual_status: 'failed',
      visual_tasks_json: JSON.stringify(taskIds)
    });
    throw err;
  }
}

export async function processPillarFfmpeg(payload, job) {
  const { getNextPendingPillarFfmpegItem, updatePillarCampaignItem, getPillarCampaign, getSetting, setSetting, getDb } = await import('./db');
  const { processTtsStudioMuxing } = await import('./video-studio-processor');
  const { google } = await import('googleapis');
  const { getAuthorizedClient } = await import('./google-auth');
  const path = await import('path');
  const fs = await import('fs');

  const db = getDb();
  const itemId = payload?.item_id;
  let item;
  if (itemId) {
    item = await db.prepare('SELECT * FROM pillar_campaign_items WHERE id = ?').get(itemId);
  } else {
    item = await getNextPendingPillarFfmpegItem();
  }
  if (!item) return { skip: true, reason: itemId ? `Item ${itemId} not found` : 'No pending OPC items for FFmpeg muxing' };

  const campaign = await getPillarCampaign(item.campaign_id);
  if (!campaign) return { skip: true, reason: `Campaign ${item.campaign_id} not found` };

  overrideOPCCampaignIfMassProd(campaign, item);

  const isSocialActive = campaign.enable_social_post === 1 || campaign.post_facebook_draft === 1;
  const finalSocialPostStatus = isSocialActive ? (campaign.fb_draft_mode === 'manual' ? 'skipped' : 'pending') : 'skipped';
  if (campaign.enable_glabs === 0 || campaign.enable_tts === 0) {
    updatePillarCampaignItem(item.id, {
      ffmpeg_status: 'skipped',
      ffmpeg_output_path: 'skipped',
      social_post_status: finalSocialPostStatus
    });
    return { processed: true, item_id: item.id, message: `Workflow dependencies (G-Labs/TTS) are inactive. Skipped FFmpeg stage. Social posting set to ${finalSocialPostStatus}.` };
  }

  if (campaign.enable_ffmpeg === 0) {
    if (campaign.enable_tts === 0 && campaign.enable_social_post === 0) {
      if (item.upload_status === 'completed' && item.drive_link) {
        updatePillarCampaignItem(item.id, {
          ffmpeg_status: 'completed',
          ffmpeg_output_path: 'skipped',
          social_post_status: 'skipped'
        });
        return { processed: true, item_id: item.id, message: 'All stages disabled. Clips uploaded.', folder_url: item.drive_link };
      }

      updatePillarCampaignItem(item.id, { ffmpeg_status: 'processing' });
      try {
        const batchId = await getOpcBatchId(campaign, item, db);
        const campaignItems = await db.prepare('SELECT id FROM pillar_campaign_items WHERE campaign_id = ? ORDER BY id ASC').all(item.campaign_id);
        const itemIndex = campaignItems.findIndex(i => i.id === item.id);
        const sequenceNumber = itemIndex !== -1 ? itemIndex + 1 : 1;
        const paddedIndex = String(sequenceNumber).padStart(3, '0');

        const { uploadVideoToFolder, getOrCreateCampaignFolder, getOrCreateFolderInFolder } = await import('./drive-uploader');

        const campaignFolderId = await getOrCreateCampaignFolder(campaign.campaign_name, 'OPC_Campaign_');
        const batchFolderId = await getOrCreateFolderInFolder(batchId, campaignFolderId);

        const localPaths = JSON.parse(item.visual_clip_paths || '[]');
        for (let i = 0; i < localPaths.length; i++) {
          const clipRelativePath = localPaths[i];
          const localVideoPath = path.join(process.cwd(), 'public', clipRelativePath);
          const clipFileName = `${batchId}-Clip-${i + 1}.mp4`;
          await uploadVideoToFolder(localVideoPath, clipFileName, batchFolderId);
        }

        // Upload audio clips to Google Drive if they exist
        if (item.tts_batch_id && item.tts_batch_id !== 'skipped') {
          try {
            const { uploadLocalFileToFolder } = await import('./drive-uploader');
            const ttsClips = await db.prepare("SELECT * FROM tts_studio_clips WHERE batch_id = ? AND status = 'completed'").all(item.tts_batch_id);
            for (const clip of ttsClips) {
              if (clip.audio_path) {
                const audioLocalPath = path.join(process.cwd(), 'public', clip.audio_path);
                if (fs.existsSync(audioLocalPath)) {
                  const audioFileName = `${batchId}-Audio-${clip.clip_index + 1}.mp3`;
                  await uploadLocalFileToFolder(audioLocalPath, audioFileName, batchFolderId, 'audio/mpeg');
                }
              }
            }
          } catch (audioErr) {
            console.error(`[OPC FFmpeg Clips Drive Audio Upload] Failed to upload audio files:`, audioErr.message);
          }
        }

        const uploadLink = `https://drive.google.com/drive/folders/${batchFolderId}`;

        updatePillarCampaignItem(item.id, {
          ffmpeg_status: 'skipped',
          ffmpeg_output_path: 'skipped',
          upload_status: 'completed',
          drive_link: uploadLink,
          social_post_status: 'skipped'
        });

        // Write back to Google Sheets row (asset_url)
        if (campaign.target_spreadsheet_id) {
          try {
            const auth = getAuthorizedClient();
            const sheets = google.sheets({ version: 'v4', auth });
            const { updateCell } = await import('./sheets-autopilot-worker');
            const sheetName = 'CAMPAIGN_OPC';
            const targetRowNum = campaign.is_mass_production === 1 && item.row_creative_payload ? JSON.parse(item.row_creative_payload).row_number + 1 : -1;
            const getHeaders = await sheets.spreadsheets.values.get({ spreadsheetId: campaign.target_spreadsheet_id, range: `'${sheetName}'!A1:Z1` });
            const opcHeaders = (getHeaders.data.values || [[]])[0].map(h => h.trim().toLowerCase());
            const hookVal = campaign.custom_hook || '';
            const resolvedRowNum = await findOpcRowByHook(sheets, campaign.target_spreadsheet_id, sheetName, opcHeaders, hookVal, targetRowNum);
            if (resolvedRowNum !== -1) {
              const assetUrlIdx = opcHeaders.indexOf('asset_url');
              if (assetUrlIdx !== -1) {
                await updateCell(sheets, campaign.target_spreadsheet_id, sheetName, assetUrlIdx, resolvedRowNum, uploadLink);
              }
            }
          } catch (sheetsErr) {
            console.warn('[Pillar FFmpeg Sheets Sync] Failed to update asset_url:', sheetsErr.message);
          }
        }

        return { processed: true, item_id: item.id, message: 'All stages disabled. Clips uploaded.', folder_url: uploadLink };
      } catch (err) {
        updatePillarCampaignItem(item.id, { ffmpeg_status: 'failed', upload_status: 'failed' });
        throw err;
      }
    }

    const finalSocialPostStatus = isSocialActive ? (campaign.fb_draft_mode === 'manual' ? 'skipped' : 'pending') : 'skipped';
    updatePillarCampaignItem(item.id, {
      ffmpeg_status: 'skipped',
      ffmpeg_output_path: 'skipped',
      upload_status: 'completed',
      drive_link: item.drive_link || null,
      social_post_status: finalSocialPostStatus
    });
    return { processed: true, item_id: item.id, message: `Skipped FFmpeg stage. Social posting set to ${finalSocialPostStatus}.` };
  }

  updatePillarCampaignItem(item.id, { ffmpeg_status: 'processing' });

  try {
    const finalVideoFileName = `opc_final_${item.id}.mp4`;
    const tempDir = path.join(process.cwd(), 'public', 'temp');
    const finalVideoPath = path.join(tempDir, finalVideoFileName);

    await processTtsStudioMuxing({
      id: `opc_${item.id}`,
      videoPath: item.visual_clip_paths,
      batchId: item.tts_batch_id,
      syncOption: campaign.ffmpeg_sync_option || 'smart_sync',
      bridgeAtClip: campaign.bridge_at_clip !== undefined ? Number(campaign.bridge_at_clip) : 2,
      bgmPath: null,
      bgmVolume: campaign.ffmpeg_bgm_volume !== undefined ? Number(campaign.ffmpeg_bgm_volume) : 0.15,
      sfxVolume: campaign.sfx_setting === 'without_sfx' ? 0.0 : (campaign.ffmpeg_sfx_volume !== undefined ? Number(campaign.ffmpeg_sfx_volume) : 0.0),
      videoScale: campaign.ffmpeg_video_scale !== undefined ? Number(campaign.ffmpeg_video_scale) : 1.0,
      outputPath: finalVideoPath
    });

    if (!fs.existsSync(finalVideoPath)) {
      throw new Error(`Muxed output file not found at ${finalVideoPath}`);
    }

    updatePillarCampaignItem(item.id, {
      ffmpeg_status: 'completed',
      ffmpeg_output_path: `/temp/${finalVideoFileName}`,
      upload_status: 'uploading'
    });

    console.log(`[Pillar FFmpeg] Uploading video to Drive...`);
    let driveUrl = '';

    const batchId = await getOpcBatchId(campaign, item, db);
    const filePrefix = getFilePrefixFromBatchId(batchId);

    try {
      const storageProvider = getSetting('storage_provider') || 'gdrive';

      if (storageProvider === 'nextcloud') {
        const { uploadBufferToNextcloud } = await import('./nextcloud-helper');
        const parentFolderName = getCampaignParentFolderName(campaign, 'OPC', db);
        const targetFolder = getCampaignNextcloudTargetFolder(campaign);
        const nextcloudBaseFolder = `/${targetFolder}/${parentFolderName}/${batchId}`.replace(/\/+/g, '/');

        const finalFileName = `${filePrefix}_video_final.mp4`;
        const targetPath = `${nextcloudBaseFolder}/${finalFileName}`;

        const fileBuffer = fs.readFileSync(finalVideoPath);
        await uploadBufferToNextcloud(fileBuffer, targetPath);
        const { getOrCreatePublicShareLink } = await import('./nextcloud-helper');
        driveUrl = await getOrCreatePublicShareLink(nextcloudBaseFolder);

        // ALSO upload all individual video clips to Nextcloud
        const clips = JSON.parse(item.visual_clip_paths || '[]');
        for (let i = 0; i < clips.length; i++) {
          const clipRelativePath = clips[i];
          const clipPath = path.join(process.cwd(), 'public', clipRelativePath);
          const clipFileName = `${filePrefix}_video_clip_${i + 1}.mp4`;
          if (fs.existsSync(clipPath)) {
            const clipBuffer = fs.readFileSync(clipPath);
            const clipTargetPath = `${nextcloudBaseFolder}/${clipFileName}`;
            await uploadBufferToNextcloud(clipBuffer, clipTargetPath);
          }
        }

        // Upload start frame images to Nextcloud
        for (let i = 0; i < clips.length; i++) {
          const startFrameFilename = `opc_start_frame_${item.id}_clip_${i + 1}.png`;
          const startFrameLocalPath = path.join(process.cwd(), 'public', 'uploads', 'start_frames', startFrameFilename);
          if (fs.existsSync(startFrameLocalPath)) {
            const startFrameBuffer = fs.readFileSync(startFrameLocalPath);
            const cloudStartFrameName = `${filePrefix}_start_frame_${i + 1}.png`;
            const clipTargetPath = `${nextcloudBaseFolder}/${cloudStartFrameName}`;
            await uploadBufferToNextcloud(startFrameBuffer, clipTargetPath);
          }
        }

        // Upload audio clips to Nextcloud if they exist
        if (item.tts_batch_id && item.tts_batch_id !== 'skipped') {
          try {
            const ttsClips = await db.prepare("SELECT * FROM tts_studio_clips WHERE batch_id = ? AND status = 'completed'").all(item.tts_batch_id);
            for (const clip of ttsClips) {
              if (clip.audio_path) {
                const audioLocalPath = path.join(process.cwd(), 'public', clip.audio_path);
                if (fs.existsSync(audioLocalPath)) {
                  const audioFileName = `${filePrefix}_audio_clip_${clip.clip_index + 1}.mp3`;
                  const audioTargetPath = `${nextcloudBaseFolder}/${audioFileName}`;
                  const audioBuffer = fs.readFileSync(audioLocalPath);
                  await uploadBufferToNextcloud(audioBuffer, audioTargetPath);
                }
              }
            }
          } catch (audioErr) {
            console.error(`[OPC FFmpeg Nextcloud Audio Upload] Failed to upload audio files:`, audioErr.message);
          }
        }

        // Upload naskah.md ke Nextcloud jika result_json ada
        if (item.result_json) {
          try {
            const parsedResult = JSON.parse(item.result_json || '{}');
            const { buildMarkdownContent } = await import('./export-builder');
            const markdownContent = buildMarkdownContent(parsedResult, batchId);
            const markdownNextcloudPath = `${nextcloudBaseFolder}/${filePrefix}_naskah.md`;
            await uploadBufferToNextcloud(Buffer.from(markdownContent, 'utf-8'), markdownNextcloudPath);
            try {
              await uploadBufferToNextcloud(Buffer.from(markdownContent, 'utf-8'), `${nextcloudBaseFolder}/naskah.md`);
            } catch (_) {}
            console.log(`[OPC FFmpeg] Successfully uploaded naskah.md to Nextcloud: ${markdownNextcloudPath}`);
          } catch (mdErr) {
            console.error(`[OPC FFmpeg Nextcloud MD Upload] Failed to upload naskah.md:`, mdErr.message);
          }
        }
      } else {
        const { uploadVideoToFolder, uploadLocalFileToFolder, getOrCreateCampaignFolder, getOrCreateFolderInFolder } = await import('./drive-uploader');

        const parentFolderName = getCampaignParentFolderName(campaign, 'OPC', db);
        const campaignFolderId = await getOrCreateCampaignFolder(parentFolderName, '');
        const targetUploadFolderId = await getOrCreateFolderInFolder(batchId, campaignFolderId);

        const finalVideoFileNameCloud = `${filePrefix}_video_final.mp4`;
        const uploaded = await uploadVideoToFolder(finalVideoPath, finalVideoFileNameCloud, targetUploadFolderId);
        driveUrl = `https://drive.google.com/drive/folders/${targetUploadFolderId}`;

        // Upload individual video clips to Google Drive
        const clips = JSON.parse(item.visual_clip_paths || '[]');
        for (let i = 0; i < clips.length; i++) {
          const clipRelativePath = clips[i];
          const clipPath = path.join(process.cwd(), 'public', clipRelativePath);
          if (fs.existsSync(clipPath)) {
            const clipFileName = `${filePrefix}_video_clip_${i + 1}.mp4`;
            await uploadLocalFileToFolder(clipPath, clipFileName, targetUploadFolderId, 'video/mp4');
          }
        }

        // Upload start frame images to Google Drive
        for (let i = 0; i < clips.length; i++) {
          const startFrameFilename = `opc_start_frame_${item.id}_clip_${i + 1}.png`;
          const startFrameLocalPath = path.join(process.cwd(), 'public', 'uploads', 'start_frames', startFrameFilename);
          if (fs.existsSync(startFrameLocalPath)) {
            const cloudStartFrameName = `${filePrefix}_start_frame_${i + 1}.png`;
            await uploadLocalFileToFolder(startFrameLocalPath, cloudStartFrameName, targetUploadFolderId, 'image/png');
          }
        }

        // Upload audio clips to Google Drive if they exist
        if (item.tts_batch_id && item.tts_batch_id !== 'skipped') {
          try {
            const ttsClips = await db.prepare("SELECT * FROM tts_studio_clips WHERE batch_id = ? AND status = 'completed'").all(item.tts_batch_id);
            for (const clip of ttsClips) {
              if (clip.audio_path) {
                const audioLocalPath = path.join(process.cwd(), 'public', clip.audio_path);
                if (fs.existsSync(audioLocalPath)) {
                  const audioFileName = `${filePrefix}_audio_clip_${clip.clip_index + 1}.mp3`;
                  await uploadLocalFileToFolder(audioLocalPath, audioFileName, targetUploadFolderId, 'audio/mpeg');
                }
              }
            }
          } catch (audioErr) {
            console.error(`[OPC FFmpeg Drive Audio Upload] Failed to upload audio files:`, audioErr.message);
          }
        }

        // Upload naskah.md ke Google Drive
        if (item.result_json) {
          try {
            const parsedResult = JSON.parse(item.result_json || '{}');
            const { buildMarkdownContent } = await import('./export-builder');
            const markdownContent = buildMarkdownContent(parsedResult, batchId);
            const tempMdPath = path.join(process.cwd(), 'public', 'temp', `${filePrefix}_naskah.md`);
            fs.writeFileSync(tempMdPath, markdownContent, 'utf-8');
            await uploadLocalFileToFolder(tempMdPath, `${filePrefix}_naskah.md`, targetUploadFolderId, 'text/markdown');
            try {
              fs.unlinkSync(tempMdPath);
            } catch (_) {}
            console.log(`[OPC FFmpeg] Successfully uploaded naskah.md to Google Drive folder: ${targetUploadFolderId}`);
          } catch (mdErr) {
            console.error(`[OPC FFmpeg Drive MD Upload] Failed to upload naskah.md:`, mdErr.message);
          }
        }
      }
    } catch (uploadErr) {
      console.error(`[Pillar FFmpeg Upload] Failed cloud upload:`, uploadErr.message);
    }

    // Save copy to local storage
    const parentFolderName = getCampaignParentFolderName(campaign, 'OPC', db);
    const subPath = `${parentFolderName}/${batchId}`;
    const finalFileNameLocal = `${filePrefix}_video_final.mp4`;
    await saveFileToLocalStorage(finalVideoPath, subPath, finalFileNameLocal);

    // Save copies of audios to local storage
    if (item.tts_batch_id && item.tts_batch_id !== 'skipped') {
      try {
        const ttsClips = await db.prepare("SELECT * FROM tts_studio_clips WHERE batch_id = ? AND status = 'completed'").all(item.tts_batch_id);
        for (const clip of ttsClips) {
          if (clip.audio_path) {
            const audioLocalPath = path.join(process.cwd(), 'public', clip.audio_path);
            const audioFileName = `${filePrefix}_audio_clip_${clip.clip_index + 1}.mp3`;
            await saveFileToLocalStorage(audioLocalPath, subPath, audioFileName);
          }
        }
      } catch (localAudioErr) {
        console.error(`[OPC FFmpeg Local Audio Sync] Failed to copy audio to local storage:`, localAudioErr.message);
      }
    }

    // Write back to Google Sheets row (asset_url)
    if (campaign.target_spreadsheet_id && driveUrl) {
      try {
        const auth = getAuthorizedClient();
        const sheets = google.sheets({ version: 'v4', auth });
        const { updateCell } = await import('./sheets-autopilot-worker');
        const sheetName = 'CAMPAIGN_OPC';
        const targetRowNum = campaign.is_mass_production === 1 && item.row_creative_payload ? JSON.parse(item.row_creative_payload).row_number + 1 : -1;
        const getHeaders = await sheets.spreadsheets.values.get({ spreadsheetId: campaign.target_spreadsheet_id, range: `'${sheetName}'!A1:Z1` });
        const opcHeaders = (getHeaders.data.values || [[]])[0].map(h => h.trim().toLowerCase());
        const hookVal = campaign.custom_hook || '';
        const resolvedRowNum = await findOpcRowByHook(sheets, campaign.target_spreadsheet_id, sheetName, opcHeaders, hookVal, targetRowNum);
        if (resolvedRowNum !== -1) {
          const assetUrlIdx = opcHeaders.indexOf('asset_url');
          if (assetUrlIdx !== -1) {
            console.log(`[Pillar FFmpeg Sheets Sync] Updating asset_url in row ${resolvedRowNum} to ${driveUrl}...`);
            await updateCell(sheets, campaign.target_spreadsheet_id, sheetName, assetUrlIdx, resolvedRowNum, driveUrl);
          }
          // Also set pipeline_status to Completed in sheet
          const pipelineIdx = opcHeaders.indexOf('pipeline_status');
          if (pipelineIdx !== -1) {
            await updateCell(sheets, campaign.target_spreadsheet_id, sheetName, pipelineIdx, resolvedRowNum, 'Completed');
          }
          // Also set processed_at to current timestamp
          const processedAtIdx = opcHeaders.indexOf('processed_at');
          if (processedAtIdx !== -1) {
            await updateCell(sheets, campaign.target_spreadsheet_id, sheetName, processedAtIdx, resolvedRowNum, new Date().toISOString());
          }
        }
      } catch (sheetsErr) {
        console.warn('[Pillar FFmpeg Sheets Sync] Failed to update asset_url:', sheetsErr.message);
      }
    }

    const isSocialActive = campaign.enable_social_post === 1 || campaign.post_facebook_draft === 1;
    const finalSocialPostStatus = isSocialActive ? (campaign.fb_draft_mode === 'manual' ? 'skipped' : 'pending') : 'skipped';
    if (isSocialActive && campaign.fb_draft_mode === 'manual') {
      console.log(`[OPC FFmpeg] FB Draft Mode is MANUAL. Skipping automatic social post step for item ${item.id}.`);
    }

    updatePillarCampaignItem(item.id, {
      workflow_status: 'completed',
      ffmpeg_status: 'completed',
      upload_status: driveUrl ? 'completed' : 'failed',
      ffmpeg_output_path: `/temp/${finalVideoFileName}`,
      drive_link: driveUrl || null,
      social_post_status: finalSocialPostStatus
    });

    try {
      const { syncCampaignToContentFlow } = await import('./contentflow-ingest');
      await syncCampaignToContentFlow(item.campaign_id);
    } catch (cfErr) {
      console.warn('[OPC FFmpeg Content Flow Sync] Warning:', cfErr.message);
    }

    return { processed: true, item_id: item.id, output_path: `/temp/${finalVideoFileName}`, drive_url: driveUrl };
  } catch (error) {
    const { logSystemError } = await import('./error-logger');
    logSystemError('OPC FFmpeg', error, item.campaign_id);
    updatePillarCampaignItem(item.id, { ffmpeg_status: 'failed' });
    throw error;
  }
}

export async function processPillarSocialPoster(payload, job) {
  const { getNextPendingPillarSocialPostItem, updatePillarCampaignItem, getPillarCampaign } = await import('./db');
  const { google } = await import('googleapis');
  const { getAuthorizedClient } = await import('./google-auth');
  const path = await import('path');

  const itemId = payload?.item_id;
  let item;
  if (itemId) {
    const { getDb } = await import('./db');
    const db = getDb();
    item = await db.prepare('SELECT * FROM pillar_campaign_items WHERE id = ?').get(itemId);
  } else {
    item = getNextPendingPillarSocialPostItem();
  }
  if (!item) return { skip: true, reason: itemId ? `Item ${itemId} not found` : 'No pending OPC items for social posting' };

  const campaign = await getPillarCampaign(item.campaign_id);
  if (!campaign) return { skip: true, reason: `Campaign ${item.campaign_id} not found` };

  overrideOPCCampaignIfMassProd(campaign, item);

  const isSocialActive = campaign.enable_social_post === 1 || campaign.post_facebook_draft === 1;
  if (!isSocialActive) {
    updatePillarCampaignItem(item.id, { social_post_status: 'skipped' });
    return { processed: true, item_id: item.id, message: 'Social Post is inactive. Skipped Social Post stage.' };
  }

  updatePillarCampaignItem(item.id, { social_post_status: 'processing' });

  const postYoutube = campaign.post_youtube_draft;
  const postTiktok = campaign.post_tiktok_draft;
  const postFacebook = campaign.post_facebook_draft;

  const parsed = JSON.parse(item.result_json || '{}');
  const results = {};

  try {
    if (postYoutube === 1) {
      try {
        const auth = getAuthorizedClient();
        const youtube = google.youtube({ version: 'v3', auth });
        const { createReadStream } = await import('fs');
        const localVideoPath = path.join(process.cwd(), 'public', item.ffmpeg_output_path);

        const res = await youtube.videos.insert({
          part: 'snippet,status',
          requestBody: {
            snippet: {
              title: parsed.yt_title || `OPC Video #${item.id}`,
              description: parsed.yt_desc || '',
              categoryId: '22'
            },
            status: { privacyStatus: 'private' }
          },
          media: {
            body: createReadStream(localVideoPath),
            mimeType: 'video/mp4'
          }
        });
        if (res.data?.id) {
          results.youtube = `https://studio.youtube.com/video/${res.data.id}/edit`;
        }
      } catch (ytErr) {
        console.error('[Pillar Social] YouTube upload failed:', ytErr.message);
      }
    }

    if (postTiktok === 1) {
      results.tiktok = 'https://ads.tiktok.com/help/article/tiktok-drafts';
    }

    // Real Facebook Page Draft Upload
    if (postFacebook === 1 || campaign.enable_social_post === 1) {
      try {
        const { postDraftToFacebookPage } = await import('./facebook-helper');
        const { getSetting } = await import('./db');

        let caption = parsed.ig_caption || parsed.instagram_caption || parsed.distribution_assets?.instagram_caption || parsed.distribution_assets?.ig_caption || parsed.caption_ig || parsed.headline || parsed.caption || parsed.script || parsed.short_desc || '';
        if (!caption && item.result_json) {
          try {
            const raw = JSON.parse(item.result_json);
            caption = raw.ig_caption || raw.instagram_caption || raw.distribution_assets?.instagram_caption || raw.distribution_assets?.ig_caption || raw.script || raw.headline || '';
          } catch (_) { }
        }
        if (!caption) {
          caption = `Draf Video OPC Campaign - ${campaign.campaign_name} #${item.id}`;
        }

        let mediaType = 'text_only';
        let mediaUrl = null;

        const hasVideoFile = item.ffmpeg_output_path && item.ffmpeg_output_path !== 'skipped';
        if (hasVideoFile) {
          const publicServerUrl = campaign.facebook_server_url ? campaign.facebook_server_url.trim() : (getSetting('fb_server_url') || '').trim();
          if (publicServerUrl) {
            const cleanBase = publicServerUrl.endsWith('/') ? publicServerUrl.slice(0, -1) : publicServerUrl;
            const storageProvider = getSetting('storage_provider') || 'gdrive';

            if (storageProvider === 'nextcloud' && item.drive_link && item.drive_link.includes('/index.php/s/')) {
              const urlParts = item.drive_link.split('/index.php/s/');
              if (urlParts.length > 1) {
                const sharePath = '/index.php/s/' + urlParts[1];
                mediaUrl = cleanBase + sharePath;
                if (!mediaUrl.endsWith('/download')) {
                  mediaUrl = mediaUrl.endsWith('/') ? mediaUrl + 'download' : mediaUrl + '/download';
                }
                mediaType = 'video';
                console.log(`[OPC Social Poster] Resolved Nextcloud public video URL: ${mediaUrl}`);
              }
            }

            if (!mediaUrl) {
              const cleanPath = item.ffmpeg_output_path.startsWith('/') ? item.ffmpeg_output_path : '/' + item.ffmpeg_output_path;
              mediaUrl = cleanBase + cleanPath;
              mediaType = 'video';
              console.log(`[OPC Social Poster] Dispatching local video draft URL: ${mediaUrl}`);
            }
          } else {
            console.warn(`[OPC Social Poster] Public server URL not configured. Bypassing video draft upload.`);
          }
        }

        const fbResult = await postDraftToFacebookPage({
          message: caption,
          mediaUrl,
          mediaType,
          pageId: campaign.facebook_page_id,
        });

        if (fbResult.success) {
          results.facebook = `https://business.facebook.com/latest/home?asset_id=${campaign.facebook_page_id || getSetting('fb_page_id') || ''}`;
          results.fb_post_id = fbResult.fb_post_id;
        } else {
          results.facebook_error = fbResult.error;
        }
      } catch (fbErr) {
        console.error('[OPC Social Poster] Facebook post draft error:', fbErr.message);
        results.facebook_error = fbErr.message;
      }
    }

    updatePillarCampaignItem(item.id, {
      social_post_status: 'completed',
      social_links_json: JSON.stringify(results)
    });

    return { processed: true, item_id: item.id, links: results };
  } catch (error) {
    const { logSystemError } = await import('./error-logger');
    logSystemError('OPC Social', error, item.campaign_id);
    updatePillarCampaignItem(item.id, { social_post_status: 'failed' });
    throw error;
  }
}

// ============================================================================
// V9.0: Instant Factory Campaign (IFC) Mass Production Scheduler Workers
// ============================================================================

export function overrideInstantCampaignIfMassProd(campaign, item) {
  if (campaign && campaign.is_mass_production === 1 && item.row_creative_payload) {
    try {
      const rowPayload = JSON.parse(item.row_creative_payload);
      if (!campaign.config) campaign.config = {};

      // Override values in config based on row payload if present
      campaign.config.custom_instruction = rowPayload.custom_instruction !== undefined ? rowPayload.custom_instruction : campaign.config.custom_instruction;
      if (rowPayload.product_ref_image_path) {
        campaign.product_ref_image_path = rowPayload.product_ref_image_path;
      }
      if (rowPayload.product_filename_declare) {
        campaign.product_filename_declare = rowPayload.product_filename_declare;
      }
    } catch (e) {
      console.warn('[IFC Scheduler] Failed to parse row_creative_payload:', e.message);
    }
  }
  return campaign;
}

/**
 * IFC Stage 0: JIT Product Sourcing for instant campaign mass production
 */
export async function processInstantRowProductSourcing(payload, job) {
  const { updateInstantCampaignItem, getDb } = await import('./db');
  const { downloadECommerceImage } = await import('./url-scraper');
  const path = await import('path');
  const fs = await import('fs');

  const db = getDb();
  const itemId = payload?.item_id;
  let item;
  if (itemId) {
    item = await db.prepare('SELECT * FROM instant_campaign_items WHERE id = ?').get(itemId);
  } else {
    const { getNextPendingInstantSourcingItem } = await import('./db');
    item = getNextPendingInstantSourcingItem();
  }

  if (!item) return { skip: true, reason: itemId ? `Item ${itemId} not found` : 'No pending instant sourcing items found' };

  let creativePayload;
  try {
    creativePayload = JSON.parse(item.row_creative_payload);
  } catch (e) {
    throw new Error(`Gagal memparse row_creative_payload untuk item ${item.id}: ${e.message}`);
  }

  const directImgUrl = creativePayload.product_image_url;

  if (directImgUrl && (directImgUrl.startsWith('http://') || directImgUrl.startsWith('https://'))) {
    console.log(`[IFC Sourcing] Mengunduh gambar produk langsung dari URL: ${directImgUrl}`);
    updateInstantCampaignItem(item.id, { generation_status: 'processing' });
    try {
      const safeFilename = `ifc_${item.campaign_id}_row${creativePayload.row_number}_${Date.now()}.png`;
      const localImagePath = `/uploads/products/${safeFilename}`;
      const absoluteLocalPath = path.join(process.cwd(), 'public', 'uploads', 'products', safeFilename);

      const uploadsDir = path.dirname(absoluteLocalPath);
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      await downloadECommerceImage(directImgUrl, absoluteLocalPath);

      creativePayload.product_ref_image_path = localImagePath;
      creativePayload.product_filename_declare = safeFilename;

      updateInstantCampaignItem(item.id, {
        row_creative_payload: JSON.stringify(creativePayload),
        generation_status: 'pending'
      });

      console.log(`[IFC Sourcing] Pengunduhan gambar langsung berhasil untuk item ${item.id}. Status diubah ke pending.`);
      return { success: true };
    } catch (error) {
      updateInstantCampaignItem(item.id, { generation_status: 'failed' });
      console.error(`[IFC Sourcing] Gagal mengunduh gambar langsung untuk item ${item.id}:`, error);
      throw error;
    }
  } else {
    console.log(`[IFC Sourcing] Item ${item.id} tidak memerlukan download gambar. Lewati sourcing.`);
    updateInstantCampaignItem(item.id, { generation_status: 'pending' });
    return { success: true, bypassed: true };
  }
}

/**
 * IFC Stage 1: Ingestion & Adaption to OPC structure
 */
export async function processInstantGenerator(payload, job) {
  const { parseGeminiJSON } = await import('./json-parser');
  const { getInstantCampaign, updateInstantCampaignItem, getDb } = await import('./db');
  const { executeWithKeyPool } = await import('./gemini');
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const path = await import('path');
  const fs = await import('fs');

  const db = getDb();
  const itemId = payload?.item_id;
  let item;
  if (itemId) {
    item = await db.prepare('SELECT * FROM instant_campaign_items WHERE id = ?').get(itemId);
  } else {
    const { getNextPendingInstantGeneratorItem } = await import('./db');
    item = getNextPendingInstantGeneratorItem();
  }
  if (!item) return { skip: true, reason: itemId ? `Item ${itemId} not found` : 'No pending instant generator items found' };

  const campaign = await getInstantCampaign(item.campaign_id);
  if (!campaign) return { skip: true, reason: `Campaign ${item.campaign_id} not found` };

  overrideInstantCampaignIfMassProd(campaign, item);

  updateInstantCampaignItem(item.id, { generation_status: 'processing' });

  try {
    let brandConfig = null;
    if (campaign.brand_profile_id) {
      const { getBrandProfile } = await import('./db');
      brandConfig = await getBrandProfile(campaign.brand_profile_id);
    }

    const { getAllKnowledgeBasesWithContent } = await import('./db');
    const kbs = await getAllKnowledgeBasesWithContent();
    const allowedKBs = ['PROMPT_SYSTEM', 'REALIST_VIRAL_NARRATIVE', 'STRATEGIC_FRAMEWORKS', 'NARRATIVE_STRUCTURE'];
    const kbCombined = kbs
      .filter(kb => allowedKBs.some(allowed => kb.name.includes(allowed)))
      .map((kb, i) => `=== KNOWLEDGE BASE ${i + 1}: ${kb.name} ===\n${kb.content}\n`)
      .join('\n');

    let brandMandate = '';
    if (brandConfig) {
      brandMandate = `\n========================================================================
🚨 BRAND IDENTITY TRANSFORMATION MANDATE (CRITICAL)
========================================================================
Semua output wajib diselaraskan dengan identitas Brand berikut:
- Nama Brand: ${brandConfig.brand_name}
- Tone of Voice (Gaya Bicara Naskah): ${brandConfig.tone_of_voice}
- Gaya Estetika Visual: ${brandConfig.visual_signature}
- Palet Warna Kamera: ${brandConfig.color_palette}
- ELEMEN TERLARANG (Jangan Dimunculkan di Visual/Prompt): ${brandConfig.forbidden_elements}
- Slogan Kampanye/CTA Penutup: ${brandConfig.brand_slogan_or_cta}

${brandConfig.raw_guideline_text ? `[FULL BRAND GUIDELINE CONTEXT]\n${brandConfig.raw_guideline_text.substring(0, 8000)}` : ''}

ATURAN ADAPTASI:
1. JANGAN kloning naskah mentah. Gaya bahasa naskah WAJIB bertipe "${brandConfig.tone_of_voice}".
2. visual_description dan T2I/I2V prompts wajib menggunakan panduan visual: "${brandConfig.visual_signature}" dan warna "${brandConfig.color_palette}".
3. Pastikan TIDAK ADA satupun ELEMEN TERLARANG dari daftar "${brandConfig.forbidden_elements}" yang masuk ke visual_description atau prompts.
4. Akhiri scene terakhir dengan menyertakan Slogan Brand: "${brandConfig.brand_slogan_or_cta}".
========================================================================\n`;
    }

    const rowPayload = item.row_creative_payload ? JSON.parse(item.row_creative_payload) : {};
    const finalProductName = rowPayload.product_name || campaign.product_name || '';
    const finalProductDescription = rowPayload.product_desc || campaign.product_description || '';
    const finalProductUsp = rowPayload.product_usp || '';

    const { getPackagingInstruction } = await import('./prompts');
    const productDataForPkg = {
      packaging_type: rowPayload.packaging_type || campaign.packaging_type || '',
      is_in_packaging: rowPayload.is_in_packaging || campaign.is_in_packaging || 0
    };
    const pkgInstruction = getPackagingInstruction(productDataForPkg);

    const config = campaign.config || {};
    const targetLanguage = config.target_language || 'id-ID';
    const languageName = targetLanguage === 'en-US' ? 'ENGLISH (US)' : 'INDONESIAN';
    const targetAiEngine = config.target_ai_engine || 'Google Veo (8s)';
    const narrativeMode = config.narrative_mode || 'Storytelling';
    const visualStyle = config.visual_style || 'Cinematic';
    const faceVisibility = config.face_visibility || 'Faceless';
    const aspectRatio = config.aspect_ratio || '9:16';
    const totalClips = config.total_clips || 4;
    const voicePersona = config.voice_persona || 'Aoede';
    const speedControl = config.speed_control || 2.5;
    const wordsPerClip = config.words_per_clip || 12;
    const customInstruction = config.custom_instruction || '';

    const masterPrompt = `Kamu adalah "MAKNA v54.9 INFINITE INDUSTRIAL ENGINE" - INSTANT CONTENT FACTORY.
Tugasmu adalah menganalisis produk dan merancang SATU JSON payload padat yang berisi Strategi, Storyboard, Naskah (Voiceover), dan Prompts AI Visual, semua sekaligus!

[KNOWLEDGE BASE INJECTION]
${kbCombined}

[DATA PRODUK]
- Nama: ${finalProductName}
- Deskripsi: ${finalProductDescription}${pkgInstruction}
${finalProductUsp ? `- USP: ${finalProductUsp}` : ''}

[KONFIGURASI KREATIF]
- Target AI Engine: ${targetAiEngine} (Penting untuk menyesuaikan panjang durasi prompt dan instruksi visual khusus)
- Narrative Mode: ${narrativeMode}
- Visual Style: ${visualStyle}
- Face Visibility: ${faceVisibility}
- Aspect Ratio Target: ${aspectRatio}
- Jumlah Klip/Scene: EXACTLY ${totalClips} klip.
- Voice Persona Target: ${voicePersona} (Sesuaikan gaya bahasa naskah dengan persona suara ini)
- Target Kecepatan Bicara: ${speedControl} kata/detik
- Batas Kata per Klip: Maksimal ${wordsPerClip} kata.
- Custom Instructions: ${customInstruction || 'Tidak ada instruksi khusus.'}
- Target Language: ${languageName}
- LANGUAGE MANDATE (SANGAT KETAT):
  * Jika target bahasa adalah ENGLISH (US): Naskah voiceover ("voiceover_text") dan caption sosial media ("tiktok_caption", "instagram_caption", "youtube_shorts_title", "youtube_shorts_desc") wajib ditulis sepenuhnya dalam Bahasa Inggris yang natural.
  * Jika target bahasa adalah INDONESIAN: Naskah voiceover ("voiceover_text") dan caption sosial media wajib ditulis sepenuhnya dalam Bahasa Indonesia.
  * PERINGATAN: Prompt visual ("t2i_prompt_plaintext" dan "i2v_prompt_plaintext") wajib TETAP selalu ditulis dalam Bahasa Inggris.

${brandMandate}
[TUGAS AGENTIC CHAIN-OF-THOUGHT]
Kamu WAJIB berpikir secara berurutan saat menyusun JSON:
1. Pikirkan SWOT & USP (Strategic Analysis).
2. Tentukan Profil Audiens & Konsep Inti (CEP, VFO, Hook).
3. Untuk setiap adegan (wajib buat tepat ${totalClips} klip/adegan), tulis naskah Voiceover dalam bahasa ${languageName} yang sangat natural, tidak kaku, sesuai dengan mode narasi dan *Voice Persona*. Pastikan jumlah kata sesuai dengan durasi klip (Durasi = Jumlah kata / ${speedControl}).
4. Terjemahkan aksi visual berdasarkan naskah menjadi Prompt T2I dan I2V dalam Bahasa Inggris Murni tanpa enter/newline, pastikan memakai gaya "5-Layer Optical Stack", disesuaikan dengan limitasi/karakteristik *Target AI Engine* (${targetAiEngine}).
5. Buat caption sosial media yang SEO-friendly dalam bahasa ${languageName}.

[ATURAN JSON STRICT FORMATTING]
1. OUTPUT WAJIB BERUPA JSON LENGKAP tanpa karakter backtick (\`\`\`) di awal atau akhir (murni text JSON).
2. DILARANG menggunakan baris baru (\\n) di dalam string "t2i_prompt_plaintext" dan "i2v_prompt_plaintext".
3. Escape double quotes dengan benar.

{
  "campaign_strategy": {
    "swot_analysis": {
      "strengths": ["...", "..."],
      "weaknesses": ["...", "..."],
      "opportunities": ["...", "..."],
      "threats": ["...", "..."]
    },
    "unique_selling_point": "Kalimat deklarasi USP produk yang tajam",
    "target_audience_profile": "Demografis dan psikografis audiens ideal",
    "core_campaign_concept": {
      "cep_type": "Tipe CEP pilihan dari kerangka kerja",
      "situation_context": "Konteks situasi relevan yang membungkus iklan",
      "vfo_matrix": "Penyelarasan Value, Feature, dan Outcome",
      "hook_strategy": "Metode hook 3 detik pertama"
    }
  },
  "production_storyboard": [
    {
      "scene_number": 1,
      "duration": "8s",
      "audio_segment": {
        "voiceover_text": "Teks Voiceover alami...",
        "word_count": 12,
        "audio_mood": "Instruksi intonasi"
      },
      "visual_segment": {
        "visual_action": "Deskripsi visual sinkron",
        "camera_movement": "Instruksi kamera sinematik"
      },
      "ai_generation_prompts": {
        "t2i_prompt_plaintext": "ENGLISH PLAINTEXT 5-Layer Optical Stack prompt siap copy-paste. MUST IN ONE LINE. --ar ${aspectRatio}",
        "i2v_prompt_plaintext": "ENGLISH PLAINTEXT motion prompt siap copy-paste. MUST IN ONE LINE. --ar ${aspectRatio}"
      }
    }
  ],
  "distribution_assets": {
    "tiktok_caption": "Caption TikTok",
    "instagram_caption": "Caption IG",
    "youtube_shorts_title": "Judul YouTube Shorts",
    "youtube_shorts_desc": "Deskripsi Shorts"
  }
}`;

    const geminiPayload = [];
    const refImagePath = rowPayload.product_ref_image_path;
    const absoluteImagePath = refImagePath ? (refImagePath.startsWith('/') ? path.join(process.cwd(), 'public', refImagePath) : refImagePath) : null;
    const imageExists = absoluteImagePath && fs.existsSync(absoluteImagePath);

    if (imageExists) {
      const ext = path.extname(absoluteImagePath).toLowerCase();
      let mimeType = 'image/jpeg';
      if (ext === '.png') mimeType = 'image/png';
      if (ext === '.webp') mimeType = 'image/webp';

      const imageBuffer = fs.readFileSync(absoluteImagePath);
      geminiPayload.push({
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType
        }
      });
    }

    geminiPayload.push({ text: masterPrompt });

    const rawResponse = await executeWithKeyPool(1, async (apiKey) => {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: GEMINI_MODELS.PRIMARY,
        generationConfig: {
          temperature: 0.85,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 65535,
          responseMimeType: 'application/json'
        }
      });
      const result = await model.generateContent(geminiPayload);
      return result.response.text();
    });

    const parsedJson = parseGeminiJSON(rawResponse);

    // Adapt / translate IFC output structure to OPC structure
    const adaptedJson = {
      ...parsedJson,
      voiceover: (parsedJson.production_storyboard || []).map(scene => ({
        clip: scene.scene_number,
        narration: scene.audio_segment?.voiceover_text || ''
      })),
      t2v_prompts: (parsedJson.production_storyboard || []).map(scene => ({
        clip: scene.scene_number,
        prompt: scene.ai_generation_prompts?.i2v_prompt_plaintext || scene.ai_generation_prompts?.t2i_prompt_plaintext || ''
      })),
      t2i_prompts: (parsedJson.production_storyboard || []).map(scene => ({
        clip: scene.scene_number,
        prompt: scene.ai_generation_prompts?.t2i_prompt_plaintext || ''
      })),
      i2v_prompts: (parsedJson.production_storyboard || []).map(scene => ({
        clip: scene.scene_number,
        prompt: scene.ai_generation_prompts?.i2v_prompt_plaintext || ''
      })),
      yt_title: parsedJson.distribution_assets?.youtube_shorts_title || '',
      yt_desc: parsedJson.distribution_assets?.youtube_shorts_desc || '',
      tiktok_caption: parsedJson.distribution_assets?.tiktok_caption || '',
      ig_caption: parsedJson.distribution_assets?.instagram_caption || ''
    };

    let safeVoiceover = adaptedJson.voiceover || [];
    let complianceStatus = 'skipped';
    let complianceScore = 0;
    let complianceLog = null;

    if (campaign.enable_vo_audit === 1 || campaign.enable_vo_audit !== 0) {
      try {
        console.log(`[IFC Generator] Running TikTok safe VO compliance audit for item #${item.id}...`);
        const fullOriginalVo = (adaptedJson.voiceover || []).map(v => v.narration || '').join('\n');
        const captionText = adaptedJson.tiktok_caption || '';
        const { auditScriptForTikTok } = await import('./tiktok-compliance-service.js');
        const auditResult = await auditScriptForTikTok(fullOriginalVo, captionText);

        safeVoiceover = (adaptedJson.voiceover || []).map((v, idx) => ({
          ...v,
          narration: (auditResult.revised_script && auditResult.revised_script[idx] !== undefined)
            ? auditResult.revised_script[idx]
            : (v.narration || '')
        }));

        complianceStatus = auditResult.verdict || 'pass';
        complianceScore = auditResult.risk_score || 0;
        complianceLog = auditResult;
      } catch (err) {
        console.error('[IFC Generator] Compliance audit error:', err.message);
      }
    }

    updateInstantCampaignItem(item.id, {
      generation_status: 'completed',
      result_json: JSON.stringify({ ...adaptedJson, voiceover: safeVoiceover }),
      original_voiceover: JSON.stringify(adaptedJson.voiceover || []),
      tiktok_safe_voiceover: JSON.stringify(safeVoiceover),
      compliance_status: complianceStatus,
      compliance_score: complianceScore,
      compliance_log_json: complianceLog ? JSON.stringify(complianceLog) : null,
      selected_vo_version: 'original'
    });

    console.log(`[IFC Generator] Storyboard successfully generated for item #${item.id}`);
    return { success: true };

  } catch (error) {
    const { logSystemError } = await import('./error-logger');
    logSystemError('IFC Generator', error, item.campaign_id);
    updateInstantCampaignItem(item.id, { generation_status: 'failed' });
    console.error(`[IFC Generator] Failed to generate storyboard for item #${item.id}:`, error);
    throw error;
  }
}

/**
 * IFC Stage 2: TTS Processing using Google TTS / Minimax
 */
export async function processInstantTts(payload, job) {
  const { getNextPendingInstantTtsItem, updateInstantCampaignItem, getInstantCampaign, createTtsBatch, createTtsClip, updateTtsClip } = await import('./db');
  const { generateMinimaxVO } = await import('./minimax-tts');
  const { generateGeminiExact8sAudio } = await import('./gemini-8s-tts');
  const path = await import('path');
  const fs = await import('fs');

  const itemId = payload?.item_id;
  let item;
  if (itemId) {
    const { getDb } = await import('./db');
    const db = getDb();
    item = await db.prepare('SELECT * FROM instant_campaign_items WHERE id = ?').get(itemId);
  } else {
    item = getNextPendingInstantTtsItem();
  }
  if (!item) return { skip: true, reason: itemId ? `Item ${itemId} not found` : 'No pending IFC items for TTS' };

  const campaign = await getInstantCampaign(item.campaign_id);
  if (!campaign) return { skip: true, reason: `Campaign ${item.campaign_id} not found` };

  overrideInstantCampaignIfMassProd(campaign, item);

  if (campaign.enable_tts === 0) {
    updateInstantCampaignItem(item.id, { tts_status: 'skipped', tts_batch_id: 'skipped' });
    return { processed: true, item_id: item.id, message: 'Skipped TTS stage' };
  }

  updateInstantCampaignItem(item.id, { tts_status: 'processing' });

  try {
    const parsed = JSON.parse(item.result_json || '{}');
    const voiceover = parsed.voiceover || [];

    if (voiceover.length === 0) {
      updateInstantCampaignItem(item.id, { tts_status: 'completed', tts_batch_id: 'no_audio' });
      return { processed: true, item_id: item.id, message: 'Skipped TTS due to empty voiceover' };
    }

    const batchId = `ttsb_ifc_${item.id}_${Date.now()}`;
    const config = campaign.config || {};
    const persona = config.voice_persona || 'Aoede';

    // Auto detect voice provider: Google voices vs Minimax voices
    const googlePersonas = ['Aoede', 'Leda', 'Despina', 'Callirrhoe', 'Autonoe', 'Erinome', 'Laomedeia', 'Achernar', 'Charon', 'Puck', 'Fenrir', 'Orus', 'Algenib', 'Iapetus'];
    const isGoogleVoice = googlePersonas.includes(persona);
    const provider = isGoogleVoice ? 'gemini' : 'minimax';

    createTtsBatch({
      id: batchId,
      source_type: 'instant_campaign',
      source_ref_id: item.id.toString(),
      provider_active: provider,
      voice_persona: persona,
      config_speed: config.speed_control !== undefined ? Number(config.speed_control) : 1.0,
      config_volume: 1.0
    });

    const tempDir = path.join(process.cwd(), 'public', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    for (let i = 0; i < voiceover.length; i++) {
      const clipId = `ttsc_ifc_${Date.now()}_${i}`;
      const text = voiceover[i].narration || '';
      const ext = provider === 'minimax' ? 'mp3' : 'wav';
      const outputFileName = `tts_ifc_${batchId}_clip_${i}.${ext}`;
      const localPath = path.join(tempDir, outputFileName);
      const publicPath = `/temp/${outputFileName}`;

      createTtsClip({
        id: clipId,
        batch_id: batchId,
        clip_index: i,
        source_text: text,
        audio_path: publicPath,
        status: 'processing'
      });

      try {
        if (provider === 'minimax') {
          await generateMinimaxVO(text, persona, localPath, {
            speed: config.speed_control !== undefined ? Number(config.speed_control) : 1.0,
            volume: 1.0,
            model: 'speech-2.8-turbo',
            language: config.target_language || 'id-ID'
          });
        } else {
          await generateGeminiExact8sAudio(text, persona, localPath);
        }
        updateTtsClip(clipId, { status: 'completed' });

        if (provider !== 'minimax' && i < voiceover.length - 1) {
          console.log(`[IFC TTS] Pacing delay: waiting 8s before next clip...`);
          await new Promise(resolve => setTimeout(resolve, 8000));
        }
      } catch (clipErr) {
        console.error(`[IFC TTS] Failed to render clip #${i} in batch ${batchId}:`, clipErr.message);
        updateTtsClip(clipId, { status: 'failed' });
        throw clipErr;
      }
    }

    updateInstantCampaignItem(item.id, {
      tts_status: 'completed',
      tts_batch_id: batchId
    });

    return { processed: true, item_id: item.id, tts_batch_id: batchId };
  } catch (error) {
    const { logSystemError } = await import('./error-logger');
    logSystemError('IFC TTS', error, item.campaign_id);
    updateInstantCampaignItem(item.id, { tts_status: 'failed' });
    throw error;
  }
}

/**
 * IFC Stage 3: G-Labs Visual Processing & Image-to-Video Bridging
 */
export async function processInstantGlabs(payload, job) {
  const { getNextPendingInstantGlabsItem, updateInstantCampaignItem, getInstantCampaign, getSetting, getDb, updateGlabsTaskStatus, insertGlabsTask } = await import('./db');
  const { generateVideo, getTaskStatus, getFileUrl } = await import('./webhook-client');
  const path = await import('path');
  const fs = await import('fs');

  const db = getDb();
  const itemId = payload?.item_id;
  const productData = null;

  const fileToBase64 = (filePath) => {
    if (!filePath) return null;
    let absolutePath = filePath;
    if (!fs.existsSync(absolutePath)) {
      const relativePart = filePath.startsWith('/') ? filePath.slice(1) : filePath;
      absolutePath = path.join(process.cwd(), 'public', relativePart);
    }
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found for base64: ${filePath}`);
    }
    const fileBuffer = fs.readFileSync(absolutePath);
    let mimeType = 'image/png';
    if (fileBuffer[0] === 0xFF && fileBuffer[1] === 0xD8 && fileBuffer[2] === 0xFF) {
      mimeType = 'image/jpeg';
    } else if (fileBuffer[0] === 0x89 && fileBuffer[1] === 0x50 && fileBuffer[2] === 0x4E && fileBuffer[3] === 0x47) {
      mimeType = 'image/png';
    } else if (fileBuffer[0] === 0x52 && fileBuffer[1] === 0x49 && fileBuffer[2] === 0x46 && fileBuffer[3] === 0x46) {
      mimeType = 'image/webp';
    }
    return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
  };

  // Phase 1: Poll processing tasks first
  let item = null;
  if (itemId) {
    item = await db.prepare(
      "SELECT * FROM instant_campaign_items WHERE id = ? AND visual_status = 'processing'"
    ).get(itemId);
  } else {
    item = await db.prepare(
      "SELECT i.* FROM instant_campaign_items i JOIN instant_campaigns c ON i.campaign_id = c.id WHERE i.visual_status = 'processing' AND c.status = 'running' AND c.local_scheduler = 1 ORDER BY i.id ASC LIMIT 1"
    ).get();
  }

  if (item) {
    const taskIds = JSON.parse(item.visual_tasks_json || '[]');
    if (taskIds.length === 0) {
      updateInstantCampaignItem(item.id, { visual_status: 'pending' });
      return { processed: true, message: 'Reset visual_status to pending' };
    }

    const completedUrls = [];
    let allCompleted = true;
    let anyFailed = false;
    let errorDetail = '';

    for (let i = 0; i < taskIds.length; i++) {
      const taskId = taskIds[i];
      try {
        const cachedTask = await db.prepare('SELECT status, video_url FROM glabs_tasks WHERE task_id = ?').get(taskId);
        if (cachedTask && cachedTask.status === 'completed' && cachedTask.video_url) {
          completedUrls[i] = cachedTask.video_url;
          continue;
        }

        const taskResult = await getTaskStatus(taskId);
        const taskStatus = (taskResult?.status || '').toLowerCase();

        if (taskStatus === 'completed') {
          const files = taskResult.results || taskResult.files || [];
          let videoFile = files.find(f => f.endsWith('.mp4')) || files[0];
          if (videoFile && (videoFile.startsWith('http://') || videoFile.startsWith('https://'))) {
            videoFile = videoFile.split('/').pop();
          }
          if (videoFile) {
            const completedUrl = getFileUrl(videoFile, taskId);
            completedUrls[i] = completedUrl;
            try {
              updateGlabsTaskStatus(taskId, 'completed', completedUrl);
            } catch { }
          } else {
            allCompleted = false;
          }
        } else if (taskStatus === 'failed') {
          anyFailed = true;
          const rawErr = taskResult?.error || taskResult?.error_detail || taskResult?.message || '';
          errorDetail = `Task ${taskId} failed on GLabs: ${rawErr}`;
          try {
            updateGlabsTaskStatus(taskId, 'failed');
          } catch { }
        } else {
          allCompleted = false;
        }
      } catch (pollErr) {
        allCompleted = false;
        console.error(`[IFC Glabs] Polling error for task ${taskId}:`, pollErr.message);
      }
    }

    if (anyFailed) {
      updateInstantCampaignItem(item.id, { visual_status: 'failed' });
      throw new Error(`Visual generation failed: ${errorDetail}`);
    }

    if (allCompleted && completedUrls.filter(Boolean).length === taskIds.length) {
      const localPaths = [];
      const tempDir = path.join(process.cwd(), 'public', 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      for (let i = 0; i < completedUrls.length; i++) {
        const url = completedUrls[i];
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to download visual clip from URL: ${url}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        const filename = `ifc_glabs_${item.id}_clip_${i}.mp4`;
        const localPath = path.join(tempDir, filename);
        fs.writeFileSync(localPath, buffer);
        localPaths.push(`/temp/${filename}`);
      }

      let batchFolderId = null;
      let uploadLink = '';
      try {
        const campaign = await getInstantCampaign(item.campaign_id);
        if (campaign) {
          overrideInstantCampaignIfMassProd(campaign, item);
          const brandProfile = await db.prepare('SELECT * FROM brand_profiles WHERE LOWER(brand_name) = LOWER(?)').get(campaign.account_name || '');
          const campaignItems = await db.prepare('SELECT id FROM instant_campaign_items WHERE campaign_id = ? ORDER BY id ASC').all(item.campaign_id);
          const itemIndex = campaignItems.findIndex(i => i.id === item.id);
          const sequenceNumber = itemIndex !== -1 ? itemIndex + 1 : 1;
          const paddedIndex = String(sequenceNumber).padStart(3, '0');

          const { uploadVideoToFolder, getOrCreateCampaignFolder, getOrCreateFolderInFolder } = await import('./drive-uploader');
          const campaignFolderId = await getOrCreateCampaignFolder(campaign.product_name, 'IFC_Campaign_', brandProfile);

          const batchFolderName = `IFC_${campaign.product_name.replace(/[^a-zA-Z0-9_]/g, '_')}_${paddedIndex}`;
          batchFolderId = await getOrCreateFolderInFolder(batchFolderName, campaignFolderId);

          for (let i = 0; i < localPaths.length; i++) {
            const clipRelativePath = localPaths[i];
            const localVideoPath = path.join(process.cwd(), 'public', clipRelativePath);
            const clipFileName = `IFC-${campaign.product_name}-${paddedIndex}-Clip-${i + 1}.mp4`;
            await uploadVideoToFolder(localVideoPath, clipFileName, batchFolderId);
          }

          // Upload audio clips if they exist
          if (item.tts_batch_id && item.tts_batch_id !== 'skipped') {
            try {
              const { uploadLocalFileToFolder } = await import('./drive-uploader');
              const ttsClips = await db.prepare("SELECT * FROM tts_studio_clips WHERE batch_id = ? AND status = 'completed'").all(item.tts_batch_id);
              for (const clip of ttsClips) {
                if (clip.audio_path) {
                  const audioLocalPath = path.join(process.cwd(), 'public', clip.audio_path);
                  if (fs.existsSync(audioLocalPath)) {
                    const audioFileName = `IFC-${campaign.product_name}-${paddedIndex}-Audio-${clip.clip_index + 1}.mp3`;
                    await uploadLocalFileToFolder(audioLocalPath, audioFileName, batchFolderId, 'audio/mpeg');
                  }
                }
              }
            } catch (audioErr) {
              console.error(`[IFC Glabs Drive Audio Upload] Failed:`, audioErr.message);
            }
          }

          uploadLink = `https://drive.google.com/drive/folders/${batchFolderId}`;
        }
      } catch (driveErr) {
        console.error(`[IFC Glabs Upload] Failed upload to Google Drive:`, driveErr.message);
      }

      updateInstantCampaignItem(item.id, {
        visual_status: 'completed',
        visual_clip_paths: JSON.stringify(localPaths),
        drive_link: uploadLink || null,
        upload_status: uploadLink ? 'completed' : 'failed'
      });

      return { processed: true, item_id: item.id, clips: localPaths, folder_url: uploadLink };
    }

    return { skip: true, reason: `Visual tasks still processing for item #${item.id}` };
  }

  // Phase 2: Submit pending tasks
  if (itemId) {
    item = await db.prepare('SELECT * FROM instant_campaign_items WHERE id = ?').get(itemId);
  } else {
    item = getNextPendingInstantGlabsItem();
  }
  if (!item) return { skip: true, reason: itemId ? `Item ${itemId} not found` : 'No pending IFC items to generate visuals' };

  const campaign = await getInstantCampaign(item.campaign_id);
  if (!campaign) return { skip: true, reason: `Campaign ${item.campaign_id} not found` };
  // [Fix v2.2.87] instant_campaign_configs tidak memiliki kolom brand — brandProfile null (fallback ke global)
  const brandProfile = null;

  overrideInstantCampaignIfMassProd(campaign, item);

  if (campaign.enable_glabs === 0) {
    updateInstantCampaignItem(item.id, {
      visual_status: 'skipped',
      visual_clip_paths: JSON.stringify([])
    });
    return { processed: true, item_id: item.id, message: 'G-Labs is inactive. Skipped visuals stage.' };
  }

  const parsed = JSON.parse(item.result_json || '{}');
  const config = campaign.config || {};
  const targetClips = config.total_clips || 4;
  const bridgeAtClip = campaign.bridge_at_clip !== undefined ? Number(campaign.bridge_at_clip) : 2;
  const visualMode = campaign.visual_mode || 'hybrid_lock';

  if (!parsed.t2v_prompts && !parsed.t2i_prompts && !parsed.i2v_prompts) {
    updateInstantCampaignItem(item.id, {
      visual_status: 'completed',
      visual_clip_paths: JSON.stringify([])
    });
    return { processed: true, item_id: item.id, message: 'Completed immediately because of 0 prompts' };
  }

  const existingTaskIds = [];
  try {
    if (item.visual_tasks_json) {
      const parsedTasks = JSON.parse(item.visual_tasks_json);
      if (Array.isArray(parsedTasks)) {
        existingTaskIds.push(...parsedTasks);
      }
    }
  } catch (e) {
    console.error(`[IFC Glabs] Failed to parse existing tasks:`, e.message);
  }

  updateInstantCampaignItem(item.id, { visual_status: 'processing' });

  const webhookPort = getSetting('webhook_port') || '8765';
  const webhookApiKey = getSetting('webhook_api_key') || '';
  const videoModel = 'veo_31_lite'; // default

  const taskIds = [];
  try {
    for (let c = 1; c <= targetClips; c++) {
      let videoResult = null;
      let promptText = '';

      const isHybridLockClip = (campaign.is_bridging_active && visualMode === 'hybrid_lock' && c === bridgeAtClip);

      const existingTaskId = existingTaskIds[c - 1];
      let reuseCompletedTask = false;
      if (existingTaskId) {
        let existingTask = await db.prepare('SELECT * FROM glabs_tasks WHERE task_id = ?').get(existingTaskId);
        if (existingTask) {
          if (existingTask.status === 'processing') {
            taskIds.push(existingTaskId);
            continue;
          }

          if (existingTask.status === 'completed' && existingTask.video_url) {
            const expectedPrompt = isHybridLockClip ?
              ((parsed.i2v_prompts || []).find(p => Number(p.clip) === c)?.prompt || '') :
              ((parsed.t2v_prompts || []).find(p => Number(p.clip) === c)?.prompt || '');

            if (existingTask.prompt === expectedPrompt) {
              console.log(`[IFC Glabs] Reusing completed task ${existingTaskId} for clip ${c}`);
              taskIds.push(existingTaskId);
              reuseCompletedTask = true;
            }
          }
        }
      }

      if (reuseCompletedTask) {
        continue;
      }

      if (isHybridLockClip) {
        const t2iPromptObj = (parsed.t2i_prompts || []).find(p => Number(p.clip) === c);
        const t2iPromptText = t2iPromptObj ? t2iPromptObj.prompt : '';
        if (!t2iPromptText) {
          throw new Error(`T2I prompt for clip ${c} not found`);
        }

        const startFrameFilename = `ifc_start_frame_${item.id}_clip_${c}.png`;
        const startFrameLocalPath = path.join(process.cwd(), 'public', 'uploads', 'start_frames', startFrameFilename);
        const relativeStartFramePath = `/uploads/start_frames/${startFrameFilename}`;

        let startFrameExists = fs.existsSync(startFrameLocalPath);

        if (!startFrameExists) {
          productBase64 = resolveProductBase64(campaign, productData, rowPayload);

          console.log(`[IFC Glabs] Submitting T2I task for clip ${c}...`);
          const { generateImage } = await import('./webhook-client');

          let t2iCompleted = false;
          let t2iImageUrl = null;

          const runT2I = async (useRefImage) => {
            const t2iResult = await generateImage({
              prompt: t2iPromptText,
              ref_image_base64: useRefImage ? productBase64 : null,
              ref_image_weight: useRefImage ? 0.75 : 0.0,
              ar: config.aspect_ratio || '9:16',
              webhookOverride: brandProfile
            });

            if (!t2iResult?.task_id) {
              throw new Error(`Failed to generate T2I start frame task`);
            }

            const maxPoll = 40;
            for (let poll = 0; poll < maxPoll; poll++) {
              await new Promise(r => setTimeout(r, 3000));
              const t2iStatus = await getTaskStatus(t2iResult.task_id);
              if (t2iStatus?.status?.toLowerCase() === 'completed') {
                const results = t2iStatus.results || t2iStatus.files || [];
                const imgFile = results.find(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.webp')) || results[0];
                if (imgFile) {
                  t2iImageUrl = getFileUrl(imgFile.split('/').pop(), t2iResult.task_id);
                  t2iCompleted = true;
                  break;
                }
              } else if (t2iStatus?.status?.toLowerCase() === 'failed') {
                throw new Error(`T2I task failed on webhook provider`);
              }
            }
          };

          try {
            await runT2I(true);
          } catch (t2iErr) {
            console.warn(`[IFC Glabs] T2I start frame generation with reference image failed: ${t2iErr.message}. Retrying WITHOUT reference image...`);
            await runT2I(false);
          }

          if (!t2iCompleted || !t2iImageUrl) {
            throw new Error(`T2I task poll timed out or did not return visual URL`);
          }

          const dlResponse = await fetch(t2iImageUrl);
          if (!dlResponse.ok) {
            throw new Error(`Failed to download start frame: ${t2iImageUrl}`);
          }
          const sfBuffer = Buffer.from(await dlResponse.arrayBuffer());
          const sfDir = path.dirname(startFrameLocalPath);
          if (!fs.existsSync(sfDir)) fs.mkdirSync(sfDir, { recursive: true });
          fs.writeFileSync(startFrameLocalPath, sfBuffer);
          console.log(`[IFC Glabs] Successfully saved JIT start frame to ${startFrameLocalPath}`);
        }

        const startFrameBase64 = fileToBase64(relativeStartFramePath);
        const i2vPromptObj = (parsed.i2v_prompts || []).find(p => Number(p.clip) === c);
        promptText = i2vPromptObj ? i2vPromptObj.prompt : '';

        console.log(`[IFC Glabs] Submitting I2V task for clip ${c} with JIT start frame...`);
        videoResult = await generateVideo({
          prompt: promptText,
          model: videoModel,
          aspect_ratio: config.aspect_ratio || '9:16',
          mode: 'start_image',
          reference_images: [startFrameBase64],
          webhookOverride: brandProfile
        });
      } else {
        const t2vPromptObj = (parsed.t2v_prompts || []).find(p => Number(p.clip) === c);
        promptText = t2vPromptObj ? t2vPromptObj.prompt : '';

        console.log(`[IFC Glabs] Submitting T2V task for clip ${c}: "${promptText}"`);
        videoResult = await generateVideo({
          prompt: promptText,
          model: videoModel,
          aspect_ratio: config.aspect_ratio || '9:16',
          webhookOverride: brandProfile
        });
      }

      if (!videoResult?.task_id) {
        throw new Error(`G-Labs submission API returned empty payload for clip ${c}`);
      }

      insertGlabsTask({
        task_id: videoResult.task_id,
        campaign_id: item.campaign_id,
        item_id: item.id,
        clip_index: c,
        prompt: promptText,
        status: 'processing'
      });

      taskIds.push(videoResult.task_id);
      updateInstantCampaignItem(item.id, {
        visual_tasks_json: JSON.stringify(taskIds)
      });

      console.log(`[IFC Glabs] Successfully scheduled task ${videoResult.task_id} for clip ${c}`);
      await new Promise(r => setTimeout(r, 2000));
    }

    updateInstantCampaignItem(item.id, {
      visual_status: 'processing',
      visual_tasks_json: JSON.stringify(taskIds)
    });

    return { processed: true, item_id: item.id, tasks: taskIds };
  } catch (err) {
    const { logSystemError } = await import('./error-logger');
    logSystemError('IFC Glabs Submission', err, item.campaign_id);
    updateInstantCampaignItem(item.id, {
      visual_status: 'failed',
      visual_tasks_json: JSON.stringify(taskIds)
    });
    throw err;
  }
}

/**
 * IFC Stage 4: FFmpeg Muxing & Upload
 */
export async function processInstantFfmpeg(payload, job) {
  const { getNextPendingInstantFfmpegItem, updateInstantCampaignItem, getInstantCampaign, getSetting, getDb } = await import('./db');
  const { processTtsStudioMuxing } = await import('./video-studio-processor');
  const path = await import('path');
  const fs = await import('fs');

  const db = getDb();
  const itemId = payload?.item_id;
  let item;
  if (itemId) {
    item = await db.prepare('SELECT * FROM instant_campaign_items WHERE id = ?').get(itemId);
  } else {
    item = getNextPendingInstantFfmpegItem();
  }
  if (!item) return { skip: true, reason: itemId ? `Item ${itemId} not found` : 'No pending IFC items for FFmpeg' };

  const campaign = await getInstantCampaign(item.campaign_id);
  if (!campaign) return { skip: true, reason: `Campaign ${item.campaign_id} not found` };

  overrideInstantCampaignIfMassProd(campaign, item);

  if (campaign.enable_glabs === 0 || campaign.enable_tts === 0) {
    updateInstantCampaignItem(item.id, {
      ffmpeg_status: 'skipped',
      ffmpeg_output_path: 'skipped',
      social_post_status: 'skipped'
    });
    return { processed: true, item_id: item.id, message: 'Workflow dependencies are inactive. Skipped FFmpeg stage.' };
  }

  if (campaign.enable_ffmpeg === 0) {
    updateInstantCampaignItem(item.id, {
      ffmpeg_status: 'skipped',
      ffmpeg_output_path: 'skipped',
      upload_status: 'completed',
      drive_link: item.drive_link || null
    });
    return { processed: true, item_id: item.id, message: 'Skipped FFmpeg stage' };
  }

  updateInstantCampaignItem(item.id, { ffmpeg_status: 'processing' });

  try {
    const finalVideoFileName = `ifc_final_${item.id}.mp4`;
    const tempDir = path.join(process.cwd(), 'public', 'temp');
    const finalVideoPath = path.join(tempDir, finalVideoFileName);

    await processTtsStudioMuxing({
      id: `ifc_${item.id}`,
      videoPath: item.visual_clip_paths,
      batchId: item.tts_batch_id,
      syncOption: 'smart_sync',
      bridgeAtClip: campaign.bridge_at_clip !== undefined ? Number(campaign.bridge_at_clip) : 2,
      bgmPath: null,
      bgmVolume: 0.15,
      sfxVolume: 0.0,
      videoScale: 1.0,
      outputPath: finalVideoPath
    });

    if (!fs.existsSync(finalVideoPath)) {
      throw new Error(`Muxed output file not found at ${finalVideoPath}`);
    }

    updateInstantCampaignItem(item.id, {
      ffmpeg_status: 'completed',
      ffmpeg_output_path: `/temp/${finalVideoFileName}`,
      upload_status: 'uploading'
    });

    console.log(`[IFC FFmpeg] Uploading video to cloud storage...`);
    let driveUrl = '';

    const campaignItems = await db.prepare('SELECT id FROM instant_campaign_items WHERE campaign_id = ? ORDER BY id ASC').all(campaign.id);
    const itemIndex = campaignItems.findIndex(i => i.id === item.id);
    const sequenceNumber = itemIndex !== -1 ? itemIndex + 1 : 1;
    const paddedIndex = String(sequenceNumber).padStart(3, '0');

    try {
      const storageProvider = getSetting('storage_provider') || 'gdrive';

      if (storageProvider === 'nextcloud') {
        const { uploadBufferToNextcloud, getOrCreatePublicShareLink } = await import('./nextcloud-helper.js');
        const parentFolderName = getCampaignParentFolderName(campaign, 'IFC');
        const batchId = await getIfcBatchId(campaign, item, db);
        const filePrefix = getFilePrefixFromBatchId(batchId);
        const targetFolder = getCampaignNextcloudTargetFolder(campaign);
        const nextcloudBaseFolder = `/${targetFolder}/${parentFolderName}/${batchId}`.replace(/\/+/g, '/');

        const finalFileName = `${filePrefix}_video_final.mp4`;
        const targetPath = `${nextcloudBaseFolder}/${finalFileName}`;

        const fileBuffer = fs.readFileSync(finalVideoPath);
        const uploaded = await uploadBufferToNextcloud(fileBuffer, targetPath);
        driveUrl = await getOrCreatePublicShareLink(nextcloudBaseFolder);

        // Backup copy for backward compatibility
        try {
          await uploadBufferToNextcloud(fileBuffer, `${nextcloudBaseFolder}/video_final.mp4`);
        } catch (_) {}

        // Upload naskah.md untuk IFC
        try {
          if (item.result_json) {
            const parsedResult = JSON.parse(item.result_json || '{}');
            const { buildMarkdownContent } = await import('./export-builder');
            const markdownContent = buildMarkdownContent(parsedResult, batchId);
            await uploadBufferToNextcloud(Buffer.from(markdownContent, 'utf-8'), `${nextcloudBaseFolder}/${filePrefix}_naskah.md`);
            await uploadBufferToNextcloud(Buffer.from(markdownContent, 'utf-8'), `${nextcloudBaseFolder}/naskah.md`);
          }
        } catch (mdErr) {
          console.error('[IFC Nextcloud MD Upload] Failed:', mdErr.message);
        }

        // Upload audio clips to Nextcloud if they exist
        if (item.tts_batch_id && item.tts_batch_id !== 'skipped') {
          try {
            const ttsClips = await db.prepare("SELECT * FROM tts_studio_clips WHERE batch_id = ? AND status = 'completed'").all(item.tts_batch_id);
            for (const clip of ttsClips) {
              if (clip.audio_path) {
                const audioLocalPath = path.join(process.cwd(), 'public', clip.audio_path);
                if (fs.existsSync(audioLocalPath)) {
                  const audioFileName = `${filePrefix}_audio_clip_${clip.clip_index + 1}.mp3`;
                  const audioTargetPath = `${nextcloudBaseFolder}/${audioFileName}`;
                  const audioBuffer = fs.readFileSync(audioLocalPath);
                  await uploadBufferToNextcloud(audioBuffer, audioTargetPath);
                }
              }
            }
          } catch (audioErr) {
            console.error(`[IFC FFmpeg Nextcloud Audio Upload] Failed:`, audioErr.message);
          }
        }
      } else {
        const { uploadVideoToFolder, uploadLocalFileToFolder, getOrCreateCampaignFolder, getOrCreateFolderInFolder } = await import('./drive-uploader');

        const parentFolderName = getCampaignParentFolderName(campaign, 'IFC');
        const campaignFolderId = await getOrCreateCampaignFolder(parentFolderName, '');
        const batchId = await getIfcBatchId(campaign, item, db);
        const filePrefix = getFilePrefixFromBatchId(batchId);

        const targetUploadFolderId = await getOrCreateFolderInFolder(batchId, campaignFolderId);

        const finalVideoFileNameCloud = `${filePrefix}_video_final.mp4`;
        const uploaded = await uploadVideoToFolder(finalVideoPath, finalVideoFileNameCloud, targetUploadFolderId);
        driveUrl = uploaded.driveUrl;

        // Upload audio clips to Google Drive if they exist
        if (item.tts_batch_id && item.tts_batch_id !== 'skipped') {
          try {
            const ttsClips = await db.prepare("SELECT * FROM tts_studio_clips WHERE batch_id = ? AND status = 'completed'").all(item.tts_batch_id);
            for (const clip of ttsClips) {
              if (clip.audio_path) {
                const audioLocalPath = path.join(process.cwd(), 'public', clip.audio_path);
                if (fs.existsSync(audioLocalPath)) {
                  const audioFileName = `${filePrefix}_audio_clip_${clip.clip_index + 1}.mp3`;
                  await uploadLocalFileToFolder(audioLocalPath, audioFileName, targetUploadFolderId, 'audio/mpeg');
                }
              }
            }
          } catch (audioErr) {
            console.error(`[IFC FFmpeg Drive Audio Upload] Failed:`, audioErr.message);
          }
        }

        // Upload naskah.md ke Google Drive jika result_json ada
        if (item.result_json) {
          try {
            const parsedResult = JSON.parse(item.result_json || '{}');
            const { buildMarkdownContent } = await import('./export-builder');
            const markdownContent = buildMarkdownContent(parsedResult, batchId);
            const tempMdPath = path.join(process.cwd(), 'public', 'temp', `${filePrefix}_naskah.md`);
            fs.writeFileSync(tempMdPath, markdownContent, 'utf-8');
            await uploadLocalFileToFolder(tempMdPath, `${filePrefix}_naskah.md`, targetUploadFolderId, 'text/markdown');
            try {
              fs.unlinkSync(tempMdPath);
            } catch (_) {}
            console.log(`[IFC FFmpeg] Successfully uploaded naskah.md to Google Drive: ${targetUploadFolderId}`);
          } catch (mdErr) {
            console.error(`[IFC FFmpeg Drive MD Upload] Failed:`, mdErr.message);
          }
        }
      }
    } catch (uploadErr) {
      console.error(`[IFC FFmpeg Upload] Failed cloud upload:`, uploadErr.message);
    }

    // Save copy to local storage
    const parentFolderName = getCampaignParentFolderName(campaign, 'IFC');
    const batchId = await getIfcBatchId(campaign, item, db);
    const filePrefix = getFilePrefixFromBatchId(batchId);
    let subPath = `${parentFolderName}/${batchId}`;
    let finalFileNameLocal = `${filePrefix}_video_final.mp4`;
    await saveFileToLocalStorage(finalVideoPath, subPath, finalFileNameLocal);

    // Save copies of audios to local storage
    if (item.tts_batch_id && item.tts_batch_id !== 'skipped') {
      try {
        const ttsClips = await db.prepare("SELECT * FROM tts_studio_clips WHERE batch_id = ? AND status = 'completed'").all(item.tts_batch_id);
        for (const clip of ttsClips) {
          if (clip.audio_path) {
            const audioLocalPath = path.join(process.cwd(), 'public', clip.audio_path);
            const audioFileName = `${filePrefix}_audio_clip_${clip.clip_index + 1}.mp3`;
            await saveFileToLocalStorage(audioLocalPath, subPath, audioFileName);
          }
        }
      } catch (localAudioErr) {
        console.error(`[IFC FFmpeg Local Audio Sync] Failed:`, localAudioErr.message);
      }
    }

    updateInstantCampaignItem(item.id, {
      upload_status: driveUrl ? 'completed' : 'failed',
      drive_link: driveUrl || null
    });

    return { processed: true, item_id: item.id, output_path: `/temp/${finalVideoFileName}`, drive_url: driveUrl };
  } catch (error) {
    const { logSystemError } = await import('./error-logger');
    logSystemError('IFC FFmpeg', error, item.campaign_id);
    updateInstantCampaignItem(item.id, { ffmpeg_status: 'failed' });
    throw error;
  }
}

/**
 * IFC Stage 5: Social Posting Drafts Upload
 */
export async function processInstantSocialPoster(payload, job) {
  const { getNextPendingInstantSocialPostItem, updateInstantCampaignItem, getInstantCampaign, getSetting } = await import('./db');
  const { google } = await import('googleapis');
  const { getAuthorizedClient } = await import('./google-auth');
  const path = await import('path');

  const itemId = payload?.item_id;
  let item;
  if (itemId) {
    const { getDb } = await import('./db');
    const db = getDb();
    item = await db.prepare('SELECT * FROM instant_campaign_items WHERE id = ?').get(itemId);
  } else {
    item = getNextPendingInstantSocialPostItem();
  }
  if (!item) return { skip: true, reason: itemId ? `Item ${itemId} not found` : 'No pending IFC items for social posting' };

  const campaign = await getInstantCampaign(item.campaign_id);
  if (!campaign) return { skip: true, reason: `Campaign ${item.campaign_id} not found` };

  overrideInstantCampaignIfMassProd(campaign, item);

  if (campaign.enable_glabs === 0 || campaign.enable_tts === 0 || campaign.enable_social_post === 0) {
    updateInstantCampaignItem(item.id, { social_post_status: 'skipped' });
    return { processed: true, item_id: item.id, message: 'Social Post is inactive. Skipped Social Post stage.' };
  }

  updateInstantCampaignItem(item.id, { social_post_status: 'processing' });

  const postYoutube = campaign.post_youtube_draft;
  const postTiktok = campaign.post_tiktok_draft;
  const postFacebook = campaign.post_facebook_draft;

  const parsed = JSON.parse(item.result_json || '{}');
  const results = {};

  try {
    if (postYoutube === 1) {
      try {
        const auth = getAuthorizedClient();
        const youtube = google.youtube({ version: 'v3', auth });
        const { createReadStream } = await import('fs');
        const localVideoPath = path.join(process.cwd(), 'public', item.ffmpeg_output_path);

        const res = await youtube.videos.insert({
          part: 'snippet,status',
          requestBody: {
            snippet: {
              title: parsed.yt_title || `IFC Video #${item.id}`,
              description: parsed.yt_desc || '',
              categoryId: '22'
            },
            status: { privacyStatus: 'private' }
          },
          media: {
            body: createReadStream(localVideoPath),
            mimeType: 'video/mp4'
          }
        });
        if (res.data?.id) {
          results.youtube = `https://studio.youtube.com/video/${res.data.id}/edit`;
        }
      } catch (ytErr) {
        console.error('[IFC Social] YouTube upload failed:', ytErr.message);
      }
    }

    if (postTiktok === 1) {
      results.tiktok = 'https://ads.tiktok.com/help/article/tiktok-drafts';
    }
    if (postFacebook === 1) {
      results.facebook = 'https://www.facebook.com/creatorstudio';
    }

    updateInstantCampaignItem(item.id, {
      social_post_status: 'completed',
      social_links_json: JSON.stringify(results)
    });

    return { processed: true, item_id: item.id, links: results };
  } catch (error) {
    const { logSystemError } = await import('./error-logger');
    logSystemError('IFC Social', error, item.campaign_id);
    updateInstantCampaignItem(item.id, { social_post_status: 'failed' });
    throw error;
  }
}

// ========================
// 20. PRODUCT SCRAPER PROCESSOR (v9.0)
// Scrapes ecommerce URLs and extracts product metadata
// ========================
export async function processProductScraper(payload, job) {
  const category = payload?.category || null;
  const tags = payload?.tags || null;
  const repairMode = payload?.repair_mode ?? true;

  // Determine url list
  let urlList = [];
  if (payload?.urls && Array.isArray(payload.urls)) {
    urlList = payload.urls;
  } else if (payload?.url) {
    urlList = [payload.url];
  }

  if (urlList.length === 0) return { skip: true, reason: 'URL list is empty' };

  const { scrapeUrl, downloadECommerceImage } = await import('./url-scraper');
  const { createProductExtraction, updateProductExtraction, getDb } = await import('./db');
  const { buildProductAgentPrompt, buildBatchProductExtractionPrompt } = await import('./prompts');
  const { executeWithKeyPool, generateWithImage } = await import('./gemini');
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const { parseGeminiJSON } = await import('./json-parser');
  const { v4: uuidv4 } = await import('uuid');
  const path = await import('path');
  const fs = await import('fs');

  console.log(`[Product Scraper Job] Processing ${urlList.length} URLs in batch. Repair mode: ${repairMode}`);

  // Step 1: Scrape all URLs sequentially (or reuse existing data)
  const scrapedProducts = [];
  const scrapeErrors = {};
  const db = getDb();

  const normalizeUrl = (url) => {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      parsed.search = '';
      parsed.hash = '';
      let normalized = parsed.toString().trim();
      if (normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
      }
      normalized = normalized.replace('://www.', '://');
      return normalized;
    } catch (e) {
      let cleaned = url.trim().split('?')[0].split('#')[0];
      if (cleaned.endsWith('/')) cleaned = cleaned.slice(0, -1);
      return cleaned;
    }
  };

  const allProducts = await db.prepare('SELECT id, input_source, source_url, raw_photo_url, cleaned_photo_url, generated_photo_url, unique_selling_point, packaging_type, scraped_image_url, raw_description, t2i_prompt, i2v_action_prompt, product_name FROM product_extractions').all();

  for (let i = 0; i < urlList.length; i++) {
    const targetUrl = urlList[i];
    const tempId = `prod_${String(i + 1).padStart(2, '0')}`;

    // Cek apakah URL sudah pernah di-scrape ke database sebelum memicu browser
    const normalizedTarget = normalizeUrl(targetUrl);
    const existing = allProducts.find(p =>
      normalizeUrl(p.input_source) === normalizedTarget ||
      normalizeUrl(p.source_url) === normalizedTarget
    );

    let repairInfo = null;

    if (existing) {
      if (!repairMode) {
        console.log(`[Product Scraper Job] URL ${targetUrl} sudah ada di database (repair_mode disabled). Melewati.`);
        continue;
      }

      // Check missing columns/physical files
      const hasRawFile = existing.raw_photo_url && fs.existsSync(path.join(process.cwd(), 'public', existing.raw_photo_url));
      const hasCleanFile = existing.cleaned_photo_url && fs.existsSync(path.join(process.cwd(), 'public', existing.cleaned_photo_url));
      const hasStudioFile = existing.generated_photo_url && fs.existsSync(path.join(process.cwd(), 'public', existing.generated_photo_url));

      const needsRaw = !hasRawFile;
      const needsClean = !hasCleanFile;
      const needsStudio = !hasStudioFile;
      const needsMetadata = !existing.unique_selling_point || !existing.packaging_type || !existing.t2i_prompt || !existing.i2v_action_prompt;

      if (!needsRaw && !needsClean && !needsStudio && !needsMetadata) {
        console.log(`[Product Scraper Job] URL ${targetUrl} sudah ada dan datanya lengkap. Melewati.`);
        continue;
      }

      console.log(`[Product Scraper Job] URL ${targetUrl} terdeteksi rumpang: needsRaw=${needsRaw}, needsClean=${needsClean}, needsStudio=${needsStudio}, needsMetadata=${needsMetadata}`);

      repairInfo = {
        id: existing.id,
        needsRaw,
        needsClean,
        needsStudio,
        needsMetadata,
        existingProduct: existing
      };
    }

    // Optimization: Skip browser scraping if we already have description and image URL cached in database
    if (existing && repairInfo) {
      const hasImageCache = existing.scraped_image_url && (existing.scraped_image_url.startsWith('http://') || existing.scraped_image_url.startsWith('https://'));
      const hasTextCache = existing.raw_description && existing.raw_description.trim().length > 0;

      // If we don't need raw photo (or we have scraped_image_url), and we don't need metadata (or we have raw_description), we can skip scraping!
      const canSkipScrape = (!repairInfo.needsRaw || hasImageCache) && (!repairInfo.needsMetadata || hasTextCache);

      if (canSkipScrape) {
        console.log(`[Product Scraper Job] Menggunakan data ter-cache dari DB untuk perbaikan ID: ${existing.id} (melewati scraping browser).`);
        scrapedProducts.push({
          tempId,
          url: targetUrl,
          isRepair: true,
          repairInfo,
          scraped: {
            title: existing.product_name || '',
            description: existing.raw_description || '',
            bodyText: existing.raw_description || '',
            fullText: existing.raw_description || ''
          },
          raw_description: existing.raw_description || ''
        });
        continue;
      }
    }

    console.log(`[Product Scraper Job] Scraping [${i + 1}/${urlList.length}]: ${targetUrl}`);
    try {
      const scraped = await scrapeUrl(targetUrl);
      scrapedProducts.push({
        tempId,
        url: targetUrl,
        isRepair: !!existing,
        repairInfo,
        scraped,
        raw_description: scraped.fullText || scraped.description || scraped.title || ''
      });
    } catch (err) {
      console.error(`[Product Scraper Job] Failed scraping URL ${targetUrl}:`, err.message);
      scrapeErrors[targetUrl] = err.message;
    }
  }

  if (scrapedProducts.length === 0) {
    console.log('[Product Scraper Job] Tidak ada produk baru atau data rumpang yang perlu diproses.');
    return {
      processed: true,
      message: 'Semua produk dilewati (sudah lengkap) atau gagal di-scrape.',
      errors: Object.keys(scrapeErrors).length > 0 ? scrapeErrors : undefined
    };
  }

  // Step 2: Batch extract using Gemini API
  const rawProductsArray = [];
  const skippedGeminiProducts = [];

  for (const p of scrapedProducts) {
    if (p.isRepair && !p.repairInfo.needsMetadata) {
      // Bypassed: We already have metadata (USP, packaging) and don't need Gemini to extract it again
      skippedGeminiProducts.push(p);
    } else {
      rawProductsArray.push({
        id: p.tempId,
        raw_description: p.raw_description
      });
    }
  }

  let extractedList = [];

  if (rawProductsArray.length > 0) {
    console.log(`[Product Scraper Job] Sending ${rawProductsArray.length} products to Gemini for extraction.`);
    const extractionPrompt = buildBatchProductExtractionPrompt(rawProductsArray);
    const extractedText = await executeWithKeyPool(1, async (apiKey) => {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: GEMINI_MODELS.PRIMARY,
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              extracted_products: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    product_name: { type: 'string' },
                    usp: { type: 'string' },
                    scraped_image_url: { type: 'string' },
                    physical_state: {
                      type: 'object',
                      properties: {
                        is_in_packaging: { type: 'boolean' },
                        packaging_type: { type: 'string' }
                      },
                      required: ['is_in_packaging', 'packaging_type']
                    },
                    t2i_prompt: { type: 'string' },
                    i2v_action_prompt: { type: 'string' }
                  },
                  required: ['id', 'product_name', 'usp', 'scraped_image_url', 'physical_state', 't2i_prompt', 'i2v_action_prompt']
                }
              }
            },
            required: ['extracted_products']
          }
        }
      });
      const result = await model.generateContent(extractionPrompt);
      return result.response.text();
    });

    const parsedJson = parseGeminiJSON(extractedText);
    extractedList = parsedJson.extracted_products || [];
    console.log(`[Product Scraper Job] Gemini returned extraction for ${extractedList.length} products.`);
  } else {
    console.log(`[Product Scraper Job] No products need Gemini extraction (all are image-only repairs). Skipping Gemini call.`);
  }

  // Append mock Gemini results for products that bypassed Gemini extraction
  for (const p of skippedGeminiProducts) {
    const ep = p.repairInfo.existingProduct;
    let existingUsp = ep.unique_selling_point || '';
    try {
      if (existingUsp.startsWith('{') || existingUsp.startsWith('[')) {
        existingUsp = JSON.parse(existingUsp);
      }
    } catch (e) { }

    extractedList.push({
      id: p.tempId,
      product_name: ep.product_name,
      usp: existingUsp,
      scraped_image_url: ep.scraped_image_url,
      physical_state: {
        is_in_packaging: ep.is_in_packaging === 1,
        packaging_type: ep.packaging_type
      },
      t2i_prompt: ep.t2i_prompt,
      i2v_action_prompt: ep.i2v_action_prompt
    });
  }

  const results = [];

  // Step 3: Loop and save products
  for (const productData of extractedList) {
    const scrapedItem = scrapedProducts.find(p => p.tempId === productData.id);
    if (!scrapedItem) {
      console.warn(`[Product Scraper Job] Unrecognized ID in Gemini response: ${productData.id}`);
      continue;
    }

    const productId = scrapedItem.isRepair ? scrapedItem.repairInfo.id : `pe_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    let localPhotoPath = null;
    let rawPhotoPath = null;
    let cleanPhotoPath = null;
    let generatedPhotoPath = null;

    const needsRaw = scrapedItem.isRepair ? scrapedItem.repairInfo.needsRaw : true;
    const needsClean = scrapedItem.isRepair ? scrapedItem.repairInfo.needsClean : true;
    const needsStudio = scrapedItem.isRepair ? scrapedItem.repairInfo.needsStudio : true;

    // Download image if scraped_image_url exists and needsRaw is true
    if (needsRaw) {
      if (productData.scraped_image_url && (productData.scraped_image_url.startsWith('http://') || productData.scraped_image_url.startsWith('https://'))) {
        try {
          const rawDir = path.join(process.cwd(), 'public', 'uploads', 'products', 'raw');
          if (!fs.existsSync(rawDir)) {
            fs.mkdirSync(rawDir, { recursive: true });
          }
          const rawFilename = `raw_${productId}.png`;
          const rawAbsolutePath = path.join(rawDir, rawFilename);
          console.log(`[Product Scraper Job] Downloading raw product image: ${productData.scraped_image_url}`);
          await downloadECommerceImage(productData.scraped_image_url, rawAbsolutePath);
          rawPhotoPath = `/uploads/products/raw/${rawFilename}`;

          // Tahap 1b: AI Smart Cropping via Gemini Spatial API & sharp
          // Skip smart crop in repair Mode to save tokens
          const runSpatialCrop = !repairMode;
          if (runSpatialCrop) {
            try {
              const rawImageBuffer = fs.readFileSync(rawAbsolutePath);
              const rawImageMime = 'image/png';

              const cropPrompt = `Analyze this product photo. There might be multiple variants of the same product. Identify the SINGLE most prominent, clear, and center-focused product item. Return the bounding box coordinates [ymin, xmin, ymax, xmax] for only that ONE item. Return coordinates as normalized integers from 0 to 1000 representing [ymin, xmin, ymax, xmax]. For example, [0, 0, 1000, 1000] would be the entire image.`;

              const cropResponseSchema = {
                type: 'object',
                properties: {
                  ymin: { type: 'integer' },
                  xmin: { type: 'integer' },
                  ymax: { type: 'integer' },
                  xmax: { type: 'integer' }
                },
                required: ['ymin', 'xmin', 'ymax', 'xmax']
              };

              console.log('[Product Scraper Job] Running Spatial Gemini API for Single Object Bounding Box...');
              const cropResultText = await generateWithImage(
                rawImageBuffer,
                rawImageMime,
                cropPrompt,
                cropResponseSchema
              );

              const cropCoords = JSON.parse(cropResultText);
              if (cropCoords && typeof cropCoords.ymin === 'number' && typeof cropCoords.xmin === 'number') {
                const sharp = (await import('sharp')).default;
                const metadata = await sharp(rawAbsolutePath).metadata();
                const left = Math.max(0, Math.round((cropCoords.xmin / 1000) * metadata.width));
                const top = Math.max(0, Math.round((cropCoords.ymin / 1000) * metadata.height));
                const width = Math.min(metadata.width - left, Math.round(((cropCoords.xmax - cropCoords.xmin) / 1000) * metadata.width));
                const height = Math.min(metadata.height - top, Math.round(((cropCoords.ymax - cropCoords.ymin) / 1000) * metadata.height));

                if (width > 10 && height > 10) {
                  const croppedBuffer = await sharp(rawAbsolutePath)
                    .extract({ left, top, width, height })
                    .toBuffer();
                  fs.writeFileSync(rawAbsolutePath, croppedBuffer);
                  console.log(`[Product Scraper Job] AI Smart Cropping successfully applied: left=${left}, top=${top}, width=${width}, height=${height}`);
                }
              }
            } catch (cropErr) {
              console.warn('[Product Scraper Job] AI Smart Cropping failed (using original):', cropErr.message);
            }
          } else {
            console.log(`[Product Scraper Job] Skipping Gemini Spatial Crop (Repair/Budget mode active).`);
          }
        } catch (imageErr) {
          console.error('[Product Scraper Job] Gagal download/proses gambar produk:', imageErr.message);
        }
      }
    } else {
      rawPhotoPath = scrapedItem.repairInfo.existingProduct.raw_photo_url;
      console.log(`[Product Scraper Job] Menggunakan foto raw yang sudah ada: ${rawPhotoPath}`);
    }

    // Tahap 1c: AI Background Removal (Imgly) untuk menghasilkan Studio Look
    if (needsClean) {
      if (rawPhotoPath) {
        const cleanFilename = `clean_${productId}.jpg`;
        try {
          const { createCleanProductShot } = await import('./bg-remover');
          const rawAbsolutePath = path.join(process.cwd(), 'public', rawPhotoPath);
          cleanPhotoPath = await createCleanProductShot(rawAbsolutePath, cleanFilename);
          console.log(`[Product Scraper Job] Background removed successfully: ${cleanPhotoPath}`);
        } catch (bgErr) {
          console.warn(`[Product Scraper Job] Gagal hapus background, menggunakan foto mentah:`, bgErr.message);
          cleanPhotoPath = rawPhotoPath;
        }
      }
    } else {
      cleanPhotoPath = scrapedItem.repairInfo.existingProduct.cleaned_photo_url || scrapedItem.repairInfo.existingProduct.clean_photo_url;
      console.log(`[Product Scraper Job] Menggunakan foto clean yang sudah ada: ${cleanPhotoPath}`);
    }

    // Tahap 3: G-Labs Generative Polish (Generasi foto studio AI via model default nano_banana_pro)
    if (needsStudio) {
      if (cleanPhotoPath && productData.t2i_prompt) {
        try {
          const { generateImage: generateGlabsImage, getTaskStatus: getGlabsTaskStatus, getFileUrl: getGlabsFileUrl } = await import('./webhook-client');
          const cleanedAbsPath = path.join(process.cwd(), 'public', cleanPhotoPath);
          const cleanedBase64 = fs.readFileSync(cleanedAbsPath).toString('base64');

          console.log(`[Product Scraper Job] Sending request to G-Labs Generative Polish (model: nano_banana_pro)...`);
          const glabsResult = await generateGlabsImage({
            prompt: productData.t2i_prompt,
            model: 'nano_banana_pro',
            aspect_ratio: '9:16',
            reference_images: [cleanedBase64]
          });

          if (glabsResult?.task_id) {
            let glabsCompleted = false;
            for (let poll = 0; poll < 40; poll++) {
              await new Promise(resolve => setTimeout(resolve, 3000));
              const statusRes = await getGlabsTaskStatus(glabsResult.task_id);
              if (statusRes?.status === 'completed') {
                const files = statusRes.results || statusRes.files || [];
                let videoOrImageFile = files.find(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')) || files[0];
                if (videoOrImageFile && (videoOrImageFile.startsWith('http://') || videoOrImageFile.startsWith('https://'))) {
                  videoOrImageFile = videoOrImageFile.split('/').pop();
                }

                if (videoOrImageFile) {
                  const downloadUrl = getGlabsFileUrl(videoOrImageFile, glabsResult.task_id);
                  const genDir = path.join(process.cwd(), 'public', 'uploads', 'products', 'generated');
                  if (!fs.existsSync(genDir)) {
                    fs.mkdirSync(genDir, { recursive: true });
                  }
                  const genFilename = `generated_${productId}.jpg`;
                  const genAbsPath = path.join(genDir, genFilename);

                  console.log(`[Product Scraper Job] Downloading generated image from G-Labs: ${downloadUrl}`);
                  const downloadRes = await fetch(downloadUrl);
                  if (downloadRes.ok) {
                    const buf = Buffer.from(await downloadRes.arrayBuffer());
                    fs.writeFileSync(genAbsPath, buf);
                    generatedPhotoPath = `/uploads/products/generated/${genFilename}`;
                    glabsCompleted = true;
                    console.log(`[Product Scraper Job] G-Labs Generative Polish completed: ${generatedPhotoPath}`);
                  }
                }
                break;
              } else if (statusRes?.status === 'failed') {
                console.warn(`[Product Scraper Job] G-Labs task failed: ${glabsResult.task_id}`);
                break;
              }
            }
          }
        } catch (glabsErr) {
          console.warn(`[Product Scraper Job] G-Labs Generative Polish failed:`, glabsErr.message);
        }
      }
    } else {
      generatedPhotoPath = scrapedItem.repairInfo.existingProduct.generated_photo_url;
      console.log(`[Product Scraper Job] Menggunakan foto studio yang sudah ada: ${generatedPhotoPath}`);
    }

    let finalUsp = '';
    if (productData.usp) {
      finalUsp = typeof productData.usp === 'string'
        ? productData.usp
        : JSON.stringify(productData.usp);
    }

    // Tentukan photo_url utama berdasarkan pointer active_photo
    localPhotoPath = generatedPhotoPath || cleanPhotoPath || rawPhotoPath;

    const data = {
      product_name: productData.product_name || scrapedItem.scraped.title || 'Produk Tanpa Nama',
      product_description: scrapedItem.scraped.description || scrapedItem.scraped.title || '',
      unique_selling_point: finalUsp,
      target_audience: '',
      pain_point_solved: '',
      key_visuals_extracted: JSON.stringify([]),
      raw_response: JSON.stringify(productData),

      // Foto Aset
      photo_url: localPhotoPath,
      raw_photo_url: rawPhotoPath,
      clean_photo_url: cleanPhotoPath, // compatibility
      cleaned_photo_url: cleanPhotoPath,
      generated_photo_url: generatedPhotoPath,
      active_photo: generatedPhotoPath ? 'generated_photo_url' : (cleanPhotoPath ? 'cleaned_photo_url' : 'raw_photo_url'),

      // Edge Cases Kemasan & Prompt
      is_in_packaging: productData.physical_state?.is_in_packaging ? 1 : 0,
      packaging_type: productData.physical_state?.packaging_type || null,
      t2i_prompt: productData.t2i_prompt || null,
      i2v_action_prompt: productData.i2v_action_prompt || null
    };

    if (scrapedItem.isRepair) {
      // Update existing database record (inplace)
      if (category) data.category = category;
      if (tags) data.tags = tags;
      updateProductExtraction(productId, data);
      console.log(`[Product Scraper Job] Berhasil memperbarui (repaired) produk ID: ${productId} - ${data.product_name}`);
    } else {
      // Insert new database record
      const newData = {
        id: productId,
        input_source: scrapedItem.url,
        is_url: 1,
        source_url: scrapedItem.url,
        affiliate_link: (() => {
          if (!payload?.url_affiliates_map) return '';
          const normalizedScraped = normalizeUrl(scrapedItem.url);
          const foundKey = Object.keys(payload.url_affiliates_map).find(
            k => normalizeUrl(k) === normalizedScraped
          );
          return foundKey ? payload.url_affiliates_map[foundKey] : '';
        })(),
        category: category || null,
        tags: tags || null,
        raw_description: scrapedItem.scraped.bodyText || scrapedItem.scraped.description || '',
        ...data
      };
      createProductExtraction(newData);
      console.log(`[Product Scraper Job] Berhasil menyimpan produk baru ID: ${productId} - ${newData.product_name}`);
    }

    results.push({ product_id: productId, product_name: data.product_name });
  }

  return {
    processed: true,
    results,
    errors: Object.keys(scrapeErrors).length > 0 ? scrapeErrors : undefined
  };
}


// ============================================================================
// V8.9: DECONSTRUCT LAB — DISCOVERY ENGINE PROCESSOR
// ============================================================================

const DECONSTRUCT_DELAY_MS = 20000; // 20 seconds between videos (anti-block)

export async function processDeconstruct(payload, job) {
  const {
    getNextPendingDeconstructAsset,
    updateDeconstructAsset,
    updateDeconstructBatchProgress,
    createJob,
  } = await import('./db');
  const { downloadFromUrl, cleanupTempFile } = await import('./video-downloader');
  const { uploadVideoToGemini, generateWithVideo } = await import('./gemini');
  const { buildDeconstructPhase1Prompt } = await import('./prompts');
  const { parseGeminiJSON } = await import('./json-parser');
  const pathMod = await import('path');

  const asset = getNextPendingDeconstructAsset();
  if (!asset) {
    return { skip: true, reason: 'No pending deconstruct assets' };
  }

  let tempFilePath = null;

  try {
    // Step 1: Download video
    console.log(`[DECONSTRUCT] Downloading video for asset ${asset.id}: ${asset.source_url}`);
    updateDeconstructAsset(asset.id, { status: 'downloading' });

    const downloaded = await downloadFromUrl(asset.source_url);
    tempFilePath = downloaded.filePath;

    updateDeconstructAsset(asset.id, {
      status: 'uploading',
      local_video_path: tempFilePath,
    });

    // Step 2: Upload to Gemini File API
    console.log(`[DECONSTRUCT] Uploading video to Gemini for asset ${asset.id}`);
    const ext = pathMod.default.extname(tempFilePath).toLowerCase();
    const mimeMap = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska' };
    const mimeType = mimeMap[ext] || 'video/mp4';

    const uploadedFile = await uploadVideoToGemini(tempFilePath, mimeType);

    updateDeconstructAsset(asset.id, {
      status: 'analyzing',
      gemini_file_uri: uploadedFile.fileUri,
    });

    // Step 3: Gemini Phase 1 Analysis
    console.log(`[DECONSTRUCT] Running Phase 1 analysis for asset ${asset.id}`);
    const prompt = buildDeconstructPhase1Prompt(
      asset.original_caption,
      asset.target_recommendation_count || 3
    );

    const responseText = await generateWithVideo(uploadedFile.fileUri, uploadedFile.mimeType, prompt);
    const parsed = parseGeminiJSON(responseText);

    // Step 4: Save results
    updateDeconstructAsset(asset.id, {
      original_storyboard_json: JSON.stringify(parsed.storyboard || []),
      product_ideas_json: JSON.stringify(parsed.product_ideas || {}),
      viral_pattern_summary: parsed.viral_pattern_summary || '',
      status: 'deconstructed',
      error_message: null,
    });

    // Step 5: Update batch progress
    const progress = updateDeconstructBatchProgress(asset.batch_id);
    console.log(`[DECONSTRUCT] Asset ${asset.id} deconstructed. Batch progress: ${progress.processed}/${progress.total}`);

    // Step 6: Cleanup temp file
    cleanupTempFile(tempFilePath);

    // Step 7: Mandatory delay (anti-block)
    console.log(`[DECONSTRUCT] Mandatory ${DECONSTRUCT_DELAY_MS / 1000}s delay before next video...`);
    await new Promise(resolve => setTimeout(resolve, DECONSTRUCT_DELAY_MS));

    // Step 8: If there are more pending assets, enqueue another job
    const nextAsset = getNextPendingDeconstructAsset();
    if (nextAsset) {
      console.log(`[DECONSTRUCT] More assets pending. Enqueuing next job...`);
      createJob('re_deconstruct', { batch_id: nextAsset.batch_id });
    }

    return { processed: true, asset_id: asset.id, batch_id: asset.batch_id };

  } catch (error) {
    console.error(`[DECONSTRUCT] Failed for asset ${asset.id}:`, error.message);
    updateDeconstructAsset(asset.id, {
      status: 'failed',
      error_message: error.message,
    });
    updateDeconstructBatchProgress(asset.batch_id);
    cleanupTempFile(tempFilePath);

    // Delay even on error (anti-block safety)
    await new Promise(resolve => setTimeout(resolve, DECONSTRUCT_DELAY_MS));

    // Continue to next asset even after failure
    const nextAsset = getNextPendingDeconstructAsset();
    if (nextAsset) {
      createJob('re_deconstruct', { batch_id: nextAsset.batch_id });
    }

    throw error;
  }
}

// ==========================================
// RECIPE LABS PROCESSORS (V9.0)
// ==========================================

export async function processRecipeGenerator(payload, job) {
  const { getDb, getRecipeCampaignById, updateRecipeItem, getBrandProfile } = await import('./db.js');
  const { executeWithKeyPool } = await import('./gemini.js');
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const { parseGeminiJSON } = await import('./json-parser.js');

  const db = getDb();
  let item = null;

  if (payload?.item_id) {
    item = await db.prepare("SELECT * FROM recipe_items WHERE id = ?").get(payload.item_id);
  } else {
    item = await db.prepare("SELECT * FROM recipe_items WHERE status = 'pending_gemini' ORDER BY created_at ASC LIMIT 1").get();
  }

  if (!item) {
    return { skip: true, reason: 'No pending recipe items for text generation' };
  }

  updateRecipeItem(item.id, { status: 'generating_text' });

  try {
    const campaign = await getRecipeCampaignById(item.campaign_id);
    if (!campaign) {
      throw new Error(`Campaign ${item.campaign_id} not found`);
    }

    const isVideoCampaign = campaign.campaign_type === 'video';
    const category = campaign.category === 'Custom Input' ? (campaign.custom_category || 'Kuliner') : campaign.category;
    const visualStyle = campaign.visual_style || 'Food Porn';

    let deconstructAsset = null;
    if (campaign.source_deconstruct_asset_id) {
      deconstructAsset = await db.prepare("SELECT * FROM re_deconstructed_assets WHERE id = ?").get(campaign.source_deconstruct_asset_id);
    }

    let deconstructContext = '';
    if (deconstructAsset) {
      deconstructContext = `
DENGAN REFERENSI BEDAH VIDEO KOMPETITOR BERIKUT:
- URL Asal Video: ${deconstructAsset.source_url}
- Storyboard Visual & Naskah Ori Kompetitor:
${deconstructAsset.original_storyboard_json}
- Ide Produk / Bahan Pendukung:
${deconstructAsset.product_ideas_json}

PENTING: Formulasikan resep tertulis lengkap (dan instruksi visualnya) yang secara langsung meniru alur dan visualisasi dari video kompetitor di atas, namun disajikan dalam naskah yang orisinal, berkualitas tinggi, dan menggunakan gaya visual yang diminta.
`;
    }

    let systemPrompt = '';

    if (isVideoCampaign) {
      console.log(`[Recipe Generator Video] Compiling culinary prompts for video storyboard item #${item.id}`);
      let brandProfile = null;
      if (campaign.brand_profile_id) {
        brandProfile = await getBrandProfile(campaign.brand_profile_id);
      }
      let config = null;
      if (campaign.config_json) {
        try {
          config = typeof campaign.config_json === 'string' ? JSON.parse(campaign.config_json) : campaign.config_json;
        } catch (_) { }
      }
      if (deconstructAsset) {
        if (!config) config = {};
        config.deconstruct_url = deconstructAsset.source_url;
        config.deconstruct_storyboard = deconstructAsset.original_storyboard_json;
        config.deconstruct_ideas = deconstructAsset.product_ideas_json;
      }
      const { compileCulinarySystemPrompt } = await import('./culinary-sequence-engine.js');
      systemPrompt = compileCulinarySystemPrompt(brandProfile, category, visualStyle, config);
    } else {
      console.log(`[Recipe Generator Static] Generating static recipe text & prompts for item #${item.id} (Category: ${category}, Style: ${visualStyle})`);
      const imgCount = campaign.images_per_recipe || 4;
      let promptsSchema = '';
      if (imgCount === 3) {
        promptsSchema = `    "image_1": "T2I Prompt (English): High quality ${visualStyle} photography of raw ingredients for [Recipe Name] neatly arranged on a rustic tabletop, top-down view, natural ambient lighting, soft focus...",
    "image_2": "T2I Prompt (English): [MANDATORY GUARDRAIL: FACELESS ONLY. Hanya boleh menampilkan tangan/lengan dari siku ke bawah. DILARANG keras menampilkan wajah, kepala, leher, dada, atau bahu]. Close up shot in ${visualStyle} style of cooking process, e.g. bubbling pot, stirring actions, or food sizzle on pan, focusing on food physics and hand interaction...",
    "image_3": "T2I Prompt (English): Masterpiece plating in ${visualStyle} style, [Recipe Name] beautifully served on an elegant ceramic dish with garnished topping, gourmet restaurant presentation..."`;
      } else if (imgCount === 5) {
        promptsSchema = `    "image_1": "T2I Prompt (English): High quality ${visualStyle} photography of raw ingredients for [Recipe Name] neatly arranged on a rustic tabletop, top-down view, natural ambient lighting, soft focus...",
    "image_2": "T2I Prompt (English): [MANDATORY GUARDRAIL: FACELESS ONLY. Hanya boleh menampilkan tangan/lengan dari siku ke bawah. DILARANG keras menampilkan wajah, kepala, leher, dada, atau bahu]. Close up shot in ${visualStyle} style of cooking process, e.g. bubbling pot, stirring actions, or food sizzle on pan, focusing on food physics and hand interaction...",
    "image_3": "T2I Prompt (English): Studio food photography in ${visualStyle} style of freshly cooked [Recipe Name] resting in cooking tray, steam rising, rich appetizing texture...",
    "image_4": "T2I Prompt (English): Masterpiece plating in ${visualStyle} style, [Recipe Name] beautifully served on an elegant ceramic dish with garnished topping, gourmet restaurant presentation...",
    "image_5": "T2I Prompt (English): Extreme macro food photography of [Recipe Name], showcasing rich detailed texture, melting cheese, dripping sauce, or glistening glaze, warm ambient lighting..."`;
      } else if (imgCount === 6) {
        promptsSchema = `    "image_1": "T2I Prompt (English): High quality ${visualStyle} photography of raw ingredients for [Recipe Name] neatly arranged on a rustic tabletop, top-down view, natural ambient lighting, soft focus...",
    "image_2": "T2I Prompt (English): [MANDATORY GUARDRAIL: FACELESS ONLY. Hanya boleh menampilkan tangan/lengan dari siku ke bawah. DILARANG keras menampilkan wajah, kepala, leher, dada, atau bahu]. Close up shot in ${visualStyle} style of cooking process, e.g. bubbling pot, stirring actions, or food sizzle on pan, focusing on food physics and hand interaction...",
    "image_3": "T2I Prompt (English): Studio food photography in ${visualStyle} style of freshly cooked [Recipe Name] resting in cooking tray, steam rising, rich appetizing texture...",
    "image_4": "T2I Prompt (English): Masterpiece plating in ${visualStyle} style, [Recipe Name] beautifully served on an elegant ceramic dish with garnished topping, gourmet restaurant presentation...",
    "image_5": "T2I Prompt (English): Extreme macro food photography of [Recipe Name], showcasing rich detailed texture, melting cheese, dripping sauce, or glistening glaze, warm ambient lighting...",
    "image_6": "T2I Prompt (English): Wide angle lifestyle food photography of [Recipe Name] served on a beautifully arranged dining table, accompanied by a side drink, rustic cozy restaurant background, soft window daylight..."`;
      } else {
        promptsSchema = `    "image_1": "T2I Prompt (English): High quality ${visualStyle} photography of raw ingredients for [Recipe Name] neatly arranged on a rustic tabletop, top-down view, natural ambient lighting, soft focus...",
    "image_2": "T2I Prompt (English): [MANDATORY GUARDRAIL: FACELESS ONLY. Hanya boleh menampilkan tangan/lengan dari siku ke bawah. DILARANG keras menampilkan wajah, kepala, leher, dada, atau bahu]. Close up shot in ${visualStyle} style of cooking process, e.g. bubbling pot, stirring actions, or food sizzle on pan, focusing on food physics and hand interaction...",
    "image_3": "T2I Prompt (English): Studio food photography in ${visualStyle} style of freshly cooked [Recipe Name] resting in cooking tray, steam rising, rich appetizing texture...",
    "image_4": "T2I Prompt (English): Masterpiece plating in ${visualStyle} style, [Recipe Name] beautifully served on an elegant ceramic dish with garnished topping, gourmet restaurant presentation..."`;
      }

      systemPrompt = `Anda adalah Koki Profesional dan Ahli Fotografi Makanan.
Tugas Anda adalah membuat 1 resep makanan/minuman yang sangat lezat, menggugah selera, dan teruji untuk kategori: "${category}".
${deconstructContext}
PENTING GAYA VISUAL: Gunakan karakteristik fotografi "${visualStyle}" secara konsisten pada setiap prompt gambar.

Beri jawaban HANYA dalam format JSON valid dengan struktur berikut:
{
  "title": "Nama Resep Legendaris",
  "content_md": "# Nama Resep Legendaris\\n\\n## Bahan-bahan\\n- Bahan 1\\n- Bahan 2\\n\\n## Cara Membuat\\n1. Langkah pertama...\\n2. Langkah kedua...",
  "prompts": {
${promptsSchema}
  }
}`;
    }

    const rawResponse = await executeWithKeyPool(1, async (apiKey) => {
      const genAI = new GoogleGenerativeAI(apiKey);
      
      const tryGenerate = async (modelName) => {
        const model = genAI.getGenerativeModel({ model: modelName });
        return await model.generateContent(systemPrompt);
      };

      let res;
      try {
        res = await tryGenerate(GEMINI_MODELS.PRIMARY);
      } catch (err) {
        console.warn(`[Recipe Gemini Fallback] ${GEMINI_MODELS.PRIMARY} failed (${err.message}). Swapping to ${GEMINI_MODELS.FALLBACK_1}...`);
        try {
          res = await tryGenerate(GEMINI_MODELS.FALLBACK_1);
        } catch (err2) {
          console.warn(`[Recipe Gemini Fallback] ${GEMINI_MODELS.FALLBACK_1} failed (${err2.message}). Swapping to ${GEMINI_MODELS.FALLBACK_2}...`);
          res = await tryGenerate(GEMINI_MODELS.FALLBACK_2);
        }
      }
      return res.response.text();
    });

    const parsed = parseGeminiJSON(rawResponse);
    if (!parsed || !parsed.title) {
      throw new Error('Failed to parse Gemini recipe response');
    }

    if (isVideoCampaign) {
      // In video campaign mode, we directly save storyboard details and skip G-Labs image rendering.
      // We advance directly to 'pending_export' (so the exporter can write and upload the Markdown report to Nextcloud)
      updateRecipeItem(item.id, {
        recipe_title: parsed.title,
        recipe_markdown_text: parsed.content_md || '',
        video_storyboard_json: JSON.stringify(parsed.storyboard || {}),
        video_dna_json: JSON.stringify(parsed.video_dna || {}),
        seo_data_json: JSON.stringify({
          facebook_copy: parsed.facebook_copy,
          affiliate_plan: parsed.affiliate_plan,
          thumbnail: parsed.thumbnail,
          seo: parsed.seo,
          performance_hypothesis: parsed.performance_hypothesis
        }),
        status: 'pending_export'
      });

      // Enqueue job exporter immediately
      console.log(`[Recipe Generator Video] Successfully generated storyboard for video item #${item.id}.`);
      return { item_id: item.id, video: true };
    } else {
      // Static campaign mode
      if (!parsed.prompts) {
        throw new Error('Missing image prompts in static recipe output');
      }
      const isGlabsEnabled = campaign.enable_glabs !== 0;
      const nextStatus = isGlabsEnabled ? 'pending_glabs' : 'completed';

      updateRecipeItem(item.id, {
        recipe_title: parsed.title,
        recipe_markdown_text: parsed.content_md || '',
        t2i_prompts_json: JSON.stringify(parsed.prompts),
        status: nextStatus
      });

      if (!isGlabsEnabled) {
        if (campaign.post_to_facebook !== 0) {
          try {
            const { postDraftToFacebookPage, formatFacebookRecipeCaption } = await import('./facebook-helper.js');
            const caption = formatFacebookRecipeCaption(parsed.title, parsed.content_md);
            const fbRes = await postDraftToFacebookPage({ message: caption, mediaType: 'text_only' });
            if (fbRes.success) {
              updateRecipeItem(item.id, { fb_post_id: fbRes.fb_post_id, fb_post_status: 'draft_created' });
            } else {
              updateRecipeItem(item.id, { fb_post_status: `failed: ${fbRes.error}` });
            }
          } catch (fbErr) {
            console.warn(`[Facebook Draft Warning] Failed to dispatch draft for item #${item.id}:`, fbErr.message);
          }
        }

        const remaining = await db.prepare("SELECT COUNT(*) as cnt FROM recipe_items WHERE campaign_id = ? AND status != 'completed'").get(campaign.id);
        if (remaining.cnt === 0) {
          const { updateRecipeCampaign } = await import('./db.js');
          updateRecipeCampaign(campaign.id, { status: 'completed' });
        } else {
          if (nextPendingItem) {
            console.log(`[Recipe Sequential Pipeline] Next recipe item #${nextPendingItem.id} in campaign is ready.`);
          }
        }
      }

      console.log(`[Recipe Generator] Successfully generated recipe "${parsed.title}" for item #${item.id} (G-Labs: ${isGlabsEnabled ? 'ON' : 'OFF'})`);
      return isGlabsEnabled ? { item_id: item.id } : { completed: true };
    }
  } catch (err) {
    console.error(`[Recipe Generator] Failed for item #${item.id}:`, err.message);
    updateRecipeItem(item.id, { status: 'failed' });
    throw err;
  }
}

export async function processRecipeGLabs(payload, job) {
  const { getDb, getRecipeCampaignById, updateRecipeItem } = await import('./db.js');
  const { generateImage, getTaskStatus, getFileUrl } = await import('./webhook-client.js');
  const path = await import('path');
  const fs = await import('fs');

  const db = getDb();
  let item = null;

  if (payload?.item_id) {
    item = await db.prepare("SELECT * FROM recipe_items WHERE id = ?").get(payload.item_id);
  } else {
    item = await db.prepare("SELECT * FROM recipe_items WHERE status = 'pending_glabs' ORDER BY created_at ASC LIMIT 1").get();
  }

  if (!item) {
    return { skip: true, reason: 'No pending recipe items for image generation' };
  }

  const campaign = await getRecipeCampaignById(item.campaign_id);
  if (campaign && campaign.enable_glabs === 0) {
    updateRecipeItem(item.id, { status: 'completed' });
    return { skip: true, reason: 'G-Labs image generation disabled for this campaign' };
  }
  // [Fix v2.2.87] recipe_campaigns memiliki brand_profile_id — gunakan ID-based lookup
  const brandProfile = (campaign && campaign.brand_profile_id)
    ? await db.prepare('SELECT * FROM brand_profiles WHERE id = ?').get(campaign.brand_profile_id)
    : null;

  updateRecipeItem(item.id, { status: 'generating_images' });

  try {
    const prompts = JSON.parse(item.t2i_prompts_json || '{}');
    const imgCount = campaign?.images_per_recipe || 4;
    const targetKeys = [];
    for (let i = 1; i <= imgCount; i++) {
      targetKeys.push(`image_${i}`);
    }
    const savedPaths = {};

    const baseUploadDir = path.join(process.cwd(), 'public', 'uploads', 'recipes', item.campaign_id, item.id);
    if (!fs.existsSync(baseUploadDir)) {
      fs.mkdirSync(baseUploadDir, { recursive: true });
    }

    console.log(`[Recipe G-Labs] Rendering ${imgCount} instructional images for item #${item.id}...`);

    for (let idx = 0; idx < targetKeys.length; idx++) {
      const key = targetKeys[idx];
      const promptText = prompts[key];

      if (!promptText) {
        console.warn(`[Recipe G-Labs] Missing prompt for ${key} in item #${item.id}`);
        continue;
      }

      console.log(`[Recipe G-Labs] Sending T2I request for ${key}...`);
      const glabsResult = await generateImage({
        prompt: promptText,
        model: 'nano_banana_pro',
        aspect_ratio: '1:1',
        webhookOverride: brandProfile
      });

      if (glabsResult?.task_id) {
        let completed = false;
        for (let poll = 0; poll < 40; poll++) {
          await new Promise(resolve => setTimeout(resolve, 3000));
          const statusRes = await getTaskStatus(glabsResult.task_id);

          if (statusRes?.status === 'completed') {
            const files = statusRes.results || statusRes.files || [];
            let imgFile = files.find(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')) || files[0];
            if (imgFile && (imgFile.startsWith('http://') || imgFile.startsWith('https://'))) {
              imgFile = imgFile.split('/').pop();
            }

            if (imgFile) {
              const downloadUrl = getFileUrl(imgFile, glabsResult.task_id);
              const filename = `${key}.jpg`;
              const absSavePath = path.join(baseUploadDir, filename);

              const downloadRes = await fetch(downloadUrl);
              if (downloadRes.ok) {
                const buf = Buffer.from(await downloadRes.arrayBuffer());
                fs.writeFileSync(absSavePath, buf);
                savedPaths[key] = `/uploads/recipes/${item.campaign_id}/${item.id}/${filename}`;
                completed = true;
                console.log(`[Recipe G-Labs] Downloaded ${key} to ${savedPaths[key]}`);
              }
            }
            break;
          } else if (statusRes?.status === 'failed') {
            console.warn(`[Recipe G-Labs] Task failed for ${key}: ${glabsResult.task_id}`);
            break;
          }
        }
      }
    }

    updateRecipeItem(item.id, {
      img_1_raw_path: savedPaths.image_1 || null,
      img_2_process_path: savedPaths.image_2 || null,
      img_3_result_path: savedPaths.image_3 || null,
      img_4_plated_path: savedPaths.image_4 || null,
      img_5_path: savedPaths.image_5 || null,
      img_6_path: savedPaths.image_6 || null,
      status: 'pending_export'
    });

    console.log(`[Recipe G-Labs] Completed image rendering stage for item #${item.id}`);
    return { item_id: item.id };
  } catch (err) {
    console.error(`[Recipe G-Labs] Failed for item #${item.id}:`, err.message);
    updateRecipeItem(item.id, { status: 'failed' });
    throw err;
  }
}

export async function processRecipeExporter(payload, job) {
  const { getDb, getRecipeCampaignById, updateRecipeCampaign, updateRecipeItem } = await import('./db');
  const { createRecipeGrid } = await import('./recipe-grid-helper');
  const { uploadFileToNextcloud } = await import('./nextcloud-helper');
  const path = await import('path');
  const fs = await import('fs');

  const db = getDb();
  let item = null;

  if (payload?.item_id) {
    item = await db.prepare("SELECT * FROM recipe_items WHERE id = ?").get(payload.item_id);
  } else {
    item = await db.prepare("SELECT * FROM recipe_items WHERE status = 'pending_export' ORDER BY created_at ASC LIMIT 1").get();
  }

  if (!item) {
    return { skip: true, reason: 'No pending recipe items for export' };
  }

  updateRecipeItem(item.id, { status: 'exporting' });

  try {
    const campaign = await getRecipeCampaignById(item.campaign_id);
    if (!campaign) throw new Error(`Campaign ${item.campaign_id} not found`);

    const baseUploadDir = path.join(process.cwd(), 'public', 'uploads', 'recipes', item.campaign_id, item.id);
    if (!fs.existsSync(baseUploadDir)) {
      fs.mkdirSync(baseUploadDir, { recursive: true });
    }

    if (campaign.campaign_type === 'video') {
      console.log(`[Recipe Exporter] Generating video storyboard report for item #${item.id}...`);

      let storyboard = {};
      let dna = {};
      let seo = {};
      try {
        storyboard = JSON.parse(item.video_storyboard_json || '{}');
        dna = JSON.parse(item.video_dna_json || '{}');
        seo = JSON.parse(item.seo_data_json || '{}');
      } catch (_) { }

      // Construct highly detailed markdown report
      let reportMd = `# ${item.recipe_title || 'Resep Video'}\n\n`;
      reportMd += `## 📝 Resep Lengkap\n\n${item.recipe_markdown_text || ''}\n\n`;

      reportMd += `## 🎬 Storyboard Video Reels (5-Module)\n\n`;
      for (const [modKey, modVal] of Object.entries(storyboard)) {
        if (!modVal) continue;
        reportMd += `### 📹 ${modVal.module_name || modKey.toUpperCase()}\n`;
        reportMd += `- **Tujuan**: ${modVal.goal || '-'}\n`;
        reportMd += `- **Skenario Visual**: ${modVal.visual_scenario || '-'}\n`;
        reportMd += `- **Kamera**: Angle: *${modVal.camera_angle || '-'}*, Movement: *${modVal.camera_movement || '-'}*\n`;
        reportMd += `- **Voice Over**: *"${modVal.voice_over || '-'}"*\n`;
        reportMd += `- **Prompt Google Veo**: \`${modVal.veo_prompt || '-'}\`\n\n`;
      }

      reportMd += `## 🌐 Copywriting & Sosial Media\n\n`;
      if (seo.facebook_copy) {
        reportMd += `### 📱 Draf Caption Facebook\n- **Judul**: ${seo.facebook_copy.title || '-'}\n- **Caption**:\n\`\`\`\n${seo.facebook_copy.caption || '-'}\n\`\`\`\n- **Komentar Pertama**: *"${seo.facebook_copy.first_comment || '-'}"*\n\n`;
      }
      if (seo.thumbnail && Array.isArray(seo.thumbnail)) {
        reportMd += `### 🖼️ Alternatif Teks Thumbnail\n`;
        seo.thumbnail.forEach((t, idx) => {
          reportMd += `${idx + 1}. **${t}**\n`;
        });
        reportMd += `\n`;
      }

      reportMd += `## 📦 Rencana Produk Afiliasi\n\n`;
      if (seo.affiliate_plan) {
        reportMd += `- **Rekomendasi Produk**: ${seo.affiliate_plan.recommended_product || '-'}\n`;
        reportMd += `- **Kategori**: ${seo.affiliate_plan.category || '-'}\n`;
        reportMd += `- **Alasan**: ${seo.affiliate_plan.reason || '-'}\n`;
        reportMd += `- **Strategi Integrasi**: ${seo.affiliate_plan.integration_strategy || '-'}\n`;
        reportMd += `- **CTA Afiliasi**: *"${seo.affiliate_plan.soft_cta || '-'}"*\n`;
        reportMd += `- **Estimasi CTR**: ${seo.affiliate_plan.estimated_ctr || '0'}%\n\n`;
      }

      reportMd += `## 📈 Optimasi & Analisis Performa\n\n`;
      if (seo.performance_hypothesis) {
        reportMd += `- **Alasan Gaya Visual**: ${seo.performance_hypothesis.visual_style_reasoning || '-'}\n`;
        reportMd += `- **Alasan Hook**: ${seo.performance_hypothesis.hook_reasoning || '-'}\n`;
        reportMd += `- **Strategi Retensi**: ${seo.performance_hypothesis.retention_reasoning || '-'}\n`;
        reportMd += `- **Faktor Risiko**: ${seo.performance_hypothesis.risk_factors || '-'}\n`;
        reportMd += `- **Saran Dibagikan (Shareability)**: ${seo.performance_hypothesis.shareability_tips || '-'}\n`;
        if (seo.performance_hypothesis.ab_testing_ideas && Array.isArray(seo.performance_hypothesis.ab_testing_ideas)) {
          reportMd += `\n### 🧪 Ide A/B Testing\n`;
          seo.performance_hypothesis.ab_testing_ideas.forEach((idea, idx) => {
            reportMd += `- ${idea}\n`;
          });
        }
        reportMd += `\n`;
      }

      reportMd += `## 🧬 Video DNA Metadata\n\n`;
      reportMd += `| Parameter | Nilai |\n|---|---|\n`;
      for (const [dnaKey, dnaVal] of Object.entries(dna)) {
        reportMd += `| ${dnaKey} | ${dnaVal} |\n`;
      }
      reportMd += `\n`;

      const reportAbsPath = path.join(baseUploadDir, 'resep_video_storyboard.md');
      fs.writeFileSync(reportAbsPath, reportMd);

      // Export to Nextcloud
      console.log(`[Recipe Exporter] Uploading video storyboard to Nextcloud Hub...`);
      const cleanCategory = (campaign.category === 'Custom Input' ? (campaign.custom_category || 'Kuliner') : campaign.category).replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanTitle = (item.recipe_title || 'Resep').replace(/[^a-zA-Z0-9_-]/g, '_');
      const parentFolder = (campaign.nextcloud_parent_folder || 'MAKNA_Recipes').replace(/\/+$/, '').replace(/^\/+/, '');
      const ncFolderPath = `/${parentFolder}/${cleanCategory}_${cleanTitle}_Video`;

      let folderShareUrl = null;
      try {
        const ncRes = await uploadFileToNextcloud(reportAbsPath, `${ncFolderPath}/resep_video_storyboard.md`, true);
        folderShareUrl = ncRes.fileUrl;
      } catch (ncErr) {
        console.warn(`[Recipe Exporter Video NC Error]:`, ncErr.message);
      }

      // Export text assets to Google Sheets if spreadsheet_id is provided
      if (campaign.spreadsheet_id) {
        console.log(`[Recipe Exporter] Spreadsheet ID detected: ${campaign.spreadsheet_id}. Exporting text assets...`);
        try {
          const { getAuthorizedClient } = await import('./google-auth.js');
          const { google } = await import('googleapis');
          const { ensureTabAndAppendRows } = await import('./sheets-autopilot-worker.js');

          const auth = getAuthorizedClient();
          const sheets = google.sheets({ version: 'v4', auth });
          const spreadsheetId = campaign.spreadsheet_id;
          const timestamp = new Date().toISOString();
          const recipeTitle = item.recipe_title || 'Resep Video';

          // 1. Export Storyboard Tab
          const storyboardHeaders = ["Recipe Title", "Module", "Goal", "Visual Scenario", "Camera Angle", "Camera Movement", "Voice Over", "Veo Prompt", "Timestamp"];
          const storyboardRows = [];
          for (const [modKey, modVal] of Object.entries(storyboard)) {
            if (!modVal) continue;
            storyboardRows.push([
              recipeTitle,
              modVal.module_name || modKey.toUpperCase(),
              modVal.goal || '',
              modVal.visual_scenario || '',
              modVal.camera_angle || '',
              modVal.camera_movement || '',
              modVal.voice_over || '',
              modVal.veo_prompt || '',
              timestamp
            ]);
          }
          if (storyboardRows.length > 0) {
            await ensureTabAndAppendRows(sheets, spreadsheetId, 'Storyboard', storyboardHeaders, storyboardRows);
          }

          // 2. Export Voiceover Tab
          const voHeaders = ["Recipe Title", "Module", "Voice Over Text", "Timestamp"];
          const voRows = [];
          for (const [modKey, modVal] of Object.entries(storyboard)) {
            if (!modVal) continue;
            voRows.push([
              recipeTitle,
              modVal.module_name || modKey.toUpperCase(),
              modVal.voice_over || '',
              timestamp
            ]);
          }
          if (voRows.length > 0) {
            await ensureTabAndAppendRows(sheets, spreadsheetId, 'Voiceover', voHeaders, voRows);
          }

          // 3. Export Prompts Tab
          const promptHeaders = ["Recipe Title", "Module", "Veo Prompt Text", "Timestamp"];
          const promptRows = [];
          for (const [modKey, modVal] of Object.entries(storyboard)) {
            if (!modVal) continue;
            promptRows.push([
              recipeTitle,
              modVal.module_name || modKey.toUpperCase(),
              modVal.veo_prompt || '',
              timestamp
            ]);
          }
          if (promptRows.length > 0) {
            await ensureTabAndAppendRows(sheets, spreadsheetId, 'Prompts', promptHeaders, promptRows);
          }

          // 4. Export Captions Tab
          const captionHeaders = ["Recipe Title", "Facebook Title", "Facebook Caption", "First Comment", "Timestamp"];
          const captionRows = [[
            recipeTitle,
            seo.facebook_copy?.title || '',
            seo.facebook_copy?.caption || '',
            seo.facebook_copy?.first_comment || '',
            timestamp
          ]];
          await ensureTabAndAppendRows(sheets, spreadsheetId, 'Captions', captionHeaders, captionRows);

          // 5. Export Video DNA Tab
          const dnaHeaders = ["Recipe Title", "Parameter Name", "Value", "Timestamp"];
          const dnaRows = [];
          for (const [dnaKey, dnaVal] of Object.entries(dna)) {
            dnaRows.push([
              recipeTitle,
              dnaKey,
              String(dnaVal),
              timestamp
            ]);
          }
          if (dnaRows.length > 0) {
            await ensureTabAndAppendRows(sheets, spreadsheetId, 'Video DNA', dnaHeaders, dnaRows);
          }

          console.log(`[Recipe Exporter] Successfully exported all text assets to Google Sheets.`);
        } catch (sheetErr) {
          console.warn(`[Recipe Exporter Google Sheets Error]:`, sheetErr.message);
        }
      }

      updateRecipeItem(item.id, { status: 'completed' });

      if (folderShareUrl && !campaign.nextcloud_folder_url) {
        updateRecipeCampaign(campaign.id, { nextcloud_folder_url: folderShareUrl });
      }

      // Facebook Post Draft
      if (campaign.post_to_facebook !== 0 && seo.facebook_copy) {
        try {
          const { postDraftToFacebookPage } = await import('./facebook-helper.js');
          let message = seo.facebook_copy.caption || '';
          if (folderShareUrl) {
            message += `\n\nResep & naskah storyboard video lengkap di Nextcloud:\n${folderShareUrl}`;
          }
          const fbRes = await postDraftToFacebookPage({ message, mediaType: 'text_only' });
          if (fbRes.success) {
            updateRecipeItem(item.id, { fb_post_id: fbRes.fb_post_id, fb_post_status: 'draft_created' });
          } else {
            updateRecipeItem(item.id, { fb_post_status: `failed: ${fbRes.error}` });
          }
        } catch (fbErr) {
          console.warn(`[Facebook Draft Video Warning] FB post failed:`, fbErr.message);
        }
      }

      // Sequential campaign loader
      const remaining = await db.prepare("SELECT COUNT(*) as cnt FROM recipe_items WHERE campaign_id = ? AND status != 'completed'").get(campaign.id);
      if (remaining.cnt === 0) {
        updateRecipeCampaign(campaign.id, { status: 'completed' });
      } else {
        if (nextPendingItem) {
          console.log(`[Recipe Sequential Pipeline] Next recipe video storyboard item #${nextPendingItem.id} in campaign is ready.`);
        }
      }

      console.log(`[Recipe Exporter] Video campaign item #${item.id} exported successfully!`);
      return { item_id: item.id, completed: true };
    }

    // Step 1: Generate Grid Poster via Sharp
    const imgPaths = [];
    if (item.img_1_raw_path) imgPaths.push(path.join(process.cwd(), 'public', item.img_1_raw_path));
    if (item.img_2_process_path) imgPaths.push(path.join(process.cwd(), 'public', item.img_2_process_path));
    if (item.img_3_result_path) imgPaths.push(path.join(process.cwd(), 'public', item.img_3_result_path));
    if (item.img_4_plated_path) imgPaths.push(path.join(process.cwd(), 'public', item.img_4_plated_path));
    if (item.img_5_path) imgPaths.push(path.join(process.cwd(), 'public', item.img_5_path));
    if (item.img_6_path) imgPaths.push(path.join(process.cwd(), 'public', item.img_6_path));

    const gridAbsPath = path.join(baseUploadDir, '05_GRID_POSTER.jpg');
    console.log(`[Recipe Exporter] Creating asymmetric collage grid for item #${item.id} (Layout: ${campaign.selected_layout_id || '4_editorial_split'})...`);

    let gridRelPath = null;
    try {
      await createRecipeGrid(imgPaths, gridAbsPath, {
        layoutId: campaign.selected_layout_id || '4_editorial_split',
        gapSize: campaign.grid_gap_size !== undefined ? campaign.grid_gap_size : 12,
        borderRadius: campaign.grid_border_radius !== undefined ? campaign.grid_border_radius : 16,
        outerPadding: campaign.grid_outer_padding !== undefined ? campaign.grid_outer_padding : 16,
        bgColor: campaign.grid_bg_color || '#0d0d12'
      });
      gridRelPath = `/uploads/recipes/${item.campaign_id}/${item.id}/05_GRID_POSTER.jpg`;
    } catch (sharpErr) {
      console.warn(`[Recipe Exporter] Grid creation failed:`, sharpErr.message);
    }

    // Step 2: Write markdown text file locally
    const mdAbsPath = path.join(baseUploadDir, 'resep_lengkap.md');
    fs.writeFileSync(mdAbsPath, item.recipe_markdown_text || `# ${item.recipe_title || 'Resep'}`);

    // Step 3: Export to Nextcloud
    console.log(`[Recipe Exporter] Exporting bundle to Nextcloud Hub...`);
    const cleanCategory = (campaign.category === 'Custom Input' ? (campaign.custom_category || 'Kuliner') : campaign.category).replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanTitle = (item.recipe_title || 'Resep').replace(/[^a-zA-Z0-9_-]/g, '_');

    const parentFolder = (campaign.nextcloud_parent_folder || 'MAKNA_Recipes').replace(/\/+$/, '').replace(/^\/+/, '');
    const ncFolderPath = `/${parentFolder}/${cleanCategory}_${cleanTitle}`;
    let folderShareUrl = null;

    try {
      // Upload markdown
      await uploadFileToNextcloud(mdAbsPath, `${ncFolderPath}/resep_lengkap.md`, false);

      // Upload images
      const img1Abs = path.join(process.cwd(), 'public', item.img_1_raw_path || '');
      const img2Abs = path.join(process.cwd(), 'public', item.img_2_process_path || '');
      const img3Abs = path.join(process.cwd(), 'public', item.img_3_result_path || '');
      const img4Abs = path.join(process.cwd(), 'public', item.img_4_plated_path || '');
      const img5Abs = path.join(process.cwd(), 'public', item.img_5_path || '');
      const img6Abs = path.join(process.cwd(), 'public', item.img_6_path || '');

      if (item.img_1_raw_path && fs.existsSync(img1Abs)) await uploadFileToNextcloud(img1Abs, `${ncFolderPath}/01_raw_ingredients.jpg`, false);
      if (item.img_2_process_path && fs.existsSync(img2Abs)) await uploadFileToNextcloud(img2Abs, `${ncFolderPath}/02_processing.jpg`, false);
      if (item.img_3_result_path && fs.existsSync(img3Abs)) await uploadFileToNextcloud(img3Abs, `${ncFolderPath}/03_finished.jpg`, false);
      if (item.img_4_plated_path && fs.existsSync(img4Abs)) await uploadFileToNextcloud(img4Abs, `${ncFolderPath}/04_plated_served.jpg`, false);
      if (item.img_5_path && fs.existsSync(img5Abs)) await uploadFileToNextcloud(img5Abs, `${ncFolderPath}/05_macro_detail.jpg`, false);
      if (item.img_6_path && fs.existsSync(img6Abs)) await uploadFileToNextcloud(img6Abs, `${ncFolderPath}/06_dining_context.jpg`, false);

      // Upload grid and generate share link for the folder/file
      if (fs.existsSync(gridAbsPath)) {
        const ncRes = await uploadFileToNextcloud(gridAbsPath, `${ncFolderPath}/05_GRID_POSTER.jpg`, true);
        folderShareUrl = ncRes.fileUrl;
      }
    } catch (ncErr) {
      console.warn(`[Recipe Exporter] Nextcloud upload warning:`, ncErr.message);
    }

    updateRecipeItem(item.id, {
      img_grid_path: gridRelPath,
      status: 'completed'
    });

    if (folderShareUrl && !campaign.nextcloud_folder_url) {
      updateRecipeCampaign(campaign.id, { nextcloud_folder_url: folderShareUrl });
    }

    if (campaign.post_to_facebook !== 0) {
      try {
        const { postDraftToFacebookPage, formatFacebookRecipeCaption } = await import('./facebook-helper.js');
        const caption = formatFacebookRecipeCaption(item.recipe_title, item.recipe_markdown_text);
        let mediaUrl = null;
        let mediaType = 'text_only';

        if (folderShareUrl) {
          let cleanShareUrl = folderShareUrl.replace(/\/+$/, '');
          const nextcloudUrl = getS('nextcloud_url');
          const fbServerUrl = getS('fb_server_url');
          if (nextcloudUrl && fbServerUrl) {
            const cleanNcBase = nextcloudUrl.replace(/\/+$/, '');
            const cleanFbBase = fbServerUrl.replace(/\/+$/, '');
            if (cleanShareUrl.startsWith(cleanNcBase)) {
              cleanShareUrl = cleanShareUrl.replace(cleanNcBase, cleanFbBase);
              console.log(`[Facebook Draft Scheduler] Replaced local Nextcloud URL with public URL: ${cleanShareUrl}`);
            }
          }
          mediaUrl = cleanShareUrl.includes('/download') ? cleanShareUrl : `${cleanShareUrl}/download`;
          mediaType = 'image';
        }

        const fbRes = await postDraftToFacebookPage({ message: caption, mediaUrl, mediaType });
        if (fbRes.success) {
          updateRecipeItem(item.id, { fb_post_id: fbRes.fb_post_id, fb_post_status: 'draft_created' });
        } else {
          updateRecipeItem(item.id, { fb_post_status: `failed: ${fbRes.error}` });
        }
      } catch (fbErr) {
        console.warn(`[Facebook Draft Warning] Failed to dispatch draft for item #${item.id}:`, fbErr.message);
      }
    }

    // Check if all items in campaign are done
    const remaining = await db.prepare("SELECT COUNT(*) as cnt FROM recipe_items WHERE campaign_id = ? AND status != 'completed'").get(campaign.id);
    if (remaining.cnt === 0) {
      updateRecipeCampaign(campaign.id, { status: 'completed' });
    } else {
      if (nextPendingItem) {
        console.log(`[Recipe Sequential Pipeline] Next recipe item #${nextPendingItem.id} in campaign is ready.`);
      }
    }

    console.log(`[Recipe Exporter] Successfully exported recipe item #${item.id}`);
    return { item_id: item.id, completed: true };
  } catch (err) {
    console.error(`[Recipe Exporter] Failed for item #${item.id}:`, err.message);
    updateRecipeItem(item.id, { status: 'failed' });
    throw err;
  }
}

async function downloadAndUploadPillarClip(item, campaign, clipIndex, url, localPaths, db) {
  const path = await import('path');
  const fs = await import('fs');
  const { getSetting } = await import('./db');

  const tempDir = path.join(process.cwd(), 'public', 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const filename = `opc_glabs_${item.id}_clip_${clipIndex}.mp4`;
  const localRelativePath = `/temp/${filename}`;
  const localFullPath = path.join(tempDir, filename);

  console.log(`[Pillar Glabs Sync] Downloading clip #${clipIndex + 1} from GLabs URL...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download visual clip from URL: ${url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(localFullPath, buffer);

  localPaths[clipIndex] = localRelativePath;
  await db.prepare('UPDATE pillar_campaign_items SET visual_clip_paths = ? WHERE id = ?').run(JSON.stringify(localPaths), item.id);

  console.log(`[Pillar Glabs Sync] Downloaded and saved clip #${clipIndex + 1} locally.`);
}

async function downloadAndUploadReClip(item, campaign, clipIndex, url, localPaths, db, isAngleVariant = false, variant = null) {
  const path = await import('path');
  const fs = await import('fs');
  const { getSetting, setSetting } = await import('./db');

  const tempDir = path.join(process.cwd(), 'public', 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const filename = isAngleVariant
    ? `reav_${variant.id}_clip_${clipIndex}.mp4`
    : `re_glabs_${item.id}_clip_${clipIndex}.mp4`;
  const localRelativePath = `/temp/${filename}`;
  const localFullPath = path.join(tempDir, filename);

  console.log(`[RE Glabs Sync] Downloading clip #${clipIndex + 1} from GLabs URL...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download visual clip from URL: ${url}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(localFullPath, buffer);

  localPaths[clipIndex] = localRelativePath;
  if (isAngleVariant) {
    await db.prepare('UPDATE re_item_angle_variants SET visual_clip_paths = ? WHERE id = ?').run(JSON.stringify(localPaths), variant.id);
  } else {
    await db.prepare('UPDATE re_campaign_items SET visual_clip_paths = ? WHERE id = ?').run(JSON.stringify(localPaths), item.id);
  }

  console.log(`[RE Glabs Sync] Downloaded and saved clip #${clipIndex + 1} locally.`);
}
