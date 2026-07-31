import ffmpeg from 'fluent-ffmpeg';
import ffprobe from 'ffprobe-static';
import path from 'path';
import fs from 'fs';
import {
  getPendingFfmpegStudioJob,
  updateFfmpegStudioJob,
  getAllFfmpegStudioJobs
} from './db.js';

// Resolve Next.js mock /ROOT path to real filesystem path (Turbopack NFT trace issue)
function getFfprobePath() {
  let p = ffprobe.path;
  if (p.startsWith('/ROOT/')) {
    p = path.join(process.cwd(), p.substring(6));
  } else if (p.startsWith('/ROOT')) {
    p = path.join(process.cwd(), p.substring(5));
  }
  
  // Fallback: build path manually if file is missing
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

const ffprobePath = getFfprobePath();
ffmpeg.setFfprobePath(ffprobePath);

/**
 * Resolve relative path relative to process.cwd() if not absolute.
 */
export function resolveLocalPath(filePath) {
  if (!filePath) return '';
  if (filePath.startsWith('/temp/')) {
    return path.join(process.cwd(), 'public', filePath);
  }
  if (filePath.startsWith('/rendered/')) {
    return path.join(process.cwd(), 'public', filePath);
  }
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  return path.join(process.cwd(), filePath);
}

/**
 * Precisely get duration of a media file (Video/Audio) using ffprobe.
 */
export function getMediaDuration(filePath) {
  const resolved = resolveLocalPath(filePath);
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(resolved, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration);
    });
  });
}

/**
 * Get video dimensions (width and height) of a video file.
 */
export function getVideoDimensions(filePath) {
  const resolved = resolveLocalPath(filePath);
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(resolved, (err, metadata) => {
      if (err) return reject(err);
      const stream = metadata.streams.find(s => s.codec_type === 'video');
      if (!stream) return reject(new Error('No video stream found'));
      resolve({ width: stream.width, height: stream.height });
    });
  });
}

/**
 * Check if a media file has an audio stream.
 */
export function hasAudioStream(filePath) {
  const resolved = resolveLocalPath(filePath);
  return new Promise((resolve) => {
    ffmpeg.ffprobe(resolved, (err, metadata) => {
      if (err) return resolve(false);
      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
      resolve(!!audioStream);
    });
  });
}

/**
 * Mix Video & Audio using FFmpeg with specific sync strategy and optional BGM/SFX.
 * Supports multiple video clips concatenation sequentially.
 */
