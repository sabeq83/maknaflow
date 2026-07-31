import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthorizedClient } from '@/lib/google-auth';
import { getSetting, setSetting, getReverseResult } from '@/lib/db';
import {
  generateREBatchId, RE_PIPELINE_HEADERS,
  buildREResultRow, buildREStoryboardRows, buildREVoiceoverRows,
  buildREPromptRows, buildRECaptionsRow, buildMarkdownContent
} from '@/lib/export-builder';
import { uploadREMarkdownToDrive } from '@/lib/drive-uploader';

const SHEET_TITLE = 'MAKNA — Master RE';

export async function POST(request) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });

    const auth = getAuthorizedClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // Fetch RE result
    const raw = await getReverseResult(id);
    if (!raw) return NextResponse.json({ success: false, error: 'Result not found' }, { status: 404 });
    const result = {
      ...raw,
      storyboard: JSON.parse(raw.storyboard || '[]'),
      voiceover: JSON.parse(raw.voiceover || '[]'),
      t2v_prompts: JSON.parse(raw.t2v_prompts || '[]'),
    };

    // Get or create Master RE Sheet
    let spreadsheetId = await getSetting('master_re_sheet_id');

    if (spreadsheetId) {
      try { await sheets.spreadsheets.get({ spreadsheetId }); }
      catch { spreadsheetId = null; }
    }

    if (!spreadsheetId) {
      const created = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title: SHEET_TITLE },
          sheets: [
            { properties: { title: 'Riset RE', index: 0 } },
            { properties: { title: 'RE Results', index: 1 } },
            { properties: { title: 'Storyboard', index: 2 } },
            { properties: { title: 'Voiceover', index: 3 } },
            { properties: { title: 'Prompts', index: 4 } },
            { properties: { title: 'Captions', index: 5 } },
          ],
        },
      });
      spreadsheetId = created.data.spreadsheetId;
      await setSetting('master_re_sheet_id', spreadsheetId);

      // Write headers
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: [
            { range: 'Riset RE!A1', values: [RE_PIPELINE_HEADERS.riset] },
            { range: 'RE Results!A1', values: [RE_PIPELINE_HEADERS.results] },
            { range: 'Storyboard!A1', values: [RE_PIPELINE_HEADERS.storyboard] },
            { range: 'Voiceover!A1', values: [RE_PIPELINE_HEADERS.voiceover] },
            { range: 'Prompts!A1', values: [RE_PIPELINE_HEADERS.prompts] },
            { range: 'Captions!A1', values: [RE_PIPELINE_HEADERS.captions] },
          ],
        },
      });

      // Bold + freeze headers
      const sheetMeta = created.data.sheets;
      const requests = sheetMeta.flatMap(s => [
        {
          repeatCell: {
            range: { sheetId: s.properties.sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.15, green: 0.15, blue: 0.2 } } },
            fields: 'userEnteredFormat(textFormat,backgroundColor)',
          },
        },
        {
          updateSheetProperties: {
            properties: { sheetId: s.properties.sheetId, gridProperties: { frozenRowCount: 1 } },
            fields: 'gridProperties.frozenRowCount',
          },
        },
      ]);
      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
    }

    // Get existing batch IDs
    const existingRes = await sheets.spreadsheets.values.get({
      spreadsheetId, range: 'RE Results!B:B',
    });
    const existingIds = (existingRes.data.values || []).flat().filter(v => v && v.startsWith('RE-'));

    // Check for duplicate re_id
    const reIdsRes = await sheets.spreadsheets.values.get({
      spreadsheetId, range: 'RE Results!A:A',
    });
    const existingReIds = (reIdsRes.data.values || []).flat();
    let batchId;

    if (existingReIds.includes(result.id)) {
      // Find existing batch_id
      const rowIndex = existingReIds.indexOf(result.id);
      const allRows = (existingRes.data.values || []).flat();
      batchId = allRows[rowIndex] || generateREBatchId(existingIds);
    } else {
      batchId = generateREBatchId(existingIds);
    }

    // Append data to all tabs
    const resultRow = buildREResultRow(result, batchId);
    const storyboardRows = buildREStoryboardRows(result, batchId);
    const voiceoverRows = buildREVoiceoverRows(result, batchId);
    const promptRows = buildREPromptRows(result, batchId);
    const captionRow = buildRECaptionsRow(result, batchId);

    if (!existingReIds.includes(result.id)) {
      await sheets.spreadsheets.values.append({
        spreadsheetId, range: 'RE Results!A1', valueInputOption: 'RAW',
        requestBody: { values: [resultRow] },
      });
    }

    // Always append scene data (or update if exists — for simplicity, append)
    const batchData = [];
    if (storyboardRows.length) batchData.push({ range: 'Storyboard!A:A', values: storyboardRows });
    if (voiceoverRows.length) batchData.push({ range: 'Voiceover!A:A', values: voiceoverRows });
    if (promptRows.length) batchData.push({ range: 'Prompts!A:A', values: promptRows });
    batchData.push({ range: 'Captions!A:A', values: [captionRow] });

    for (const item of batchData) {
      await sheets.spreadsheets.values.append({
        spreadsheetId, range: item.range, valueInputOption: 'RAW',
        requestBody: { values: item.values },
      });
    }

    // Upload Markdown to Drive
    let driveUrl = null;
    try {
      const markdownContent = buildMarkdownContent(result, batchId);
      const filename = `${batchId}.md`;
      const uploaded = await uploadREMarkdownToDrive(markdownContent, filename);
      driveUrl = uploaded.driveUrl;
    } catch (mdErr) {
      console.error('Failed to upload Markdown to Drive:', mdErr);
    }

    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
    return NextResponse.json({
      success: true,
      data: { spreadsheetId, url, batchId, scenesCount: storyboardRows.length, driveUrl },
    });
  } catch (error) {
    console.error('RE pipeline sync error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const sheetId = await getSetting('master_re_sheet_id');
    return NextResponse.json({
      success: true,
      data: {
        exists: !!sheetId,
        spreadsheetId: sheetId || null,
        url: sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}` : null,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
