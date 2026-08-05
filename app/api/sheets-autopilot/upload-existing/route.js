import { NextResponse } from 'next/server';
import { getDb, updateSheetsJobStatus } from '@/lib/db';
import { uploadLocalFileToFolder, uploadMarkdownToCampaignFolder } from '@/lib/drive-uploader';
import { buildMarkdownContent } from '@/lib/sheets-autopilot-worker';
import fs from 'fs';
import path from 'path';

import { withTenantContext } from '@/lib/auth';

export const GET = withTenantContext(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');

    if (!batchId) {
      return NextResponse.json({ success: false, error: 'batchId wajib disertakan.' }, { status: 400 });
    }

    const db = getDb();
    
    // 1. Fetch job details
    const job = await db.prepare("SELECT * FROM sheets_jobs WHERE batch_id = ? ORDER BY created_at DESC LIMIT 1").get(batchId);
    if (!job) {
      return NextResponse.json({ success: false, error: `Job untuk batch ID ${batchId} tidak ditemukan.` }, { status: 404 });
    }

    if (!job.gdrive_folder_url) {
      return NextResponse.json({ success: false, error: `Google Drive Folder URL belum diinisialisasi untuk batch ${batchId}.` }, { status: 400 });
    }

    // Extract folder ID from URL
    let folderId = job.gdrive_folder_url.split('/').pop();
    if (folderId.includes('?')) {
      folderId = folderId.split('?')[0];
    }

    console.log(`[Forced Upload] Starting upload of existing assets for ${batchId} to folder ${folderId}...`);
    const tempDir = path.join(process.cwd(), 'public', 'temp');
    const uploadLogs = [];

    // 2. Upload combined audio & video (check _final first, fallback to old name)
    let finalVideo = path.join(tempDir, `final_video_${batchId}_final.mp4`);
    if (!fs.existsSync(finalVideo)) {
      finalVideo = path.join(tempDir, `final_video_${batchId}.mp4`);
    }
    if (fs.existsSync(finalVideo)) {
      uploadLogs.push(`Mengunggah final video: ${batchId}_video_final.mp4`);
      await uploadLocalFileToFolder(finalVideo, `${batchId}_video_final.mp4`, folderId, 'video/mp4');
    }

    let finalAudio = path.join(tempDir, `tts_combined_${batchId}_final.mp3`);
    if (!fs.existsSync(finalAudio)) {
      finalAudio = path.join(tempDir, `tts_combined_${batchId}.mp3`);
    }
    if (fs.existsSync(finalAudio)) {
      uploadLogs.push(`Mengunggah final audio: ${batchId}_audio_final.mp3`);
      await uploadLocalFileToFolder(finalAudio, `${batchId}_audio_final.mp3`, folderId, 'audio/mpeg');
    }

    // 3. Upload individual audio clips
    const filesInTemp = fs.readdirSync(tempDir);
    const targetAudioPrefix = `tts_autopilot_${job.campaign_id.split('_')[0] || 'RE'}_${batchId}_clip_`;
    
    for (const f of filesInTemp) {
      if (f.startsWith(targetAudioPrefix) && f.endsWith('.mp3')) {
        const fullP = path.join(tempDir, f);
        uploadLogs.push(`Mengunggah audio klip individual: ${f}`);
        await uploadLocalFileToFolder(fullP, f, folderId, 'audio/mpeg');
      }
    }

    // 4. Upload individual video clips
    const storyboardResult = {
      storyboard: JSON.parse(job.storyboard || '[]'),
      voiceover: JSON.parse(job.voiceover || '[]'),
      t2v_prompts: promptsObj.t2v_prompts || [],
      t2i_prompts: promptsObj.t2i_prompts || [],
      i2v_prompts: promptsObj.i2v_prompts || [],
      tiktok_caption: captionsObj.tiktok_caption || '',
      ig_caption: captionsObj.ig_caption || '',
      yt_title: captionsObj.yt_title || '',
      yt_desc: captionsObj.yt_desc || '',
    };

    const markdownContent = buildMarkdownContent(storyboardResult, batchId);
    uploadLogs.push('Memperbarui naskah.md di Google Drive...');
    await uploadMarkdownToCampaignFolder(markdownContent, 'naskah.md', folderId);

    return NextResponse.json({
      success: true,
      message: `Proses upload aset asisten selesai untuk batch ${batchId}.`,
      logs: uploadLogs
    });

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
