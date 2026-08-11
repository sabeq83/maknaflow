import { getSheetsCampaigns, getSheetsCampaign, getSheetsJobs, createSheetsJob, updateSheetsJobStatus, getDb, insertGlabsTask, updateGlabsTaskStatus, getSetting } from './db.js';
import { uploadBufferToNextcloud, uploadFileToNextcloud, getOrCreatePublicShareLink, checkAndCreateFolder } from './nextcloud-helper.js';
import { getAuthorizedClient } from './google-auth.js';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { executeWithKeyPool, uploadVideoToGemini, generateContentFlexible, GEMINI_MODELS } from './gemini.js';
import { generateMinimaxVO, registerJitVoiceCast } from './minimax-tts.js';
import { scrapeUrl, downloadECommerceImage } from './url-scraper.js';
import { generateImage, generateVideo, getTaskStatus, getFileUrl } from './webhook-client.js';
import { processVideoMuxing } from './video-studio-processor.js';
import { getOrCreateCampaignFolder, getOrCreateFolderInFolder, uploadMarkdownToCampaignFolder, uploadLocalFileToFolder } from './drive-uploader.js';
import { parseGeminiJSON } from './json-parser.js';
import { buildReverseEngineeringBridgePrompt, buildOrganicPillarPrompt, buildReverseEngineeringPrompt, DEMOGRAPHIC_PRESETS, WARDROBE_PRESETS, LIGHTING_PRESETS, getPackagingInstruction, getConceptInstruction, buildProductTruthContractSection } from './prompts.js';
import { downloadFromUrl, cleanupTempFile } from './video-downloader.js';
import { resolveVisualOverrides } from './visual-override-resolver.js';

// Log rotation config
let _logWriteCounter = 0;
const MAX_LOG_BYTES = 200_000;   // 200 KB
const KEEP_LOG_LINES = 500;      // baris terbaru yang dipertahankan
const LOG_CHECK_INTERVAL = 50;   // periksa setiap 50 kali tulis

// Helper to find column index from spreadsheet headers with multiple alias support
function getProductUrlIndex(headers) {
  const aliases = ['link product', 'link_product', 'link produk', 'url produk', 'url product', 'url_product', 'product link', 'product_link'];
  for (const alias of aliases) {
    const idx = headers.indexOf(alias.toLowerCase().trim());
    if (idx !== -1) return idx;
  }
  return -1;
}

function getAffiliateUrlIndex(headers) {
  const aliases = ['link aff', 'link_aff', 'link affiliate', 'affiliate link', 'linkaff', 'url affiliate', 'url affiliates', 'url_affiliate', 'url_affiliates', 'affiliate url', 'affiliate_url'];
  for (const alias of aliases) {
    const idx = headers.indexOf(alias.toLowerCase().trim());
    if (idx !== -1) return idx;
  }
  return -1;
}

function maybeTruncateLog(logFile) {
  try {
    const stat = fs.statSync(logFile);
    if (stat.size > MAX_LOG_BYTES) {
      const content = fs.readFileSync(logFile, 'utf8');
      const lines = content.split('\n').filter(Boolean);
      const kept = lines.slice(-KEEP_LOG_LINES);
      const truncated =
        `[AUTO-TRUNCATED: ${new Date().toISOString()} — menjaga ${KEEP_LOG_LINES} baris terbaru]\n` +
        kept.join('\n') + '\n';
      fs.writeFileSync(logFile, truncated);
    }
  } catch (err) {
    console.error('Failed to truncate log:', err.message);
  }
}

import { getActiveTenantId } from './tenant-context.js';

// Log to file for UI terminal
export function logToAutopilot(message) {
  try {
    const logDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const tenantId = getActiveTenantId();
    const logFile = path.join(logDir, `autopilot_logs_${tenantId}.txt`);
    const timestamp = new Date().toLocaleTimeString('id-ID', { hour12: false });
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(`[Autopilot Log] ${message}`);
    fs.appendFileSync(logFile, logMessage);
    _logWriteCounter++;
    if (_logWriteCounter % LOG_CHECK_INTERVAL === 0) {
      maybeTruncateLog(logFile);
    }
  } catch (err) {
    console.error('Failed to write autopilot log:', err.message);
  }
}


// Convert 0-based column index to letter
export function getColumnLetter(colIndex) {
  let temp = '';
  let letter = '';
  while (colIndex >= 0) {
    temp = colIndex % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    colIndex = Math.floor(colIndex / 26) - 1;
  }
  return letter;
}

