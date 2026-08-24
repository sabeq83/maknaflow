import pkg from 'pg';
const { Pool } = pkg;
import { invalidateAllVoiceoverAssets } from '../lib/youtube-studio-production-repository.js';

const pool = new Pool({
  host: '100.78.186.123',
  port: 5432,
  database: 'maknaflow_db',
  user: 'makna_user',
  password: 'maknagridpass',
  ssl: false
});

process.env.PG_SEARCH_PATH = 'dev';

async function run() {
  try {
    const episodeId = 'ytep_3suyq35q';
    console.log('Syncing scheduler_jobs sequence...');
    await pool.query("SELECT setval(pg_get_serial_sequence('dev.scheduler_jobs', 'id'), coalesce(max(id), 0) + 1, false) FROM dev.scheduler_jobs");
    
    console.log(`Resetting and queueing all voiceover tracks for episode ${episodeId}...`);
    const res = await invalidateAllVoiceoverAssets(episodeId, { username: 'system' });
    console.log(`Success! Queued ${res.count} voiceover assets.`);
  } catch (err) {
    console.error('Failed to requeue:', err);
  } finally {
    await pool.end();
  }
}

run();
