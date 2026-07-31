import ffmpeg from 'fluent-ffmpeg';
import ffprobe from 'ffprobe-static';
import path from 'path';
import fs from 'fs';
import { getMediaDuration, resolveLocalPath } from './video-studio-processor.js';

// Setup ffprobe path (handling Next.js Turbopack /ROOT packaging path issue)
function getFfprobePath() {
  let p = ffprobe.path;
  if (p.startsWith('/ROOT/')) {
    p = path.join(process.cwd(), p.substring(6));
  } else if (p.startsWith('/ROOT')) {
    p = path.join(process.cwd(), p.substring(5));
  }
  
  if (!fs.existsSync(p)) {
    const platform = process.platform;
    const arch = process.arch;
    const manualPath = path.join(process.cwd(), 'node_modules', 'ffprobe-static', 'bin', platform, arch, platform === 'win32' ? 'ffprobe.exe' : 'ffprobe');
    if (fs.existsSync(manualPath)) {
      return manualPath;
    }
  }
  return p;
}

ffmpeg.setFfprobePath(getFfprobePath());

/**
 * Menganalisis durasi media dan mengembalikan opsi sinkronisasi target berdasarkan Smart Decision Tree.
 * @param {Object} params - Parameter
 * @param {string} params.videoPath - Path file video mentah
 * @param {string} params.audioPath - Path file audio VO mentah
 * @param {number} params.currentClipIndex - Indeks klip saat ini (1 s/d N)
 * @param {number} params.bridgeAtClip - Titik transisi bridging (X)
 * @returns {Promise<string>} Opsi sinkronisasi ('stretch', 'shortest', 'freeze', 'loop')
 */
export async function determineSmartSyncOption(params, mediaDurationGetter = getMediaDuration) {
  const { videoPath, audioPath, currentClipIndex, bridgeAtClip } = params;
  
  const videoDuration = await mediaDurationGetter(videoPath);
  const audioDuration = await mediaDurationGetter(audioPath);
  const durationDiff = videoDuration - audioDuration;

  console.log(`⏱️ [SmartSync Klip ${currentClipIndex}] Durasi Video: ${videoDuration}s | Durasi Suara: ${audioDuration}s (Selisih: ${durationDiff.toFixed(2)}s)`);

  // Kasus 1: Perbedaan durasi mikro (± 2 detik) -> Symmetrical Speed Stretch
  if (Math.abs(durationDiff) <= 2.0) {
    return 'stretch';
  }

  // Kasus 2: Video jauh lebih panjang (Selisih > 2 detik)
  if (durationDiff > 2.0) {
    const isHookZone = currentClipIndex < bridgeAtClip;
    return isHookZone ? 'shortest' : 'freeze';
  }

  // Kasus 3: Audio jauh lebih panjang (Selisih < -2 detik) -> Infinite Video Looping
  return 'loop';
}

/**
 * Smart Audio-Video Muxing Engine
 * Mengambil keputusan edit secara otonom berdasarkan durasi media dan posisi adegan
 * @param {Object} params - Parameter konfigurasi
 * @param {string} params.videoPath - Path video mentah
 * @param {string} params.audioPath - Path audio VO mentah
 * @param {string} params.outputPath - Path hasil render final klip
 * @param {number} params.currentClipIndex - Indeks klip saat ini (1 s/d N)
 * @param {number} params.bridgeAtClip - Titik transisi bridging (X)
 */