// Convert file to base64
const fileToBase64 = (filePath) => {
  const absolutePath = filePath.startsWith('/') ? path.join(process.cwd(), 'public', filePath) : filePath;
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

// Resolve the best product reference image for campaign G-Labs usage.
// New canonical order: clean_photo_url → raw_photo_url.
// Legacy generated_photo_url / active_photo are NOT used as reference for new pipeline.
export function resolveProductImagePath(product) {
  if (!product) return null;

  // 1. Clean photo (canonical — dikurasi, berlatar putih)
  if (product.clean_photo_url) {
    const absPath = path.join(process.cwd(), 'public', product.clean_photo_url);
    if (fs.existsSync(absPath)) {
      return product.clean_photo_url;
    }
  }

  // 2. Cleaned photo alias (legacy compatibility — same as clean)
  if (product.cleaned_photo_url && product.cleaned_photo_url !== product.clean_photo_url) {
    const absPath = path.join(process.cwd(), 'public', product.cleaned_photo_url);
    if (fs.existsSync(absPath)) {
      return product.cleaned_photo_url;
    }
  }

  // 3. Raw photo (original, fallback saat clean belum tersedia)
  if (product.raw_photo_url) {
    const absPath = path.join(process.cwd(), 'public', product.raw_photo_url);
    if (fs.existsSync(absPath)) {
      return product.raw_photo_url;
    }
  }

  // 4. photo_url pointer (legacy compatibility — last resort)
  if (product.photo_url) {
    const absPath = path.join(process.cwd(), 'public', product.photo_url);
    if (fs.existsSync(absPath)) {
      return product.photo_url;
    }
  }

  return null;
}

// Helper tunggal untuk semua consumer kampanye/G-Labs:
// Kembalikan field URL (bukan path lokal) dengan urutan canonical Clean → Raw.
export function resolveProductReferenceImage(product) {
  if (!product) return null;
  return product.clean_photo_url || product.cleaned_photo_url || product.raw_photo_url || null;
}



// Update cell helper
export async function updateCell(sheets, spreadsheetId, sheetName, colIndex, rowIndex, value) {
  const colLetter = getColumnLetter(colIndex);
  const range = `'${sheetName}'!${colLetter}${rowIndex}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[value]]
    }
  });
}

// Ensure tab exists, setup bold/frozen headers, and append rows
export async function ensureTabAndAppendRows(sheets, spreadsheetId, tabName, headers, rows) {
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const tabExists = meta.data.sheets.some(s => s.properties.title === tabName);

    if (!tabExists) {
      logToAutopilot(`TAB "${tabName}" belum ada di Google Sheet. Membuat tab baru...`);
      const addSheetRes = await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: { title: tabName }
              }
            }
          ]
        }
      });

      const newSheetId = addSheetRes.data.replies[0].addSheet.properties.sheetId;
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${tabName}'!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers]
        }
      });

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: { sheetId: newSheetId, startRowIndex: 0, endRowIndex: 1 },
                cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.15, green: 0.15, blue: 0.2 } } },
                fields: 'userEnteredFormat(textFormat,backgroundColor)'
              }
            },
            {
              updateSheetProperties: {
                properties: { sheetId: newSheetId, gridProperties: { frozenRowCount: 1 } },
                fields: 'gridProperties.frozenRowCount'
              }
            }
          ]
        }
      });
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${tabName}'!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: rows
      }
    });
    logToAutopilot(`Berhasil menulis data ke TAB "${tabName}" di Google Sheet.`);
  } catch (err) {
    logToAutopilot(`[ERROR] Gagal menulis ke TAB "${tabName}": ${err.message}`);
  }
}

// Main background poller logic
export async function runSyncWorker() {
  logToAutopilot('=== MESIN AUTOPILOT SINKRONISASI MULAI ===');
  const db = getDb();

  // 1. Process active jobs first (State Machine)
  const activeJobs = await db.prepare(`
    SELECT j.*, c.campaign_name, c.campaign_type, c.spreadsheet_id, c.gdrive_folder_id, c.video_model, c.aspect_ratio, c.enable_tts, c.enable_glabs, c.enable_ffmpeg, c.voice_provider, c.voice_persona, c.voice_speed, c.voice_volume, c.ffmpeg_sync_option, c.ffmpeg_video_scale, c.ffmpeg_sfx_volume, c.ffmpeg_bgm_volume, c.tts_model_quality, c.target_language
    FROM sheets_jobs j
    JOIN sheets_campaigns c ON j.campaign_id = c.id
    WHERE j.status = 'processing' AND c.status = 'active'
  `).all();

  if (activeJobs.length > 0) {
    logToAutopilot(`Menemukan ${activeJobs.length} pekerjaan autopilot aktif yang sedang berjalan.`);
    for (const job of activeJobs) {
      // Guardrail: check for jobs stuck longer than the configured timeout (default: 10 minutes)
      const timeoutLimitMins = Number(getSetting('autopilot_guardrail_timeout') || '10');
      const jobCreatedAt = new Date(job.created_at + ' UTC').getTime();
      const elapsed = Date.now() - jobCreatedAt;
      const TIMEOUT_LIMIT_MS = timeoutLimitMins * 60 * 1000;

      if (elapsed > TIMEOUT_LIMIT_MS) {
        const elapsedMins = Math.round(elapsed / 60000);
        logToAutopilot(`[GUARDRAIL] Deteksi baris ${job.row_index} macet selama ${elapsedMins} menit. Menghentikan paksa.`);

        try {
          // Determine what stage it got stuck on
          let detailedReason = 'macet';
          if (!job.script_status || job.script_status === 'pending' || job.script_status === 'processing') {
            detailedReason = 'macet pada naskah';
          } else if (!job.tts_status || job.tts_status === 'pending' || job.tts_status === 'processing') {
            detailedReason = 'macet pada suara (TTS)';
          } else if (job.visual_status === 'processing') {
            // Find which clip got stuck in G-Labs
            const tasks = await db.prepare('SELECT * FROM glabs_tasks WHERE item_id = ?').all(job.id);
            const unfinished = tasks.find(t => t.status !== 'completed' && t.status !== 'failed');
            if (unfinished) {
              detailedReason = `macet pada visual klip ${unfinished.clip_index}`;
            } else {
              detailedReason = 'macet pada visual G-Labs';
            }
          } else if (job.visual_status === 'completed' && (!job.ffmpeg_status || job.ffmpeg_status === 'pending' || job.ffmpeg_status === 'processing')) {
            detailedReason = 'macet pada FFmpeg stitching';
          } else if (job.ffmpeg_status === 'completed' && job.status === 'processing') {
            detailedReason = 'macet pada upload Nextcloud';
          }

          // Update DB status to failed using safe wrapper
          updateSheetsJobStatus(job.id, { status: 'failed' });

          // Write failure to Google Sheet
          const auth = getAuthorizedClient();
          const sheets = google.sheets({ version: 'v4', auth });
          const sheetName = job.campaign_type === 'RE' ? 'CAMPAIGN_RE' : (job.campaign_type === 'OPC' ? 'CAMPAIGN_OPC' : 'CAMPAIGN_IFC');
          const rowsRes = await sheets.spreadsheets.values.get({
            spreadsheetId: job.spreadsheet_id,
            range: `'${sheetName}'!A1:Z1000`
          });
          const rows = rowsRes.data.values;
          if (rows) {
            const headers = rows[0].map(h => h.trim().toLowerCase());
            await updateCell(sheets, job.spreadsheet_id, sheetName, headers.indexOf('pipeline_status'), job.row_index, `Failed: ${detailedReason}`);
            await updateCell(sheets, job.spreadsheet_id, sheetName, headers.indexOf('processed_at'), job.row_index, new Date().toISOString());
          }
        } catch (guardrailErr) {
          logToAutopilot(`[GUARDRAIL ERROR] Gagal mengeksekusi guardrail untuk baris ${job.row_index}: ${guardrailErr.message}`);
          try {
            updateSheetsJobStatus(job.id, { status: 'failed' });
          } catch (dbErr) {
            logToAutopilot(`[GUARDRAIL ERROR] Gagal update status DB fallback: ${dbErr.message}`);
          }
        }

        continue; // Skip processing this job, let sync loop continue with next rows
      }

      try {
        await processActiveJob(job);
      } catch (err) {
        logToAutopilot(`[ERROR] Gagal memproses pekerjaan aktif ${job.id}: ${err.message}`);
        updateSheetsJobStatus(job.id, { status: 'failed' });
        try {
          const auth = getAuthorizedClient();
          const sheets = google.sheets({ version: 'v4', auth });
          const sheetName = job.campaign_type === 'RE' ? 'CAMPAIGN_RE' : (job.campaign_type === 'OPC' ? 'CAMPAIGN_OPC' : 'CAMPAIGN_IFC');
          const meta = await sheets.spreadsheets.get({ spreadsheetId: job.spreadsheet_id });
          const rowsRes = await sheets.spreadsheets.values.get({
            spreadsheetId: job.spreadsheet_id,
            range: `'${sheetName}'!A1:Z1000`
          });
          const rows = rowsRes.data.values;
          if (rows) {
            const headers = rows[0].map(h => h.trim().toLowerCase());
            await updateCell(sheets, job.spreadsheet_id, sheetName, headers.indexOf('pipeline_status'), job.row_index, 'Failed');
            await updateCell(sheets, job.spreadsheet_id, sheetName, headers.indexOf('processed_at'), job.row_index, new Date().toISOString());
          }
        } catch (sheetErr) {
          logToAutopilot(`[ERROR] Gagal memperbarui status 'Failed' di Google Sheets: ${sheetErr.message}`);
        }
      }
    }
    logToAutopilot('=== MESIN AUTOPILOT SINKRONISASI SELESAI ===');
    return;
  }

  // 2. If no active jobs, scan spreadsheet for new Approved rows
  const campaigns = getSheetsCampaigns().filter(c => c.status === 'active');
  if (campaigns.length === 0) {
    logToAutopilot('Tidak ada kampanye autopilot aktif ditemukan di database.');
    logToAutopilot('=== MESIN AUTOPILOT SINKRONISASI SELESAI ===');
    return;
  }

  for (const campaign of campaigns) {
    logToAutopilot(`\n--------------------------------------------------`);
    logToAutopilot(`Memindai baris baru untuk kampanye: ${campaign.campaign_name} (Tipe: ${campaign.campaign_type})`);

    try {
      const auth = getAuthorizedClient();
      const sheets = google.sheets({ version: 'v4', auth });

      const meta = await sheets.spreadsheets.get({ spreadsheetId: campaign.spreadsheet_id });
      const sheetName = campaign.campaign_type === 'RE' ? 'CAMPAIGN_RE' : (campaign.campaign_type === 'OPC' ? 'CAMPAIGN_OPC' : 'CAMPAIGN_IFC');

      const sheetExists = meta.data.sheets.some(s => s.properties.title === sheetName);
      if (!sheetExists) {
        logToAutopilot(`[PERINGATAN] Tab "${sheetName}" tidak ditemukan di Spreadsheet ID: ${campaign.spreadsheet_id}. Melewati.`);
        continue;
      }

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: campaign.spreadsheet_id,
        range: `'${sheetName}'!A1:Z1000`
      });

      const rows = response.data.values;
      if (!rows || rows.length <= 1) continue;

      const headers = rows[0].map(h => h.trim().toLowerCase());
      const reviewStatusIdx = headers.indexOf('review_status') !== -1 ? headers.indexOf('review_status') : headers.indexOf('review status');
      if (reviewStatusIdx === -1) continue;

      const requiredOutputs = ['batch_id', 'pipeline_status', 'markdown_url', 'asset_url', 'processed_at'];
      for (const req of requiredOutputs) {
        if (headers.indexOf(req) === -1) {
          const nextColIndex = headers.length;
          const colLetter = getColumnLetter(nextColIndex);
          await sheets.spreadsheets.values.update({
            spreadsheetId: campaign.spreadsheet_id,
            range: `'${sheetName}'!${colLetter}1`,
            valueInputOption: 'RAW',
            requestBody: { values: [[req]] }
          });
          headers.push(req);
        }
      }

      const urlSourceIdx = headers.indexOf('url_source') !== -1 ? headers.indexOf('url_source') : headers.indexOf('url source') !== -1 ? headers.indexOf('url source') : headers.indexOf('source url') !== -1 ? headers.indexOf('source url') : headers.indexOf('source_url');
      const pilarContentIdx = headers.indexOf('pilar_content') !== -1 ? headers.indexOf('pilar_content') : headers.indexOf('pilar content') !== -1 ? headers.indexOf('pilar content') : headers.indexOf('topik') !== -1 ? headers.indexOf('topik') : headers.indexOf('topic');
      const namaProdukIdx = headers.indexOf('nama produk') !== -1 ? headers.indexOf('nama produk') : headers.indexOf('nama_produk') !== -1 ? headers.indexOf('nama_produk') : headers.indexOf('product name') !== -1 ? headers.indexOf('product name') : headers.indexOf('product_name');

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const getVal = (idx) => {
          if (idx !== -1 && row[idx] !== undefined) return row[idx].trim();
          return '';
        };

        const reviewStatus = getVal(reviewStatusIdx);
        const pipelineStatus = getVal(headers.indexOf('pipeline_status'));

        if (reviewStatus === 'Approved' && pipelineStatus !== 'Completed' && pipelineStatus !== 'Processing') {
          // Check if retry count exceeded
          const previousJobs = getSheetsJobs(campaign.id)
            .filter(j => j.row_index === i + 1)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

          const latestJob = previousJobs[0];
          let currentRetryCount = 0;
          if (latestJob) {
            currentRetryCount = latestJob.retry_count || 0;
            if (latestJob.status === 'failed' && currentRetryCount >= 3) {
              logToAutopilot(`[LEWATI] Baris ${i + 1} sudah gagal 3 kali. Melewati.`);
              continue;
            }
          }

          // Found a row to start!
          const cleanName = (campaign.campaign_name || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
          const campaignCode = cleanName || 'GEN';
          const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          const batchId = `${campaign.campaign_type}-${campaignCode}-${dateStr}-${String(i + 1).padStart(3, '0')}`;

          if (latestJob && latestJob.status === 'failed') {
            logToAutopilot(`\n🔄 [Auto-Retry] Mencoba kembali baris ${i + 1} dengan Batch ID: ${batchId} (Percobaan #${currentRetryCount + 1}/3)...`);
          }

          const urlOrTopic = campaign.campaign_type === 'RE'
            ? getVal(urlSourceIdx)
            : (campaign.campaign_type === 'OPC' ? getVal(pilarContentIdx) : getVal(namaProdukIdx));

          const jobId = `job_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

          // Create Job in SQLite
          createSheetsJob({
            id: jobId,
            campaign_id: campaign.id,
            batch_id: batchId,
            row_index: i + 1,
            url_or_topic: urlOrTopic || 'N/A',
            status: 'processing',
            retry_count: latestJob && latestJob.status === 'failed' ? currentRetryCount + 1 : 0
          });

          // Carry over (inherit) progress if latestJob exists
          if (latestJob) {
            const inherits = {};
            if (latestJob.storyboard && latestJob.storyboard !== '[]') {
              inherits.storyboard = latestJob.storyboard;
              inherits.voiceover = latestJob.voiceover;
              inherits.prompts_json = latestJob.prompts_json;
              inherits.captions_json = latestJob.captions_json;
              inherits.script_status = 'completed';
              logToAutopilot(`[Resume] Mewarisi naskah storyboard/prompts dari job sebelumnya (${latestJob.id}).`);
            }
            if (latestJob.local_audio_path && fs.existsSync(path.join(process.cwd(), 'public', latestJob.local_audio_path))) {
              inherits.local_audio_path = latestJob.local_audio_path;
              inherits.tts_status = 'completed';
              logToAutopilot(`[Resume] Mewarisi berkas audio voiceover dari job sebelumnya (${latestJob.id}).`);
            }
            if (Object.keys(inherits).length > 0) {
              updateSheetsJobStatus(jobId, inherits);
            }
          }

          // Write back in progress status to sheet
          await updateCell(sheets, campaign.spreadsheet_id, sheetName, headers.indexOf('batch_id'), i + 1, batchId);
          await updateCell(sheets, campaign.spreadsheet_id, sheetName, headers.indexOf('pipeline_status'), i + 1, 'Processing');

          // Fetch the created job to pass to processActiveJob
          const newJob = await db.prepare('SELECT * FROM sheets_jobs WHERE id = ?').get(jobId);
          const mergedJob = {
            ...newJob,
            campaign_name: campaign.campaign_name,
            campaign_type: campaign.campaign_type,
            spreadsheet_id: campaign.spreadsheet_id,
            gdrive_folder_id: campaign.gdrive_folder_id,
            video_model: campaign.video_model,
            aspect_ratio: campaign.aspect_ratio,
            enable_tts: campaign.enable_tts,
            enable_glabs: campaign.enable_glabs,
            enable_ffmpeg: campaign.enable_ffmpeg,
            voice_provider: campaign.voice_provider,
            voice_persona: campaign.voice_persona,
            voice_speed: campaign.voice_speed,
            voice_volume: campaign.voice_volume,
            ffmpeg_sync_option: campaign.ffmpeg_sync_option,
            ffmpeg_video_scale: campaign.ffmpeg_video_scale,
            ffmpeg_sfx_volume: campaign.ffmpeg_sfx_volume,
            ffmpeg_bgm_volume: campaign.ffmpeg_bgm_volume,
            tts_model_quality: campaign.tts_model_quality,
            target_language: campaign.target_language,
            narrative_mode: campaign.narrative_mode || 'Storytelling'
          };

          // Dispatch the tasks!
          await processActiveJob(mergedJob);

          logToAutopilot('Selesai memulai pengerjaan baris baru. Tick scheduler berikutnya akan memproses status.');
          logToAutopilot('=== MESIN AUTOPILOT SINKRONISASI SELESAI ===');
          return;
        }
      }
    } catch (campaignErr) {
      logToAutopilot(`[ERROR] Terjadi kesalahan fatal pada kampanye ${campaign.campaign_name}: ${campaignErr.message}`);
    }
  }

  logToAutopilot('=== MESIN AUTOPILOT SINKRONISASI SELESAI ===');
}

async function processActiveJob(job) {
  const db = getDb();
  const auth = getAuthorizedClient();
  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });

  const sheetName = job.campaign_type === 'RE' ? 'CAMPAIGN_RE' : (job.campaign_type === 'OPC' ? 'CAMPAIGN_OPC' : 'CAMPAIGN_IFC');
  const meta = await sheets.spreadsheets.get({ spreadsheetId: job.spreadsheet_id });
  const rowsRes = await sheets.spreadsheets.values.get({
    spreadsheetId: job.spreadsheet_id,
    range: `'${sheetName}'!A1:Z1000`
  });
  const rows = rowsRes.data.values;
  if (!rows) throw new Error('Spreadsheet data is empty');
  const headers = rows[0].map(h => h.trim().toLowerCase());

  if (!job.script_status || job.script_status === 'pending') {
    await runScriptStage(job, sheets, headers, sheetName);
    job = await db.prepare('SELECT * FROM sheets_jobs WHERE id = ?').get(job.id);
  }

  if (job.script_status === 'completed' && (!job.tts_status || job.tts_status === 'pending')) {
    await runTtsStage(job, sheets, headers, sheetName);
    job = await db.prepare('SELECT * FROM sheets_jobs WHERE id = ?').get(job.id);
  }

  if (job.tts_status === 'completed' && (!job.visual_status || job.visual_status === 'pending')) {
    const campaign = getSheetsCampaign(job.campaign_id);
    if (campaign && campaign.enable_glabs !== 1) {
      logToAutopilot('G-Labs Visual Generator dinonaktifkan di konfigurasi. Melompati tahap visual...');
      updateSheetsJobStatus(job.id, { visual_status: 'completed', ffmpeg_status: 'pending' });
      job = await db.prepare('SELECT * FROM sheets_jobs WHERE id = ?').get(job.id);
    } else {
      await dispatchVisualTasks(job, sheets, headers, sheetName);
      return;
    }
  }

  if (job.visual_status === 'processing') {
    await pollVisualTasks(job, sheets, headers, sheetName);
    return;
  }

  if (job.visual_status === 'completed' && (!job.ffmpeg_status || job.ffmpeg_status === 'pending')) {
    await runFFmpegStage(job, sheets, headers, sheetName);
    job = await db.prepare('SELECT * FROM sheets_jobs WHERE id = ?').get(job.id);
  }

  if (job.ffmpeg_status === 'completed' && job.status === 'processing') {
    await runUploadStage(job, sheets, headers, sheetName, drive);
    return;
  }
}

async function runScriptStage(job, sheets, headers, sheetName) {
  const db = getDb();
  const campaign = getSheetsCampaign(job.campaign_id);
  if (!campaign) throw new Error(`Campaign ${job.campaign_id} not found`);

  const batchId = job.batch_id;
  const jobId = job.id;
  const urlOrTopic = job.url_or_topic;

  const rowsRes = await sheets.spreadsheets.values.get({
    spreadsheetId: campaign.spreadsheet_id,
    range: `'${sheetName}'!A1:Z1000`
  });
  const rows = rowsRes.data.values;
  if (!rows || rows.length <= job.row_index - 1) {
    throw new Error('Spreadsheet data row not found');
  }
  const row = rows[job.row_index - 1];

  const getVal = (idx) => {
    if (idx !== -1 && row[idx] !== undefined) return row[idx].trim();
    return '';
  };

  const getHeaderIndex = (aliases) => {
    for (const alias of aliases) {
      const idx = headers.indexOf(alias.toLowerCase().trim());
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const linkProductIdx = getProductUrlIndex(headers);
  const linkAffIdx = getAffiliateUrlIndex(headers);
  const pilarContentIdx = getHeaderIndex(['pilar_content', 'pilar content', 'topik', 'topic']);
  const hookIdx = getHeaderIndex(['hook']);
  const visualActionIdx = getHeaderIndex(['visual_action', 'visual action']);
  const namaProdukIdx = getHeaderIndex(['nama produk', 'nama_produk', 'product name', 'product_name']);
  const tautanGambarIdx = getHeaderIndex(['tautan_gambar_produk', 'tautan gambar produk', 'tautan gambar', 'product image url', 'product_image_url']);
  const hookCustomIdx = getHeaderIndex(['hook_visual_action_custom_instruction', 'hook visual action custom instruction', 'custom instruction']);
  const uspIdx = getHeaderIndex(['usp', 'unique selling point', 'unique_selling_point']);
  const cepIdx = getHeaderIndex(['cep', 'category entry point', 'category_entry_point']);
  const vfoIdx = getHeaderIndex(['vfo', 'value', 'value focus', 'value_focus', 'value focus objective']);
  const keyMsgIdx = getHeaderIndex(['key message', 'key_message', 'pesan utama', 'pesan_utama']);
  const wardrobeColorIdx = getHeaderIndex(['warna pakaian', 'warna wardrobe', 'wardrobe_color', 'wardrobe color', 'warna baju', 'warna jilbab', 'warna hijab']);

  const rowWardrobeColor = getVal(wardrobeColorIdx);

  let downloadedVideo = null;
  try {
    let storyboardRows = [];

    // 1. Download referential video if it exists (RE campaign)
    if (campaign.campaign_type === 'RE') {
      if (!urlOrTopic || !urlOrTopic.startsWith('http')) {
        throw new Error("URL video referensi tidak valid atau kosong untuk kampanye tipe RE.");
      }
      logToAutopilot(`Mengunduh video referensi: ${urlOrTopic}`);
      try {
        downloadedVideo = await downloadFromUrl(urlOrTopic);
        logToAutopilot(`Unduh video referensi berhasil: ${downloadedVideo.filePath}`);
      } catch (dlErr) {
        throw new Error(`Gagal mengunduh video referensi dari URL: ${dlErr.message}`);
      }
    }

    // 2. JIT Product Sourcing
    let product = null;
    const productUrl = getVal(linkProductIdx);
    const isBridgingActive = Number(campaign.is_bridging_active) === 1;
    const shouldSourceProduct = (isBridgingActive && productUrl && productUrl.startsWith('http')) ||
      (campaign.campaign_type === 'IFC' && productUrl && productUrl.startsWith('http'));

    if (shouldSourceProduct) {
      logToAutopilot(`[JIT Sourcing] Mencari URL produk di database: ${productUrl}`);
      product = await db.prepare('SELECT * FROM product_extractions WHERE input_source = ? OR source_url = ?').get(productUrl, productUrl);

      if (product) {
        logToAutopilot(`Aset produk ditemukan di database: "${product.product_name}".`);
      } else {
        logToAutopilot(`Aset produk tidak ditemukan. Memulai Playwright scraping JIT untuk URL: ${productUrl}`);
        const scrapeResult = await scrapeUrl(productUrl);
        logToAutopilot('Scraping HTML berhasil. Mengekstrak metadata menggunakan Gemini...');

        const extractedData = await executeWithKeyPool(1, async (apiKey) => {
          const prompt = `Lakukan ekstraksi terstruktur detail produk dari konten halaman toko berikut ke dalam JSON.
Halaman Konten:
${scrapeResult.fullText}

Hasilkan JSON dengan struktur:
{
  "product_name": "Nama Produk komersial lengkap beserta brand",
  "product_description": "Deskripsi singkat fungsi dan kegunaan produk",
  "unique_selling_point": "USP utama atau kelebihan produk",
  "scraped_image_url": "URL gambar produk asli dari CDN yang bersih",
  "target_audience": "Target pasar ideal",
  "pain_point_solved": "Masalah utama yang diselesaikan produk",
  "physical_state": {
    "is_in_packaging": true atau false,
    "packaging_type": "toples", "botol", "pouch", "box", "tube", atau "none" (tulis sesuai wadah fisik produk)
  },
  "t2i_prompt": "Text-to-Image prompt dalam Bahasa Inggris untuk menghasilkan foto produk studio komersial premium berlatar bersih tabletop",
  "i2v_action_prompt": "Image-to-Video action prompt dalam Bahasa Inggris yang mendeskripsikan gerakan cairan, tuangan, krim, atau interaksi mikro terhadap produk tersebut"
}`;

          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({
            model: GEMINI_MODELS.PRIMARY,
            generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
          });
          const result = await model.generateContent(prompt);
          return parseGeminiJSON(result.response.text());
        });

        if (!extractedData.product_name) {
          throw new Error('Gemini gagal mengekstrak nama produk.');
        }

        logToAutopilot(`Metadata produk berhasil diekstrak: "${extractedData.product_name}"`);

        let localImagePath = null;
        let cleanPhotoPath = null;
        if (extractedData.scraped_image_url && extractedData.scraped_image_url.startsWith('http')) {
          const safeFilename = `autopilot_jit_${Date.now()}.png`;
          localImagePath = `/uploads/products/${safeFilename}`;
          const absoluteLocalPath = path.join(process.cwd(), 'public', 'uploads', 'products', safeFilename);

          const uploadsDir = path.dirname(absoluteLocalPath);
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }

          logToAutopilot(`Mengunduh gambar produk dari ${extractedData.scraped_image_url}...`);
          await downloadECommerceImage(extractedData.scraped_image_url, absoluteLocalPath);
          logToAutopilot(`Gambar berhasil disimpan secara fisik ke ${localImagePath}`);

          // Run background remover!
          const cleanFilename = `clean_jit_${Date.now()}.png`;
          try {
            const { createCleanProductShot } = await import('./bg-remover');
            cleanPhotoPath = await createCleanProductShot(absoluteLocalPath, cleanFilename);
            logToAutopilot(`[JIT Sourcing] Hapus background sukses: ${cleanPhotoPath}`);
          } catch (bgErr) {
            logToAutopilot(`[JIT Sourcing] [PERINGATAN] Gagal hapus background: ${bgErr.message}`);
            cleanPhotoPath = localImagePath;
          }
        }

        const dbProductData = {
          id: `pe_jit_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          input_source: productUrl,
          is_url: 1,
          product_name: extractedData.product_name,
          product_description: extractedData.product_description || '',
          unique_selling_point: extractedData.unique_selling_point || '',
          target_audience: extractedData.target_audience || '',
          pain_point_solved: extractedData.pain_point_solved || '',
          key_visuals_extracted: JSON.stringify(extractedData.key_visuals_extracted || []),
          raw_response: JSON.stringify(extractedData),
          category: 'Autopilot JIT Sourcing',
          tags: 'autopilot, JIT',
          photo_url: cleanPhotoPath || localImagePath,
          source_url: productUrl,
          scraped_image_url: extractedData.scraped_image_url || null,
          raw_photo_url: localImagePath,
          clean_photo_url: cleanPhotoPath,
          cleaned_photo_url: cleanPhotoPath,
          generated_photo_url: null,
          is_in_packaging: extractedData.physical_state?.is_in_packaging ? 1 : 0,
          packaging_type: extractedData.physical_state?.packaging_type || 'none',
          t2i_prompt: extractedData.t2i_prompt || null,
          i2v_action_prompt: extractedData.i2v_action_prompt || null,
          affiliate_link: getVal(linkAffIdx) || '',
          raw_description: extractedData.product_description || ''
        };

        const { createProductExtraction } = await import('./db.js');
        createProductExtraction(dbProductData);
        product = dbProductData;
        logToAutopilot('Aset produk baru berhasil disimpan ke database SQLite.');
      }
    }

    if (product) {
      try {
        const { createOrUpdateCampaignProductBinding } = await import('./campaign-product-binding.js');
        const tenantId = getActiveTenantId();
        await createOrUpdateCampaignProductBinding({
          tenantId,
          sourceType: 'sheets_autopilot',
          sourceCampaignId: job.campaign_id,
          sourceItemId: job.id,
          brandProfileId: campaign.brand_profile_id || null,
          productId: product.id,
          explicitAffiliateOverride: null,
          affiliateRequired: false
        });
      } catch (bindErr) {
        logToAutopilot(`[Autopilot Binding Warning]: ${bindErr.message}`);
      }
    }

    if (campaign.campaign_type === 'IFC' && !product) {
      const directImgUrl = getVal(tautanGambarIdx);
      let localImagePath = null;
      if (directImgUrl && directImgUrl.startsWith('http')) {
        const safeFilename = `autopilot_ifc_${campaign.id}_row${job.row_index}.png`;
        localImagePath = `/uploads/products/${safeFilename}`;
        const absoluteLocalPath = path.join(process.cwd(), 'public', 'uploads', 'products', safeFilename);
        const uploadsDir = path.dirname(absoluteLocalPath);
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        if (fs.existsSync(absoluteLocalPath)) {
          logToAutopilot(`[IFC] Gambar produk sudah ada di server: ${localImagePath}. Menggunakan gambar lokal.`);
        } else {
          logToAutopilot(`Mengunduh gambar produk IFC dari ${directImgUrl}...`);
          await downloadECommerceImage(directImgUrl, absoluteLocalPath);
          logToAutopilot(`Gambar produk IFC berhasil diunduh ke ${localImagePath}`);
        }
      }

      product = {
        product_name: getVal(namaProdukIdx),
        product_description: getVal(namaProdukIdx),
        unique_selling_point: getVal(uspIdx),
        photo_url: localImagePath || directImgUrl,
        packaging_type: 'none',
        is_in_packaging: 0
      };
    }

    logToAutopilot('Memulai generasi naskah storyboard via Gemini...');
    let brandProfile = null;
    if (campaign.brand_profile_id) {
      const { getBrandProfile } = await import('./db.js');
      brandProfile = await getBrandProfile(campaign.brand_profile_id);
    }

    const { getAllKnowledgeBasesWithContent } = await import('./db.js');
    const kbs = await getAllKnowledgeBasesWithContent();

    let storyboardResult = null;
    let isProductActive = (campaign.campaign_type === 'IFC') || isBridgingActive;

    if (campaign.campaign_type === 'IFC') {
      const productName = getVal(namaProdukIdx) || '';
      const revealDuration = campaign.bridge_duration_clips !== undefined ? Number(campaign.bridge_duration_clips) : 0;
      if (productName.trim().length === 0 || revealDuration === 0) {
        isProductActive = false;
      }
    }

    const effectiveVisualMode = isProductActive ? (campaign.visual_mode || 'hybrid_lock') : 'pure_t2v';
    const effectiveProduct = isProductActive ? (product || {}) : {};

    const targetClips = campaign.target_clips_count || 4;
    const revealAtClip = campaign.bridge_at_clip || 3;
    const revealDuration = campaign.bridge_duration_clips !== undefined ? Number(campaign.bridge_duration_clips) : 0;
    const revealEndClip = revealAtClip + revealDuration - 1;
    const productName = effectiveProduct?.product_name || '';
    const hasProduct = productName.trim().length > 0 && revealDuration > 0;

    let rowVsoData = null;
    if (campaign.visual_overrides_json) {
      try {
        rowVsoData = JSON.parse(campaign.visual_overrides_json);
      } catch (e) {
        rowVsoData = {};
      }
    } else {
      rowVsoData = {};
    }

    rowVsoData = resolveVisualOverrides({
      visualOverrides: rowVsoData,
      itemIndex: Math.max(0, Number(job.row_index || 1) - 1),
      stableSeed: `${campaign.id}:${job.id}`,
      rowOverride: rowWardrobeColor
    });

    if (campaign.campaign_type === 'RE') {
      let prompt;
      if (isBridgingActive) {
        const config = {
          ...campaign,
          visual_mode: effectiveVisualMode,
          brand_profile: brandProfile,
          product_data: effectiveProduct,
          visual_overrides: rowVsoData,
          visual_style: campaign.visual_style || 'Cinematic'
        };
        prompt = buildReverseEngineeringBridgePrompt(kbs, config);
      } else {
        const config = {
          aspect_ratio: campaign.aspect_ratio || '9:16',
          target_ai: campaign.target_ai || 'Google Veo (8s)',
          custom_instruction: campaign.custom_instruction || '',
          prompt_output_format: 'plain_text',
          brand_profile: brandProfile,
          words_per_clip: campaign.words_per_clip || '17-19 kata',
          face_visibility: campaign.face_visibility || 'Faceless',
          visual_overrides: rowVsoData,
          target_clips_count: campaign.target_clips_count || 5,
          target_language: campaign.target_language || 'id-ID',
          tts_model_quality: campaign.tts_model_quality || 'speech-2.8-turbo',
          visual_style: campaign.visual_style || 'Cinematic',
          narrative_mode: campaign.narrative_mode || 'Storytelling'
        };
        prompt = buildReverseEngineeringPrompt(kbs, config);
      }

      const rawResponse = await executeWithKeyPool(1, async (apiKey) => {
        let videoPayload = null;
        if (downloadedVideo) {
          logToAutopilot('Mengunggah video referensi ke Gemini API...');
          try {
            const upload = await uploadVideoToGemini(downloadedVideo.filePath, downloadedVideo.mimeType, apiKey);
            videoPayload = {
              fileUri: upload.fileUri,
              mimeType: upload.mimeType
            };
            logToAutopilot('Video referensi berhasil diunggah ke Gemini server.');
          } catch (uploadErr) {
            logToAutopilot(`[PERINGATAN] Gagal mengunduh video ke Gemini (${uploadErr.message}). Menganalisis sebagai teks saja.`);
          }
        }

        return await generateContentFlexible({
          prompt,
          videoPayload,
          apiKey
        });
      });

      if (downloadedVideo) {
        cleanupTempFile(downloadedVideo.filePath);
        downloadedVideo = null;
      }

      storyboardResult = parseGeminiJSON(rawResponse);
    } else if (campaign.campaign_type === 'OPC') {
      const campaignData = {
        ...campaign,
        is_bridging_active: isBridgingActive ? 1 : 0,
        visual_mode: effectiveVisualMode,
        content_pillar: getVal(pilarContentIdx),
        custom_hook: getVal(hookIdx),
        visual_action_guideline: getVal(visualActionIdx)
      };
      const vsoData = rowVsoData;
      const prompt = buildOrganicPillarPrompt(kbs, campaignData, effectiveProduct, brandProfile, vsoData);

      const rawResponse = await generateContentFlexible({
        prompt,
        modelName: GEMINI_MODELS.PRIMARY,
        timeoutMs: 180000
      });

      storyboardResult = parseGeminiJSON(rawResponse);
    } else if (campaign.campaign_type === 'IFC') {
      let vsoSection = '';
      const vsoData = rowVsoData;
      if (vsoData) {
        const targetConcept = vsoData.character_concept || "faceless";
        const targetCharacter = vsoData.subject_demographic === "custom"
          ? vsoData.subject_demographic_custom
          : (DEMOGRAPHIC_PRESETS[vsoData.subject_demographic] || "a graceful Muslimah");
        const targetWardrobe = vsoData.wardrobe_style === "custom"
          ? vsoData.wardrobe_style_custom
          : (WARDROBE_PRESETS[vsoData.wardrobe_style] || "modest clothing");
        const targetLighting = vsoData.lighting_style === "custom"
          ? vsoData.lighting_style_custom
          : (LIGHTING_PRESETS[vsoData.lighting_style] || "soft natural light");

        vsoSection = `
========================================================================
🚨 VISUAL SWAP OVERRIDES (VSO PRESET) MANDATE
========================================================================
Anda WAJIB menyesuaikan seluruh detail estetika visual video dengan spesifikasi visual di bawah ini di seluruh klip storyboard maupun prompt visual T2V/T2I/I2V:
1. Konsep Karakter  : ${targetConcept} (${getConceptInstruction(targetConcept)})
2. Demografi Subjek : ${targetCharacter}
3. Warna Hijab (Wardrobe): ${targetWardrobe}
4. Pencahayaan/Light: ${targetLighting}
5. KONSISTENSI WARDROBE WAJIB: Warna, tekstur, dan pola dari gamis/wardrobe (${targetWardrobe}) HARUS IDENTIK di seluruh klip. Jangan mengganti warna atau motif pakaian subjek antar-klip. Setiap klip yang menampilkan subjek WAJIB menggunakan wardrobe dengan warna dan tekstur yang PERSIS SAMA.
6. KONSISTENSI LATAR/LOKASI WAJIB: Latar belakang (Environment/Location) dan suasana ruangan HARUS SELARAS di seluruh klip. Gunakan tema latar yang seragam (misalnya jika berlatar meja studio, pastikan semua klip berlatar meja studio serupa) dan dilarang berpindah lokasi secara ekstrem antar adegan.

Terapkan aturan visibilitas wajah dan konsep karakter secara konsisten di deskripsi visual storyboard maupun prompt T2V/T2I (tulis dalam Bahasa Inggris).
========================================================================
`;
      }

      const targetLanguage = campaign.target_language || 'id-ID';
      const languageLabel = targetLanguage === 'en-US' ? 'English (US)' : 'Bahasa Indonesia';

      let faceVisibility = campaign.face_visibility || 'Faceless';
      if (vsoData) {
        const targetConcept = vsoData.character_concept || "faceless";
        if (targetConcept.toLowerCase() === 'faceless') faceVisibility = 'Faceless';
        else if (targetConcept.toLowerCase() === 'pov') faceVisibility = 'POV';
        else if (targetConcept.toLowerCase() === 'silhouette') faceVisibility = 'Silhouette';
        else if (targetConcept.toLowerCase() === 'stylized_3d') faceVisibility = '3D Stylized Claymation';
      }

      const customHook = getVal(hookIdx);
      const customVisualAction = getVal(visualActionIdx);
      const contentPillar = getVal(pilarContentIdx);
      const cepVal = getVal(cepIdx);
      const vfoVal = getVal(vfoIdx);
      const keyMsgVal = getVal(keyMsgIdx);

      let productSection = '';
      let narrationStructure = '';

      if (hasProduct) {
        const revealRangeText = (revealDuration === 1 || revealEndClip <= revealAtClip)
          ? `Klip ${revealAtClip}`
          : `Klip ${revealAtClip} hingga Klip ${revealEndClip}`;

        productSection = `
========================================================================
🚨 KETENTUAN PEMBAHASAN PRODUK (PRODUCT REVEAL MANDATE)
========================================================================
Produk Target wajib dibahas dan diperkenalkan HANYA pada rentang klip berikut: **${revealRangeText}**.
Detail Produk:
- Nama Produk: "${productName}"
- Deskripsi: "${effectiveProduct?.product_description || ''}"
- Unique Selling Point (USP): "${effectiveProduct?.unique_selling_point || ''}"
- Bentuk Kemasan Fisik: "${effectiveProduct?.packaging_type || 'none'}" (Apakah di dalam kemasan: ${effectiveProduct?.is_in_packaging === 1 || effectiveProduct?.is_in_packaging === true ? 'Yes' : 'No'})${getPackagingInstruction(effectiveProduct)}
${keyMsgVal ? `- Key Message Solusi Produk: "${keyMsgVal}"` : ''}

Aturan Narasi Produk:
1. Bahas produk target secara kasual dan kreatif pada ${revealRangeText}. Hubungkan kegunaan produk dengan konflik/cerita yang sedang eskalasi.
2. Di luar klip ${revealRangeText} (misal klip pembuka sebelum reveal atau klip penutup setelah durasi produk selesai), Anda DILARANG KERAS membahas atau mempromosikan produk/brand. Narasi harus murni berfokus pada cerita/konteks edukasi.

${buildProductTruthContractSection(effectiveProduct, revealAtClip, revealEndClip)}
🚨 PRODUCT GEOMETRY MANDATE:
For target product clips (Clip ${revealAtClip} to ${revealEndClip}), you MUST base the [Product geometry/label details] and [Material Physics] in your "t2i_prompts" strictly on the "Bentuk Kemasan Fisik" provided above. Do not hallucinate different packaging types (e.g., if the packaging type is "toples" or "jar", describe it as a jar/cylinder, NOT a pouch or bag).
`;
      } else {
        productSection = `
========================================================================
🚨 KETENTUAN CERITA TANPA PRODUK (NO PRODUCT MANDATE)
========================================================================
Kampanye ini dikonfigurasi TANPA promosi produk. Seluruh adegan (${targetClips} klip) wajib difokuskan murni pada pembahasan cerita edukatif, informatif, atau drama kasual yang mengalir, tanpa menyebutkan produk atau brand apa pun.
`;
      }

      const narrMode = campaign.narrative_mode || 'Storytelling';
      let narrativeModeInst = '';
      if (narrMode === 'Storytelling') {
        narrativeModeInst = `Gaya bahasa voiceover wajib "Storytelling" (bercerita situasional/perjalanan tanpa menggunakan kata ganti orang pertama seperti "Aku/Gue" atau tokoh fiktif seperti "Andi/Siti" untuk menghindari kesan berbohong. Fokus pada keindahan proses, estetika visual, dan kenyamanan jangka panjang).`;
      } else if (narrMode === 'Problem-Solution') {
        narrativeModeInst = `Gaya bahasa voiceover wajib "Problem-Solution" (awali dengan penekanan rasa lelah, keluhan, atau frustrasi penonton secara dramatis/pain point, diikuti dengan solusi konkret secara logis. Fokus pada efisiensi waktu, kemudahan, dan nilai praktis).`;
      } else if (narrMode === 'Educational') {
        narrativeModeInst = `Gaya bahasa voiceover wajib "Educational" (fokus pada fakta informatif, penjelasan ilmiah/teknis di balik metode, serta tips yang bernilai edukatif tinggi).`;
      }

      narrationStructure = `
========================================================================
🚨 GAYA NARASI KAMPANYE: ${narrMode}
========================================================================
${narrativeModeInst}

========================================================================
🚨 STRUKTUR NARASI S-E-P (SETUP, ESCALATION, PAYOFF) MANDATE
========================================================================
Anda wajib menyusun alur cerita storyboard dan voiceover sebanyak tepat ${targetClips} klip mengikuti kaidah SEP berikut:
1. **SETUP (Klip 1)**:
   - Tahap pengenalan situasi awal, karakter, atau latar masalah/aktivitas.
   - ${cepVal ? `Integrasikan situasi Category Entry Point (CEP) berikut sebagai pemantik awal cerita: "${cepVal}"` : ''}
   - ${customHook ? `Gunakan teks Hook berikut sebagai kalimat voiceover pembuka Klip 1 secara utuh: "${customHook}"` : 'Buat hook pembuka yang viral, relevan, dan memicu rasa penasaran penonton.'}
2. **ESCALATION (Klip 2 hingga Klip ${targetClips - 1})**:
   - Peningkatan ketegangan, drama, atau pendalaman masalah/konteks aktivitas secara bertahap.
   - ${customVisualAction ? `Adaptasikan ide visual/adegan berikut ke dalam deskripsi adegan visual klip-klip ini: "${customVisualAction}"` : 'Jelaskan visualisasi aktivitas yang menarik dan dinamis.'}
   - ${hasProduct ? `Bahas/hubungkan produk target pada klip ke-${revealAtClip} (reveal) hingga klip ke-${revealEndClip} sebagai bagian dari penyelesaian/aktivitas eskalasi. ${vfoVal ? `Gunakan pendekatan nilai (VFO) bertipe "${vfoVal}" saat menyampaikan solusi produk tersebut.` : ''}` : ''}
3. **PAYOFF (Klip terakhir / Klip ${targetClips})**:
   - Penyelesaian konflik, kesimpulan edukatif, atau CTA penutup yang memuaskan penonton.
   - Jika rentang pembahasan produk mencakup klip terakhir ini, akhiri dengan rekomendasi produk secara halus ${keyMsgVal ? `yang menyampaikan Key Message: "${keyMsgVal}"` : ''}. Jika tidak, akhiri dengan kesimpulan cerita umum yang bernilai. ${hasProduct ? `Selain itu, Anda WAJIB menyertakan alternatif "cta_facebook" dan "cta_tiktok" khusus di dalam objek JSON voiceover klip terakhir ini.
    🚨 CRITICAL CTA VARIATIONS MANDATE:
    - "cta_facebook": MUST refer to clicking the link (e.g., "klik link di bawah ya!", "info lengkap cek link di bawah!").
    - "cta_tiktok": MUST refer to buying from the profile bio link, comment pin, or shop link, but strictly NEVER mention "link di bawah" (e.g., "produk ori di bio ya!", "dapatkan di keranjang kuning ya!").` : ''}
`;

      const allowedKBs = [
        'MAKNA_Config_v54.9',
        'REALIST_VIRAL_NARRATIVE',
        'STRATEGIC_FRAMEWORKS',
        'PROMPT_SYSTEM',
        'NARRATIVE_STRUCTURE'
      ];
      const kbCombined = kbs
        .filter(kb => allowedKBs.some(allowed => kb.name.includes(allowed)))
        .map((kb, i) => `=== KNOWLEDGE BASE ${i + 1}: ${kb.name} ===\n${kb.content}\n=== END KB ${i + 1} ===`)
        .join('\n\n');

      const prompt = `Tugas Anda adalah merancang naskah iklan Instant Factory Campaign (IFC) sebanyak tepat ${targetClips} klip.

## KNOWLEDGE BASE(S) INJECTION
${kbCombined}

Informasi Input Sheet:
- Topik/Pilar Konten: ${contentPillar || '(Gunakan topik cerita yang mengalir)'}
- Custom Instructions: ${campaign.custom_instruction || getVal(hookCustomIdx) || ''}

${productSection}

${narrationStructure}

========================================================================
🚨 VISUAL MODE CONFIGURATION: ${effectiveVisualMode}
========================================================================
Aspek Rasio: ${campaign.aspect_ratio || '9:16'}
Model Video: ${campaign.video_model || 'veo_31_lite'}
Gaya Visual (Visual Style): ${campaign.visual_style || 'Cinematic'}
Aturan Visual Mode (${effectiveVisualMode}):
${effectiveVisualMode === 'hybrid_lock' && hasProduct ? `
- Klip di luar pembahasan produk (Klip sebelum ke-${revealAtClip} atau sesudah ke-${revealEndClip}) wajib menggunakan Text-to-Video. Isi array "t2v_prompts" untuk klip-klip tersebut. Anda tidak perlu mengisi "t2i_prompts" and "i2v_prompts" untuk klip selain klip pembahasan produk.
- Klip ke-${revealAtClip} hingga ${revealEndClip} (klip pembahasan produk) wajib menggunakan Double-Pass (T2I + I2V) untuk mengunci konsistensi produk:
  - Isi array "t2i_prompts" untuk klip-klip tersebut (start frame image).
  - Isi array "i2v_prompts" untuk klip-klip tersebut (motion video).
  - Anda tidak boleh mengisi "t2v_prompts" untuk klip pembahasan produk.` : `
- Semua klip (Klip 1 hingga ${targetClips}) wajib menggunakan Text-to-Video. Isi array "t2v_prompts" untuk seluruh klip tersebut. Anda tidak perlu mengisi array "t2i_prompts" dan "i2v_prompts".`}

${brandProfile ? `
🚨 BRAND IDENTITY INTEGRATION
- Nama Brand: ${brandProfile.brand_name}
- Tone of Voice: ${brandProfile.tone_of_voice} (Naskah VO wajib bergaya ${brandProfile.tone_of_voice})
- Gaya Estetika Visual: ${brandProfile.visual_signature}
- Palet Warna Kamera: ${brandProfile.color_palette}
- Elemen Terlarang: ${brandProfile.forbidden_elements}
- Slogan Kampanye/CTA Penutup: ${brandProfile.brand_slogan_or_cta} (Akhiri adegan terakhir dengan slogan ini)
` : ''}

${vsoSection}

---
## ATURAN BAHASA (LANGUAGE MANDATE)
Naskah voiceover ("narration") dan metadata media sosial (captions, title, description) WAJIB ditulis sepenuhnya dalam bahasa: **${languageLabel}**.
Semua prompt visual (t2v_prompts, i2v_prompts, dan t2i_prompts) tetap WAJIB ditulis dalam Bahasa Inggris.

## ATURAN FORMAT PROMPT VISUAL (STRICT VISUAL PROMPT FORMATTING)
1. Tulis visual prompt dalam bentuk deskripsi linear satu baris (Plain Text format) tanpa menyertakan enter/newline (\n) dan BEBAS dari tag 'NEGATIVE PROMPT'.
2. Gunakan format LAYER yang terstruktur untuk seluruh prompt visual (t2v_prompts, t2i_prompts, dan i2v_prompts) guna memastikan konsistensi dan detail yang maksimal.
3. Terapkan Face Visibility secara konsisten: Anda WAJIB mematuhi aturan "${faceVisibility}" di seluruh visual prompt (T2V/T2I/I2V).
   * Jika "Faceless": Frame WAJIB dipotong dari siku ke bawah. DILARANG keras menampilkan wajah, kepala, leher, dada, atau bahu pada adegan mana pun. Fokus pada area lengan hingga pergelangan tangan dan jari (forearm & hand close-up).
   * Jika "POV": Gunakan sudut pandang orang pertama (First-Person POV) seolah-olah kamera adalah mata subjek.
   * Jika "Silhouette": Tampilkan subjek manusia berupa siluet/bayangan gelap dengan backlighting dramatis tanpa memperlihatkan fitur wajah.

Output harus berupa JSON valid sesuai skema:
{
  "analysis_summary": {
    "original_hook_analysis": "Analisis hook",
    "weakness_identified": "Kelemahan pasar",
    "the_upgrade_strategy": "Strategi promosi"
  },
  "storyboard": [
    {
      "scene": 1,
      "duration": "8s",
      "visual_description": "Deskripsi adegan detail (dalam Bahasa Inggris)",
      "camera_movement": "Kinetic camera movement (dalam Bahasa Inggris)",
      "audio_mood": "SFX & mood musik"
    }
  ],
  "voiceover": [
    {
      "scene": 1,
      "narration": "Naskah voiceover dalam ${languageLabel}"
    }${hasProduct ? `,
    {
      "scene": ${targetClips},
      "narration": "Naskah voiceover default untuk klip terakhir.",
      "cta_facebook": "Alternatif CTA khusus Facebook/Instagram (misal: 'klik link di bawah ya!'). Wajib dalam ${languageLabel}.",
      "cta_tiktok": "Alternatif CTA khusus TikTok (misal: 'produk ori di keranjang ya!'). Wajib dalam ${languageLabel}."
    }` : ''}
  ],
  "t2v_prompts": [
    {
      "clip": 1,
      "prompt": "(VERTICAL 9:16) --ar ${campaign.aspect_ratio || '9:16'} --no landscape [LAYER 0: VISUAL TRUTH & ANCHORS] (Geometric Truth: [MANDATE 50 - Shape & Material Extraction]), (Biometric Anchor: [MANDATE 29 - 3-Point Character Lock]), (Wardrobe: [Wardrobe Lock]). [LAYER 1: SCENE & OPTICS] (Location: [MANDATE 33 - Verbatim Scene Lock]), (Lens: [Camera Spec]), (Camera Move: [Insert Kinetic Logic]), (Lighting: [Lighting Mood]). [LAYER 2: MICRO-PACING & ACTION (MANDATE 49)] ([00:00-00:02]): (Visual Action: [Move]), ([00:02-00:04]): (Visual Action: [Move]), ([00:04-00:06]): (Visual Action: [Move]), ([00:06-00:08]): (Visual Action: [Move] + [TRANSITION LOCK]). [LAYER 3: SFX] SFX: [Insert SFX]"
    }
  ],
  "t2i_prompts": [
    {
      "clip": 1,
      "prompt": "(VERTICAL 9:16) --ar ${campaign.aspect_ratio || '9:16'} --no landscape [LAYER 1: OPTICS] (Shot on [Camera], [Lens]), (Texture: [Film Physics]). [LAYER 2: SUBJECT & VISUAL TRUTH] (Anchor: [Subject Anchor]), (Wardrobe: [Wardrobe Lock]), (Product Truth: [Product Geometry] made of [Material Physics]). [LAYER 3: SCENE & LIGHT] (Environment: [Scene Lock]), (Lighting: [Lighting Mood]). [LAYER 4: KINETIC IMPLICATION] (Frozen Action: Subject is poised to [Action Verb]), (Micro-Expression: [Key Emotion])."
    }
  ],
  "i2v_prompts": [
    {
      "clip": 1,
      "prompt": "(VERTICAL 9:16) --ar ${campaign.aspect_ratio || '9:16'} --no landscape [LAYER 1: INPUT & TRUTH LOCK] (Start Frame: [Filename]), (Consistency: MAX). (Geometric Truth: [MANDATE 50 - Shape & Material Extraction]). [LAYER 2: MICRO-PACING & ACTION (MANDATE 49)] ([00:00-00:02]): (Visual Action: [Move]), ([00:02-00:04]): (Visual Action: [Move]), ([00:04-00:06]): (Visual Action: [Move]), ([00:06-00:08]): (Visual Action: [Move] + [TRANSITION LOCK]). [LAYER 3: SFX] SFX: [Insert SFX]"
    }
  ],
  "tiktok_caption": "Caption TikTok. In ${languageLabel}.",
  "ig_caption": "Caption Instagram. In ${languageLabel}.",
  "yt_title": "Judul YouTube Shorts. In ${languageLabel}.",
  "yt_desc": "Deskripsi YouTube Shorts. In ${languageLabel}."
}`;

      const rawResponse = await generateContentFlexible({
        prompt,
        modelName: GEMINI_MODELS.PRIMARY,
        timeoutMs: 180000
      });

      storyboardResult = parseGeminiJSON(rawResponse);
    }

    // Compatibility mapper for RE campaigns (which output new_video_plan format)
    if (storyboardResult.new_video_plan && !storyboardResult.storyboard) {
      const plan = storyboardResult.new_video_plan;
      storyboardResult.storyboard = plan.map(item => ({
        scene: item.clip_index || item.clip || 1,
        duration: item.duration || '8s',
        visual_description: item.visual_action || '',
        camera_movement: item.camera_movement || '',
        audio_mood: item.audio_mood || ''
      }));
      storyboardResult.voiceover = plan.map(item => ({
        scene: item.clip_index || item.clip || 1,
        narration: item.new_vo || item.voiceover || ''
      }));
      storyboardResult.t2v_prompts = plan.map(item => ({
        clip: item.clip_index || item.clip || 1,
        prompt: item.t2v_prompt || ''
      })).filter(p => p.prompt);
      storyboardResult.t2i_prompts = plan.map(item => ({
        clip: item.clip_index || item.clip || 1,
        prompt: item.t2i_prompt || ''
      })).filter(p => p.prompt);
      storyboardResult.i2v_prompts = plan.map(item => ({
        clip: item.clip_index || item.clip || 1,
        prompt: item.i2v_prompt || ''
      })).filter(p => p.prompt);
    }

    logToAutopilot('Generasi naskah storyboard berhasil.');

    // Programmatic prompt partitioning alignment (v10.15.0)
    const isHybrid = (effectiveVisualMode === 'hybrid_lock' && hasProduct);
    logToAutopilot(`[Visual Mode Guard] Melakukan restrukturisasi visual prompt agar selaras dengan mode ${isHybrid ? 'Hybrid Lock' : 'Pure T2V'}...`);

    const newT2v = [];
    const newT2i = [];
    const newI2v = [];

    for (let c = 1; c <= targetClips; c++) {
      const isBridge = isHybrid && (c >= revealAtClip && c <= revealEndClip);

      const origT2v = (storyboardResult.t2v_prompts || []).find(p => Number(p.clip) === c)?.prompt || '';
      const origT2i = (storyboardResult.t2i_prompts || []).find(p => Number(p.clip) === c)?.prompt || '';
      const origI2v = (storyboardResult.i2v_prompts || []).find(p => Number(p.clip) === c)?.prompt || '';

      if (isBridge) {
        // Bridge Clip: Wajib T2I & I2V
        const resolvedT2i = origT2i || origT2v || `product photograph of ${productName}, cinematic studio lighting, 9:16 vertical --ar 9:16`;
        const resolvedI2v = origI2v || origT2v || `cinematic camera slowly panning, product close up, 9:16 vertical --ar 9:16`;

        newT2i.push({ clip: c, prompt: resolvedT2i });
        newI2v.push({ clip: c, prompt: resolvedI2v });
      } else {
        // Non-Bridge Clip: Wajib T2V
        const resolvedT2v = origT2v || origI2v || origT2i || `cinematic video, vertical 9:16 --ar 9:16`;

        newT2v.push({ clip: c, prompt: resolvedT2v });
      }
    }

    storyboardResult.t2v_prompts = newT2v;
    storyboardResult.t2i_prompts = newT2i;
    storyboardResult.i2v_prompts = newI2v;
    logToAutopilot('[Visual Mode Guard] Restrukturisasi prompt selesai.');

    // JIT Dynamic Voice Cast Registration
    if (campaign.enable_audio_segment === 1) {
      logToAutopilot('[JIT Voice Cast] Memeriksa naskah untuk pendaftaran karakter otonom...');
      const updatedVoiceCastJson = registerJitVoiceCast(
        campaign.voice_cast_json,
        storyboardResult.voiceover || [],
        campaign.target_language || 'id-ID'
      );
      if (updatedVoiceCastJson) {
        logToAutopilot('[JIT Voice Cast] Karakter baru ditemukan! Mendaftarkan ke database kampanye...');
        await db.prepare('UPDATE sheets_campaigns SET voice_cast_json = ? WHERE id = ?').run(updatedVoiceCastJson, campaign.id);
        campaign.voice_cast_json = updatedVoiceCastJson;
      }
    }

    // Write back to SQLite
    updateSheetsJobStatus(jobId, {
      storyboard: JSON.stringify(storyboardResult.storyboard || []),
      voiceover: JSON.stringify(storyboardResult.voiceover || []),
      prompts_json: JSON.stringify({
        t2v_prompts: storyboardResult.t2v_prompts || [],
        t2i_prompts: storyboardResult.t2i_prompts || [],
        i2v_prompts: storyboardResult.i2v_prompts || []
      }),
      captions_json: JSON.stringify({
        caption: storyboardResult.social_media_package?.caption || storyboardResult.caption || storyboardResult.universal_caption || storyboardResult.tiktok_caption || storyboardResult.ig_caption || '',
        tiktok_caption: storyboardResult.social_media_package?.caption || storyboardResult.caption || storyboardResult.universal_caption || storyboardResult.tiktok_caption || storyboardResult.ig_caption || '',
        ig_caption: storyboardResult.social_media_package?.caption || storyboardResult.caption || storyboardResult.universal_caption || storyboardResult.tiktok_caption || storyboardResult.ig_caption || '',
        yt_title: storyboardResult.social_media_package?.caption || storyboardResult.caption || storyboardResult.universal_caption || storyboardResult.tiktok_caption || storyboardResult.ig_caption || '',
        yt_desc: storyboardResult.social_media_package?.caption || storyboardResult.caption || storyboardResult.universal_caption || storyboardResult.tiktok_caption || storyboardResult.ig_caption || ''
      }),
      script_status: 'completed'
    });

    const storyboard = storyboardResult.storyboard || storyboardResult.production_storyboard || [];
    storyboardRows = storyboard.map((s, idx) => {
      const sceneNum = s.scene || s.scene_number || (idx + 1);
      const sceneId = `${batchId}_S${String(sceneNum).padStart(2, '0')}`;
      const visualDesc = s.visual_description || (s.visual_segment?.visual_action) || '';
      const cameraMov = s.camera_movement || (s.visual_segment?.camera_movement) || '';
      const sfxMood = s.audio_mood || (s.audio_segment?.audio_mood) || '';
      return [
        batchId,
        sceneId,
        sceneNum,
        s.duration || '8s',
        visualDesc,
        cameraMov,
        sfxMood
      ];
    });

    // Write to tabs in Google Sheets
    if (storyboardRows && storyboardRows.length > 0) {
      await ensureTabAndAppendRows(
        sheets,
        campaign.spreadsheet_id,
        'Storyboard',
        ['batch_id', 'scene_id', 'scene_number', 'duration', 'visual_description', 'camera_movement', 'audio_mood'],
        storyboardRows
      );

      const voiceoverRows = storyboard.map((s, idx) => {
        const sceneNum = s.scene || s.scene_number || (idx + 1);
        const sceneId = `${batchId}_S${String(sceneNum).padStart(2, '0')}`;
        const vo = (storyboardResult.voiceover || []).find(v => Number(v.scene || v.clip || v.scene_number) === Number(sceneNum)) || {};
        const narration = vo.narration || vo.voiceover_text || '';
        return [
          batchId,
          sceneId,
          sceneNum,
          narration
        ];
      });
      await ensureTabAndAppendRows(
        sheets,
        campaign.spreadsheet_id,
        'Voiceover',
        ['batch_id', 'scene_id', 'scene_number', 'narration'],
        voiceoverRows
      );

      const promptsRows = storyboard.map((s, idx) => {
        const sceneNum = s.scene || s.scene_number || (idx + 1);
        const sceneId = `${batchId}_S${String(sceneNum).padStart(2, '0')}`;
        const t2v = (storyboardResult.t2v_prompts || []).find(p => Number(p.clip || p.scene || p.scene_number) === Number(sceneNum))?.prompt || '';
        const t2i = (storyboardResult.t2i_prompts || []).find(p => Number(p.clip || p.scene || p.scene_number) === Number(sceneNum))?.prompt || '';
        const i2v = (storyboardResult.i2v_prompts || []).find(p => Number(p.clip || p.scene || p.scene_number) === Number(sceneNum))?.prompt || '';
        return [
          batchId,
          sceneId,
          sceneNum,
          t2v,
          t2i,
          i2v
        ];
      });
      await ensureTabAndAppendRows(
        sheets,
        campaign.spreadsheet_id,
        'Prompt',
        ['batch_id', 'scene_id', 'scene_number', 't2v_prompt', 't2i_prompt', 'i2v_prompt'],
        promptsRows
      );

      // Force update Prompt sheet headers to ensure compatibility with new columns
      try {
        await sheets.spreadsheets.values.update({
          spreadsheetId: campaign.spreadsheet_id,
          range: `'Prompt'!A1:F1`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [['batch_id', 'scene_id', 'scene_number', 't2v_prompt', 't2i_prompt', 'i2v_prompt']]
          }
        });
      } catch (err) {
        logToAutopilot(`[PERINGATAN] Gagal memaksakan update header 'Prompt'!A1:F1: ${err.message}`);
      }

      const tiktok = storyboardResult.tiktok_caption || storyboardResult.analysis_summary?.tiktok_caption || '';
      const ig = storyboardResult.ig_caption || storyboardResult.analysis_summary?.ig_caption || '';
      const ytTitle = storyboardResult.yt_title || storyboardResult.analysis_summary?.yt_title || '';
      const ytDesc = storyboardResult.yt_desc || storyboardResult.analysis_summary?.yt_desc || '';
      const captionsRows = [
        [
          batchId,
          tiktok,
          ig,
          ytTitle,
          ytDesc
        ]
      ];
      await ensureTabAndAppendRows(
        sheets,
        campaign.spreadsheet_id,
        'Captions',
        ['batch_id', 'tiktok_caption', 'ig_caption', 'yt_title', 'yt_desc'],
        captionsRows
      );
    }
  } catch (err) {
    logToAutopilot(`[ERROR] Gagal pada runScriptStage: ${err.message}`);
    updateSheetsJobStatus(jobId, { status: 'failed', script_status: 'failed' });
    try {
      await updateCell(sheets, campaign.spreadsheet_id, sheetName, headers.indexOf('pipeline_status'), job.row_index, 'Failed');
      await updateCell(sheets, campaign.spreadsheet_id, sheetName, headers.indexOf('processed_at'), job.row_index, new Date().toISOString());
    } catch (sheetErr) {
      logToAutopilot(`[ERROR] Gagal memperbarui status 'Failed' ke Google Sheets: ${sheetErr.message}`);
    }
    throw err;
  } finally {
    if (downloadedVideo) {
      try {
        cleanupTempFile(downloadedVideo.filePath);
        logToAutopilot(`Membersihkan file video referensi sementara: ${downloadedVideo.filePath}`);
      } catch (cleanupErr) {
        console.warn('Gagal membersihkan video referensi:', cleanupErr.message);
      }
    }
  }
}

