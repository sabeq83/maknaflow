import { pgQuery } from './db-pg.js';
import { 
  claimProductionJob, 
  completeProductionJob, 
  failProductionJob,
  getProductionPackage,
  getProductionAssets
} from './youtube-studio-production-repository.js';
import { getGenerationProfile } from './youtube-studio-generation-profiles.js';
import { getEpisode } from './youtube-studio-repository.js';
import { getMediaDuration, hasAudioStream } from './video-studio-processor.js';

import { generateVisualShot } from './youtube-studio-visual-adapter.js';
import { generateVoiceSegment } from './youtube-studio-voice-adapter.js';
import { getTaskStatus, getTaskResult } from './webhook-client.js';
import { assemblePreview, renderFinal } from './youtube-studio-render-adapter.js';
import { classifyProductionFailure } from './youtube-studio-contract.js';
import { generateStartFrame, pollStartFrame } from './youtube-studio-start-frame-adapter.js';
import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';

/**
 * Download a video from an external URL to local storage.
 * Returns the relative public path e.g. /uploads/videos/yt_video_xxx.mp4
 */
async function downloadVideoLocally(url, assetId) {
  const filename = `yt_video_${assetId}_${Date.now()}.mp4`;
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'videos');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  const destPath = path.join(uploadDir, filename);

  await new Promise((resolve, reject) => {
    const transport = url.startsWith('https') ? https : http;
    transport.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download video from ${url}: HTTP ${response.statusCode}`));
        return;
      }
      const file = fs.createWriteStream(destPath);
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });

  console.log(`[VideoDownload] Saved ${url} -> ${destPath}`);
  return `/uploads/videos/${filename}`;
}

export async function processProductionJob(jobId) {
  // 1. Claim job
  const job = await claimProductionJob(jobId);
  if (!job) return { skipped: true, reason: 'Job already claimed or not queued' };

  try {
    const pkg = await getProductionPackage(job.production_package_id);
    if (!pkg) throw new Error(`Production package ${job.production_package_id} not found`);

    const assets = await getProductionAssets(pkg.id);
    const asset = assets.find(a => a.id === job.asset_id);
    if (!asset) throw new Error(`Asset ${job.asset_id} not found`);

    const profile = getGenerationProfile(pkg.generation_profile_key);

    let outputAssetJson = {};
    let costJson = {};

    if (job.job_kind === 'voiceover') {
      const productionMode = pkg.context_snapshot_json?.audio_production_snapshot?.audio_production_mode || 'standalone_tts';
      if (productionMode === 'native_scene_audio') {
        outputAssetJson = {
          audio_path: 'skipped_native_embedded',
          size_bytes: 0,
          duration_seconds: asset.generation_duration_seconds || 5.0,
          selected_voice_speed: 1.0,
          skipped_native_embedded: true
        };
        costJson = { billed_duration: 0 };
        await completeProductionJob(jobId, outputAssetJson, costJson);
        return { success: true };
      }

      // Process voiceover generation
      const episode = await getEpisode(pkg.episode_id);
      const speakerId = asset.speaker_id || 'narrator';
      const casting = (pkg.context_snapshot_json?.casting_snapshot || []).find(item => item.speaker_id === speakerId);
      const binding = casting?.tts_binding;
      if (!binding?.provider || !binding?.persona_key) {
        const error = new Error(`Snapshot voice binding not found for speaker "${speakerId}"`);
        error.code = 'YT_SNAPSHOT_VOICE_NOT_FOUND';
        throw error;
      }
      const speakerVoice = { provider: binding.provider, persona: binding.persona_key, speed: Number(binding.speed || 1) };

      const voiceProvider = speakerVoice.provider;
      const voicePersona = speakerVoice.persona;
      const voiceSpeed = speakerVoice.speed;
      const ext = voiceProvider === 'minimax' ? 'mp3' : 'wav';

      const blockSuffix = asset.audio_block_id ? `_block_${asset.audio_block_id}` : '';
      const filename = `yt_vo_${pkg.id}_scene_${asset.scene_index}${blockSuffix}.${ext}`;
      const tempDir = path.join(process.cwd(), 'public', 'temp');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      const outputPath = path.join(tempDir, filename);

      const voiceRes = await generateVoiceSegment({
        text: asset.prompt_snapshot,
        locale: episode?.locale || 'id-ID',
        provider: voiceProvider,
        persona: voicePersona,
        speed: voiceSpeed,
        outputPath: outputPath
      });

      let actualDuration = 0;
      try {
        actualDuration = await getMediaDuration(outputPath);
      } catch (err) {
        console.warn('[TTS Probe Warning] Failed to get audio duration:', err.message);
      }

      outputAssetJson = {
        audio_path: `temp/${filename}`,
        size_bytes: voiceRes.size_bytes,
        duration_seconds: actualDuration,
        selected_voice_speed: Number(voiceSpeed)
      };

      try {
        await refreshPackageDurationAnalysis(pkg.id);
      } catch (err) {
        console.error('[Production Worker] Failed to refresh package duration analysis:', err.message);
      }

    } else if (job.job_kind === 'visual') {
      if (asset.generation_mode === 'static_asset' || asset.generation_mode === 'broll') {
        // Bypass visual generation for static assets and stock broll
        outputAssetJson = {
          video_path: 'templates/placeholder_16_9.mp4',
          bypass: true,
          mode: asset.generation_mode
        };
        costJson = { billed_duration: 0 };
      } else if (asset.generation_mode === 't2i_i2v' && !asset.output_asset_json?.image_path) {
        // Step 1: Generate start-frame (T2I)
        const genRes = await generateStartFrame({ asset, profile });
        const providerTaskId = genRes.provider_task_id;

        await pgQuery('UPDATE youtube_production_jobs SET progress = 30 WHERE id = $1', [jobId]);

        // Poll start-frame task status
        let attempt = 0;
        let pollRes;
        while (attempt < 150) {
          pollRes = await pollStartFrame(providerTaskId, asset.id);
          if (pollRes.status === 'completed') {
            break;
          }
          if (pollRes.status === 'failed') {
            throw new Error(`Start-frame generation failed: ${pollRes.error_message}`);
          }
          await new Promise(r => setTimeout(r, 2000));
          attempt++;
        }

        if (!pollRes || pollRes.status !== 'completed') {
          throw new Error('Start-frame generation timed out after 5m');
        }

        outputAssetJson = pollRes.output_asset_json;
        costJson = { billed_duration: 0 };
      } else {
        // Step 2: Generate visual video clip (I2V or T2V)
        const genRes = await generateVisualShot({ asset, profile });
        const providerTaskId = genRes.provider_task_id;

        await pgQuery('UPDATE youtube_production_jobs SET progress = 30 WHERE id = $1', [jobId]);

        let attempt = 0;
        let statusData;
        while (attempt < 150) {
          statusData = await getTaskStatus(providerTaskId);
          if (statusData.status === 'succeeded' || statusData.status === 'completed') {
            break;
          }
          if (statusData.status === 'failed') {
            throw new Error(`G-Labs visual generation failed: ${statusData.error || 'Unknown error'}`);
          }
          await new Promise(r => setTimeout(r, 2000));
          attempt++;
        }

        if (!statusData || (statusData.status !== 'succeeded' && statusData.status !== 'completed')) {
          throw new Error('G-Labs visual generation timed out after 5m');
        }

        const resultData = await getTaskResult(providerTaskId);
        const rawVideoUrl = resultData.results?.[0];

        let localVideoPath;
        if (rawVideoUrl && (rawVideoUrl.startsWith('http://') || rawVideoUrl.startsWith('https://'))) {
          // Download video to local storage so UI can serve it without depending on external URL
          localVideoPath = await downloadVideoLocally(rawVideoUrl, asset.id);
        } else {
          localVideoPath = rawVideoUrl || 'templates/placeholder_16_9.mp4';
        }

        const productionMode = pkg.context_snapshot_json?.audio_production_snapshot?.audio_production_mode || 'standalone_tts';
        if (productionMode === 'native_scene_audio') {
          const audioPresent = await hasAudioStream(localVideoPath);
          if (!audioPresent) {
            const error = new Error('Native Scene Audio output has no embedded audio stream');
            error.code = 'YT_NATIVE_AUDIO_STREAM_MISSING';
            throw error;
          }
        }

        outputAssetJson = {
          video_path: localVideoPath,
          provider_task_id: providerTaskId,
          image_path: asset.output_asset_json?.image_path || null,
          embedded_audio_validated: productionMode === 'native_scene_audio'
        };
        costJson = {
          billed_duration: asset.generation_duration_seconds
        };
      }
    }

    // Complete Job
    await completeProductionJob(jobId, outputAssetJson, costJson);
    return { success: true };

  } catch (err) {
    console.error(`[Production Worker] Job ${jobId} failed:`, err.message);
    const failureType = classifyProductionFailure(err);
    await failProductionJob(jobId, failureType, err.message);
    throw err;
  }
}

export async function processYouTubeAssemblyJob(payload) {
  const { package_id, job_id } = payload;

  const pkg = await getProductionPackage(package_id);
  if (!pkg) throw new Error(`Package ${package_id} not found`);

  // Update status to running
  await pgQuery('UPDATE youtube_production_jobs SET status = \'running\', started_at = CURRENT_TIMESTAMP WHERE id = $1', [job_id]);

  try {
    const assets = await getProductionAssets(pkg.id);
    const previewRes = await assemblePreview({ productionPackage: pkg, assets });

    await pgQuery(`
      UPDATE youtube_production_packages
      SET status = 'preview_ready', preview_asset_json = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [JSON.stringify(previewRes), pkg.id]);

    await pgQuery(`
      UPDATE youtube_production_jobs
      SET status = 'completed', progress = 100, completed_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [job_id]);

    return previewRes;

  } catch (err) {
    await pgQuery(`
      UPDATE youtube_production_jobs
      SET status = 'failed', error_message = $1, completed_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [err.message, job_id]);
    throw err;
  }
}

