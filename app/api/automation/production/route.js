import { NextResponse } from 'next/server';
import { parseGeminiJSON } from '@/lib/json-parser';
import { getIdea, getAllKnowledgeBasesWithContent, createAsset, updateIdeaStatus, getAsset, getSetting } from '@/lib/db';
import { getGeminiModel } from '@/lib/gemini';
import { buildProductionPrompt } from '@/lib/prompts';
import { v4 as uuidv4 } from 'uuid';
import { google } from 'googleapis';
import { getAuthorizedClient } from '@/lib/google-auth';
import {
  generateBatchId, PIPELINE_HEADERS,
  buildIdeationRow, buildProductionRows, buildCaptionsRow,
} from '@/lib/export-builder';

/**
 * Automation Production: Generate production assets + auto-sync to Pipeline Sheet
 * N8N calls this single endpoint with an idea_id.
 */
export async function POST(request) {
  try {
    const { idea_id } = await request.json();

    if (!idea_id) {
      return NextResponse.json({ success: false, error: 'idea_id wajib diisi' }, { status: 400 });
    }

    // 1. Get the idea
    const idea = await getIdea(idea_id);
    if (!idea) {
      return NextResponse.json({ success: false, error: 'Idea tidak ditemukan' }, { status: 404 });
    }

    // 2. Generate production via Gemini
    const kbs = await getAllKnowledgeBasesWithContent();
    if (kbs.length === 0) {
      return NextResponse.json({ success: false, error: 'Belum ada Knowledge Base.' }, { status: 400 });
    }

    const outputFormat = idea.prompt_output_format || 'json';
    const prompt = buildProductionPrompt(
      kbs.map(kb => ({ name: kb.name, content: kb.content })),
      idea,
      { prompt_output_format: outputFormat }
    );

    const model = await getGeminiModel();
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    let parsed;
    try {
      parsed = parseGeminiJSON(responseText);
    } catch (parseError) {
      return NextResponse.json({ success: false, error: parseError.message }, { status: 500 });
    }

    // 3. Save asset to DB
    const asset = {
      asset_id: uuidv4(),
      idea_id,
      storyboard: JSON.stringify(parsed.storyboard || []),
      t2i_prompts: JSON.stringify(parsed.t2i_prompts || []),
      i2v_prompts: JSON.stringify(parsed.i2v_prompts || []),
      tiktok_caption: parsed.tiktok_caption || '',
      ig_caption: parsed.ig_caption || '',
      yt_title: parsed.yt_title || '',
      yt_desc: parsed.yt_desc || '',
      raw_response: responseText,
    };
    await createAsset(asset);
    await updateIdeaStatus(idea_id, 'Generated');

    // 4. Auto-sync to Pipeline Sheet
    let pipelineResult = null;
    const tokensStr = await getSetting('google_tokens');

    if (tokensStr) {
      try {
        const auth = getAuthorizedClient();
        const sheets = google.sheets({ version: 'v4', auth });

        let spreadsheetId = await getSetting('master_pipeline_sheet_id');
        if (spreadsheetId) {
          try { await sheets.spreadsheets.get({ spreadsheetId }); }
          catch { spreadsheetId = null; }
        }

        if (!spreadsheetId) {
          const created = await sheets.spreadsheets.create({
            requestBody: {
              properties: { title: 'MAKNA — Master Pipeline' },
              sheets: [
                { properties: { title: 'Ideation', index: 0 } },
                { properties: { title: 'Production', index: 1 } },
                { properties: { title: 'Captions', index: 2 } },
              ],
            },
          });
          spreadsheetId = created.data.spreadsheetId;
          const { setSetting } = await import('@/lib/db');
          await setSetting('master_pipeline_sheet_id', spreadsheetId);

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
        }

        // Find or create batch_id for this idea
        const ideaIdsRes = await sheets.spreadsheets.values.get({
          spreadsheetId, range: 'Ideation!A:B',
        });
        const ideaRows = ideaIdsRes.data.values || [];
        let batchId;
        const existingRow = ideaRows.find(row => row[0] === idea.id);

        if (existingRow) {
          batchId = existingRow[1];
          // Update pipeline_status to 'produced'
          const rowIndex = ideaRows.indexOf(existingRow) + 1;
          await sheets.spreadsheets.values.update({
            spreadsheetId, range: `Ideation!L${rowIndex}`,
            valueInputOption: 'RAW',
            requestBody: { values: [['produced']] },
          });
        } else {
          // Auto-create ideation row
          const existingBatchIds = ideaRows.map(r => r[1]).filter(v => v && v.startsWith('B-'));
          batchId = generateBatchId(existingBatchIds);
          await sheets.spreadsheets.values.append({
            spreadsheetId, range: 'Ideation!A1', valueInputOption: 'RAW',
            requestBody: { values: [buildIdeationRow(idea, batchId)] },
          });
        }

        // Prepare result for row building
        const storyboard = parsed.storyboard || [];
        const fullResult = {
          ...asset,
          storyboard,
          voiceover: storyboard.map((s, i) => ({
            scene: s.scene || i + 1,
            narration: s.narration || '',
            duration: s.duration || '',
          })),
          t2i_prompts: parsed.t2i_prompts || [],
          i2v_prompts: parsed.i2v_prompts || [],
          tiktok_caption: parsed.tiktok_caption || '',
          ig_caption: parsed.ig_caption || '',
          yt_title: parsed.yt_title || '',
          yt_desc: parsed.yt_desc || '',
        };

        // Append production rows
        const prodRows = buildProductionRows(fullResult, idea, batchId);
        if (prodRows.length > 0) {
          await sheets.spreadsheets.values.append({
            spreadsheetId, range: 'Production!A1', valueInputOption: 'RAW',
            requestBody: { values: prodRows },
          });
        }

        // Append captions
        const captionRow = buildCaptionsRow(fullResult, idea, batchId);
        await sheets.spreadsheets.values.append({
          spreadsheetId, range: 'Captions!A1', valueInputOption: 'RAW',
          requestBody: { values: [captionRow] },
        });

        pipelineResult = {
          synced: true,
          batch_id: batchId,
          scenes_count: prodRows.length,
          pipeline_sheet_url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
        };
      } catch (syncErr) {
        pipelineResult = { synced: false, error: syncErr.message };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        asset_id: asset.asset_id,
        idea_id,
        scenes_count: (parsed.storyboard || []).length,
        pipeline: pipelineResult,
      },
    });
  } catch (error) {
    console.error('Automation production error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
