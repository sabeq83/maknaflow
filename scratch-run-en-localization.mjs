import { getPgPool, pgQuery } from './lib/db-pg.js';
import { loadDbCaches } from './lib/db.js';
import { 
  getEpisode, 
  getLatestResearchBrief, 
  getChannelStrategy, 
  saveScriptDraft, 
  autoFitScript, 
  approveScript 
} from './lib/youtube-studio-repository.js';
import { generateScript } from './lib/youtube-studio-planner.js';
import { getUniverseCharacters, getUniverseLocations } from './lib/db.js';
import { getProductionPackageByEpisode, getProductionAssets } from './lib/youtube-studio-production-repository.js';

async function run() {
  const pool = getPgPool();
  const episodeId = 'ytep_3suyq35q';
  const tenantId = 'default_tenant';
  const actor = { username: 'system_english_localizer' };

  try {
    await loadDbCaches();

    console.log('--- STARTING ENGLISH LOCALIZATION & SYNC PIPELINE ---');

    console.log('1. Configuring episode metadata in dev database...');
    await pgQuery(`
      UPDATE youtube_episodes 
      SET locale = 'en-US', voice_provider = 'minimax', voice_persona = 'English_WhimsicalGirl' 
      WHERE id = $1
    `, [episodeId]);

    const episode = await getEpisode(episodeId);
    console.log('   Episode status:', episode.status, '| Locale:', episode.locale, '| Persona:', episode.voice_persona);

    console.log('2. Loading approved blueprint & dependencies...');
    const bpRes = await pgQuery('SELECT * FROM youtube_episode_blueprints WHERE episode_id = $1 AND status = \'approved\'', [episodeId]);
    const approvedBp = bpRes.rows[0];
    if (!approvedBp) throw new Error('No approved blueprint found!');

    const research = await getLatestResearchBrief(episodeId);
    const strategy = await getChannelStrategy(episode.channel_id);

    let universe = null;
    if (strategy?.universe_id) {
      const uRes = await pgQuery('SELECT * FROM universe_profiles WHERE id = $1', [strategy.universe_id]);
      if (uRes.rows.length > 0) {
        universe = uRes.rows[0];
        universe.characters = await getUniverseCharacters(strategy.universe_id) || [];
        universe.locations = await getUniverseLocations(strategy.universe_id) || [];
      }
    }
    let visualIdentity = null;
    if (strategy?.visual_identity_preset_id) {
      const viRes = await pgQuery('SELECT * FROM visual_identities WHERE id = $1', [strategy.visual_identity_preset_id]);
      visualIdentity = viRes.rows[0];
    }

    const snapshot = {
      strategy_id: strategy?.id,
      universe_id: strategy?.universe_id,
      universe_snapshot: universe,
      visual_identity_preset_id: strategy?.visual_identity_preset_id,
      visual_identity_snapshot: visualIdentity,
      blueprint_id: approvedBp.id
    };

    console.log('3. Triggering AI script generation in English via Gemini...');
    const generatedScriptJson = await generateScript(
      episode, 
      approvedBp.content_json, 
      research?.content_json, 
      universe, 
      visualIdentity
    );

    console.log('4. Saving new English draft script...');
    const savedDraft = await saveScriptDraft(episodeId, approvedBp.id, generatedScriptJson, snapshot, actor);
    console.log(`   Saved Draft Script ID: ${savedDraft.id} (Version: ${savedDraft.version})`);

    console.log('5. Running Auto-fit Narration to calibrate word counts...');
    const autoFitDraft = await autoFitScript(savedDraft.id, actor);
    console.log(`   Auto-fitted Script ID: ${autoFitDraft.id} (Version: ${autoFitDraft.version})`);

    console.log('6. Approving the calibrated English script...');
    const approvedScript = await approveScript(autoFitDraft.id, actor, 'English localization migration', { ignoreConstraints: true });
    console.log(`   Approved Script ID: ${approvedScript.id} (Status: ${approvedScript.status})`);

    console.log('7. Fetching active production package to sync visual assets...');
    const pkg = await getProductionPackageByEpisode(episodeId);
    if (!pkg) throw new Error('No active production package found');

    const assets = await getProductionAssets(pkg.id);
    const voiceoverAssets = assets.filter(a => a.asset_type === 'voiceover').sort((a, b) => a.scene_index - b.scene_index);
    const scenes = autoFitDraft.script_json.scenes;

    console.log('8. Syncing English voiceover text to assets...');
    for (const voAsset of voiceoverAssets) {
      const scene = scenes.find(s => s.scene_index === voAsset.scene_index + 1 || s.scene_index === voAsset.scene_index);
      const newVoiceoverText = scene ? scene.voiceover : null;

      if (!newVoiceoverText) {
        console.warn(`   No voiceover text found in script for scene index ${voAsset.scene_index}`);
        continue;
      }

      console.log(`   Updating Scene ${voAsset.scene_index} Voiceover -> "${newVoiceoverText.slice(0, 45)}..."`);
      
      // Update asset status and text
      await pgQuery(`
        UPDATE youtube_production_assets 
        SET status = 'queued', prompt_snapshot = $1, output_asset_json = NULL, error_code = NULL, error_message = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [newVoiceoverText, voAsset.id]);

      // Remove any existing voiceover job
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

    // Queue voiceover jobs
    for (const voAsset of voiceoverAssets) {
      const jobId = `ytpj_en_${Math.random().toString(36).slice(2, 10)}`;
      const idempotencyKey = `idemp_prod_job_${voAsset.id}_en_v1`;

      await pgQuery(`
        INSERT INTO youtube_production_jobs (id, tenant_id, production_package_id, asset_id, job_kind, idempotency_key, status)
        VALUES ($1, $2, $3, $4, 'voiceover', $5, 'queued')
      `, [jobId, tenantId, pkg.id, voAsset.id, idempotencyKey]);

      await pgQuery(`
        INSERT INTO scheduler_jobs (queue_name, payload) 
        VALUES ($1, $2)
      `, ['youtube_production_asset', JSON.stringify({ job_id: jobId, tenant_id: tenantId })]);
    }

    console.log('--- ALL STEPS COMPLETED SUCCESSFULLY! English translation, pacing, script approval and asset aligning are done. ---');

  } catch (e) {
    console.error('Localization migration failed:', e);
  } finally {
    await new Promise(r => setTimeout(r, 2000));
    await pool.end();
  }
}

run();
