import { pgQuery } from './db-pg.js';
import { 
  claimProductionJob, 
  completeProductionJob, 
  failProductionJob,
  getProductionPackage,
  getProductionAssets
} from './youtube-studio-production-repository.js';
import { getGenerationProfile } from './youtube-studio-generation-profiles.js';
import { generateVisualShot } from './youtube-studio-visual-adapter.js';
import { generateVoiceSegment } from './youtube-studio-voice-adapter.js';
import { getTaskStatus, getTaskResult } from './webhook-client.js';
import { assemblePreview, renderFinal } from './youtube-studio-render-adapter.js';
import { classifyProductionFailure } from './youtube-studio-contract.js';
import path from 'path';
import fs from 'fs';

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
      // Process voiceover generation
      const filename = `yt_vo_${pkg.id}_scene_${asset.scene_index}.mp3`;
      const tempDir = path.join(process.cwd(), 'public', 'temp');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      const outputPath = path.join(tempDir, filename);

      const voiceRes = await generateVoiceSegment({
        text: asset.prompt_snapshot,
        outputPath: outputPath
      });

      outputAssetJson = {
        audio_path: `temp/${filename}`,
        size_bytes: voiceRes.size_bytes
      };
    } else if (job.job_kind === 'visual') {
      // Process G-Labs visual generation
      const genRes = await generateVisualShot({ asset, profile });
      
      const providerTaskId = genRes.provider_task_id;
      
      // Update job progress
      await pgQuery('UPDATE youtube_production_jobs SET progress = 30 WHERE id = $1', [jobId]);

      // Poll task status (synchronously in worker with timeout)
      let attempt = 0;
      let statusData;
      while (attempt < 30) {
        statusData = await getTaskStatus(providerTaskId);
        if (statusData.status === 'succeeded') {
          break;
        }
        if (statusData.status === 'failed') {
          throw new Error(`G-Labs visual generation failed: ${statusData.error || 'Unknown error'}`);
        }
        await new Promise(r => setTimeout(r, 2000));
        attempt++;
      }

      if (!statusData || statusData.status !== 'succeeded') {
        throw new Error('G-Labs visual generation timed out after 60s');
      }

      const resultData = await getTaskResult(providerTaskId);
      const videoUrl = resultData.results?.[0] || 'templates/placeholder_16_9.mp4';

      outputAssetJson = {
        video_path: videoUrl,
        provider_task_id: providerTaskId
      };
      costJson = {
        billed_duration: asset.generation_duration_seconds
      };
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
