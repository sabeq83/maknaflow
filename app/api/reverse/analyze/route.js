import { NextResponse } from 'next/server';
import { parseGeminiJSON } from '@/lib/json-parser';
import { getAllKnowledgeBasesWithContent, createReverseResult, getVideoById, updateVideoLibraryEntry, getSetting, setSetting } from '@/lib/db';
import { uploadVideoToGemini, generateWithVideo } from '@/lib/gemini';
import { buildReverseEngineeringPrompt } from '@/lib/prompts';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { google } from 'googleapis';
import { getAuthorizedClient } from '@/lib/google-auth';
import {
  generateREBatchId, RE_PIPELINE_HEADERS,
  buildREResultRow, buildREStoryboardRows, buildREVoiceoverRows,
  buildREPromptRows, buildRECaptionsRow, buildMarkdownContent,
} from '@/lib/export-builder';
import { uploadREMarkdownToDrive } from '@/lib/drive-uploader';

/**
 * POST /api/reverse/analyze
 * Decoupled RE: Analyze a video already in the library by video_id.
 * Used by UI (Gallery → Analyze) and n8n Webhook 2.
 */
export async function POST(request) {
  try {
    const { video_id, custom_instruction, aspect_ratio, target_ai, prompt_output_format } = await request.json();

    if (!video_id) {
      return NextResponse.json({ success: false, error: 'video_id wajib diisi' }, { status: 400 });
    }

    // 1. Lookup video in library
    const video = await getVideoById(video_id);
    if (!video) {
      return NextResponse.json({ success: false, error: 'Video not found in library' }, { status: 404 });
    }
    if (video.status !== 'ready') {
      return NextResponse.json({ success: false, error: `Video status is '${video.status}', must be 'ready'` }, { status: 400 });
    }

    // 2. Get mime type from file
    const ext = path.extname(video.local_path).toLowerCase();
    const mimeMap = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska' };
    const mimeType = mimeMap[ext] || video.mime_type || 'video/mp4';

    // 3. Upload to Gemini File API (directly from local path)
    const uploadedFile = await uploadVideoToGemini(video.local_path, mimeType);

    // 4. Read KBs
    const kbs = await getAllKnowledgeBasesWithContent();
    if (kbs.length === 0) {
      return NextResponse.json({ success: false, error: 'Belum ada Knowledge Base.' }, { status: 400 });
    }

    // 5. Build prompt & generate
    const config = {
      custom_instruction: custom_instruction || '',
      aspect_ratio: aspect_ratio || '9:16',
      target_ai: target_ai || 'Google Veo (8s)',
      prompt_output_format: prompt_output_format || 'plain_text',
    };

    const prompt = buildReverseEngineeringPrompt(
      kbs.map(kb => ({ name: kb.name, content: kb.content })),
      config
    );

    const responseText = await generateWithVideo(uploadedFile.fileUri, uploadedFile.mimeType, prompt);

    let parsed;
    try {
      parsed = parseGeminiJSON(responseText);
    } catch (parseError) {
      return NextResponse.json({ success: false, error: `Parse error: ${parseError.message}` }, { status: 500 });
    }

    // 6. Save to reverse_results DB
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

    // Link RE result back to video library entry
    await updateVideoLibraryEntry(video_id, { re_id: result.id, status: 'analyzed' });

    // 7. Auto-sync to Google Sheets + Drive
    const fullResult = {
      ...result,
      storyboard: parsed.storyboard || [],
      voiceover: parsed.voiceover || [],
      t2v_prompts: parsed.t2v_prompts || [],
    };

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

        // Upload Markdown to Drive
        let driveUrl = null;
        try {
          const markdownContent = buildMarkdownContent(fullResult, batchId);
          const filename = `${batchId}.md`;
          const uploaded = await uploadREMarkdownToDrive(markdownContent, filename);
          driveUrl = uploaded.driveUrl;
        } catch (mdErr) {
          console.error('Failed to upload Markdown to Drive:', mdErr);
        }

        pipelineResult = {
          synced: true,
          batch_id: batchId,
          scenes_count: storyboardRows.length,
          re_sheet_url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
          drive_url: driveUrl,
        };
      } catch (syncErr) {
        pipelineResult = { synced: false, error: syncErr.message };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        re_id: result.id,
        video_id: video_id,
        video_filename: video.filename,
        scenes_count: (parsed.storyboard || []).length,
        pipeline: pipelineResult,
      },
    });
  } catch (error) {
    console.error('RE Analyze error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