export async function processVideoMuxing(jobConfig) {
  const { videoPath, audioPath, syncOption, bgmPath, bgmVolume = 0.15, sfxVolume = 0.0, videoScale = 1.0, outputPath } = jobConfig;

  // Parse video paths (could be single string or JSON array of strings)
  let videoPaths = [];
  try {
    const parsed = JSON.parse(videoPath);
    videoPaths = Array.isArray(parsed) ? parsed : [videoPath];
  } catch {
    videoPaths = [videoPath];
  }

  const resolvedVideos = videoPaths.map(resolveLocalPath);
  const resolvedOutput = resolveLocalPath(outputPath);

  // 1. Get durations & audio info
  const videoDurations = [];
  const videoAudioStatus = [];
  let totalVideoDuration = 0;

  for (const vp of resolvedVideos) {
    const dur = await getMediaDuration(vp);
    const hasAudio = await hasAudioStream(vp);
    videoDurations.push(dur);
    videoAudioStatus.push(hasAudio);
    totalVideoDuration += dur;
  }

  let resolvedAudio = resolveLocalPath(audioPath);
  if (!resolvedAudio || !fs.existsSync(resolvedAudio)) {
    const tempDir = path.join(process.cwd(), 'public', 'temp');
    fs.mkdirSync(tempDir, { recursive: true });
    resolvedAudio = path.join(tempDir, `silent_${Date.now()}_${Math.random().toString(36).substring(7)}.wav`);
    const { execSync } = require('child_process');
    execSync(`ffmpeg -y -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -t ${Math.ceil(totalVideoDuration || 5)} "${resolvedAudio}"`);
  }

  const audioDuration = await getMediaDuration(resolvedAudio);

  // Get first video's dimensions to standardize all clips
  const firstVideoDims = await getVideoDimensions(resolvedVideos[0]);
  const stdWidth = firstVideoDims.width;
  const stdHeight = firstVideoDims.height;

  const command = ffmpeg();

  // 2. Add all video inputs
  for (const vp of resolvedVideos) {
    command.input(vp);
  }

  // 3. Add audio voiceover input
  command.input(resolvedAudio);

  // 4. Add BGM input if provided and file exists
  const hasBgm = bgmPath && fs.existsSync(resolveLocalPath(bgmPath));
  if (hasBgm) {
    command.input(resolveLocalPath(bgmPath));
  }

  // 5. Build filter complex graph
  const filterGraph = [];

  // Step A: Standardize visual and audio of all clips
  for (let i = 0; i < resolvedVideos.length; i++) {
    // Standardize video dimensions & sample aspect ratio (apply center zoom if videoScale > 1.0)
    if (videoScale > 1.0) {
      filterGraph.push({
        filter: 'scale',
        options: `${Math.round(stdWidth * videoScale)}:${Math.round(stdHeight * videoScale)}`,
        inputs: `${i}:v`,
        outputs: `v_scale_${i}`
      });
      filterGraph.push({
        filter: 'crop',
        options: `${stdWidth}:${stdHeight}`,
        inputs: `v_scale_${i}`,
        outputs: `v_crop_${i}`
      });
      filterGraph.push({
        filter: 'setsar',
        options: '1',
        inputs: `v_crop_${i}`,
        outputs: `v_std_${i}`
      });
    } else {
      filterGraph.push({
        filter: 'scale',
        options: `${stdWidth}:${stdHeight}`,
        inputs: `${i}:v`,
        outputs: `v_scale_${i}`
      });
      filterGraph.push({
        filter: 'setsar',
        options: '1',
        inputs: `v_scale_${i}`,
        outputs: `v_std_${i}`
      });
    }

    // Standardize audio stream (generate silence if missing) - only if sfxVolume > 0
    if (sfxVolume > 0) {
      if (videoAudioStatus[i]) {
        filterGraph.push({
          filter: 'aformat',
          options: 'sample_rates=44100:channel_layouts=stereo',
          inputs: `${i}:a`,
          outputs: `a_std_${i}`
        });
      } else {
        filterGraph.push({
          filter: 'aevalsrc',
          options: `0:d=${videoDurations[i]}`,
          outputs: `a_std_${i}`
        });
      }
    }
  }

  // Step B: Determine loop count if syncOption is 'loop' and video is shorter than audio
  let loopCount = 1;
  if (syncOption === 'loop') {
    loopCount = Math.ceil(audioDuration / totalVideoDuration);
    if (loopCount < 1) loopCount = 1;
  }

  // Step C: Concat visual streams with Boomerang (Ping-Pong) effect if loopCount > 1
  const onePassVideoLabel = resolvedVideos.length === 1 ? 'v_std_0' : 'v_one_pass';
  if (resolvedVideos.length > 1) {
    const videoConcatInputs = [];
    for (let i = 0; i < resolvedVideos.length; i++) {
      videoConcatInputs.push(`v_std_${i}`);
    }
    filterGraph.push({
      filter: 'concat',
      options: {
        n: resolvedVideos.length,
        v: 1,
        a: 0
      },
      inputs: videoConcatInputs,
      outputs: 'v_one_pass'
    });
  }

  if (syncOption === 'loop' && loopCount > 1) {
    const splitOutputs = [];
    for (let l = 0; l < loopCount; l++) {
      splitOutputs.push(`v_pass_${l}`);
    }
    filterGraph.push({
      filter: 'split',
      options: String(loopCount),
      inputs: onePassVideoLabel,
      outputs: splitOutputs
    });

    const concatInputs = [];
    for (let l = 0; l < loopCount; l++) {
      const isOdd = l % 2 === 1;
      const outLabel = `v_pass_proc_${l}`;
      if (isOdd) {
        filterGraph.push({
          filter: 'reverse',
          inputs: `v_pass_${l}`,
          outputs: `v_pass_rev_${l}`
        });
        filterGraph.push({
          filter: 'setpts',
          options: 'PTS-STARTPTS',
          inputs: `v_pass_rev_${l}`,
          outputs: outLabel
        });
      } else {
        filterGraph.push({
          filter: 'setpts',
          options: 'PTS-STARTPTS',
          inputs: `v_pass_${l}`,
          outputs: outLabel
        });
      }
      concatInputs.push(outLabel);
    }

    filterGraph.push({
      filter: 'concat',
      options: {
        n: loopCount,
        v: 1,
        a: 0
      },
      inputs: concatInputs,
      outputs: 'v_joined'
    });
  } else {
    // Standard playback (single pass or loopCount = 1)
    filterGraph.push({
      filter: 'setpts',
      options: 'PTS-STARTPTS',
      inputs: onePassVideoLabel,
      outputs: 'v_joined'
    });
  }

  // Step D: Concat audio SFX streams (only if sfxVolume > 0)
  if (sfxVolume > 0) {
    if (loopCount > 1) {
      for (let i = 0; i < resolvedVideos.length; i++) {
        const splitAudioOutputs = [];
        for (let l = 0; l < loopCount; l++) {
          splitAudioOutputs.push(`a_std_${i}_split_${l}`);
        }
        filterGraph.push({
          filter: 'asplit',
          options: String(loopCount),
          inputs: `a_std_${i}`,
          outputs: splitAudioOutputs
        });
      }
    }

    const audioConcatInputs = [];
    for (let l = 0; l < loopCount; l++) {
      for (let i = 0; i < resolvedVideos.length; i++) {
        if (loopCount > 1) {
          audioConcatInputs.push(`a_std_${i}_split_${l}`);
        } else {
          audioConcatInputs.push(`a_std_${i}`);
        }
      }
    }
    filterGraph.push({
      filter: 'concat',
      options: {
        n: resolvedVideos.length * loopCount,
        v: 0,
        a: 1
      },
      inputs: audioConcatInputs,
      outputs: 'a_sfx_joined'
    });
  }

  // Step E: Apply visual sync on joined stream
  let videoOutLabel = 'v_joined';
  if (syncOption === 'stretch') {
    const factor = audioDuration / totalVideoDuration;
    filterGraph.push({
      filter: 'setpts',
      options: `${factor}*PTS`,
      inputs: 'v_joined',
      outputs: 'v_sync'
    });
    videoOutLabel = 'v_sync';
  } else if (syncOption === 'freeze') {
    const padDuration = Math.max(0, audioDuration - totalVideoDuration);
    filterGraph.push({
      filter: 'tpad',
      options: {
        stop_mode: 'clone',
        stop_duration: padDuration
      },
      inputs: 'v_joined',
      outputs: 'v_sync'
    });
    videoOutLabel = 'v_sync';
  }

  // Step F: Mixing audio streams
  const voiceoverInputIdx = resolvedVideos.length;
  const bgmInputIdx = resolvedVideos.length + 1;
  const mixInputs = [];

  // Voiceover stream
  filterGraph.push({
    filter: 'volume',
    options: '1.0',
    inputs: `${voiceoverInputIdx}:a`,
    outputs: 'vo_vol'
  });
  mixInputs.push('vo_vol');

  // SFX stream
  if (sfxVolume > 0) {
    filterGraph.push({
      filter: 'volume',
      options: String(sfxVolume),
      inputs: 'a_sfx_joined',
      outputs: 'sfx_vol'
    });
    mixInputs.push('sfx_vol');
  }

  // BGM stream
  if (hasBgm) {
    filterGraph.push({
      filter: 'volume',
      options: String(bgmVolume),
      inputs: `${bgmInputIdx}:a`,
      outputs: 'bgm_vol'
    });
    mixInputs.push('bgm_vol');
  }

  // Mix active audio
  let audioOutLabel = 'vo_vol';
  if (mixInputs.length > 1) {
    filterGraph.push({
      filter: 'amix',
      options: {
        inputs: mixInputs.length,
        duration: 'first',
        dropout_transition: 2
      },
      inputs: mixInputs,
      outputs: 'a_mixed'
    });
    audioOutLabel = 'a_mixed';
  }

  command.complexFilter(filterGraph);

  const mapVideo = videoOutLabel.includes('_') ? `[${videoOutLabel}]` : videoOutLabel;
  const mapAudio = audioOutLabel.includes('_') ? `[${audioOutLabel}]` : audioOutLabel;

  command.outputOptions([
    `-map ${mapVideo}`,
    `-map ${mapAudio}`,
    '-c:v libx264',
    '-preset slow',
    '-crf 18',
    '-profile:v high',
    '-level 4.1',
    '-pix_fmt yuv420p',
    '-r 30',
    '-g 60',
    '-keyint_min 60',
    '-sc_threshold 0',
    '-movflags +faststart',
    '-c:a aac',
    '-b:a 192k',
    '-ar 48000',
    '-ac 2',
    '-shortest'
  ]);

  // Make sure output folder exists
  const outputDir = path.dirname(resolvedOutput);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    command
      .save(resolvedOutput)
      .on('start', () => {
        // Human-Readable log (Hide raw FFmpeg CLI command)
        console.log(`⚡ [Rendering Video] Memproses penggabungan klip video & audio TTS...`);
      })
      .on('end', () => {
        console.log(`✨ [Rendering Selesai] Klip berhasil diproses: ${path.basename(resolvedOutput)}`);
        resolve(resolvedOutput);
      })
      .on('error', (err) => {
        console.error('❌ [Rendering Error] Gagal memproses klip video:', err.message);
        reject(err);
      });
  });
}

