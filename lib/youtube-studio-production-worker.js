import { pgQuery } from './db-pg.js';
import { getEpisode, getLatestScript } from './youtube-studio-repository.js';
import { callGeminiTtsApi } from './gemini.js';
import { renderLongForm } from './youtube-studio-render-adapter.js';
import path from 'path';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';

export async function processYouTubeRenderJob(jobId) {
  // 1. Fetch job details
  const jobRes = await pgQuery('SELECT * FROM youtube_render_jobs WHERE id = $1', [jobId]);
  const job = jobRes.rows[0];
  if (!job) throw new Error(`Render job ${jobId} not found`);

  // Update status to running
  await pgQuery('UPDATE youtube_render_jobs SET status = \'running\', started_at = CURRENT_TIMESTAMP WHERE id = $1', [jobId]);

  try {
    const episode = await getEpisode(job.episode_id);
    const script = await getLatestScript(job.episode_id);
    if (!script || script.status !== 'approved') {
      throw new Error('Episode script is not approved');
    }

    const scriptData = script.script_json;
    const scenes = scriptData.scenes || [];
    
    // 2. Scene-level VO Generation (TTS)
    await pgQuery('UPDATE youtube_render_jobs SET progress = 20 WHERE id = $1', [jobId]);
    const voiceoverClips = [];
    const tempDir = path.join(process.cwd(), 'public', 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const filename = `yt_vo_${jobId}_scene_${i}.mp3`;
      const outputPath = path.join(tempDir, filename);
      
      try {
        await callGeminiTtsApi(scene.voiceover, 'Orus', { outputPath });
      } catch (err) {
        console.warn(`[TTS Fallback] Gemini TTS failed, writing dummy audio: ${err.message}`);
        await new Promise((resolve, reject) => {
          ffmpeg()
            .input('anullsrc=r=32000:cl=mono')
            .inputFormat('lavfi')
            .output(outputPath)
            .duration(scene.estimated_duration_seconds || 5)
            .on('end', resolve)
            .on('error', reject)
            .run();
        });
      }

      voiceoverClips.push({
        scene_index: i,
        audio_path: `temp/${filename}`,
        text: scene.voiceover
      });
    }

    // 3. Visual Clip Association (MVP: Use placeholder visual clips)
    await pgQuery('UPDATE youtube_render_jobs SET progress = 50 WHERE id = $1', [jobId]);
    const visualClips = scenes.map((s, idx) => ({
      scene_index: idx,
      video_path: 'templates/placeholder_16_9.mp4',
      duration: s.estimated_duration_seconds || 5
    }));

    // 4. Assemble production package
    const productionPackageId = `ytpp_${Math.random().toString(36).slice(2, 10)}`;
    const sceneManifest = { scenes: visualClips };
    const voiceManifest = { clips: voiceoverClips };
    
    await pgQuery(`
      INSERT INTO youtube_production_packages (id, tenant_id, episode_id, approved_script_id, scene_manifest_json, voice_manifest_json)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [productionPackageId, job.tenant_id, job.episode_id, script.id, JSON.stringify(sceneManifest), JSON.stringify(voiceManifest)]);

    // Update job progress
    await pgQuery('UPDATE youtube_render_jobs SET production_package_id = $1, progress = 70 WHERE id = $2', [productionPackageId, jobId]);

    // 5. Render final output video
    const timeline = {
      scenes: scenes.map((s, idx) => ({
        video_path: visualClips[idx].video_path,
        audio_path: voiceoverClips[idx].audio_path,
        duration: visualClips[idx].duration,
        voiceover: s.voiceover
      }))
    };

    const rendered = await renderLongForm({ timeline, job });

    // 6. Complete Job
    await pgQuery(`
      UPDATE youtube_render_jobs
      SET status = 'succeeded', progress = 100, output_asset_json = $1, completed_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [JSON.stringify(rendered), jobId]);

    // Update episode status
    await pgQuery('UPDATE youtube_episodes SET status = \'Ready to Publish\' WHERE id = $1', [job.episode_id]);

    return rendered;

  } catch (err) {
    console.error(`Render job failed: ${err.message}`);
    await pgQuery('UPDATE youtube_render_jobs SET status = \'failed\', error_message = $1 WHERE id = $2', [err.message, jobId]);
    throw err;
  }
}
