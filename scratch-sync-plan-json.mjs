import { getPgPool, pgQuery } from './lib/db-pg.js';
import { getEpisode, getLatestScript } from './lib/youtube-studio-repository.js';
import { getProductionPackageByEpisode } from './lib/youtube-studio-production-repository.js';
import { loadDbCaches } from './lib/db.js';

async function run() {
  const pool = getPgPool();
  const episodeId = 'ytep_3suyq35q';

  try {
    await loadDbCaches();
    console.log('Fetching approved script...');
    const script = await getLatestScript(episodeId);
    if (!script || script.status !== 'approved') {
      throw new Error('Latest script is not approved!');
    }

    console.log('Fetching active production package...');
    const pkg = await getProductionPackageByEpisode(episodeId);
    if (!pkg) throw new Error('No active production package found');

    const scriptScenes = script.script_json.scenes;
    const planJson = pkg.plan_json;

    console.log('Syncing voiceovers in plan_json...');
    for (let s of planJson.scenes) {
      const scriptScene = scriptScenes.find(ss => ss.scene_index === s.scene_index);
      if (scriptScene) {
        console.log(`Syncing Scene ${s.scene_index}: "${s.voiceover.slice(0, 30)}..." -> "${scriptScene.voiceover.slice(0, 30)}..."`);
        s.voiceover = scriptScene.voiceover;
      }
    }

    // Save updated plan_json back to DB
    await pgQuery(`
      UPDATE youtube_production_packages 
      SET plan_json = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2
    `, [JSON.stringify(planJson), pkg.id]);

    console.log('Successfully synced plan_json voiceover texts in the database!');

  } catch (e) {
    console.error('Failed to sync plan_json:', e);
  } finally {
    await new Promise(r => setTimeout(r, 1000));
    await pool.end();
  }
}

run();
