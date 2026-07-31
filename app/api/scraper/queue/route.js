import { NextResponse } from 'next/server';
import { getSetting, createVideoLibraryEntry } from '@/lib/db';
import { google } from 'googleapis';
import { getAuthorizedClient } from '@/lib/google-auth';
import { downloadFromUrl, moveToLibrary, generateThumbnail, getFileSize } from '@/lib/video-downloader';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { RE_PIPELINE_HEADERS } from '@/lib/export-builder';

/**
 * GET /api/scraper/queue
 * Autonomous Scraper Queue V3: Read 1 pending row from "Riset RE" tab,
 * scrape video, save to library, and update row status to "processing".
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
    catch (e) { 
      console.error('Sheet fetch error:', e.message);
      return NextResponse.json({ success: true, data: { processed: false, reason: 'Master RE Sheet not found', detail: e.message } }); 
    }

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
    const urlCol = headers.indexOf('source_url');
    const priorityCol = headers.indexOf('priority');
    const errorCol = headers.indexOf('error_note');
    const videoIdCol = headers.indexOf('video_id');

    if (statusCol === -1 || urlCol === -1 || videoIdCol === -1) {
      return NextResponse.json({ success: false, error: 'Kolom status, source_url, atau video_id tidak ditemukan di header' }, { status: 400 });
    }

    // Collect pending rows
    const pendingRows = [];
    for (let i = 1; i < risetData.length; i++) {
      const row = risetData[i];
      const status = (row[statusCol] || '').toLowerCase().trim();
      if (status === 'pending' || status === '') {
        pendingRows.push({ rowIndex: i, row });
      }
    }

    if (pendingRows.length === 0) {
      return NextResponse.json({ success: true, data: { processed: false, reason: 'No pending items' } });
    }

    // Priority sort
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    pendingRows.sort((a, b) => {
      const pA = (a.row[priorityCol] || '').toLowerCase();
      const pB = (b.row[priorityCol] || '').toLowerCase();
      const valA = priorityOrder[pA] ?? 3;
      const valB = priorityOrder[pB] ?? 3;
      if (valA !== valB) return valA - valB;
      return a.rowIndex - b.rowIndex; // oldest first
    });

    const target = pendingRows[0];
    const sourceUrl = target.row[urlCol];
    const sheetRowNumber = target.rowIndex + 1; // 1-indexed

    if (!sourceUrl || sourceUrl.trim() === '') {
      // Mark as error if URL is empty
      const updates = [
        { col: statusCol, val: 'error' },
        { col: errorCol, val: 'URL Kosong' },
      ];
      await updateSheetRow(sheets, spreadsheetId, sheetRowNumber, headers, target.row, updates);
      return NextResponse.json({ success: true, data: { processed: false, reason: 'URL Kosong' } });
    }

    console.log(`[Scraper Queue] Processing Row ${sheetRowNumber}: ${sourceUrl}`);

    try {
      // 1. Download
      const dlResult = await downloadFromUrl(sourceUrl);

      // 2. Move to permanent V3 library
      const videoId = uuidv4();
      const ext = path.extname(dlResult.filename) || '.mp4';
      const libraryFilename = `${videoId}${ext}`;
      
      const libraryPath = moveToLibrary(dlResult.filePath, libraryFilename);
      const fileSize = getFileSize(libraryPath);

      // 3. Generate thumbnail
      const thumbFilename = `${videoId}.jpg`;
      const thumbPath = await generateThumbnail(libraryPath, thumbFilename);

      // 4. Save to DB
      await createVideoLibraryEntry({
        id: videoId,
        source_type: 'url',
        source_url: sourceUrl,
        filename: libraryFilename,
        local_path: libraryPath,
        file_size: fileSize,
        mime_type: dlResult.mimeType || 'video/mp4',
        thumbnail_path: thumbPath || null,
        status: 'ready',
        error_note: null,
        tags: '[]',
      });

      // 5. Update Google Sheet row -> processing
      const updates = [
        { col: statusCol, val: 'processing' },
        { col: videoIdCol, val: videoId },
        { col: errorCol, val: '' }, // clear any previous error
      ];
      await updateSheetRow(sheets, spreadsheetId, sheetRowNumber, headers, target.row, updates);

      return NextResponse.json({ 
        success: true, 
        data: { 
          processed: true, 
          row: sheetRowNumber,
          video_id: videoId,
        } 
      });

    } catch (error) {
      console.error('[Scraper Queue] Error:', error.message);
      // Update Google Sheet row -> error
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
    console.error('Scraper Queue error:', error);
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