export async function processYouTubeFinalJob(payload) {
  const { package_id, job_id } = payload;

  const pkg = await getProductionPackage(package_id);
  if (!pkg) throw new Error(`Package ${package_id} not found`);

  // Update status to running
  await pgQuery('UPDATE youtube_production_jobs SET status = \'running\', started_at = CURRENT_TIMESTAMP WHERE id = $1', [job_id]);

  try {
    const assets = await getProductionAssets(pkg.id);
    const finalRes = await renderFinal({ productionPackage: pkg, assets });

    await pgQuery(`
      UPDATE youtube_production_packages
      SET status = 'completed', final_asset_json = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [JSON.stringify(finalRes), pkg.id]);

    await pgQuery(`
      UPDATE youtube_production_jobs
      SET status = 'completed', progress = 100, completed_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [job_id]);

    // Update episode status
    await pgQuery(`
      UPDATE youtube_episodes SET status = 'Ready to Publish' WHERE id = $1
    `, [pkg.episode_id]);

    return finalRes;

  } catch (err) {
    await pgQuery(`
      UPDATE youtube_production_jobs
      SET status = 'failed', error_message = $1, completed_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [err.message, job_id]);
    throw err;
  }
}

async function refreshPackageDurationAnalysis(packageId) {
  const assetsRes = await pgQuery('SELECT * FROM youtube_production_assets WHERE production_package_id = $1', [packageId]);
  const assets = assetsRes.rows;

  const voAssets = assets.filter(a => a.asset_type === 'voiceover');
  let totalAudioDuration = 0;
  voAssets.forEach(a => {
    totalAudioDuration += a.output_asset_json?.duration_seconds || 0;
  });

  const analysis = {
    total_audio_duration_seconds: Number(totalAudioDuration.toFixed(1)),
    last_calibrated_at: new Date().toISOString()
  };

  await pgQuery('UPDATE youtube_production_packages SET duration_analysis_json = $1 WHERE id = $2', [JSON.stringify(analysis), packageId]);
}