async function runTtsStage(job, sheets, headers, sheetName) {
  const db = getDb();
  const campaign = getSheetsCampaign(job.campaign_id);
  if (!campaign) throw new Error(`Campaign ${job.campaign_id} not found`);

  const batchId = job.batch_id;
  const jobId = job.id;

  const tempDir = path.join(process.cwd(), 'public', 'temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  try {
    let finalAudioPath = null;
    if (campaign.enable_tts === 1) {
      logToAutopilot('TTS aktif. Memulai rendering voiceover...');
      const voiceover = JSON.parse(job.voiceover || '[]');
      const provider = campaign.voice_provider || 'minimax';
      const globalPersona = campaign.voice_persona || 'Professional Anchor';

      // Parse voice_cast_json for multi-character dialog support (Mandate 94 v2.0)
      let voiceCast = null;
      if (campaign.voice_cast_json) {
        try {
          const parsed = typeof campaign.voice_cast_json === 'string'
            ? JSON.parse(campaign.voice_cast_json)
            : campaign.voice_cast_json;
          voiceCast = parsed?.characters?.length > 0 ? parsed : null;
        } catch (e) {
          logToAutopilot(`[WARN] Gagal parse voice_cast_json: ${e.message}. Fallback ke single voice.`);
        }
      }

      // Helper: concat audio segments (dialog dari beberapa karakter jadi 1 file klip)
      const concatAudioSegments = async (segmentPaths, outputPath) => {
        const { execSync } = await import('child_process');
        if (segmentPaths.length === 1) {
          fs.copyFileSync(segmentPaths[0], outputPath);
          return;
        }
        const filterStr = segmentPaths.map((_, i) => `[${i}:a]`).join('') + `concat=n=${segmentPaths.length}:v=0:a=1[a]`;
        let cmd = `ffmpeg -y `;
        segmentPaths.forEach(p => { cmd += `-i "${p}" `; });
        cmd += `-filter_complex "${filterStr}" -map "[a]" "${outputPath}"`;
        execSync(cmd);
      };

      const clipsAudioPaths = [];
      for (let c = 0; c < voiceover.length; c++) {
        const clip = voiceover[c];
        const ext = provider === 'minimax' ? 'mp3' : 'wav';
        const outputClipName = `tts_autopilot_${batchId}_clip_${c}.${ext}`;
        const localClipPath = path.join(tempDir, outputClipName);

        // Multi-voice dialog mode: voice_segments present + voiceCast available + Minimax provider
        if (clip.voice_segments && clip.voice_segments.length > 1 && voiceCast && provider === 'minimax') {
          logToAutopilot(`[Multi-Voice] Klip ${c + 1}: rendering ${clip.voice_segments.length} segmen dialog...`);
          const segmentPaths = [];

          for (let s = 0; s < clip.voice_segments.length; s++) {
            const seg = clip.voice_segments[s];
            const charEntry = voiceCast.characters.find(ch => ch.id === seg.character_id);
            const segVoiceId = charEntry?.minimax_voice_id || globalPersona;
            const segPath = path.join(tempDir, `seg_${batchId}_c${c}_${s}_${seg.character_id || s}.mp3`);

            logToAutopilot(`  → Segmen ${s + 1}: character="${seg.character_id}" voice="${segVoiceId}" text="${(seg.text || '').slice(0, 40)}..."`);
            await generateMinimaxVO(seg.text || '', segVoiceId, segPath, {
              speed: campaign.voice_speed || 1.0,
              volume: campaign.voice_volume || 1.0,
              model: campaign.tts_model_quality,
              language: campaign.target_language || 'id-ID'
            });
            segmentPaths.push(segPath);
          }

          logToAutopilot(`  → Menggabungkan ${segmentPaths.length} segmen dialog menjadi 1 audio klip...`);
          await concatAudioSegments(segmentPaths, localClipPath);
          logToAutopilot(`  ✓ Klip ${c + 1} multi-voice selesai.`);

        } else {
          // Single voice mode (existing behavior)
          const text = clip.narration || '';
          logToAutopilot(`Rendering audio klip ${c + 1} via ${provider} (${globalPersona})...`);
          if (provider === 'minimax') {
            await generateMinimaxVO(text, globalPersona, localClipPath, {
              speed: campaign.voice_speed || 1.0,
              volume: campaign.voice_volume || 1.0,
              model: campaign.tts_model_quality,
              language: campaign.target_language || 'id-ID'
            });
          } else {
            const { generateGeminiExact8sAudio } = await import('./gemini-8s-tts');
            await generateGeminiExact8sAudio(text, globalPersona, localClipPath);
          }
        }

        clipsAudioPaths.push(localClipPath);
      }

      const combinedAudioName = `tts_combined_${batchId}_final.mp3`;
      const absoluteCombinedPath = path.join(tempDir, combinedAudioName);

      const { execSync } = await import('child_process');
      const filterString = clipsAudioPaths.map((_, index) => `[${index}:a]`).join('') + `concat=n=${clipsAudioPaths.length}:v=0:a=1[a]`;

      let cmd = `ffmpeg -y `;
      clipsAudioPaths.forEach(p => {
        cmd += `-i "${p}" `;
      });
      cmd += `-filter_complex "${filterString}" -map "[a]" "${absoluteCombinedPath}"`;

      logToAutopilot('Menggabungkan audio clips menjadi satu naskah voiceover utuh...');
      execSync(cmd);
      finalAudioPath = `/temp/${combinedAudioName}`;
      logToAutopilot(`Voiceover utuh selesai digabungkan: ${finalAudioPath}`);
    }

    updateSheetsJobStatus(jobId, {
      local_audio_path: finalAudioPath,
      tts_status: 'completed'
    });
  } catch (err) {
    logToAutopilot(`[ERROR] Gagal pada runTtsStage: ${err.message}`);
    updateSheetsJobStatus(jobId, { status: 'failed', tts_status: 'failed' });
    try {
      await updateCell(sheets, campaign.spreadsheet_id, sheetName, headers.indexOf('pipeline_status'), job.row_index, 'Failed');
      await updateCell(sheets, campaign.spreadsheet_id, sheetName, headers.indexOf('processed_at'), job.row_index, new Date().toISOString());
    } catch (sheetErr) {
      logToAutopilot(`[ERROR] Gagal memperbarui status 'Failed' ke Google Sheets: ${sheetErr.message}`);
    }
    throw err;
  }
}

