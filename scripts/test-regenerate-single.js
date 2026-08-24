import pkg from 'pg';
const { Pool } = pkg;
import { invalidateShotAndAssemblies } from '../lib/youtube-studio-production-repository.js';
import { runNextJob } from '../lib/scheduler.js';

const pool = new Pool({
  host: '100.78.186.123',
  port: 5432,
  database: 'maknaflow_db',
  user: 'makna_user',
  password: 'maknagridpass',
  ssl: false
});

process.env.PG_SEARCH_PATH = 'dev';

async function test() {
  try {
    const assetId = 'ytpa_vo_cn2q39kr';
    console.log(`1. Invalidating asset ${assetId} to queue it...`);
    await invalidateShotAndAssemblies(assetId, { username: 'system' });
    console.log('   Asset invalidated & job queued.');

    console.log('2. Running scheduler queue processor to pick up the job...');
    let processed = false;
    for (let i = 0; i < 5; i++) {
      console.log(`   Attempt ${i + 1} to run job...`);
      const result = await runNextJob();
      if (result) {
        console.log('   Job processed successfully:', result);
        processed = true;
        break;
      }
      await new Promise(r => setTimeout(r, 2000));
    }

    if (!processed) {
      console.log('   No job was processed in 5 attempts.');
    }
  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    await pool.end();
  }
}

test();
