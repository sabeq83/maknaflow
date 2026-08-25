import { getPgPool, pgQuery } from './lib/db-pg.js';
import { loadDbCaches } from './lib/db.js';
import { getEpisode, getLatestScript } from './lib/youtube-studio-repository.js';
import { getProductionPackageByEpisode, getProductionAssets } from './lib/youtube-studio-production-repository.js';

async function run() {
  const pool = getPgPool();
  const episodeId = 'ytep_3suyq35q';
  const tenantId = 'default_tenant';

  try {
    await loadDbCaches();

    console.log('1. Fetching approved script...');
    const script = await getLatestScript(episodeId);
    if (!script || script.status !== 'approved') {
      throw new Error('Latest script is not approved!');
    }

    console.log('2. Fetching active production package...');
    const pkg = await getProductionPackageByEpisode(episodeId);
    if (!pkg) throw new Error('No active production package found');

    const assets = await getProductionAssets(pkg.id);
    const voiceoverAssets = assets.filter(a => a.asset_type === 'voiceover').sort((a, b) => a.scene_index - b.scene_index);
    const scenes = script.script_json.scenes;

    console.log('3. Syncing corrected English voiceover text (strict +1 offset)...');
    
    for (const voAsset of voiceoverAssets) {
      const scene = scenes.find(s => s.scene_index === voAsset.scene_index + 1);
      const newVoiceoverText = scene ? scene.voiceover : null;

      if (!newVoiceoverText) {
        console.warn(`No voiceover text found in script for scene index ${voAsset.scene_index + 1}`);
        continue;
      }

      console.log(`Updating Asset ${voAsset.id} (Scene Index: ${voAsset.scene_index} -> Scene ${voAsset.scene_index + 1}) -> "${newVoiceoverText.slice(0, 50)}..."`);
      
      // Update asset text and set status to queued
      await pgQuery(`
        UPDATE youtube_production_assets 
        SET status = 'queued', prompt_snapshot = $1, output_asset_json = NULL, error_code = NULL, error_message = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [newVoiceoverText, voAsset.id]);

      // Delete any existing job
      await pgQuery(`
        DELETE FROM youtube_production_jobs 
        WHERE asset_id = $1 AND job_kind = 'voiceover'
      `, [voAsset.id]);
    }

    // Set package status back to generating
    await pgQuery(`
      UPDATE youtube_production_packages 
      SET status = 'generating', preview_asset_json = NULL, final_asset_json = NULL, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1
    `, [pkg.id]);

    // Delete old assembly jobs
    await pgQuery(`
      DELETE FROM youtube_production_jobs 
      WHERE production_package_id = $1 AND job_kind IN ('assembly', 'final_render')
    `, [pkg.id]);

    // Queue corrected voiceover jobs
    for (const voAsset of voiceoverAssets) {
      const jobId = `ytpj_fix_${Math.random().toString(36).slice(2, 10)}`;
      const idempotencyKey = `idemp_prod_job_${voAsset.id}_fix_v2`;

      await pgQuery(`
        INSERT INTO youtube_production_jobs (id, tenant_id, production_package_id, asset_id, job_kind, idempotency_key, status)
        VALUES ($1, $2, $3, $4, 'voiceover', $5, 'queued')
      `, [jobId, tenantId, pkg.id, voAsset.id, idempotencyKey]);

      await pgQuery(`
        INSERT INTO scheduler_jobs (queue_name, payload) 
        VALUES ($1, $2)
      `, ['youtube_production_asset', JSON.stringify({ job_id: jobId, tenant_id: tenantId })]);
    }

    console.log('Successfully aligned and queued corrected voiceover jobs!');

  } catch (e) {
    console.error('VO correction failed:', e);
  } finally {
    await new Promise(r => setTimeout(r, 1000));
    await pool.end();
  }
}

run();
