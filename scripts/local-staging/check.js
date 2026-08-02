import pg from 'pg';
import { loadStagingEnv } from './env.js';

const { Client } = pg;
const env = loadStagingEnv();
let failed = false;

function result(ok, message) {
  console.log(`${ok ? '✓' : '✗'} ${message}`);
  if (!ok) failed = true;
}

async function probe(url, required) {
  try {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(2500) });
    result(response.status > 0, `${url} responded with HTTP ${response.status}`);
  } catch (error) {
    result(!required, `${url} is not running${required ? '' : ' (optional)'}`);
  }
}

async function main() {
  result(env.HOSTNAME === '127.0.0.1', 'Web host is loopback-only');
  result(env.API_HOST === '127.0.0.1', 'API host is loopback-only');
  result(env.PGHOST === '127.0.0.1', 'PostgreSQL host is loopback-only');
  result(env.ENABLE_BACKGROUND_SERVICES === 'false', 'Background services are disabled');
  result(env.REDIS_ENABLED === 'false', 'Redis queues are disabled');

  const client = new Client({ host: env.PGHOST, port: Number(env.PGPORT), user: env.PGUSER, password: env.PGPASSWORD, database: env.PGDATABASE });
  try {
    await client.connect();
    const db = await client.query("SELECT current_database() AS database, current_user AS role, to_regclass('public.users') AS users_table");
    result(db.rows[0].database === 'maknaflow_staging', 'Connected to maknaflow_staging');
    result(Boolean(db.rows[0].users_table), 'Required users table exists');
  } catch (error) {
    result(false, `PostgreSQL check failed: ${error.message}`);
  } finally {
    await client.end().catch(() => {});
  }

  await probe('http://127.0.0.1:5010/login', false);
  await probe('http://127.0.0.1:7010/health', false);
  process.exit(failed ? 1 : 0);
}

main();
