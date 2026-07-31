import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/db';
import { google } from 'googleapis';
import { getAuthorizedClient } from '@/lib/google-auth';
import { uploadToDriveBatch } from '@/lib/drive-uploader';
import { getTaskStatus, generateVideo, getFileUrl } from '@/lib/webhook-client';
import { uploadFileUrlToNextcloud } from '@/lib/nextcloud-helper';

// Mengatur max duration menjadi 300 detik (5 menit) agar proses jeda 30s per scene tidak timeout di Vercel
export const maxDuration = 300;

export async function POST() {
  return await handleQueue();
}

export async function GET() {
  return await handleQueue();
}

async function handleQueue() {
  try {
    const auth = getAuthorizedClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Get Master RE Sheet
    const spreadsheetId = await getSetting('master_re_sheet_id');
    if (!spreadsheetId) {
      return NextResponse.json({ success: true, data: { processed: false, reason: 'No Master RE Sheet exists yet' } });
    }

    try {
      await sheets.spreadsheets.get({ spreadsheetId });
    } catch {
      return NextResponse.json({ success: true, data: { processed: false, reason: 'Master RE Sheet not found' } });
    }

    // 2. Read "Prompts" tab
    let promptsData;
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "'Prompts'!A:Z",
      });
      promptsData = res.data.values || [];
    } catch {
      return NextResponse.json({ success: true, data: { processed: false, reason: 'Prompts tab not found or empty' } });
    }

    if (promptsData.length <= 1) {
      return NextResponse.json({ success: true, data: { processed: false, reason: 'No items in Prompts tab' } });
    }

    // 3. Find headers
    const headers = promptsData[0];
    const getCol = (name) => headers.indexOf(name);

    const batchIdCol = getCol('batch_id');
    const sceneIdCol = getCol('scene_id');
    const aspectRatioCol = getCol('aspect_ratio');
    const targetAiCol = getCol('target_ai');
    const promptCol = getCol('t2v_prompt');
    const videoTaskIdCol = getCol('video_task_id');
    const videoStatusCol = getCol('video_status');
    const videoUrlCol = getCol('video_url');

    // Make sure necessary columns exist
    if ([batchIdCol, sceneIdCol, promptCol, videoTaskIdCol, videoStatusCol, videoUrlCol].some(c => c === -1)) {
      return NextResponse.json({ success: false, error: 'Missing required columns in Prompts tab' }, { status: 400 });
    }

    // --- PHASE 1: POLLING (Status Checking) ---
    const processingRows = [];
    for (let i = 1; i < promptsData.length; i++) {
      const row = promptsData[i];
      const status = (row[videoStatusCol] || '').toLowerCase().trim();
      const taskId = row[videoTaskIdCol] || '';
      if (status === 'processing' && taskId) {
        processingRows.push({
          rowIndex: i,
          row,
          taskId,
          batchId: row[batchIdCol] || '',
          sceneId: row[sceneIdCol] || ''
        });
      }
    }

    let stillProcessingCount = 0;
    const pollingResults = [];

    for (const item of processingRows) {
      try {
        const statusData = await getTaskStatus(item.taskId);
        const sheetRowNum = item.rowIndex + 1;

        if (statusData.status === 'completed') {
          // Update to done
          const videoUrl = statusData.results && statusData.results.length > 0 ? statusData.results[0] : '';

          let finalVideoUrl = videoUrl;
          if (videoUrl) {
            try {
              // Extract filename from the GLabs URL
              const rawFilename = videoUrl.split('/').pop();
              
              // Reconstruct the correct download URL using our webhook-client logic (respecting proxy/host)
              const downloadUrl = getFileUrl(rawFilename);

              const driveFilename = `${item.sceneId || item.taskId}.mp4`;
              
              const storageProvider = await getSetting('storage_provider') || 'gdrive';
              
              if (storageProvider === 'nextcloud') {
                const targetFolder = await getSetting('nextcloud_target_folder') || '/MAKNA_Video_Generations';
                const batchFolder = item.batchId || 'UNBATCHED';
                const targetPath = `${targetFolder}/${batchFolder}/${driveFilename}`.replace(/\/+/g, '/');
                
                const uploadResult = await uploadFileUrlToNextcloud(downloadUrl, targetPath);
                finalVideoUrl = uploadResult.fileUrl;
              } else {
                // V3: Read folder config from Settings, fallback to default
                const glabsFolderName = await getSetting('drive_glabs_folder_name') || 'RE Videos';
                const driveUpload = await uploadToDriveBatch({
                  fileUrl: downloadUrl,
                  batchId: item.batchId || 'UNBATCHED',
                  filename: driveFilename,
                  mimeType: 'video/mp4',
                  rootFolderName: glabsFolderName,
                });
                finalVideoUrl = driveUpload.driveUrl;
              }
            } catch (driveErr) {
              console.error(`Failed to upload ${item.taskId} to drive:`, driveErr);
            }
          }

          await updateSheetRow(sheets, spreadsheetId, sheetRowNum, [
            { col: videoStatusCol, val: 'done' },
            { col: videoUrlCol, val: finalVideoUrl }
          ]);
          pollingResults.push({ taskId: item.taskId, status: 'completed', videoUrl: finalVideoUrl });
        } else if (statusData.status === 'failed') {
          // Update to failed
          await updateSheetRow(sheets, spreadsheetId, sheetRowNum, [
            { col: videoStatusCol, val: 'failed' }
          ]);
          pollingResults.push({ taskId: item.taskId, status: 'failed', error: statusData.error_detail });
        } else {
          // Still pending/running
          stillProcessingCount++;
        }
      } catch (err) {
        console.error(`Error polling task ${item.taskId}:`, err.message);
        stillProcessingCount++;
      }
    }

    // --- PHASE 2: SEQUENTIAL QUEUE CHECK ---
    if (stillProcessingCount > 0) {
      return NextResponse.json({
        success: true,
        data: {
          phase: 'polling',
          message: `There are ${stillProcessingCount} tasks still processing in GLabs. Waiting for them to complete before sending new batch.`,
          polling_updates: pollingResults
        }
      });
    }

    // --- PHASE 3: SUBMISSION (Send New Batch) ---
    // Re-read data just in case it was updated by polling or externally
    const refreshedRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'Prompts'!A:Z" });
    const refreshedData = refreshedRes.data.values || [];

    let firstPendingBatchId = null;
    const pendingScenes = [];

    for (let i = 1; i < refreshedData.length; i++) {
      const row = refreshedData[i];
      const status = (row[videoStatusCol] || '').toLowerCase().trim();
      const bId = row[batchIdCol] || '';

      if (status === 'pending' || status === '') {
        if (!firstPendingBatchId) {
          firstPendingBatchId = bId;
        }

        if (bId === firstPendingBatchId) {
          pendingScenes.push({ rowIndex: i, row });
        }
      }
    }

    if (pendingScenes.length === 0) {
      return NextResponse.json({
        success: true,
        data: { phase: 'submission', message: 'No pending batches found.', polling_updates: pollingResults }
      });
    }

    const submissionResults = [];

    // Process the batch
    for (let i = 0; i < pendingScenes.length; i++) {
      const item = pendingScenes[i];
      const sheetRowNum = item.rowIndex + 1;
      const t2vPrompt = item.row[promptCol] || '';
      const aspectRatio = item.row[aspectRatioCol] || '9:16';
      // const targetAi = item.row[targetAiCol] || 'veo_31_lite'; // fallback

      if (!t2vPrompt) {
        await updateSheetRow(sheets, spreadsheetId, sheetRowNum, [
          { col: videoStatusCol, val: 'failed' } // No prompt
        ]);
        submissionResults.push({ sceneId: item.row[sceneIdCol], status: 'failed_no_prompt' });
        continue;
      }

      try {
        const generateData = await generateVideo({
          prompt: t2vPrompt,
          aspect_ratio: aspectRatio,
          mode: 'text_to_video'
        });

        const newTaskId = generateData.task_id;

        if (newTaskId) {
          await updateSheetRow(sheets, spreadsheetId, sheetRowNum, [
            { col: videoStatusCol, val: 'processing' },
            { col: videoTaskIdCol, val: newTaskId }
          ]);
          submissionResults.push({ sceneId: item.row[sceneIdCol], status: 'submitted', taskId: newTaskId });
        } else {
          await updateSheetRow(sheets, spreadsheetId, sheetRowNum, [
            { col: videoStatusCol, val: 'failed' }
          ]);
          submissionResults.push({ sceneId: item.row[sceneIdCol], status: 'failed_no_task_id' });
        }

      } catch (err) {
        console.error('GLabs fetch error:', err.message);
        await updateSheetRow(sheets, spreadsheetId, sheetRowNum, [
          { col: videoStatusCol, val: 'failed' }
        ]);
        submissionResults.push({ sceneId: item.row[sceneIdCol], status: 'failed_exception', error: err.message });
      }

      // Wait 30 seconds before sending the next prompt, if this is not the last one
      if (i < pendingScenes.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        phase: 'submission_complete',
        batch_id: firstPendingBatchId,
        polling_updates: pollingResults,
        submissions: submissionResults
      }
    });

  } catch (error) {
    console.error('GLabs queue error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Helper: Update specific cells in a row
async function updateSheetRow(sheets, spreadsheetId, rowNum, updates) {
  try {
    for (const u of updates) {
      if (u.col >= 0) {
        const colLetter = String.fromCharCode(65 + u.col);
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `'Prompts'!${colLetter}${rowNum}`,
          valueInputOption: 'RAW',
          requestBody: { values: [[u.val]] },
        });
      }
    }
  } catch (e) {
    console.error(`Failed to update row ${rowNum}:`, e.message);
  }
}