export async function runSmartSyncMux(params) {
  const { videoPath, audioPath, outputPath, currentClipIndex, bridgeAtClip } = params;

  const resolvedVideo = resolveLocalPath(videoPath);
  const resolvedAudio = resolveLocalPath(audioPath);
  const resolvedOutput = resolveLocalPath(outputPath);

  const videoDuration = await getMediaDuration(resolvedVideo);
  const audioDuration = await getMediaDuration(resolvedAudio);
  const durationDiff = videoDuration - audioDuration;

  const option = await determineSmartSyncOption({
    videoPath: resolvedVideo,
    audioPath: resolvedAudio,
    currentClipIndex,
    bridgeAtClip
  });

  if (option === 'stretch') {
    const speedFactor = audioDuration / videoDuration;
    console.log(`[SmartSync run] Menerapkan Speed Stretch (Faktor: ${speedFactor.toFixed(3)})`);
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(resolvedVideo)
        .input(resolvedAudio)
        .complexFilter([
          `[0:v]setpts=${speedFactor}*PTS[v]`
        ])
        .outputOptions([
          '-map [v]',
          '-map 1:a:0',
          '-c:v libx264',
          '-pix_fmt yuv420p',
          '-c:a aac',
          '-shortest'
        ])
        .save(resolvedOutput)
        .on('end', () => resolve(resolvedOutput))
        .on('error', (err) => reject(err));
    });
  }

  if (option === 'shortest') {
    console.log(`[SmartSync run] Zona Hook: Menerapkan Hard Trim (Potong s/d ${audioDuration}s)`);
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(resolvedVideo)
        .input(resolvedAudio)
        .outputOptions([
          '-map 0:v:0',
          '-map 1:a:0',
          '-c:v libx264',
          '-pix_fmt yuv420p',
          '-c:a aac',
          '-shortest'
        ])
        .save(resolvedOutput)
        .on('end', () => resolve(resolvedOutput))
        .on('error', (err) => reject(err));
    });
  }

  if (option === 'freeze') {
    console.log(`[SmartSync run] Zona CTA: Menerapkan Freeze Frame pada frame akhir`);
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(resolvedVideo)
        .input(resolvedAudio)
        .complexFilter([
          `[0:v]tpad=stop_mode=clone:stop_duration=${durationDiff}[v]`
        ])
        .outputOptions([
          '-map [v]',
          '-map 1:a:0',
          '-c:v libx264',
          '-pix_fmt yuv420p',
          '-c:a aac',
          '-shortest'
        ])
        .save(resolvedOutput)
        .on('end', () => resolve(resolvedOutput))
        .on('error', (err) => reject(err));
    });
  }

  if (option === 'loop') {
    let loopCount = Math.ceil(audioDuration / videoDuration);
    if (!loopCount || loopCount < 1) loopCount = 1;
    console.log(`[SmartSync run] Audio Sangat Panjang: Menerapkan Boomerang Loop (Loop Count: ${loopCount})`);
    
    return new Promise((resolve, reject) => {
      const filterGraph = [];
      let videoStreamName = 'v_boomerang';
      
      if (loopCount <= 1) {
        filterGraph.push('[0:v]setpts=PTS-STARTPTS[v_boomerang]');
      } else {
        let splitOutputs = [];
        for (let i = 0; i < loopCount; i++) {
          splitOutputs.push(`[v${i}]`);
        }
        filterGraph.push(`[0:v]split=${loopCount}${splitOutputs.join('')}`);

        let concatInputs = [];
        for (let i = 0; i < loopCount; i++) {
          const isOdd = i % 2 === 1;
          const outLabel = `[v_proc_${i}]`;
          if (isOdd) {
            filterGraph.push(`[v${i}]reverse,setpts=PTS-STARTPTS${outLabel}`);
          } else {
            filterGraph.push(`[v${i}]setpts=PTS-STARTPTS${outLabel}`);
          }
          concatInputs.push(outLabel);
        }

        filterGraph.push(`${concatInputs.join('')}concat=n=${loopCount}:v=1:a=0[v_boomerang]`);
      }

      ffmpeg()
        .input(resolvedVideo)
        .input(resolvedAudio)
        .complexFilter(filterGraph)
        .outputOptions([
          `-map [${videoStreamName}]`,
          '-map 1:a:0',
          '-c:v libx264',
          '-pix_fmt yuv420p',
          '-c:a aac',
          '-shortest'
        ])
        .save(resolvedOutput)
        .on('end', () => resolve(resolvedOutput))
        .on('error', (err) => reject(err));
    });
  }
}
