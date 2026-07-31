import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthorizedClient } from '@/lib/google-auth';
import { getSetting, setSetting, getIdea, getAsset, getReverseResult } from '@/lib/db';
import {
  generateBatchId, PIPELINE_HEADERS,
  buildIdeationRow, buildProductionRows, buildCaptionsRow,
} from '@/lib/export-builder';

const SHEET_TITLE = 'MAKNA — Master Pipeline';

export async function POST(request) {
  try {
    const { id, source, stage } = await request.json();
    // stage: 'ideation' or 'production'
    // source: 'production' or 'reverse'
    if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });

    const auth = getAuthorizedClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Get or create Master Pipeline Sheet
    let spreadsheetId = await getSetting('master_pipeline_sheet_id');
    let isNew = false;

    if (spreadsheetId) {
      // Validate it still exists
      try {
        await sheets.spreadsheets.get({ spreadsheetId });
      } catch {
        spreadsheetId = null; // Sheet deleted, will recreate
      }
    }

    if (!spreadsheetId) {
      // Create new Master Pipeline Sheet
      const created = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title: SHEET_TITLE },
          sheets: [
            { properties: { title: 'Ideation', index: 0 } },
            { properties: { title: 'Production', index: 1 } },
            { properties: { title: 'Captions', index: 2 } },
          ],
        },
      });
      spreadsheetId = created.data.spreadsheetId;
      await setSetting('master_pipeline_sheet_id', spreadsheetId);
      isNew = true;

      // Write headers
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: [
            { range: 'Ideation!A1', values: [PIPELINE_HEADERS.ideation] },
            { range: 'Production!A1', values: [PIPELINE_HEADERS.production] },
            { range: 'Captions!A1', values: [PIPELINE_HEADERS.captions] },
          ],
        },
      });

      // Bold headers
      const sheetMeta = created.data.sheets;
      const formatRequests = sheetMeta.map(s => ({
        repeatCell: {
          range: { sheetId: s.properties.sheetId, startRowIndex: 0, endRowIndex: 1 },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true },
              backgroundColor: { red: 0.15, green: 0.15, blue: 0.2 },
            },
          },
          fields: 'userEnteredFormat(textFormat,backgroundColor)',
        },
      }));

      // Freeze header rows
      const freezeRequests = sheetMeta.map(s => ({
        updateSheetProperties: {
          properties: { sheetId: s.properties.sheetId, gridProperties: { frozenRowCount: 1 } },
          fields: 'gridProperties.frozenRowCount',
        },
      }));

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [...formatRequests, ...freezeRequests] },
      });
    }

    // 2. Get existing batch_ids to generate unique new one
    const existingRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Ideation!A:A', // batch_id column
    });
    const existingBatchIds = (existingRes.data.values || []).flat().filter(v => v && v.startsWith('B-'));

    // 3. Process based on stage
    if (stage === 'ideation') {
      // Fetch idea from DB
      const idea = await getIdea(id);
      if (!idea) return NextResponse.json({ success: false, error: 'Idea not found' }, { status: 404 });

      // Check if idea_id already exists in sheet (prevent duplicates)
      const ideaIdsRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Ideation!W:W',
      });
      const existingIdeaIds = (ideaIdsRes.data.values || []).flat();

      if (existingIdeaIds.includes(idea.id)) {
        // Find row and update instead
        const rowIndex = existingIdeaIds.indexOf(idea.id) + 1;
        const batchIdCell = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `Ideation!A${rowIndex}`,
        });
        const existingBatchId = batchIdCell.data.values?.[0]?.[0] || generateBatchId(existingBatchIds);

        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `Ideation!A${rowIndex}`,
          valueInputOption: 'RAW',
          requestBody: { values: [buildIdeationRow(idea, existingBatchId)] },
        });

        const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
        return NextResponse.json({ success: true, data: { spreadsheetId, url, batchId: existingBatchId, action: 'updated' } });
      }

      // New entry
      const batchId = generateBatchId(existingBatchIds);
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Ideation!A1',
        valueInputOption: 'RAW',
        requestBody: { values: [buildIdeationRow(idea, batchId)] },
      });

      const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
      return NextResponse.json({ success: true, data: { spreadsheetId, url, batchId, action: 'created' } });

    } else if (stage === 'production') {
      // Fetch result
      let result, idea;
      if (source === 'reverse') {
        result = await getReverseResult(id);
        if (!result) return NextResponse.json({ success: false, error: 'Result not found' }, { status: 404 });
        result.storyboard = JSON.parse(result.storyboard || '[]');
        result.voiceover = JSON.parse(result.voiceover || '[]');
        result.t2v_prompts = JSON.parse(result.t2v_prompts || '[]');
        // For reverse, t2v_prompts go into t2i_prompt column
        result.t2i_prompts = result.t2v_prompts;
        idea = { id: result.id, product_name: result.video_filename || 'Reverse Engineering' };
      } else {
        const asset = await getAsset(id);
        if (!asset) return NextResponse.json({ success: false, error: 'Asset not found' }, { status: 404 });
        idea = asset.idea_id ? await getIdea(asset.idea_id) : null;
        const storyboard = JSON.parse(asset.storyboard || '[]');
        result = {
          ...asset,
          storyboard,
          voiceover: storyboard.map((s, i) => ({
            scene: s.scene || i + 1,
            narration: s.narration || '',
            duration: s.duration || '',
          })),
          t2i_prompts: JSON.parse(asset.t2i_prompts || '[]'),
          i2v_prompts: JSON.parse(asset.i2v_prompts || '[]'),
        };
        if (!idea) idea = { id: asset.idea_id || '', product_name: 'Production' };
      }

      // Check if idea already has a batch_id in ideation tab
      const ideaIdsRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Ideation!A:W',
      });
      const ideaRows = ideaIdsRes.data.values || [];
      let batchId;
      const existingRow = ideaRows.find(row => row[22] === idea.id);

      if (existingRow) {
        batchId = existingRow[0];
        // Update pipeline_status
        const rowIndex = ideaRows.indexOf(existingRow) + 1;
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `Ideation!V${rowIndex}`,
          valueInputOption: 'RAW',
          requestBody: { values: [['produced']] },
        });
      } else {
        // Auto-create ideation entry
        batchId = generateBatchId(existingBatchIds);
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: 'Ideation!A1',
          valueInputOption: 'RAW',
          requestBody: { values: [buildIdeationRow(idea, batchId)] },
        });
      }

      // Check for existing production rows (prevent duplicates)
      const prodIdeaIdsRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Production!A:A',
      });
      const prodIdeaIds = (prodIdeaIdsRes.data.values || []).flat();
      if (prodIdeaIds.includes(idea.id)) {
        // Remove existing rows for this idea first
        // Find all row indices and delete them
        const allProdData = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: 'Production!A:A',
        });
        const prodRows = (allProdData.data.values || []).flat();

        // Get Production sheet ID
        const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
        const prodSheet = sheetInfo.data.sheets.find(s => s.properties.title === 'Production');
        const prodSheetId = prodSheet?.properties.sheetId;

        if (prodSheetId !== undefined) {
          const deleteRequests = [];
          for (let r = prodRows.length - 1; r >= 1; r--) {
            if (prodRows[r] === idea.id) {
              deleteRequests.push({
                deleteDimension: {
                  range: { sheetId: prodSheetId, dimension: 'ROWS', startIndex: r, endIndex: r + 1 },
                },
              });
            }
          }
          if (deleteRequests.length > 0) {
            await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: { requests: deleteRequests },
            });
          }
        }
      }

      // Append production rows
      const rows = buildProductionRows(result, idea, batchId);
      if (rows.length > 0) {
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: 'Production!A1',
          valueInputOption: 'RAW',
          requestBody: { values: rows },
        });
      }

      // Append/update captions
      const capIdeaIdsRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Captions!A:A',
      });
      const capIdeaIds = (capIdeaIdsRes.data.values || []).flat();
      const captionRow = buildCaptionsRow(result, idea, batchId);

      if (capIdeaIds.includes(idea.id)) {
        const capRowIndex = capIdeaIds.indexOf(idea.id) + 1;
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `Captions!A${capRowIndex}`,
          valueInputOption: 'RAW',
          requestBody: { values: [captionRow] },
        });
      } else {
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: 'Captions!A1',
          valueInputOption: 'RAW',
          requestBody: { values: [captionRow] },
        });
      }

      const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
      return NextResponse.json({
        success: true,
        data: { spreadsheetId, url, batchId, scenesCount: rows.length, action: existingRow ? 'updated' : 'created' },
      });
    }

    return NextResponse.json({ success: false, error: 'stage must be ideation or production' }, { status: 400 });
  } catch (error) {
    console.error('Pipeline sync error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// GET — return master pipeline sheet info
export async function GET() {
  try {
    const sheetId = await getSetting('master_pipeline_sheet_id');
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
