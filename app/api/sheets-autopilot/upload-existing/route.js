import { NextResponse } from 'next/server';
import { getDb, updateSheetsJobStatus } from '@/lib/db';
import { uploadLocalFileToFolder, uploadMarkdownToCampaignFolder } from '@/lib/drive-uploader';
import { buildMarkdownContent } from '@/lib/sheets-autopilot-worker';
import fs from 'fs';
import path from 'path';

export async function GET(request) {
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
    // The individual audio clips are tts_autopilot_RE_... mp3
    const filesInTemp = fs.readdirSync(tempDir);
    const audioClips = filesInTemp.filter(f => f.startsWith(`tts_autopilot_${batchId}_clip_`) && (f.endsWith('.mp3') || f.endsWith('.wav')));
    
    for (const file of audioClips) {
      const absPath = path.join(tempDir, file);
      const ext = path.extname(file) || '.mp3';
      const clipNum = file.match(/_clip_(\d+)/)?.[1];
      const targetName = `${batchId}_audio_clip_${Number(clipNum) + 1}${ext}`;
      const mimeType = ext === '.wav' ? 'audio/wav' : 'audio/mpeg';
      
      uploadLogs.push(`Mengunggah klip audio: ${targetName}`);
      await uploadLocalFileToFolder(absPath, targetName, folderId, mimeType);
    }

    // 4. Upload individual video clips
    const videoClips = filesInTemp.filter(f => f.startsWith(`temp_clip_${batchId}_`) && f.endsWith('.mp4'));
    for (const file of videoClips) {
      const absPath = path.join(tempDir, file);
      const clipNum = file.match(/_(\d+)\.mp4/)?.[1];
      const targetName = `${batchId}_video_clip_${clipNum}.mp4`;
      
      uploadLogs.push(`Mengunggah klip video: ${targetName}`);
      await uploadLocalFileToFolder(absPath, targetName, folderId, 'video/mp4');
    }

    // 5. Compile and upload naskah.md
    const promptsObj = job.prompts_json ? JSON.parse(job.prompts_json) : {};
    const captionsObj = job.captions_json ? JSON.parse(job.captions_json) : {};
    
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
}