// Global active lock in Node memory
const globalRef = global;
if (!globalRef.ffmpegStudioQueueActive) {
  globalRef.ffmpegStudioQueueActive = false;
}

/**
 * Sequential Queue processor loop.
 * Guarantees that only ONE ffmpeg job runs on the server at any given time.
 */
export async function triggerFfmpegStudioQueue() {
  if (globalRef.ffmpegStudioQueueActive) {
    console.log('[Video Studio Queue] Sequential queue processor is already processing a job.');
    return;
  }

  globalRef.ffmpegStudioQueueActive = true;
  console.log('[Video Studio Queue] Starting queue processing loop.');

  try {
    while (true) {
      const job = getPendingFfmpegStudioJob();
      if (!job) {
        console.log('[Video Studio Queue] No pending rendering jobs found in queue.');
        break;
      }

      console.log(`[Video Studio Queue] Processing job ${job.id}...`);
      updateFfmpegStudioJob(job.id, { status: 'processing' });

      try {
        const bgmVolume = job.bgm_volume !== null && job.bgm_volume !== undefined ? job.bgm_volume : 0.15;
        const sfxVolume = job.sfx_volume !== null && job.sfx_volume !== undefined ? job.sfx_volume : 0.0;
        const videoScale = job.video_scale !== null && job.video_scale !== undefined ? job.video_scale : 1.0;
        const outputPath = `public/rendered/${job.id}.mp4`;

        if (job.audio_source_type === 'tts_studio') {
          await processTtsStudioMuxing({
            id: job.id,
            videoPath: job.video_path,
            batchId: job.audio_path,
            syncOption: job.sync_option,
            bgmPath: job.bgm_path,
            bgmVolume: bgmVolume,
            sfxVolume: sfxVolume,
            videoScale: videoScale,
            outputPath: outputPath
          });
        } else {
          await processVideoMuxing({
            videoPath: job.video_path,
            audioPath: job.audio_path,
            syncOption: job.sync_option,
            bgmPath: job.bgm_path,
            bgmVolume: bgmVolume,
            sfxVolume: sfxVolume,
            videoScale: videoScale,
            outputPath: outputPath
          });
        }

        updateFfmpegStudioJob(job.id, {
          status: 'completed',
          output_path: `/rendered/${job.id}.mp4`
        });

        console.log(`[Video Studio Queue] Job ${job.id} completed successfully.`);
        scheduleTempFileGC(job.video_path, job.audio_path, job.video_source_type, job.audio_source_type);

      } catch (err) {
        console.error(`[Video Studio Queue] Job ${job.id} processing failed:`, err);
        updateFfmpegStudioJob(job.id, {
          status: 'failed',
          error_log: err.message || String(err)
        });

        scheduleTempFileGC(job.video_path, job.audio_path, job.video_source_type, job.audio_source_type);
      }
    }
  } finally {
    globalRef.ffmpegStudioQueueActive = false;
    console.log('[Video Studio Queue] Queue processing loop terminated.');
  }
}

