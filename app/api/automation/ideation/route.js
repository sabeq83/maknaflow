import { NextResponse } from 'next/server';
import { parseGeminiJSON } from '@/lib/json-parser';
import { getAllKnowledgeBasesWithContent, createIdea, getSetting } from '@/lib/db';
import { getGeminiModel } from '@/lib/gemini';
import { buildIdeationPrompt } from '@/lib/prompts';
import { v4 as uuidv4 } from 'uuid';
import { google } from 'googleapis';
import { getAuthorizedClient } from '@/lib/google-auth';
import {
  generateBatchId, PIPELINE_HEADERS,
  buildIdeationRow,
} from '@/lib/export-builder';

/**
 * Automation Ideation: Generate ideas + auto-sync to Pipeline Sheet
 * N8N calls this single endpoint to do both.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      product_name,
      product_description = '',
      jumlah_ide = 3,
      jumlah_klip = 5,
      narrative_mode = 'Psikodrama',
      visual_style = 'UGC',
      words_per_clip = '15-16 Words',
      target_ai = 'Veo',
      face_visibility = 'Faceless',
      aspect_ratio = '9:16 Vertical',
      instruksi_tambahan = '',
      prompt_output_format = 'json',
    } = body;

    if (!product_name) {
      return NextResponse.json({ success: false, error: 'product_name wajib diisi' }, { status: 400 });
    }

    // 1. Generate ideas via Gemini
    const kbs = await getAllKnowledgeBasesWithContent();
    if (kbs.length === 0) {
      return NextResponse.json({ success: false, error: 'Belum ada Knowledge Base. Upload di Settings.' }, { status: 400 });
    }

    const prompt = buildIdeationPrompt(
      kbs.map(kb => ({ name: kb.name, content: kb.content })),
      { product_name, product_description },
      { jumlah_ide, jumlah_klip, narrative_mode, visual_style, words_per_clip, target_ai, face_visibility, aspect_ratio, instruksi_tambahan }
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

    // 2. Save ideas to DB
    const savedIdeas = [];
    const kbNames = kbs.map(kb => kb.name).join(', ');

    for (const ideaData of parsed.ideas || [parsed]) {
      const idea = {
        id: uuidv4(),
        topik: ideaData.topik || '',
        konteks_cep: ideaData.konteks_cep || '',
        vfo: ideaData.vfo || '',
        key_messages: ideaData.key_messages || '',
        kb_digunakan: kbNames,
        jumlah_klip: jumlah_klip || 5,
        narrative_mode: narrative_mode || '',
        visual_style: visual_style || '',
        words_per_clip: words_per_clip || '',
        target_ai: target_ai || '',
        face_visibility: face_visibility || '',
        aspect_ratio: aspect_ratio || '',
        instruksi_tambahan: instruksi_tambahan || '',
        product_name,
        product_description: product_description || '',
        jumlah_ide: jumlah_ide || 1,
        prompt_output_format: prompt_output_format || 'json',
        raw_response: responseText,
        status: 'Draft',
      };
      await createIdea(idea);
      savedIdeas.push(idea);
    }

    // 3. Auto-sync to Pipeline Sheet (if Google connected)
    let pipelineResult = null;
    const tokensStr = await getSetting('google_tokens');

    if (tokensStr) {
      try {
        const auth = getAuthorizedClient();
        const sheets = google.sheets({ version: 'v4', auth });

        // Get or create Master Pipeline Sheet
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
          const { setSetting: setS } = await import('@/lib/db');
          setS('master_pipeline_sheet_id', spreadsheetId);

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

        // Get existing batch IDs
        const existingRes = await sheets.spreadsheets.values.get({
          spreadsheetId, range: 'Ideation!B:B',
        });
        const existingBatchIds = (existingRes.data.values || []).flat().filter(v => v && v.startsWith('B-'));

        // Sync each idea
        const batchIds = [];
        for (const idea of savedIdeas) {
          const batchId = generateBatchId([...existingBatchIds, ...batchIds]);
          batchIds.push(batchId);

          await sheets.spreadsheets.values.append({
            spreadsheetId, range: 'Ideation!A1', valueInputOption: 'RAW',
            requestBody: { values: [buildIdeationRow(idea, batchId)] },
          });
        }

        pipelineResult = {
          synced: true,
          batch_ids: batchIds,
          pipeline_sheet_url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
        };
      } catch (syncErr) {
        pipelineResult = { synced: false, error: syncErr.message };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ideas_count: savedIdeas.length,
        idea_ids: savedIdeas.map(i => i.id),
        ideas: savedIdeas.map(i => ({ id: i.id, topik: i.topik, product_name: i.product_name })),
        pipeline: pipelineResult,
      },
    });
  } catch (error) {
    console.error('Automation ideation error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
