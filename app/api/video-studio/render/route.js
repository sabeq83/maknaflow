import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { createFfmpegStudioJob, getVideoById } from '@/lib/db';
import { triggerFfmpegStudioQueue } from '@/lib/video-studio-processor';

// BGM folder and initialization helper
const BGM_DIR = path.join(process.cwd(), 'public', 'bgm');
if (!fs.existsSync(BGM_DIR)) {
  fs.mkdirSync(BGM_DIR, { recursive: true });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      video_source_type,
      video_path,
      audio_source_type,
      audio_path,
      sync_option,
      bgm_file,
      bgm_volume,
      sfx_volume,
      video_scale
    } = body;

    // 1. Basic validation
    if (!video_source_type || !video_path) {
      return NextResponse.json({ success: false, error: 'Sumber video dan path video wajib diisi' }, { status: 400 });
    }
    if (!audio_source_type || !audio_path) {
      return NextResponse.json({ success: false, error: 'Sumber audio dan path audio wajib diisi' }, { status: 400 });
    }
    if (!sync_option || !['shortest', 'stretch', 'freeze', 'loop'].includes(sync_option)) {
      return NextResponse.json({ success: false, error: 'Strategi sinkronisasi tidak valid' }, { status: 400 });
    }

    // Parse input video paths (supports string, JSON array, or Array object)
    let videoInputList = [];
    if (Array.isArray(video_path)) {
      videoInputList = video_path;
    } else {
      try {
        const parsed = JSON.parse(video_path);
        videoInputList = Array.isArray(parsed) ? parsed : [video_path];
      } catch {
        videoInputList = [video_path];
      }
    }

    if (videoInputList.length === 0) {
      return NextResponse.json({ success: false, error: 'Daftar video tidak boleh kosong' }, { status: 400 });
    }

    // 2. Resolve paths for Database/Upload entries
    const resolvedVideoPaths = [];
    let resolvedAudioPath = audio_path;

    for (const vp of videoInputList) {
      if (video_source_type === 'database') {
        const videoEntry = await getVideoById(vp);
        if (!videoEntry) {
          return NextResponse.json({ success: false, error: `Video dengan ID '${vp}' tidak ditemukan di database` }, { status: 404 });
        }
        resolvedVideoPaths.push(videoEntry.local_path);
      } else if (video_source_type === 're_campaign') {
        // Format ID: "re::<itemId>::clip<N>"  → klip per-scene dari visual_clip_paths[N]
        //            "re::<itemId>::final"     → ffmpeg_output_path (video final gabungan)
        const parts = vp.split('::');
        // parts[0] = 're', parts[1] = itemId, parts[2] = 'clipN' atau 'final'
        const itemId = parts[1];
        const clipPart = parts[2] || 'final'; // default ke final jika tidak ada

        const { getDb } = await import('@/lib/db');
        const db = getDb();
        const item = await db.prepare('SELECT visual_clip_paths, ffmpeg_output_path, ffmpeg_status, visual_status FROM re_campaign_items WHERE id = ?').get(itemId);

        if (!item) {
          return NextResponse.json({ success: false, error: `RE Campaign item '${itemId}' tidak ditemukan` }, { status: 404 });
        }

        let resolvedPath;
        if (clipPart === 'final') {
          if (!item.ffmpeg_output_path || item.ffmpeg_status !== 'completed') {
            return NextResponse.json({ success: false, error: `Video final untuk item '${itemId}' belum selesai di-render FFmpeg` }, { status: 404 });
          }
          resolvedPath = path.join(process.cwd(), 'public', item.ffmpeg_output_path);
        } else {
          // clipPart = 'clip0', 'clip1', 'clip2', ...
          const clipIndex = parseInt(clipPart.replace('clip', ''), 10);
          let clipPaths = [];
          try { clipPaths = JSON.parse(item.visual_clip_paths || '[]'); } catch {}
          if (isNaN(clipIndex) || clipIndex >= clipPaths.length) {
            return NextResponse.json({ success: false, error: `Klip scene #${clipIndex} untuk item '${itemId}' tidak ditemukan (total: ${clipPaths.length} klip)` }, { status: 404 });
          }
          resolvedPath = path.join(process.cwd(), 'public', clipPaths[clipIndex]);
        }

        resolvedVideoPaths.push(resolvedPath);
      } else if (video_source_type === 'instant_factory') {
        // Format ID: "if::<campaign_id>::scene<N>" — abs_path sudah di-resolve di API campaign-videos
        // Kita re-resolve di sini via path yang dikirim langsung (abs_path sudah dikirim dari UI)
        // Atau kita pakai video_path yang sudah berupa fs_path (/public/...)
        const relPath = vp; // berupa "/path/to/clip.mp4" atau absolute
        const absPath = path.isAbsolute(relPath) ? relPath : path.join(process.cwd(), 'public', relPath);
        resolvedVideoPaths.push(absPath);
      } else {
        resolvedVideoPaths.push(vp);
      }
    }

    if (audio_source_type === 'database') {
      const audioEntry = await getVideoById(audio_path);
      if (!audioEntry) {
        return NextResponse.json({ success: false, error: `Audio dengan ID '${audio_path}' tidak ditemukan di database` }, { status: 404 });
      }
      resolvedAudioPath = audioEntry.local_path;
    }

    // Double check files exist on disk
    for (const rvp of resolvedVideoPaths) {
      const absoluteVideoPath = path.isAbsolute(rvp) ? rvp : path.join(process.cwd(), rvp);
      if (!fs.existsSync(absoluteVideoPath)) {
        return NextResponse.json({ success: false, error: `File video tidak ditemukan di server: ${rvp}` }, { status: 400 });
      }
    }

    if (audio_source_type !== 'tts_studio') {
      const absoluteAudioPath = path.isAbsolute(resolvedAudioPath) ? resolvedAudioPath : path.join(process.cwd(), resolvedAudioPath);
      if (!fs.existsSync(absoluteAudioPath)) {
        return NextResponse.json({ success: false, error: `File audio tidak ditemukan di server: ${resolvedAudioPath}` }, { status: 400 });
      }
    } else {
      const { getTtsBatchWithClips } = await import('@/lib/db');
      const batchData = await getTtsBatchWithClips(resolvedAudioPath);
      if (!batchData) {
        return NextResponse.json({ success: false, error: `Batch TTS Studio '${resolvedAudioPath}' tidak ditemukan` }, { status: 400 });
      }
    }

    // 3. Resolve BGM path
    let bgmPath = null;
    if (bgm_file) {
      bgmPath = path.join('public', 'bgm', bgm_file);
      const absoluteBgmPath = path.join(process.cwd(), bgmPath);
      
      // Auto create dummy sine BGM if selected file doesn't exist
      if (!fs.existsSync(absoluteBgmPath)) {
        try {
          console.log(`[Video Studio Render API] BGM file not found, creating dummy file: ${bgm_file}`);
          const execSync = require('child_process').execSync;
          // Generate a 30s silence with some very quiet low rumble as BGM using lavfi
          execSync(`ffmpeg -y -f lavfi -i "anullsrc=r=44100:cl=stereo" -t 30 -q:a 9 "${absoluteBgmPath}"`);
        } catch (e) {
          console.warn(`[Video Studio Render API] Failed to create dummy BGM:`, e.message);
          bgmPath = null; // reset to none if we failed to create it
        }
      }
    }

    // 4. Create Job Record
    const jobId = `fsj_${uuidv4().replace(/-/g, '').substring(0, 12)}`;
    const jobRecord = {
      id: jobId,
      video_source_type,
      video_path: JSON.stringify(resolvedVideoPaths),
      audio_source_type,
      audio_path: resolvedAudioPath,
      sync_option,
      bgm_path: bgmPath,
      bgm_volume: bgm_volume !== undefined ? parseFloat(bgm_volume) : 0.15,
      sfx_volume: sfx_volume !== undefined ? parseFloat(sfx_volume) : 0.0,
      video_scale: video_scale !== undefined ? parseFloat(video_scale) : 1.0,
      output_path: null,
      status: 'pending',
      error_log: null
    };

    await createFfmpegStudioJob(jobRecord);

    // 5. Trigger Queue Runner asynchronously
    triggerFfmpegStudioQueue();

    return NextResponse.json({
      success: true,
      message: 'Pekerjaan rendering berhasil dimasukkan ke dalam antrean.',
      data: {
        job_id: jobId,
        status: 'pending'
      }
    });

  } catch (error) {
    console.error('[Video Studio Render API] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
