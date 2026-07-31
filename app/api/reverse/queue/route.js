import { NextResponse } from 'next/server';
import { parseGeminiJSON } from '@/lib/json-parser';
import { getAllKnowledgeBasesWithContent, createReverseResult, getVideoById, updateVideoLibraryEntry, getSetting } from '@/lib/db';
import { uploadVideoToGemini, generateWithVideo } from '@/lib/gemini';
import { buildReverseEngineeringPrompt } from '@/lib/prompts';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { google } from 'googleapis';
import { getAuthorizedClient } from '@/lib/google-auth';
import {
  generateREBatchId, buildREResultRow, buildREStoryboardRows, buildREVoiceoverRows,
  buildREPromptRows, buildRECaptionsRow, buildMarkdownContent
} from '@/lib/export-builder';
import { uploadREMarkdownToDrive } from '@/lib/drive-uploader';

/**
 * GET /api/reverse/queue
 * Autonomous RE Queue V3: Read 1 processing row from "Riset RE" tab,
 * analyze the local video via Gemini, distribute results, and update status.
 * Triggered periodically by n8n.
 */
export async function GET() {
  try {
    const auth = getAuthorizedClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetId = await getSetting('master_re_sheet_id');
    if (!spreadsheetId) {
      return NextResponse.json({ success: true, data: { processed: false, reason: 'No Master RE Sheet exists yet' } });
    }

    try { await sheets.spreadsheets.get({ spreadsheetId }); }
    catch { return NextResponse.json({ success: true, data: { processed: false, reason: 'Master RE Sheet not found' } }); }

    // Read "Riset RE" tab
    let risetData;
    try {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'Riset RE'!A:Z" });
      risetData = res.data.values || [];
    } catch {
      return NextResponse.json({ success: true, data: { processed: false, reason: 'Riset RE tab not found' } });
    }

    if (risetData.length <= 1) {
      return NextResponse.json({ success: true, data: { processed: false, reason: 'No items in Riset RE tab' } });
    }

    // Find headers
    const headers = risetData[0];
    const statusCol = headers.indexOf('status');
    const videoIdCol = headers.indexOf('video_id');
    const priorityCol = headers.indexOf('priority');
    const instrCol = headers.indexOf('custom_instruction');
    const aspectCol = headers.indexOf('aspect_ratio');
    const targetAiCol = headers.indexOf('target_ai');
    const reIdCol = headers.indexOf('re_id');
    const batchIdCol = headers.indexOf('batch_id');
    const processedAtCol = headers.indexOf('processed_at');
    const errorCol = headers.indexOf('error_note');
    const mdUrlCol = headers.indexOf('markdown_url');

    if (statusCol === -1 || videoIdCol === -1) {
      return NextResponse.json({ success: false, error: 'Kolom status atau video_id tidak ditemukan di header' }, { status: 400 });
    }

    // Collect processing rows that have a video_id
    const processingRows = [];
    for (let i = 1; i < risetData.length; i++) {
      const row = risetData[i];
      const status = (row[statusCol] || '').toLowerCase().trim();
      const videoId = (row[videoIdCol] || '').trim();
      if (status === 'processing' && videoId !== '') {
        processingRows.push({ rowIndex: i, row, videoId });
      }
    }

    if (processingRows.length === 0) {
      return NextResponse.json({ success: true, data: { processed: false, reason: 'No processing items with video_id found' } });
    }

    // Priority sort
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    processingRows.sort((a, b) => {
      const pA = (a.row[priorityCol] || '').toLowerCase();
      const pB = (b.row[priorityCol] || '').toLowerCase();
      const valA = priorityOrder[pA] ?? 3;
      const valB = priorityOrder[pB] ?? 3;
      if (valA !== valB) return valA - valB;
      return a.rowIndex - b.rowIndex; // oldest first
    });

    const target = processingRows[0];
    const videoId = target.videoId;
    const sheetRowNumber = target.rowIndex + 1; // 1-indexed

    console.log(`[Reverse Queue] Processing Row ${sheetRowNumber} for Video ID: ${videoId}`);

    try {
      // 1. Get video from library
      const video = await getVideoById(videoId);
      if (!video) throw new Error(`Video ID ${videoId} not found in local library`);
      if (video.status !== 'ready' && video.status !== 'analyzed') {
        throw new Error(`Video status is '${video.status}', must be 'ready' or 'analyzed'`);
      }

      // 2. Upload to Gemini File API
      const ext = path.extname(video.local_path).toLowerCase();
      const mimeMap = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska' };
      const mimeType = mimeMap[ext] || video.mime_type || 'video/mp4';
      const uploadedFile = await uploadVideoToGemini(video.local_path, mimeType);

      // 3. Get Knowledge Bases
      const kbs = await getAllKnowledgeBasesWithContent();
      if (kbs.length === 0) throw new Error('Belum ada Knowledge Base.');

      // 4. Build prompt
      const config = {
        custom_instruction: target.row[instrCol] || '',
        aspect_ratio: target.row[aspectCol] || '9:16',
        target_ai: target.row[targetAiCol] || 'Google Veo (8s)',
        prompt_output_format: 'plain_text',
      };
      const prompt = buildReverseEngineeringPrompt(kbs.map(kb => ({ name: kb.name, content: kb.content })), config);

      // 5. Generate with Gemini
      const responseText = await generateWithVideo(uploadedFile.fileUri, uploadedFile.mimeType, prompt);
      const parsed = parseGeminiJSON(responseText);

      // 6. Generate IDs and Save to DB
      const existingRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: "'RE Results'!B:B" }).catch(() => ({ data: { values: [] } }));
      const existingIds = (existingRes.data?.values || []).flat().filter(v => v && v.startsWith('RE-'));
      const batchId = generateREBatchId(existingIds);
      
      const result = {
        id: uuidv4(),
        source_type: video.source_type,
        source_url: video.source_url || '',
        video_filename: video.filename,
        custom_instruction: config.custom_instruction,
        aspect_ratio: config.aspect_ratio,
        target_ai: config.target_ai,
        prompt_output_format: config.prompt_output_format,
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
      await updateVideoLibraryEntry(videoId, { re_id: result.id, status: 'analyzed' });

      // 7. Auto-sync to Google Sheets (Results, Storyboard, etc.)
      const fullResult = { ...result, storyboard: parsed.storyboard || [], voiceover: parsed.voiceover || [], t2v_prompts: parsed.t2v_prompts || [] };
      const storyboardRows = buildREStoryboardRows(fullResult, batchId);
      const voiceoverRows = buildREVoiceoverRows(fullResult, batchId);
      const promptRows = buildREPromptRows(fullResult, batchId);

      await sheets.spreadsheets.values.append({ spreadsheetId, range: "'RE Results'!A1", valueInputOption: 'RAW', requestBody: { values: [buildREResultRow(fullResult, batchId)] } });
      if (storyboardRows.length) await sheets.spreadsheets.values.append({ spreadsheetId, range: "'Storyboard'!A1", valueInputOption: 'RAW', requestBody: { values: storyboardRows } });
      if (voiceoverRows.length) await sheets.spreadsheets.values.append({ spreadsheetId, range: "'Voiceover'!A1", valueInputOption: 'RAW', requestBody: { values: voiceoverRows } });
      if (promptRows.length) await sheets.spreadsheets.values.append({ spreadsheetId, range: "'Prompts'!A1", valueInputOption: 'RAW', requestBody: { values: promptRows } });
      await sheets.spreadsheets.values.append({ spreadsheetId, range: "'Captions'!A1", valueInputOption: 'RAW', requestBody: { values: [buildRECaptionsRow(fullResult, batchId)] } });

      // 8. Markdown Export
      let driveUrl = null;
      try {
        const markdownContent = buildMarkdownContent(fullResult, batchId);
        const filename = `${batchId}.md`;
        const uploaded = await uploadREMarkdownToDrive(markdownContent, filename);
        driveUrl = uploaded.driveUrl;
      } catch (mdErr) {
        console.error('Failed to upload Markdown to Drive:', mdErr);
      }

      // 9. Update Riset RE row -> produced
      const updates = [
        { col: statusCol, val: 'produced' },
        { col: batchIdCol, val: batchId },
        { col: reIdCol, val: result.id },
        { col: processedAtCol, val: new Date().toISOString() },
        { col: errorCol, val: '' },
      ];
      if (mdUrlCol !== -1 && driveUrl) updates.push({ col: mdUrlCol, val: driveUrl });

      await updateSheetRow(sheets, spreadsheetId, sheetRowNumber, headers, target.row, updates);

      return NextResponse.json({ 
        success: true, 
        data: { 
          processed: true, 
          row: sheetRowNumber,
          batch_id: batchId,
          scenes: storyboardRows.length
        } 
      });

    } catch (error) {
      console.error('[Reverse Queue] Error:', error.message);
      const updates = [
        { col: statusCol, val: 'error' },
        { col: errorCol, val: error.message },
      ];
      await updateSheetRow(sheets, spreadsheetId, sheetRowNumber, headers, target.row, updates);

      return NextResponse.json({ 
        success: true, 
        data: { 
          processed: false, 
          row: sheetRowNumber,
          error: error.message,
        } 
      });
    }

  } catch (error) {
    console.error('Reverse Queue error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Helper to update specific columns in a row
async function updateSheetRow(sheets, spreadsheetId, rowNumber, headers, currentRow, updates) {
  const maxColIndex = Math.max(...updates.map(u => u.col));
  const newRow = [...currentRow];
  while (newRow.length <= maxColIndex) newRow.push('');

  updates.forEach(u => {
    newRow[u.col] = u.val;
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'Riset RE'!A${rowNumber}`,
    valueInputOption: 'RAW',
    requestBody: { values: [newRow] },
  });
}

export const POST = GET;
