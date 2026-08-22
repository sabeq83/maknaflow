import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { resolveFfprobePath } from './ffprobe-path.js';
import { processVideoMuxing } from './video-studio-processor.js';

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

async function processRender({ pkgId, assets, fileName }) {
  const tempDir = path.join(process.cwd(), 'public', 'temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const renderDir = path.join(process.cwd(), 'public', 'rendered');
  if (!fs.existsSync(renderDir)) fs.mkdirSync(renderDir, { recursive: true });

  const finalVideoPath = path.join(renderDir, fileName);

  // Group assets by scene_index
  const scenes = [];
  const sceneIndices = [...new Set(assets.map(a => a.scene_index))].sort((a, b) => a - b);
  
  for (const sceneIdx of sceneIndices) {
    const sceneAssets = assets.filter(a => a.scene_index === sceneIdx);
    const voAsset = sceneAssets.find(a => a.shot_index === -1);
    const visAssets = sceneAssets.filter(a => a.shot_index >= 0).sort((a, b) => a.shot_index - b.shot_index);

    const videoPaths = visAssets.map(a => {
      const out = a.output_asset_json;
      return out?.video_path || 'templates/placeholder_16_9.mp4';
    });

    const voOut = voAsset?.output_asset_json;
    const audioPath = voOut?.audio_path;

    const duration = visAssets.reduce((sum, a) => sum + (a.generation_duration_seconds || 5), 0);

    scenes.push({
      scene_index: sceneIdx,
      video_paths: videoPaths,
      audio_path: audioPath,
      duration: duration,
      voiceover: voAsset?.prompt_snapshot || ''
    });
  }

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

    await processVideoMuxing({
      videoPath: JSON.stringify(segmentVideoPaths),
      audioPath: segmentAudioPath,
      syncOption: 'smart_sync',
      bgmPath: null,
      bgmVolume: 0,
      sfxVolume: 0,
      videoScale: 1.0,
      outputPath: tempClipPath
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

  return {
    videoAsset: `/rendered/${fileName}`,
    subtitleAsset: `/rendered/${baseName}_subs.srt`,
    durationSeconds: currentTime,
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
