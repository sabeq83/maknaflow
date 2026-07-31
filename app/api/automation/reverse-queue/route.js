import { NextResponse } from 'next/server';
import { parseGeminiJSON } from '@/lib/json-parser';
import { getAllKnowledgeBasesWithContent, createReverseResult, getSetting, setSetting } from '@/lib/db';
import { uploadVideoToGemini, generateWithVideo } from '@/lib/gemini';
import { buildReverseEngineeringPrompt } from '@/lib/prompts';
import { downloadFromUrl, cleanupTempFile } from '@/lib/video-downloader';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { google } from 'googleapis';
import { getAuthorizedClient } from '@/lib/google-auth';
import {
  generateREBatchId, RE_PIPELINE_HEADERS,
  buildREResultRow, buildREStoryboardRows, buildREVoiceoverRows,
  buildREPromptRows, buildRECaptionsRow, buildMarkdownContent
} from '@/lib/export-builder';
import { uploadREMarkdownToDrive } from '@/lib/drive-uploader';

/**
 * Automation Reverse Queue: Read "Riset RE" tab → process 1 pending video → write results back.
 * N8N calls this every 5 minutes. MAKNA handles everything.
 */
export async function POST() {
  let tempFilePath = null;

  try {
    const auth = getAuthorizedClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Get Master RE Sheet
    let spreadsheetId = await getSetting('master_re_sheet_id');
    if (!spreadsheetId) {
      return NextResponse.json({ success: true, data: { processed: false, reason: 'No Master RE Sheet exists yet' } });
    }

    try { await sheets.spreadsheets.get({ spreadsheetId }); }
    catch { return NextResponse.json({ success: true, data: { processed: false, reason: 'Master RE Sheet not found' } }); }

    // 2. Read "Riset RE" tab
    let risetData;
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId, range: "'Riset RE'!A:Z",
      });
      risetData = res.data.values || [];
    } catch {
      // Tab might not exist — add it
      try {
        const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
        const existingTabs = sheetInfo.data.sheets.map(s => s.properties.title);
        if (!existingTabs.includes('Riset RE')) {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [{ addSheet: { properties: { title: 'Riset RE', index: 0 } } }],
            },
          });
          await sheets.spreadsheets.values.update({
            spreadsheetId, range: "'Riset RE'!A1", valueInputOption: 'RAW',
            requestBody: { values: [RE_PIPELINE_HEADERS.riset] },
          });
        }
      } catch (e) { console.error('Failed to create Riset RE tab:', e.message); }
      return NextResponse.json({ success: true, data: { processed: false, reason: 'Riset RE tab created. Add URLs to start.' } });
    }

    if (risetData.length <= 1) {
      return NextResponse.json({ success: true, data: { processed: false, reason: 'No items in Riset RE tab' } });
    }

    // 3. Find headers and pending rows
    const headers = risetData[0];
    const statusCol = headers.indexOf('status');
    const urlCol = headers.indexOf('source_url');
    const nameCol = headers.indexOf('video_name');
    const instrCol = headers.indexOf('custom_instruction');
    const aspectCol = headers.indexOf('aspect_ratio');
    const targetAiCol = headers.indexOf('target_ai');
    const priorityCol = headers.indexOf('priority');
    const reIdCol = headers.indexOf('re_id');
    const batchIdCol = headers.indexOf('batch_id');
    const processedAtCol = headers.indexOf('processed_at');
    const errorCol = headers.indexOf('error_note');
    const rowIdCol = headers.indexOf('row_id');

    // Collect pending rows with their index
    const pendingRows = [];
    for (let i = 1; i < risetData.length; i++) {
      const row = risetData[i];
      const status = (row[statusCol] || '').toLowerCase().trim();
      if (status === 'pending' || status === '') {
        pendingRows.push({ rowIndex: i, row });
      }
    }

    if (pendingRows.length === 0) {
      return NextResponse.json({ success: true, data: { processed: false, reason: 'No pending items', total: risetData.length - 1 } });
    }

    // 4. Priority sort: high > normal > low > empty
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    pendingRows.sort((a, b) => {
      const pa = priorityOrder[(a.row[priorityCol] || '').toLowerCase()] ?? 3;
      const pb = priorityOrder[(b.row[priorityCol] || '').toLowerCase()] ?? 3;
      return pa - pb;
    });

    // Pick first
    const target = pendingRows[0];
    const sheetRowNum = target.rowIndex + 1; // 1-indexed for Sheets API
    const sourceUrl = target.row[urlCol] || '';
    const videoName = target.row[nameCol] || 'Untitled';
    const customInstruction = target.row[instrCol] || '';
    const aspectRatio = target.row[aspectCol] || '9:16';
    const targetAi = target.row[targetAiCol] || 'Google Veo (8s)';

    if (!sourceUrl) {
      // Update status to failed
      await updateRisetRow(sheets, spreadsheetId, sheetRowNum, statusCol, 'failed', errorCol, 'source_url kosong');
      return NextResponse.json({ success: true, data: { processed: false, reason: 'First pending row has no URL', remaining: pendingRows.length - 1 } });
    }

    // 5. Mark as processing
    await updateRisetRow(sheets, spreadsheetId, sheetRowNum, statusCol, 'processing');

    try {
      // 6. Download video
      const downloaded = await downloadFromUrl(sourceUrl);
      tempFilePath = downloaded.filePath;

      const ext = path.extname(tempFilePath).toLowerCase();
      const mimeMap = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska' };
      const mimeType = mimeMap[ext] || 'video/mp4';

      // 7. Upload to Gemini
      const uploadedFile = await uploadVideoToGemini(tempFilePath, mimeType);

      // Read KBs
      const kbs = await getAllKnowledgeBasesWithContent();
      if (kbs.length === 0) {
        cleanupTempFile(tempFilePath);
        await updateRisetRow(sheets, spreadsheetId, sheetRowNum, statusCol, 'failed', errorCol, 'Belum ada Knowledge Base');
        return NextResponse.json({ success: false, error: 'Belum ada Knowledge Base.' }, { status: 400 });
      }

      // 8. Generate with Gemini
      const prompt = buildReverseEngineeringPrompt(
        kbs.map(kb => ({ name: kb.name, content: kb.content })),
        { custom_instruction: customInstruction, aspect_ratio: aspectRatio, target_ai: targetAi, prompt_output_format: 'json' }
      );
      const responseText = await generateWithVideo(uploadedFile.fileUri, uploadedFile.mimeType, prompt);

      // Parse JSON
      let parsed;
      try {
        parsed = parseGeminiJSON(responseText);
      } catch (parseError) {
        cleanupTempFile(tempFilePath);
        await updateRisetRow(sheets, spreadsheetId, sheetRowNum, statusCol, 'failed', errorCol, `Parse error: ${parseError.message}`);
        return NextResponse.json({ success: false, error: `Parse error: ${parseError.message}` }, { status: 500 });
      }

      // 9. Save to DB
      const result = {
        id: uuidv4(),
        source_type: 'url',
        source_url: sourceUrl,
        video_filename: downloaded.filename || videoName,
        custom_instruction: customInstruction,
        aspect_ratio: aspectRatio,
        target_ai: targetAi,
        prompt_output_format: 'json',
        storyboard: JSON.stringify(parsed.storyboard || []),
        voiceover: JSON.stringify(parsed.voiceover || []),
        t2v_prompts: JSON.stringify(parsed.t2v_prompts || []),
        tiktok_caption: parsed.tiktok_caption || '',
        ig_caption: parsed.ig_caption || '',
        yt_title: parsed.yt_title || '',
        yt_desc: parsed.yt_desc || '',
        raw_response: responseText,
      };
      await createReverseResult(result);
      cleanupTempFile(tempFilePath);
      tempFilePath = null;

      // 10. Write to RE Sheet tabs
      const fullResult = {
        ...result,
        storyboard: parsed.storyboard || [],
        voiceover: parsed.voiceover || [],
        t2v_prompts: parsed.t2v_prompts || [],
      };

      const existingBatchRes = await sheets.spreadsheets.values.get({
        spreadsheetId, range: 'RE Results!B:B',
      });
      const existingIds = (existingBatchRes.data.values || []).flat().filter(v => v && v.startsWith('RE-'));
      const batchId = generateREBatchId(existingIds);

      const storyboardRows = buildREStoryboardRows(fullResult, batchId);
      const voiceoverRows = buildREVoiceoverRows(fullResult, batchId);
      const promptRows = buildREPromptRows(fullResult, batchId);

      await sheets.spreadsheets.values.append({
        spreadsheetId, range: 'RE Results!A1', valueInputOption: 'RAW',
        requestBody: { values: [buildREResultRow(fullResult, batchId)] },
      });
      if (storyboardRows.length) {
        await sheets.spreadsheets.values.append({
          spreadsheetId, range: 'Storyboard!A1', valueInputOption: 'RAW',
          requestBody: { values: storyboardRows },
        });
      }
      if (voiceoverRows.length) {
        await sheets.spreadsheets.values.append({
          spreadsheetId, range: 'Voiceover!A1', valueInputOption: 'RAW',
          requestBody: { values: voiceoverRows },
        });
      }
      if (promptRows.length) {
        await sheets.spreadsheets.values.append({
          spreadsheetId, range: 'Prompts!A1', valueInputOption: 'RAW',
          requestBody: { values: promptRows },
        });
      }
      await sheets.spreadsheets.values.append({
        spreadsheetId, range: 'Captions!A1', valueInputOption: 'RAW',
        requestBody: { values: [buildRECaptionsRow(fullResult, batchId)] },
      });

      // 11. Upload Markdown to Drive
      let driveUrl = null;
      try {
        const markdownContent = buildMarkdownContent(fullResult, batchId);
        const filename = `${batchId}.md`;
        const uploaded = await uploadREMarkdownToDrive(markdownContent, filename);
        driveUrl = uploaded.driveUrl;
      } catch (mdErr) {
        console.error('Failed to upload Markdown to Drive from Queue:', mdErr);
      }

      // 12. Update Riset RE row → produced
      const updates = [
        { col: statusCol, val: 'produced' },
        { col: reIdCol, val: result.id },
        { col: batchIdCol, val: batchId },
        { col: processedAtCol, val: new Date().toISOString() },
        { col: errorCol, val: '' },
      ];
      
      const markdownCol = headers.indexOf('markdown_url');
      if (markdownCol >= 0 && driveUrl) {
        updates.push({ col: markdownCol, val: driveUrl });
      }

      // Auto-fill row_id if empty
      if (!target.row[rowIdCol]) {
        updates.push({ col: rowIdCol, val: `RQ-${sheetRowNum}` });
      }

      for (const u of updates) {
        if (u.col >= 0) {
          const colLetter = String.fromCharCode(65 + u.col);
          await sheets.spreadsheets.values.update({
            spreadsheetId, range: `'Riset RE'!${colLetter}${sheetRowNum}`,
            valueInputOption: 'RAW',
            requestBody: { values: [[u.val]] },
          });
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          processed: true,
          video_name: videoName,
          re_id: result.id,
          batch_id: batchId,
          scenes_count: storyboardRows.length,
          remaining_pending: pendingRows.length - 1,
          drive_url: driveUrl,
          debug_version: 'v2_14_columns_fix',
        },
      });

    } catch (processError) {
      cleanupTempFile(tempFilePath);
      // Update Riset RE row → failed
      await updateRisetRow(sheets, spreadsheetId, sheetRowNum, statusCol, 'failed', errorCol, processError.message);
      return NextResponse.json({ success: false, error: processError.message }, { status: 500 });
    }

  } catch (error) {
    cleanupTempFile(tempFilePath);
    console.error('Reverse queue error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Helper: Update specific cells in Riset RE row
async function updateRisetRow(sheets, spreadsheetId, rowNum, statusCol, statusVal, errorCol, errorVal) {
  try {
    if (statusCol >= 0) {
      const col = String.fromCharCode(65 + statusCol);
      await sheets.spreadsheets.values.update({
        spreadsheetId, range: `'Riset RE'!${col}${rowNum}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[statusVal]] },
      });
    }
    if (errorCol >= 0 && errorVal !== undefined) {
      const col = String.fromCharCode(65 + errorCol);
      await sheets.spreadsheets.values.update({
        spreadsheetId, range: `'Riset RE'!${col}${rowNum}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[errorVal]] },
      });
    }
  } catch (e) { console.error('Failed to update Riset RE row:', e.message); }
}
