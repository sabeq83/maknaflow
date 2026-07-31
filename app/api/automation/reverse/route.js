import { NextResponse } from 'next/server';
import { parseGeminiJSON } from '@/lib/json-parser';
import { getAllKnowledgeBasesWithContent, createReverseResult, getSetting, setSetting } from '@/lib/db';
import { uploadVideoToGemini, generateWithVideo } from '@/lib/gemini';
import { buildReverseEngineeringPrompt } from '@/lib/prompts';
import { downloadFromUrl, cleanupTempFile } from '@/lib/video-downloader';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { google } from 'googleapis';
import { getAuthorizedClient } from '@/lib/google-auth';
import {
  generateREBatchId, RE_PIPELINE_HEADERS,
  buildREResultRow, buildREStoryboardRows, buildREVoiceoverRows,
  buildREPromptRows, buildRECaptionsRow,
} from '@/lib/export-builder';

const TEMP_DIR = path.join(process.cwd(), 'data', 'temp');

/**
 * Automation Reverse Engineering: Download video + RE via Gemini + auto-sync to Master RE Sheet
 */
export async function POST(request) {
  let tempFilePath = null;

  try {
    const body = await request.json();
    const {
      source_url,
      custom_instruction = '',
      aspect_ratio = '9:16',
      target_ai = 'Google Veo (8s)',
      prompt_output_format = 'json',
    } = body;

    if (!source_url) {
      return NextResponse.json({ success: false, error: 'source_url wajib diisi' }, { status: 400 });
    }

    // 1. Download video
    const downloaded = await downloadFromUrl(source_url);
    tempFilePath = downloaded.filePath;
    const videoFilename = downloaded.filename;

    // Get mime type
    const ext = path.extname(tempFilePath).toLowerCase();
    const mimeMap = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska' };
    const mimeType = mimeMap[ext] || 'video/mp4';

    // 2. Upload to Gemini
    const uploadedFile = await uploadVideoToGemini(tempFilePath, mimeType);

    // Read KBs
    const kbs = await getAllKnowledgeBasesWithContent();
    if (kbs.length === 0) {
      cleanupTempFile(tempFilePath);
      return NextResponse.json({ success: false, error: 'Belum ada Knowledge Base.' }, { status: 400 });
    }

    // Build prompt
    const prompt = buildReverseEngineeringPrompt(
      kbs.map(kb => ({ name: kb.name, content: kb.content })),
      { custom_instruction, aspect_ratio, target_ai, prompt_output_format }
    );

    // 3. Generate with Gemini
    const responseText = await generateWithVideo(uploadedFile.fileUri, uploadedFile.mimeType, prompt);

    let parsed;
    try {
      parsed = parseGeminiJSON(responseText);
    } catch (parseError) {
      cleanupTempFile(tempFilePath);
      return NextResponse.json({ success: false, error: parseError.message }, { status: 500 });
    }

    // 4. Save to DB
    const result = {
      id: uuidv4(),
      source_type: 'url',
      source_url: source_url || '',
      video_filename: videoFilename,
      custom_instruction,
      aspect_ratio,
      target_ai,
      prompt_output_format,
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

    // Prepare parsed result for pipeline
    const fullResult = {
      ...result,
      storyboard: parsed.storyboard || [],
      voiceover: parsed.voiceover || [],
      t2v_prompts: parsed.t2v_prompts || [],
    };

    // 5. Auto-sync to Master RE Sheet
    let pipelineResult = null;
    const tokensStr = await getSetting('google_tokens');

    if (tokensStr) {
      try {
        const auth = getAuthorizedClient();
        const sheets = google.sheets({ version: 'v4', auth });

        let spreadsheetId = await getSetting('master_re_sheet_id');
        if (spreadsheetId) {
          try { await sheets.spreadsheets.get({ spreadsheetId }); }
          catch { spreadsheetId = null; }
        }

        if (!spreadsheetId) {
          const created = await sheets.spreadsheets.create({
            requestBody: {
              properties: { title: 'MAKNA — Master RE' },
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
        }

        // Generate batch ID
        const existingRes = await sheets.spreadsheets.values.get({
          spreadsheetId, range: 'RE Results!B:B',
        });
        const existingIds = (existingRes.data.values || []).flat().filter(v => v && v.startsWith('RE-'));
        const batchId = generateREBatchId(existingIds);

        // Append all data
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

        pipelineResult = {
          synced: true,
          batch_id: batchId,
          scenes_count: storyboardRows.length,
          re_sheet_url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
        };
      } catch (syncErr) {
        pipelineResult = { synced: false, error: syncErr.message };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        re_id: result.id,
        video_filename: videoFilename,
        scenes_count: (parsed.storyboard || []).length,
        pipeline: pipelineResult,
      },
    });
  } catch (error) {
    cleanupTempFile(tempFilePath);
    console.error('Automation reverse error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