async function dispatchVisualTasks(job, sheets, headers, sheetName) {
  const db = getDb();
  const campaign = getSheetsCampaign(job.campaign_id);
  if (!campaign) throw new Error(`Campaign ${job.campaign_id} not found`);

  const batchId = job.batch_id;
  const jobId = job.id;

  const storyboard = JSON.parse(job.storyboard || '[]');
  const prompts = JSON.parse(job.prompts_json || '{}');
  const totalClips = storyboard.length;

  if (totalClips === 0) {
    throw new Error('Storyboard is empty, cannot dispatch visual tasks');
  }

  // Find latest job for carrying over completed glabs tasks
  const previousJobs = await db.prepare(`
    SELECT * FROM sheets_jobs
    WHERE campaign_id = ? AND row_index = ? AND id != ?
    ORDER BY created_at DESC
  `).all(job.campaign_id, job.row_index, job.id);

  const latestJob = previousJobs[0];
  let oldCompletedTasks = [];
  if (latestJob) {
    oldCompletedTasks = await db.prepare(`
      SELECT * FROM glabs_tasks
      WHERE item_id = ? AND status = 'completed'
    `).all(latestJob.id);
  }

  logToAutopilot('G-Labs Visual Generator aktif. Memulai penjadwalan klip video...');

  let rowVsoData = null;
  if (campaign.visual_overrides_json) {
    try {
      rowVsoData = JSON.parse(campaign.visual_overrides_json);
    } catch (e) {
      rowVsoData = {};
    }
  } else {
    rowVsoData = {};
  }

  let rowWardrobeColor = '';
  try {
    const getHeaderIndex = (aliases) => {
      for (const alias of aliases) {
        const idx = headers.indexOf(alias.toLowerCase().trim());
        if (idx !== -1) return idx;
      }
      return -1;
    };
    const wardrobeColorIdx = getHeaderIndex(['warna pakaian', 'warna wardrobe', 'wardrobe_color', 'wardrobe color', 'warna baju', 'warna jilbab', 'warna hijab']);
    if (wardrobeColorIdx !== -1) {
      const rowsRes = await sheets.spreadsheets.values.get({
        spreadsheetId: campaign.spreadsheet_id,
        range: `'${sheetName}'!A1:Z1000`
      });
      const rows = rowsRes.data.values;
      if (rows && rows.length > job.row_index - 1) {
        const row = rows[job.row_index - 1];
        if (row && row[wardrobeColorIdx] !== undefined) {
          rowWardrobeColor = row[wardrobeColorIdx].trim();
        }
      }
    }
  } catch (err) {
    logToAutopilot(`[PERINGATAN] Gagal mengambil row wardrobe color: ${err.message}`);
  }

  rowVsoData = resolveVisualOverrides({
    visualOverrides: rowVsoData,
    itemIndex: Math.max(0, Number(job.row_index || 1) - 1),
    stableSeed: `${campaign.id}:${job.id}`,
    rowOverride: rowWardrobeColor
  });

  const applyReplacements = (promptStr) => {
    let s = promptStr;
    if (rowVsoData) {
      const isMascotUniverse = rowVsoData.subject_demographic?.startsWith('mascot_universe_');
      const targetCharacter = isMascotUniverse
        ? 'a 3D stylized cartoon character'
        : (rowVsoData.subject_demographic === 'custom'
          ? rowVsoData.subject_demographic_custom
          : (DEMOGRAPHIC_PRESETS[rowVsoData.subject_demographic] || 'a graceful Muslimah'));
      const targetWardrobe = isMascotUniverse
        ? 'organic clay textures'
        : (rowVsoData.wardrobe_style === 'custom'
          ? rowVsoData.wardrobe_style_custom
          : (WARDROBE_PRESETS[rowVsoData.wardrobe_style] || 'modest clothing'));
      const targetLighting = rowVsoData.lighting_style === 'custom'
        ? rowVsoData.lighting_style_custom
        : (LIGHTING_PRESETS[rowVsoData.lighting_style] || 'soft natural light');

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

  let productBase64 = null;
  const isBridgingActive = Number(campaign.is_bridging_active) === 1;
  const effectiveVisualMode = isBridgingActive ? (campaign.visual_mode || 'hybrid_lock') : 'pure_t2v';

  let product = null;
  const linkProductIdx = getProductUrlIndex(headers);

  if (isBridgingActive) {
    const rowsRes = await sheets.spreadsheets.values.get({
      spreadsheetId: campaign.spreadsheet_id,
      range: `'${sheetName}'!A1:Z1000`
    });
    const rows = rowsRes.data.values;
    if (rows && rows.length > job.row_index - 1) {
      const row = rows[job.row_index - 1];
      const productUrl = linkProductIdx !== -1 && row[linkProductIdx] ? row[linkProductIdx].trim() : '';
      if (productUrl && productUrl.startsWith('http')) {
        product = await db.prepare('SELECT * FROM product_extractions WHERE input_source = ? OR source_url = ?').get(productUrl, productUrl);
      }
    }
  }

  if (product) {
    try {
      const { createOrUpdateCampaignProductBinding } = await import('./campaign-product-binding.js');
      const tenantId = getActiveTenantId();
      await createOrUpdateCampaignProductBinding({
        tenantId,
        sourceType: 'sheets_autopilot',
        sourceCampaignId: job.campaign_id,
        sourceItemId: job.id,
        brandProfileId: campaign.brand_profile_id || null,
        productId: product.id,
        explicitAffiliateOverride: null,
        affiliateRequired: false
      });
    } catch (bindErr) {
      logToAutopilot(`[Autopilot Binding Warning]: ${bindErr.message}`);
    }
  }

  const effectiveProduct = isBridgingActive ? (product || {}) : {};

  if (effectiveVisualMode === 'hybrid_lock') {
    let resolvedPhotoPath = resolveProductImagePath(effectiveProduct);

    if (resolvedPhotoPath) {
      logToAutopilot(`[Product Reference] Menggunakan foto produk dari path: ${resolvedPhotoPath}`);
    } else {
      const redownloadUrl = effectiveProduct?.scraped_image_url;
      if (redownloadUrl && redownloadUrl.startsWith('http')) {
        const rawFilename = `raw_redownload_${effectiveProduct.id || Date.now()}.png`;
        const rawRelPath = `/uploads/products/raw/${rawFilename}`;
        const rawAbsPath = path.join(process.cwd(), 'public', 'uploads', 'products', 'raw', rawFilename);

        logToAutopilot(`[Product Reference] File foto produk tidak ditemukan di disk. Mencoba re-download dari scraped_image_url ke ${rawRelPath}...`);
        try {
          const imgRes = await fetch(redownloadUrl);
          if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`);
          const imgBuf = Buffer.from(await imgRes.arrayBuffer());
          fs.mkdirSync(path.dirname(rawAbsPath), { recursive: true });
          fs.writeFileSync(rawAbsPath, imgBuf);

          await db.prepare('UPDATE product_extractions SET raw_photo_url = ? WHERE id = ?').run(rawRelPath, effectiveProduct.id);
          effectiveProduct.raw_photo_url = rawRelPath; // update in-memory object

          resolvedPhotoPath = rawRelPath;
          logToAutopilot(`[Product Reference] Re-download berhasil. Menggunakan foto produk Raw baru: ${resolvedPhotoPath}`);
        } catch (dlErr) {
          logToAutopilot(`[ERROR] Gagal re-download foto produk: ${dlErr.message}. Double-Pass tidak dapat dijalankan.`);
        }
      } else {
        logToAutopilot(`[ERROR] scraped_image_url kosong di DB — tidak bisa re-download foto produk. Double-Pass akan dilewati.`);
      }
    }

    if (resolvedPhotoPath) {
      productBase64 = fileToBase64(resolvedPhotoPath);
    }

    if (!productBase64) {
      logToAutopilot('[PERINGATAN] productBase64 null setelah semua upaya — bridge scene akan dirender sebagai T2V biasa.');
    }
  }

  // [FIX A] IFC: Load foto produk yang sudah diunduh di runScriptStage
  if (campaign.campaign_type === 'IFC' && !productBase64) {
    const ifcPhotoFilename = `autopilot_ifc_${campaign.id}_row${job.row_index}.png`;
    const ifcPhotoRelPath = `/uploads/products/${ifcPhotoFilename}`;
    const ifcPhotoAbsPath = path.join(process.cwd(), 'public', 'uploads', 'products', ifcPhotoFilename);
    if (fs.existsSync(ifcPhotoAbsPath)) {
      productBase64 = fileToBase64(ifcPhotoRelPath);
      if (productBase64) {
        logToAutopilot(`[IFC] Gambar produk berhasil di-load dari ${ifcPhotoRelPath} → siap digunakan sebagai referensi T2I.`);
      } else {
        logToAutopilot(`[IFC] File ditemukan tapi gagal di-encode ke base64: ${ifcPhotoRelPath}`);
      }
    } else {
      logToAutopilot(`[IFC] Gambar produk tidak ditemukan di ${ifcPhotoRelPath}. T2I akan dijalankan tanpa referensi gambar produk.`);
    }
  }

  const bridgeAtClip = campaign.bridge_at_clip || 2;
  const bridgeDuration = campaign.bridge_duration_clips || 1;
  const bridgeEndClip = bridgeAtClip + bridgeDuration - 1;

  try {
    for (let c = 1; c <= totalClips; c++) {
      logToAutopilot(`\n[G-Labs] Memproses klip visual ${c}/${totalClips}...`);
      // [FIX B] IFC: Jika klip memiliki T2I prompt → otomatis jadi bridge scene (tidak bergantung pada range bridge_at_clip)
      const hasT2iPrompt = (prompts.t2i_prompts || []).some(p => Number(p.clip) === c);
      const isInBridgeRange = effectiveVisualMode === 'hybrid_lock' && (c >= bridgeAtClip && c <= bridgeEndClip);
      const isBridgeScene = !!productBase64 && (
        campaign.campaign_type === 'IFC' ? hasT2iPrompt : isInBridgeRange
      );
      if (isBridgeScene) {
        logToAutopilot(`[Dispatch] Klip ${c}: Bridge scene (Double-Pass T2I→I2V)${campaign.campaign_type === 'IFC' ? ' [IFC: T2I prompt detected]' : ''}`);
      } else {
        logToAutopilot(`[Dispatch] Klip ${c}: Pure T2V${!productBase64 ? ' [no productBase64]' : ''}`);
      }

      const t2vObj = (prompts.t2v_prompts || []).find(p => Number(p.clip) === c);
      const rawT2vPrompt = t2vObj ? t2vObj.prompt : `cinematic video, vertical 9:16 --ar 9:16`;
      const t2vPromptText = applyReplacements(rawT2vPrompt);

      // Check if we can reuse a completed G-Labs task from the previous attempt
      const matchingOldTask = oldCompletedTasks.find(t => t.clip_index === c);
      if (matchingOldTask && matchingOldTask.video_url) {
        logToAutopilot(`[G-Labs] Klip visual ${c}/${totalClips} sudah pernah sukses pada job sebelumnya (${latestJob.id}). Reusing video URL: ${matchingOldTask.video_url}`);
        insertGlabsTask({
          task_id: matchingOldTask.task_id,
          campaign_id: campaign.id,
          item_id: jobId,
          clip_index: c,
          prompt: isBridgeScene ? 'I2V Motion Prompt' : t2vPromptText,
          status: 'completed',
          video_url: matchingOldTask.video_url
        });
        continue;
      }

      let videoResult = null;

      if (isBridgeScene && productBase64) {
        logToAutopilot(`[Double-Pass] Menghasilkan start frame T2I untuk klip ${c}...`);
        const t2iObj = (prompts.t2i_prompts || []).find(p => Number(p.clip) === c);
        const rawT2iPrompt = t2iObj ? t2iObj.prompt : `product photograph of ${effectiveProduct.product_name}, professional studio lighting, 9:16 vertical --ar 9:16`;
        const t2iPromptText = applyReplacements(rawT2iPrompt);

        const imageModel = getSetting('webhook_image_model') || 'nano_banana_pro';
        const t2iResult = await generateImage({
          prompt: t2iPromptText,
          model: imageModel,
          aspect_ratio: campaign.aspect_ratio || '9:16',
          reference_images: [productBase64]
        });

        if (!t2iResult?.task_id) throw new Error(`Gagal menjadwalkan T2I untuk klip ${c}`);

        let t2iCompleted = false;
        let t2iImageUrl = null;
        for (let pol = 0; pol < 100; pol++) {
          await new Promise(r => setTimeout(r, 2000));
          const statusRes = await getTaskStatus(t2iResult.task_id);
          if (statusRes?.status === 'completed') {
            const files = statusRes.results || statusRes.files || [];
            let imageFile = files.find(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')) || files[0];
            if (imageFile && (imageFile.startsWith('http://') || imageFile.startsWith('https://'))) {
              imageFile = imageFile.split('/').pop();
            }
            t2iImageUrl = getFileUrl(imageFile);
            t2iCompleted = true;
            break;
          } else if (statusRes?.status === 'failed') {
            throw new Error(`T2I task ${t2iResult.task_id} gagal.`);
          }
        }

        if (!t2iCompleted || !t2iImageUrl) throw new Error(`T2I task ${t2iResult.task_id} timed out.`);
        logToAutopilot(`Start frame T2I selesai di-render.`);

        const imgResponse = await fetch(t2iImageUrl);
        const startFrameBuffer = Buffer.from(await imgResponse.arrayBuffer());
        const t2iBase64 = `data:image/png;base64,${startFrameBuffer.toString('base64')}`;

        logToAutopilot(`[Double-Pass] Menghasilkan gerakan I2V dari start frame...`);
        const i2vObj = (prompts.i2v_prompts || []).find(p => Number(p.clip) === c);
        const rawI2vPrompt = i2vObj ? i2vObj.prompt : `cinematic camera zoom, slowly panning, product showcase vertical 9:16 --ar 9:16`;
        const i2vPromptText = applyReplacements(rawI2vPrompt);

        videoResult = await generateVideo({
          prompt: i2vPromptText,
          model: 'veo_31_lite',
          aspect_ratio: campaign.aspect_ratio || '9:16',
          mode: 'start_image',
          reference_images: [t2iBase64]
        });
      } else {
        logToAutopilot(`[T2V] Menghasilkan klip video dari text...`);
        videoResult = await generateVideo({
          prompt: t2vPromptText,
          model: campaign.video_model || 'veo_31_lite',
          aspect_ratio: campaign.aspect_ratio || '9:16',
          mode: 'text_to_video'
        });
      }

      if (!videoResult?.task_id) throw new Error(`Gagal menjadwalkan video untuk klip ${c}`);

      // Register tasks to glabs_tasks
      insertGlabsTask({
        task_id: videoResult.task_id,
        campaign_id: campaign.id,
        item_id: jobId,
        clip_index: c,
        prompt: isBridgeScene ? 'I2V Motion Prompt' : t2vPromptText,
        status: 'processing'
      });
    }

    // Update state to processing G-labs tasks
    updateSheetsJobStatus(jobId, { visual_status: 'processing' });
    logToAutopilot(`Semua klip video autopilot untuk job ${jobId} berhasil disubmit ke G-labs.`);
  } catch (err) {
    logToAutopilot(`[ERROR] Gagal pada dispatchVisualTasks: ${err.message}`);
    updateSheetsJobStatus(jobId, { status: 'failed', visual_status: 'failed' });
    try {
      await updateCell(sheets, campaign.spreadsheet_id, sheetName, headers.indexOf('pipeline_status'), job.row_index, 'Failed');
      await updateCell(sheets, campaign.spreadsheet_id, sheetName, headers.indexOf('processed_at'), job.row_index, new Date().toISOString());
    } catch (sheetErr) {
      logToAutopilot(`[ERROR] Gagal memperbarui status 'Failed' ke Google Sheets: ${sheetErr.message}`);
    }
    throw err;
  }
}

async function pollVisualTasks(job, sheets, headers, sheetName) {
  const db = getDb();
  const tasks = await db.prepare('SELECT * FROM glabs_tasks WHERE item_id = ?').all(job.id);

  if (tasks.length === 0) {
    logToAutopilot(`[PERINGATAN] Tidak ditemukan glabs_tasks untuk job ${job.id}. Melompati polling.`);
    updateSheetsJobStatus(job.id, { visual_status: 'completed', ffmpeg_status: 'pending' });
    return;
  }

  logToAutopilot(`[Polling] Memeriksa status ${tasks.length} tugas G-Labs untuk job ${job.id}...`);

  let anyFailed = false;
  let anyPending = false;

  for (const task of tasks) {
    if (task.status === 'completed') continue;
    if (task.status === 'failed') {
      anyFailed = true;
      continue;
    }

    try {
      const statusRes = await getTaskStatus(task.task_id);
      const taskStatus = (statusRes?.status || '').toLowerCase();

      if (taskStatus === 'completed') {
        const files = statusRes.results || statusRes.files || [];
        let videoFile = files.find(f => f.endsWith('.mp4')) || files[0];
        if (videoFile && (videoFile.startsWith('http://') || videoFile.startsWith('https://'))) {
          videoFile = videoFile.split('/').pop();
        }
        if (videoFile) {
          const videoUrl = getFileUrl(videoFile);
          updateGlabsTaskStatus(task.task_id, 'completed', videoUrl);
          logToAutopilot(`>> Klip ${task.clip_index} selesai: ${videoUrl}`);
        } else {
          anyPending = true;
        }
      } else if (taskStatus === 'failed') {
        updateGlabsTaskStatus(task.task_id, 'failed');
        anyFailed = true;
        logToAutopilot(`[ERROR] Klip ${task.clip_index} (Task ID: ${task.task_id}) gagal di G-Labs.`);
      } else {
        anyPending = true;
      }
    } catch (err) {
      anyPending = true;
      logToAutopilot(`[PERINGATAN] Gagal polling status G-Labs task ${task.task_id}: ${err.message}`);
    }
  }

  if (anyFailed) {
    logToAutopilot(`[ERROR] Satu atau lebih tugas visual G-Labs gagal untuk job ${job.id}.`);
    updateSheetsJobStatus(job.id, { status: 'failed', visual_status: 'failed' });
    try {
      await updateCell(sheets, job.spreadsheet_id, sheetName, headers.indexOf('pipeline_status'), job.row_index, 'Failed');
      await updateCell(sheets, job.spreadsheet_id, sheetName, headers.indexOf('processed_at'), job.row_index, new Date().toISOString());
    } catch (sheetErr) {
      logToAutopilot(`[ERROR] Gagal memperbarui status 'Failed' ke Google Sheets: ${sheetErr.message}`);
    }
    return;
  }

  if (anyPending) {
    logToAutopilot(`Beberapa tugas visual G-Labs masih berjalan. Polling berikutnya akan memantau kembali.`);
    return;
  }

  // All completed!
  logToAutopilot(`Seluruh tugas visual G-Labs untuk job ${job.id} selesai dengan sukses.`);
  updateSheetsJobStatus(job.id, { visual_status: 'completed', ffmpeg_status: 'pending' });
}

async function runFFmpegStage(job, sheets, headers, sheetName) {
  const db = getDb();
  const campaign = getSheetsCampaign(job.campaign_id);
  if (!campaign) throw new Error(`Campaign ${job.campaign_id} not found`);

  const batchId = job.batch_id;
  const tempDir = path.join(process.cwd(), 'public', 'temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const tasks = await db.prepare('SELECT * FROM glabs_tasks WHERE item_id = ? ORDER BY clip_index ASC').all(job.id);
  const videoClips = [];

  try {
    if (campaign.enable_glabs === 1) {
      logToAutopilot(`Memulai pengunduhan ${tasks.length} klip video dari G-Labs...`);
      for (const task of tasks) {
        if (!task.video_url) throw new Error(`Video URL is missing for clip ${task.clip_index}`);

        const tempClipName = `temp_clip_${batchId}_${task.clip_index}.mp4`;
        const absoluteClipPath = path.join(tempDir, tempClipName);

        logToAutopilot(`Mengunduh klip ${task.clip_index} ke ${absoluteClipPath}...`);
        const downloadResponse = await fetch(task.video_url);
        if (!downloadResponse.ok) throw new Error(`Gagal mengunduh klip ${task.clip_index} dari ${task.video_url}`);
        const clipBuffer = Buffer.from(await downloadResponse.arrayBuffer());
        fs.writeFileSync(absoluteClipPath, clipBuffer);

        videoClips.push(`/temp/${tempClipName}`);
      }

      updateSheetsJobStatus(job.id, { visual_clip_paths: JSON.stringify(videoClips) });
    }

    let finalVideoPath = null;
    const finalAudioPath = job.local_audio_path;

    if (campaign.enable_ffmpeg === 1 && videoClips.length > 0 && finalAudioPath) {
      logToAutopilot('FFmpeg Muxing aktif. Menggabungkan klip video dan voiceover...');
      const outputVideoName = `final_video_${batchId}_final.mp4`;
      const absoluteOutputPath = path.join(tempDir, outputVideoName);

      // Convert relative paths to absolute
      const absoluteVideoClips = videoClips.map(clip => {
        return clip.startsWith('/') ? path.join(process.cwd(), 'public', clip) : path.join(process.cwd(), 'public', 'temp', path.basename(clip));
      });

      const muxConfig = {
        videoPath: JSON.stringify(absoluteVideoClips),
        audioPath: finalAudioPath,
        syncOption: campaign.ffmpeg_sync_option || 'smart_sync',
        bgmPath: null,
        bgmVolume: campaign.ffmpeg_bgm_volume !== undefined ? campaign.ffmpeg_bgm_volume : 0.15,
        sfxVolume: campaign.ffmpeg_sfx_volume !== undefined ? campaign.ffmpeg_sfx_volume : 0.0,
        videoScale: campaign.ffmpeg_video_scale !== undefined ? campaign.ffmpeg_video_scale : 1.0,
        outputPath: absoluteOutputPath
      };

      logToAutopilot(`Mengeksekusi muxing FFmpeg ke ${absoluteOutputPath}...`);
      await processVideoMuxing(muxConfig);

      finalVideoPath = `/temp/${outputVideoName}`;
      logToAutopilot(`Muxing video berhasil: ${finalVideoPath}`);

      updateSheetsJobStatus(job.id, {
        local_video_path: finalVideoPath,
        ffmpeg_status: 'completed'
      });
    } else {
      logToAutopilot('FFmpeg Muxing dilewati (dinonaktifkan atau klip kosong).');
      updateSheetsJobStatus(job.id, { ffmpeg_status: 'completed' });
    }

  } catch (err) {
    logToAutopilot(`[ERROR] Gagal pada runFFmpegStage: ${err.message}`);
    updateSheetsJobStatus(job.id, { status: 'failed', ffmpeg_status: 'failed' });
    try {
      await updateCell(sheets, job.spreadsheet_id, sheetName, headers.indexOf('pipeline_status'), job.row_index, 'Failed');
      await updateCell(sheets, job.spreadsheet_id, sheetName, headers.indexOf('processed_at'), job.row_index, new Date().toISOString());
    } catch (sheetErr) {
      logToAutopilot(`[ERROR] Gagal memperbarui status 'Failed' ke Google Sheets: ${sheetErr.message}`);
    }
  }
}

async function runUploadStage(job, sheets, headers, sheetName, drive) {
  const db = getDb();
  const campaign = getSheetsCampaign(job.campaign_id);
  if (!campaign) throw new Error(`Campaign ${job.campaign_id} not found`);

  const batchId = job.batch_id;
  const jobId = job.id;
  const tempDir = path.join(process.cwd(), 'public', 'temp');

  try {
    const storageProvider = getSetting('storage_provider') || 'gdrive';

    let assetUrl = '';
    let markdownUrl = '';

    // Common JSON Parse for storyboard result
    let storyboardResult = {};
    try {
      storyboardResult = {
        storyboard: JSON.parse(job.storyboard || '[]'),
        voiceover: JSON.parse(job.voiceover || '[]'),
        t2v_prompts: JSON.parse(job.prompts_json || '{}').t2v_prompts || [],
        t2i_prompts: JSON.parse(job.prompts_json || '{}').t2i_prompts || [],
        i2v_prompts: JSON.parse(job.prompts_json || '{}').i2v_prompts || [],
        tiktok_caption: JSON.parse(job.captions_json || '{}').tiktok_caption || '',
        ig_caption: JSON.parse(job.captions_json || '{}').ig_caption || '',
        yt_title: JSON.parse(job.captions_json || '{}').yt_title || '',
        yt_desc: JSON.parse(job.captions_json || '{}').yt_desc || ''
      };
    } catch (parseErr) {
      logToAutopilot(`[PERINGATAN] Gagal mengurai detail storyboard untuk upload: ${parseErr.message}`);
    }

    const markdownContent = buildMarkdownContent(storyboardResult, batchId);

    // Fetch product photo if bridging active
    let product = null;
    const rowsRes = await sheets.spreadsheets.values.get({
      spreadsheetId: campaign.spreadsheet_id,
      range: `'${sheetName}'!A1:Z1000`
    });
    const rows = rowsRes.data.values;
    const row = rows ? rows[job.row_index - 1] : null;

    const getVal = (idx) => {
      if (idx !== -1 && row && row[idx] !== undefined) return row[idx].trim();
      return '';
    };

    const linkProductIdx = getProductUrlIndex(headers);
    const productUrl = getVal(linkProductIdx);
    if (campaign.is_bridging_active === 1 && productUrl && productUrl.startsWith('http')) {
      product = await db.prepare('SELECT * FROM product_extractions WHERE input_source = ? OR source_url = ?').get(productUrl, productUrl);
    }

    if (product) {
      try {
        const { createOrUpdateCampaignProductBinding } = await import('./campaign-product-binding.js');
        const tenantId = getActiveTenantId();
        await createOrUpdateCampaignProductBinding({
          tenantId,
          sourceType: 'sheets_autopilot',
          sourceCampaignId: job.campaign_id,
          sourceItemId: job.id,
          brandProfileId: campaign.brand_profile_id || null,
          productId: product.id,
          explicitAffiliateOverride: null,
          affiliateRequired: false
        });
      } catch (bindErr) {
        logToAutopilot(`[Autopilot Binding Warning]: ${bindErr.message}`);
      }
    }

    if (storageProvider === 'nextcloud') {
      logToAutopilot('Memulai sinkronisasi Nextcloud...');
      const targetFolder = campaign.gdrive_folder_id || getSetting('nextcloud_target_folder') || '/MAKNA_Video_Generations';
      const batchFolderPath = `${targetFolder}/${batchId}`.replace(/\/+/g, '/');

      await checkAndCreateFolder(batchFolderPath);
      assetUrl = await getOrCreatePublicShareLink(batchFolderPath);
      logToAutopilot(`Folder batch Nextcloud ditentukan: ${assetUrl}`);

      // 1. Upload markdown
      logToAutopilot(`Mengunggah ${batchId}_naskah.md ke Nextcloud...`);
      const markdownRemotePath = `${batchFolderPath}/${batchId}_naskah.md`.replace(/\/+/g, '/');
      const uploadedMarkdown = await uploadBufferToNextcloud(Buffer.from(markdownContent, 'utf-8'), markdownRemotePath);
      markdownUrl = uploadedMarkdown.fileUrl;
      logToAutopilot(`Naskah diunggah ke Nextcloud: ${markdownUrl}`);

      // Salinan cadangan untuk backward compatibility
      try {
        const backupMdPath = `${batchFolderPath}/naskah.md`.replace(/\/+/g, '/');
        await uploadBufferToNextcloud(Buffer.from(markdownContent, 'utf-8'), backupMdPath);
      } catch (backupErr) {
        logToAutopilot(`[PERINGATAN] Gagal mengunggah salinan cadangan naskah.md: ${backupErr.message}`);
      }

      // 2. Upload product image
      if (Number(campaign.is_bridging_active) === 1 && product) {
        const resolvedPhotoPath = resolveProductImagePath(product);
        if (resolvedPhotoPath) {
          const absProdImgPath = resolvedPhotoPath.startsWith('/') ? path.join(process.cwd(), 'public', resolvedPhotoPath) : resolvedPhotoPath;
          if (fs.existsSync(absProdImgPath)) {
            logToAutopilot(`Mengunggah gambar produk (${resolvedPhotoPath}) ke Nextcloud...`);
            const targetName = `${batchId}_product_image.png`;
            const remoteImgPath = `${batchFolderPath}/${targetName}`.replace(/\/+/g, '/');
            await uploadFileToNextcloud(absProdImgPath, remoteImgPath, false);
          }
        }
      }

      // 3. Upload individual audio clips
      if (job.voiceover) {
        try {
          const voiceover = JSON.parse(job.voiceover);
          const provider = campaign.voice_provider || 'minimax';
          const ext = provider === 'minimax' ? 'mp3' : 'wav';
          logToAutopilot(`Mengunggah ${voiceover.length} klip audio individual ke Nextcloud...`);
          for (let idx = 0; idx < voiceover.length; idx++) {
            const outputClipName = `tts_autopilot_${batchId}_clip_${idx}.${ext}`;
            const absClipPath = path.join(tempDir, outputClipName);
            if (fs.existsSync(absClipPath)) {
              const targetName = `${batchId}_audio_clip_${idx + 1}.${ext}`;
              logToAutopilot(`Mengunggah klip audio individual ke Nextcloud: ${targetName}`);
              const remoteAudioPath = `${batchFolderPath}/${targetName}`.replace(/\/+/g, '/');
              await uploadFileToNextcloud(absClipPath, remoteAudioPath, false);
            }
          }
        } catch (uploadAudioErr) {
          logToAutopilot(`[PERINGATAN] Gagal mengunggah klip audio individual ke Nextcloud: ${uploadAudioErr.message}`);
        }
      }

      // 4. Upload individual video clips
      if (job.visual_clip_paths) {
        try {
          const clips = JSON.parse(job.visual_clip_paths);
          logToAutopilot(`Mengunggah ${clips.length} klip video individual ke Nextcloud...`);
          for (let idx = 0; idx < clips.length; idx++) {
            const clip = clips[idx];
            const absClipPath = path.join(process.cwd(), 'public', clip);
            if (fs.existsSync(absClipPath)) {
              const targetName = `${batchId}_video_clip_${idx + 1}.mp4`;
              logToAutopilot(`Mengunggah klip video individual ke Nextcloud: ${targetName}`);
              const remoteVideoClipPath = `${batchFolderPath}/${targetName}`.replace(/\/+/g, '/');
              await uploadFileToNextcloud(absClipPath, remoteVideoClipPath, false);
            }
          }
        } catch (uploadClipsErr) {
          logToAutopilot(`[PERINGATAN] Gagal mengunggah klip video individual ke Nextcloud: ${uploadClipsErr.message}`);
        }
      }

      // 5. Upload final audio
      if (job.local_audio_path) {
        const absAudioPath = path.join(process.cwd(), 'public', job.local_audio_path);
        if (fs.existsSync(absAudioPath)) {
          logToAutopilot('Mengunggah audio voiceover final ke Nextcloud...');
          const targetName = `${batchId}_audio_final.mp3`;
          const remoteFinalAudioPath = `${batchFolderPath}/${targetName}`.replace(/\/+/g, '/');
          await uploadFileToNextcloud(absAudioPath, remoteFinalAudioPath, false);
        }
      }

      // 6. Upload final video
      if (job.local_video_path) {
        const absVideoPath = path.join(process.cwd(), 'public', job.local_video_path);
        if (fs.existsSync(absVideoPath)) {
          logToAutopilot('Mengunggah video final ke Nextcloud...');
          const targetName = `${batchId}_video_final.mp4`;
          const remoteFinalVideoPath = `${batchFolderPath}/${targetName}`.replace(/\/+/g, '/');
          await uploadFileToNextcloud(absVideoPath, remoteFinalVideoPath, false);
        }
      }

    } else {
      logToAutopilot('Memulai sinkronisasi Google Drive...');
      let parentFolderId = campaign.gdrive_folder_id;
      if (!parentFolderId) {
        logToAutopilot('Drive Folder ID tidak dispesifikasikan. Membuat folder kampanye di root...');
        parentFolderId = await getOrCreateCampaignFolder(campaign.campaign_name, `${campaign.campaign_type}_Campaign_`);
      }

      logToAutopilot(`Membuat subfolder batch "${batchId}" di Drive...`);
      const batchFolderId = await getOrCreateFolderInFolder(batchId, parentFolderId);
      assetUrl = `https://drive.google.com/drive/folders/${batchFolderId}`;
      logToAutopilot(`Folder batch berhasil dibuat: ${assetUrl}`);

      logToAutopilot(`Mengunggah ${batchId}_naskah.md ke Drive...`);
      const uploadedMarkdown = await uploadMarkdownToCampaignFolder(markdownContent, `${batchId}_naskah.md`, batchFolderId);
      markdownUrl = uploadedMarkdown.driveUrl;
      logToAutopilot(`Naskah diunggah: ${markdownUrl}`);

      // Salinan cadangan untuk backward compatibility
      try {
        await uploadMarkdownToCampaignFolder(markdownContent, 'naskah.md', batchFolderId);
      } catch (backupErr) {
        logToAutopilot(`[PERINGATAN] Gagal mengunggah salinan cadangan naskah.md ke Drive: ${backupErr.message}`);
      }

      if (Number(campaign.is_bridging_active) === 1 && product) {
        const resolvedPhotoPath = resolveProductImagePath(product);
        if (resolvedPhotoPath) {
          const absProdImgPath = resolvedPhotoPath.startsWith('/') ? path.join(process.cwd(), 'public', resolvedPhotoPath) : resolvedPhotoPath;
          if (fs.existsSync(absProdImgPath)) {
            logToAutopilot(`Mengunggah gambar produk (${resolvedPhotoPath}) ke Drive...`);
            await uploadLocalFileToFolder(absProdImgPath, `${batchId}_product_image.png`, batchFolderId, 'image/png');
          }
        }
      }

      // Upload individual audio clips to Google Drive
      if (job.voiceover) {
        try {
          const voiceover = JSON.parse(job.voiceover);
          const provider = campaign.voice_provider || 'minimax';
          const ext = provider === 'minimax' ? 'mp3' : 'wav';
          const mimeType = ext === 'wav' ? 'audio/wav' : 'audio/mpeg';
          logToAutopilot(`Mengunggah ${voiceover.length} klip audio individual ke Drive...`);
          for (let idx = 0; idx < voiceover.length; idx++) {
            const outputClipName = `tts_autopilot_${batchId}_clip_${idx}.${ext}`;
            const absClipPath = path.join(tempDir, outputClipName);
            if (fs.existsSync(absClipPath)) {
              const targetName = `${batchId}_audio_clip_${idx + 1}.${ext}`;
              logToAutopilot(`Mengunggah klip audio individual: ${targetName}`);
              await uploadLocalFileToFolder(absClipPath, targetName, batchFolderId, mimeType);
            }
          }
        } catch (uploadAudioErr) {
          logToAutopilot(`[PERINGATAN] Gagal mengunggah klip audio individual: ${uploadAudioErr.message}`);
        }
      }

      // Upload individual video clips to Google Drive
      if (job.visual_clip_paths) {
        try {
          const clips = JSON.parse(job.visual_clip_paths);
          logToAutopilot(`Mengunggah ${clips.length} klip video individual ke Drive...`);
          for (let idx = 0; idx < clips.length; idx++) {
            const clip = clips[idx];
            const absClipPath = path.join(process.cwd(), 'public', clip);
            if (fs.existsSync(absClipPath)) {
              const targetName = `${batchId}_video_clip_${idx + 1}.mp4`;
              logToAutopilot(`Mengunggah klip video individual: ${targetName}`);
              await uploadLocalFileToFolder(absClipPath, targetName, batchFolderId, 'video/mp4');
            }
          }
        } catch (uploadClipsErr) {
          logToAutopilot(`[PERINGATAN] Gagal mengunggah klip video individual: ${uploadClipsErr.message}`);
        }
      }

      if (job.local_audio_path) {
        const absAudioPath = path.join(process.cwd(), 'public', job.local_audio_path);
        if (fs.existsSync(absAudioPath)) {
          logToAutopilot('Mengunggah audio voiceover ke Drive...');
          await uploadLocalFileToFolder(absAudioPath, `${batchId}_audio_final.mp3`, batchFolderId, 'audio/mpeg');
        }
      }

      if (job.local_video_path) {
        const absVideoPath = path.join(process.cwd(), 'public', job.local_video_path);
        if (fs.existsSync(absVideoPath)) {
          logToAutopilot('Mengunggah video final ke Drive...');
          await uploadLocalFileToFolder(absVideoPath, `${batchId}_video_final.mp4`, batchFolderId, 'video/mp4');
        }
      }
    }

    // Write back to Google Sheets row
    await updateCell(sheets, campaign.spreadsheet_id, sheetName, headers.indexOf('pipeline_status'), job.row_index, 'Completed');
    await updateCell(sheets, campaign.spreadsheet_id, sheetName, headers.indexOf('asset_url'), job.row_index, assetUrl);
    await updateCell(sheets, campaign.spreadsheet_id, sheetName, headers.indexOf('processed_at'), job.row_index, new Date().toISOString());

    // Write captions back to Campaign Tab if target columns exist (v10.14.1)
    const tiktokCaption = storyboardResult.tiktok_caption || '';
    const igCaption = storyboardResult.ig_caption || '';
    const tiktokSingleLine = tiktokCaption ? tiktokCaption.replace(/\r?\n/g, ' ').trim() : '';
    const igSingleLine = igCaption ? igCaption.replace(/\r?\n/g, ' ').trim() : '';

    const tiktokColAliases = ['tiktok_caption', 'tiktok caption', 'caption_tiktok', 'caption tiktok'];
    let tiktokColIdx = -1;
    for (const alias of tiktokColAliases) {
      const idx = headers.indexOf(alias.toLowerCase());
      if (idx !== -1) {
        tiktokColIdx = idx;
        break;
      }
    }

    const igColAliases = ['ig_caption', 'ig caption', 'instagram_caption', 'instagram caption', 'caption_ig', 'caption ig'];
    let igColIdx = -1;
    for (const alias of igColAliases) {
      const idx = headers.indexOf(alias.toLowerCase());
      if (idx !== -1) {
        igColIdx = idx;
        break;
      }
    }

    if (tiktokColIdx !== -1 && tiktokSingleLine) {
      logToAutopilot(`Menulis TikTok caption (single-line) ke tab ${sheetName} kolom ${headers[tiktokColIdx]}...`);
      await updateCell(sheets, campaign.spreadsheet_id, sheetName, tiktokColIdx, job.row_index, tiktokSingleLine);
    }

    if (igColIdx !== -1 && igSingleLine) {
      logToAutopilot(`Menulis IG caption (single-line) ke tab ${sheetName} kolom ${headers[igColIdx]}...`);
      await updateCell(sheets, campaign.spreadsheet_id, sheetName, igColIdx, job.row_index, igSingleLine);
    }

    updateSheetsJobStatus(jobId, {
      status: 'completed',
      gdrive_folder_url: assetUrl
    });

    logToAutopilot(`>> Berhasil menyelesaikan job ${jobId} (Baris ${job.row_index}).`);

    // Clean up temporary files
    if (job.local_audio_path) {
      try { cleanupTempFile(path.join(process.cwd(), 'public', job.local_audio_path)); } catch { }
    }
    if (job.local_video_path) {
      try { cleanupTempFile(path.join(process.cwd(), 'public', job.local_video_path)); } catch { }
    }
    if (job.visual_clip_paths) {
      try {
        const clips = JSON.parse(job.visual_clip_paths);
        for (const clip of clips) {
          cleanupTempFile(path.join(process.cwd(), 'public', clip));
        }
      } catch { }
    }
    // Clean up temporary audio clip files
    if (job.voiceover) {
      try {
        const voiceover = JSON.parse(job.voiceover);
        const provider = campaign.voice_provider || 'minimax';
        const ext = provider === 'minimax' ? 'mp3' : 'wav';
        for (let idx = 0; idx < voiceover.length; idx++) {
          const outputClipName = `tts_autopilot_${batchId}_clip_${idx}.${ext}`;
          cleanupTempFile(path.join(tempDir, outputClipName));
        }
      } catch { }
    }

  } catch (err) {
    logToAutopilot(`[ERROR] Gagal pada runUploadStage: ${err.message}`);
    updateSheetsJobStatus(jobId, { status: 'failed' });
    try {
      await updateCell(sheets, campaign.spreadsheet_id, sheetName, headers.indexOf('pipeline_status'), job.row_index, 'Failed');
      await updateCell(sheets, campaign.spreadsheet_id, sheetName, headers.indexOf('processed_at'), job.row_index, new Date().toISOString());
    } catch (sheetErr) {
      logToAutopilot(`[ERROR] Gagal memperbarui status 'Failed' ke Google Sheets: ${sheetErr.message}`);
    }
  }
}



// Markdown formatting helper
export function buildMarkdownContent(parsed, batchId) {
  let md = `# Naskah Autopilot: ${batchId}\n\n`;
  if (parsed.analysis_summary) {
    md += `## Analisis Strategi\n`;
    md += `- **Hook Analysis**: ${parsed.analysis_summary.original_hook_analysis || ''}\n`;
    md += `- **Weakness Identified**: ${parsed.analysis_summary.weakness_identified || ''}\n`;
    md += `- **Upgrade Strategy**: ${parsed.analysis_summary.the_upgrade_strategy || ''}\n\n`;
  }

  const storyboard = parsed.storyboard || parsed.production_storyboard || [];
  const voiceover = parsed.voiceover || [];

  // 1. Storyboard Section
  md += `## Storyboard :\n`;
  for (let idx = 0; idx < storyboard.length; idx++) {
    const scene = storyboard[idx];
    const clipNum = scene.scene || scene.clip || scene.scene_number || (idx + 1);
    md += `### Klip ${clipNum} :\n`;
    md += `- **Visual**: ${scene.visual_description || scene.visual_segment?.visual_action || ''}\n`;
    md += `- **Kamera**: ${scene.camera_movement || scene.visual_segment?.camera_movement || ''}\n`;
    md += `- **Audio Mood**: ${scene.audio_mood || scene.audio_segment?.audio_mood || ''}\n\n`;
  }

  // 2. Voiceover Section
  md += `## Voiceover\n`;
  for (let idx = 0; idx < storyboard.length; idx++) {
    const scene = storyboard[idx];
    const clipNum = scene.scene || scene.clip || scene.scene_number || (idx + 1);
    const vo = voiceover.find(v => Number(v.scene || v.clip) === Number(clipNum)) || {};
    md += `### Klip ${clipNum} :\n`;
    md += `*"${vo.narration || vo.voiceover_text || ''}"*\n`;
    if (idx === storyboard.length - 1) {
      if (vo.cta_facebook) {
        md += `- **CTA Facebook**: *"${vo.cta_facebook}"*\n`;
      }
      if (vo.cta_tiktok) {
        md += `- **CTA TikTok**: *"${vo.cta_tiktok}"*\n`;
      }
    }
    md += `\n`;
  }

  // 3. Prompts Section
  md += `## Prompts\n`;
  for (let idx = 0; idx < storyboard.length; idx++) {
    const scene = storyboard[idx];
    const clipNum = scene.scene || scene.clip || scene.scene_number || (idx + 1);
    const t2v = (parsed.t2v_prompts || []).find(p => Number(p.clip) === Number(clipNum))?.prompt;
    const t2i = (parsed.t2i_prompts || []).find(p => Number(p.clip) === Number(clipNum))?.prompt;
    const i2v = (parsed.i2v_prompts || []).find(p => Number(p.clip) === Number(clipNum))?.prompt;

    if (t2v || t2i || i2v) {
      md += `### Klip ${clipNum} :\n`;
      if (t2v) {
        md += `- **Prompt T2V**: \`${t2v}\`\n`;
      }
      if (t2i) {
        md += `- **Prompt T2I**: \`${t2i}\`\n`;
      }
      if (i2v) {
        md += `- **Prompt I2V**: \`${i2v}\`\n`;
      }
      md += `\n`;
    }
  }

  // Social Media Metadata & Captions section
  const universalCaption = parsed.caption || parsed.universal_caption || parsed.social_media_package?.caption || parsed.tiktok_caption || parsed.ig_caption || '';

  if (universalCaption) {
    md += `## Media Sosial Metadata & Caption\n\n`;
    md += `### 📲 Social Media Package & Caption\n\`\`\`text\n${universalCaption}\n\`\`\`\n\n`;
  }

  return md;
}
