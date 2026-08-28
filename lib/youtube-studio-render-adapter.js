import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { resolveFfprobePath } from './ffprobe-path.js';
import { processYouTubeTimelineMux, getMediaDuration } from './video-studio-processor.js';
import { pgQuery } from './db-pg.js';

ffmpeg.setFfprobePath(resolveFfprobePath());
if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
} else if (fs.existsSync('/opt/homebrew/bin/ffmpeg')) {
  ffmpeg.setFfmpegPath('/opt/homebrew/bin/ffmpeg');
}

export async function assemblePreview({ productionPackage, assets }) {
  return await processRender({
    pkgId: productionPackage.id,
    assets: assets,
    fileName: `yt_preview_${productionPackage.id}.mp4`
  });
}

export async function renderFinal({ productionPackage, assets }) {
  return await processRender({
    pkgId: productionPackage.id,
    assets: assets,
    fileName: `yt_final_${productionPackage.id}.mp4`
  });
}

async function concatAudioClips(audioPaths, outputPath) {
  return new Promise((resolve, reject) => {
    const command = ffmpeg();
    audioPaths.forEach(p => {
      command.input(p);
    });
    command
      .on('end', resolve)
      .on('error', reject)
      .filterGraph(`concat=n=${audioPaths.length}:v=0:a=1[a]`, ['[a]'])
      .output(outputPath)
      .run();
  });
}

async function processRender({ pkgId, assets, fileName }) {
  const tempDir = path.join(process.cwd(), 'public', 'temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const renderDir = path.join(process.cwd(), 'public', 'uploads', 'rendered');
  if (!fs.existsSync(renderDir)) fs.mkdirSync(renderDir, { recursive: true });

  const finalVideoPath = path.join(renderDir, fileName);

  const tempAudioFilesToClean = [];

  // Group assets by scene_index
  const scenes = [];
  const sceneIndices = [...new Set(assets.map(a => a.scene_index))].sort((a, b) => a - b);
  
  for (const sceneIdx of sceneIndices) {
    const sceneAssets = assets.filter(a => a.scene_index === sceneIdx);
    const voAssets = sceneAssets.filter(a => a.shot_index === -1).sort((a, b) => {
      return (a.audio_block_id || '').localeCompare(b.audio_block_id || '');
    });
    const visAssets = sceneAssets.filter(a => a.shot_index >= 0).sort((a, b) => a.shot_index - b.shot_index);

    const videoPaths = visAssets.map(a => {
      const out = a.output_asset_json;
      return out?.video_path || 'templates/placeholder_16_9.mp4';
    });

    const audioPaths = voAssets
      .map(a => a.output_asset_json?.audio_path)
      .filter(Boolean)
      .map(p => path.join(process.cwd(), 'public', p));

    let audioPath = null;
    if (audioPaths.length === 1) {
      audioPath = audioPaths[0];
    } else if (audioPaths.length > 1) {
      const mergedTempPath = path.join(tempDir, `merged_vo_${pkgId}_scene_${sceneIdx}.wav`);
      await concatAudioClips(audioPaths, mergedTempPath);
      audioPath = mergedTempPath;
      tempAudioFilesToClean.push(mergedTempPath);
    }

    const duration = visAssets.reduce((sum, a) => sum + (a.generation_duration_seconds || 5), 0);

    scenes.push({
      scene_index: sceneIdx,
      video_paths: videoPaths,
      audio_path: audioPath,
      duration: duration,
      voiceover: voAssets.map(a => a.prompt_snapshot || '').join(' ')
    });
  }

  // Fetch episode narration profile key
  const pkgRes = await pgQuery(`
    SELECT e.narration_profile_key 
    FROM youtube_production_packages p
    JOIN youtube_episodes e ON p.episode_id = e.id
    WHERE p.id = $1
  `, [pkgId]);
  const narrationProfileKey = pkgRes.rows[0]?.narration_profile_key || 'general_id';

  const tempClipPaths = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const segmentVideoPaths = scene.video_paths || ['templates/placeholder_16_9.mp4'];
    const segmentAudioPath = scene.audio_path;
    const tempClipPath = path.join(tempDir, `temp_yt_${pkgId}_clip_${i}.mp4`);

    // Ensure all segment video files exist
    for (const vPath of segmentVideoPaths) {
      const fullVideoPath = path.join(process.cwd(), 'public', vPath);
      if (!fs.existsSync(fullVideoPath)) {
        const parentDir = path.dirname(fullVideoPath);
        if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
        // Create a dummy video file using ffmpeg to avoid missing file errors
        await new Promise((resolve, reject) => {
          ffmpeg()
            .input('color=c=black:s=1280x720:d=10')
            .inputFormat('lavfi')
            .output(fullVideoPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
        });
      }
    }

    await processYouTubeTimelineMux({
      videoPaths: segmentVideoPaths,
      audioPath: segmentAudioPath,
      plannedDurationSeconds: scene.duration,
      durationPolicy: 'preserve_timeline',
      outputPath: tempClipPath,
      narrationProfileKey
    });

    tempClipPaths.push(tempClipPath);
  }

  // Concatenate clips
  await new Promise((resolve, reject) => {
    const concatCommand = ffmpeg();
    for (const p of tempClipPaths) {
      concatCommand.input(p);
    }
    concatCommand
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .mergeToFile(finalVideoPath, tempDir);
  });

  // Measure actual duration of output media
  let finalDuration = 0;
  try {
    finalDuration = await getMediaDuration(finalVideoPath);
  } catch (err) {
    console.warn('[Render Adapter Warning] Failed to get final video duration:', err.message);
  }

  // Generate subtitles (SRT file)
  const baseName = fileName.replace('.mp4', '');
  const srtPath = path.join(renderDir, `${baseName}_subs.srt`);
  let srtContent = '';
  let currentTime = 0;
  
  for (let i = 0; i < scenes.length; i++) {
    const dur = scenes[i].duration || 5;
    const startTimeStr = formatSRTTime(currentTime);
    const endTimeStr = formatSRTTime(currentTime + dur);
    srtContent += `${i + 1}\n${startTimeStr} --> ${endTimeStr}\n${scenes[i].voiceover}\n\n`;
    currentTime += dur;
  }
  fs.writeFileSync(srtPath, srtContent);

  // Clean up segment files
  for (const p of tempClipPaths) {
    try { fs.unlinkSync(p); } catch(_) {}
  }
  for (const p of tempAudioFilesToClean) {
    try { fs.unlinkSync(p); } catch(_) {}
  }

  return {
    videoAsset: `/uploads/rendered/${fileName}`,
    subtitleAsset: `/uploads/rendered/${baseName}_subs.srt`,
    durationSeconds: Number(finalDuration.toFixed(1)),
    providerMetadata: { renderer: 'ffmpeg_production_assembler' }
  };
}

function formatSRTTime(seconds) {
  const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
  return `${hrs}:${mins}:${secs},${ms}`;
}