/**
 * Muxes a list of video clips sequentially with respective clips from a TTS batch.
 * Applies sync option, scaling, BGM, and mixes them.
 */
export async function processTtsStudioMuxing(config) {
  const { id, videoPath, batchId, syncOption, bgmPath, bgmVolume = 0.15, sfxVolume = 0.0, videoScale = 1.0, outputPath, bridgeAtClip = 3 } = config;

  let videoPaths = [];
  try {
    const parsed = JSON.parse(videoPath);
    videoPaths = Array.isArray(parsed) ? parsed : [videoPath];
  } catch {
    videoPaths = [videoPath];
  }

  // Load completed clips from batch
  const { getTtsBatchWithClips } = await import('./db.js');
  const batchData = getTtsBatchWithClips(batchId);
  if (!batchData || !batchData.clips || batchData.clips.length === 0) {
    throw new Error(`Batch TTS Studio '${batchId}' tidak ditemukan atau tidak memiliki klip.`);
  }

  const completedClips = batchData.clips.filter(c => c.status === 'completed');
  if (completedClips.length === 0) {
    throw new Error(`Batch TTS Studio '${batchId}' tidak memiliki klip berstatus 'completed'.`);
  }

  const pairCount = Math.min(videoPaths.length, completedClips.length);
  console.log(`🎬 [Video Studio] Memulai rendering ${pairCount} adegan klip video & audio...`);

  const tempClipPaths = [];
  const tempDir = path.join(process.cwd(), 'public', 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  try {
    // 1. Process muxing for each segment individually
    for (let i = 0; i < pairCount; i++) {
      const tempClipPath = path.join(tempDir, `temp_muxed_${id}_clip_${i}.mp4`);
      console.log(`🎬 [Penyelarasan Klip ${i + 1}/${pairCount}] Menggabungkan video dengan audio VO...`);
      
      let resolvedSyncOption = syncOption;
      if (syncOption === 'smart_sync') {
        const { determineSmartSyncOption } = await import('./smart-sync-engine.js');
        resolvedSyncOption = await determineSmartSyncOption({
          videoPath: videoPaths[i],
          audioPath: completedClips[i].audio_path,
          currentClipIndex: i + 1,
          bridgeAtClip: bridgeAtClip
        });
      }

      await processVideoMuxing({
        videoPath: JSON.stringify([videoPaths[i]]),
        audioPath: completedClips[i].audio_path,
        syncOption: resolvedSyncOption,
        bgmPath: null, // do not apply BGM on segment-level
        bgmVolume: 0,
        sfxVolume: sfxVolume,
        videoScale: videoScale,
        outputPath: tempClipPath
      });

      tempClipPaths.push(tempClipPath);
    }

    // 2. Concatenate all segment video files together
    console.log(`🎞️ [Penggabungan Final] Menyatukan ${tempClipPaths.length} adegan menjadi 1 video utuh...`);
    
    const concatCommand = ffmpeg();
    for (const p of tempClipPaths) {
      concatCommand.input(resolveLocalPath(p));
    }

    const hasBgm = bgmPath && fs.existsSync(resolveLocalPath(bgmPath));
    if (hasBgm) {
      concatCommand.input(resolveLocalPath(bgmPath));
    }

    const filterInputs = [];
    for (let i = 0; i < tempClipPaths.length; i++) {
      filterInputs.push(`${i}:v`, `${i}:a`);
    }

    const filterGraph = [];
    filterGraph.push({
      filter: 'concat',
      options: {
        n: tempClipPaths.length,
        v: 1,
        a: 1
      },
      inputs: filterInputs,
      outputs: ['v_joined', 'a_joined']
    });

    let finalAudioLabel = 'a_joined';

    if (hasBgm) {
      const bgmInputIdx = tempClipPaths.length;
      filterGraph.push({
        filter: 'volume',
        options: '1.0',
        inputs: 'a_joined',
        outputs: 'vo_joined_vol'
      });
      filterGraph.push({
        filter: 'volume',
        options: String(bgmVolume),
        inputs: `${bgmInputIdx}:a`,
        outputs: 'bgm_vol'
      });
      filterGraph.push({
        filter: 'amix',
        options: {
          inputs: 2,
          duration: 'first',
          dropout_transition: 2
        },
        inputs: ['vo_joined_vol', 'bgm_vol'],
        outputs: 'a_mixed'
      });
      finalAudioLabel = 'a_mixed';
    }

    concatCommand.complexFilter(filterGraph);

    const mapVideo = '[v_joined]';
    const mapAudio = finalAudioLabel.includes('_') ? `[${finalAudioLabel}]` : finalAudioLabel;

    concatCommand.outputOptions([
      `-map ${mapVideo}`,
      `-map ${mapAudio}`,
      '-c:v libx264',
      '-pix_fmt yuv420p',
      '-c:a aac'
    ]);

    const resolvedOutput = resolveLocalPath(outputPath);
    const outputDir = path.dirname(resolvedOutput);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    await new Promise((resolve, reject) => {
      concatCommand
        .save(resolvedOutput)
        .on('start', () => {
          console.log(`⚡ [FFmpeg Muxing] Memproses rendering video final...`);
        })
        .on('end', () => {
          console.log(`🎉 [Rendering Selesai] Video final berhasil diproduksi: ${path.basename(resolvedOutput)}`);
          resolve(resolvedOutput);
        })
        .on('error', (err) => {
          console.error('❌ [FFmpeg Error] Gagal menggabungkan klip video final:', err.message);
          reject(err);
        });
    });

  } finally {
    // Cleanup temporary clips
    console.log('[FFmpeg Video Studio] Cleaning up segment temporary files...');
    for (const p of tempClipPaths) {
      try {
        if (fs.existsSync(p)) {
          fs.unlinkSync(p);
        }
      } catch (err) {
        console.error(`[FFmpeg Video Studio] Failed to delete temp file ${p}:`, err);
      }
    }
  }
}

/**
 * Deletes uploaded temporary files after exactly 30 minutes.
 */
export function scheduleTempFileGC(videoPath, audioPath, videoSourceType, audioSourceType) {
  setTimeout(() => {
    console.log(`[Video Studio GC] Triggering cleanup for job files: ${videoPath}, ${audioPath}`);
    
    // Parse video path (could be a JSON array)
    let videoPaths = [];
    try {
      const parsed = JSON.parse(videoPath);
      videoPaths = Array.isArray(parsed) ? parsed : [videoPath];
    } catch {
      videoPaths = [videoPath];
    }

    if (videoSourceType === 'upload') {
      for (const vp of videoPaths) {
        try {
          const resolved = resolveLocalPath(vp);
          if (fs.existsSync(resolved)) {
            fs.unlinkSync(resolved);
            console.log(`[Video Studio GC] Successfully deleted temp video file: ${vp}`);
          }
        } catch (err) {
          console.error(`[Video Studio GC] Failed to delete temp video file ${vp}:`, err);
        }
      }
    }

    if (audioSourceType === 'upload') {
      try {
        const resolved = resolveLocalPath(audioPath);
        if (fs.existsSync(resolved)) {
          fs.unlinkSync(resolved);
          console.log(`[Video Studio GC] Successfully deleted temp audio file: ${audioPath}`);
        }
      } catch (err) {
        console.error(`[Video Studio GC] Failed to delete temp audio file ${audioPath}:`, err);
      }
    }
  }, 30 * 60 * 1000); // 30 minutes
}

/**
 * Scans and cleans up stale temporary files left from previous server runs.
 */
export function runStartupGC() {
  console.log('[Video Studio GC] Running startup garbage collection sweep.');
  try {
    const jobs = getAllFfmpegStudioJobs();
    const now = Date.now();
    const thirtyMinutesMs = 30 * 60 * 1000;

    const oldJobs = jobs.filter(job => {
      const isEnded = job.status === 'completed' || job.status === 'failed';
      const createdTime = new Date(job.created_at).getTime();
      return isEnded && (now - createdTime > thirtyMinutesMs);
    });

    console.log(`[Video Studio GC] Found ${oldJobs.length} ended jobs that are older than 30 minutes.`);

    for (const job of oldJobs) {
      // Parse video path (could be a JSON array)
      let videoPaths = [];
      try {
        const parsed = JSON.parse(job.video_path);
        videoPaths = Array.isArray(parsed) ? parsed : [job.video_path];
      } catch {
        videoPaths = [job.video_path];
      }

      if (job.video_source_type === 'upload') {
        for (const vp of videoPaths) {
          const resolved = resolveLocalPath(vp);
          if (fs.existsSync(resolved)) {
            fs.unlinkSync(resolved);
            console.log(`[Video Studio GC] Cleaned up stale temp video file: ${vp}`);
          }
        }
      }
      if (job.audio_source_type === 'upload') {
        const resolved = resolveLocalPath(job.audio_path);
        if (fs.existsSync(resolved)) {
          fs.unlinkSync(resolved);
          console.log(`[Video Studio GC] Cleaned up stale temp audio file: ${job.audio_path}`);
        }
      }
    }
  } catch (err) {
    console.error('[Video Studio GC] Error during startup GC sweep:', err);
  }
}

// Automatically trigger startup sweep when module is loaded
runStartupGC();
