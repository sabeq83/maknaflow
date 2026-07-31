import { NextResponse } from 'next/server';
import { parseGeminiJSON } from '@/lib/json-parser';
import { getAllKnowledgeBasesWithContent, createReverseResult } from '@/lib/db';
import { uploadVideoToGemini, generateWithVideo } from '@/lib/gemini';
import { buildReverseEngineeringPrompt } from '@/lib/prompts';
import { downloadFromUrl, cleanupTempFile } from '@/lib/video-downloader';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

const TEMP_DIR = path.join(process.cwd(), 'data', 'temp');

export async function POST(request) {
  let tempFilePath = null;

  try {
    const contentType = request.headers.get('content-type') || '';
    let sourceType, sourceUrl, videoFilename, customInstruction, promptOutputFormat, aspectRatio, targetAi;

    if (contentType.includes('multipart/form-data')) {
      // ===== PATH A: File Upload =====
      const formData = await request.formData();
      const file = formData.get('file');
      customInstruction = formData.get('custom_instruction') || '';
      aspectRatio = formData.get('aspect_ratio') || '9:16';
      targetAi = formData.get('target_ai') || 'Google Veo (8s)';
      promptOutputFormat = formData.get('prompt_output_format') || 'plain_text';

      if (!file || !file.size) {
        return NextResponse.json({ success: false, error: 'File video wajib diupload' }, { status: 400 });
      }

      // Save to temp
      if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

      const filename = `upload_${Date.now()}_${file.name}`;
      tempFilePath = path.join(TEMP_DIR, filename);

      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(tempFilePath, buffer);

      sourceType = 'upload';
      sourceUrl = '';
      videoFilename = file.name;
    } else {
      // ===== PATH B: URL Download =====
      const body = await request.json();
      const { video_url, custom_instruction, aspect_ratio, target_ai, prompt_output_format } = body;
      customInstruction = custom_instruction || '';
      aspectRatio = aspect_ratio || '9:16';
      targetAi = target_ai || 'Google Veo (8s)';
      promptOutputFormat = prompt_output_format || 'plain_text';

      if (!video_url) {
        return NextResponse.json({ success: false, error: 'URL video wajib diisi' }, { status: 400 });
      }

      const downloaded = await downloadFromUrl(video_url);
      tempFilePath = downloaded.filePath;
      sourceType = 'url';
      sourceUrl = video_url;
      videoFilename = downloaded.filename;
    }

    // Get mime type
    const ext = path.extname(tempFilePath).toLowerCase();
    const mimeMap = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska' };
    const mimeType = mimeMap[ext] || 'video/mp4';

    // Upload to Gemini File API
    const uploadedFile = await uploadVideoToGemini(tempFilePath, mimeType);

    // Read all KBs
    const kbs = await getAllKnowledgeBasesWithContent();
    if (kbs.length === 0) {
      cleanupTempFile(tempFilePath);
      return NextResponse.json({ success: false, error: 'Belum ada Knowledge Base.' }, { status: 400 });
    }

    // Build prompt
    const prompt = buildReverseEngineeringPrompt(
      kbs.map(kb => ({ name: kb.name, content: kb.content })),
      { custom_instruction: customInstruction, aspect_ratio: aspectRatio, target_ai: targetAi, prompt_output_format: promptOutputFormat }
    );

    // Call Gemini with video
    const responseText = await generateWithVideo(uploadedFile.fileUri, uploadedFile.mimeType, prompt);

    let parsed;
    try {
      parsed = parseGeminiJSON(responseText);
    } catch (parseError) {
      cleanupTempFile(tempFilePath);
      return NextResponse.json({
        success: false,
        error: `Gagal mem-parsing respons Gemini: ${parseError.message}. Coba lagi.`,
      }, { status: 500 });
    }

    // Save to DB
    const result = {
      id: uuidv4(),
      source_type: sourceType,
      source_url: sourceUrl || '',
      video_filename: videoFilename,
      custom_instruction: customInstruction,
      aspect_ratio: aspectRatio,
      target_ai: targetAi,
      prompt_output_format: promptOutputFormat,
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

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        storyboard: parsed.storyboard,
        voiceover: parsed.voiceover,
        t2v_prompts: parsed.t2v_prompts,
      },
    });
  } catch (error) {
    cleanupTempFile(tempFilePath);
    console.error('Reverse engineering error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
