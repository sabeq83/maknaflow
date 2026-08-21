import fs from 'fs';
import path from 'path';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '0.0.0.0']);
const REQUIRED = ['HOSTNAME', 'PORT', 'API_HOST', 'API_PORT', 'PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'];

export function loadStagingEnv() {
  const envPath = path.join(process.cwd(), '.env.staging.local');
  if (!fs.existsSync(envPath)) {
    throw new Error('Missing .env.staging.local. Copy .env.staging.local.example first.');
  }

  const env = { ...process.env };
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }

  const isExistingDb = process.env.USE_EXISTING_TEST_DB === 'true';
  if (isExistingDb) {
    const localEnvPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(localEnvPath)) {
      for (const rawLine of fs.readFileSync(localEnvPath, 'utf8').split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const separator = line.indexOf('=');
        if (separator < 1) continue;
        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (key.startsWith('PG')) {
          env[key] = value;
        }
      }
    }
  }

  for (const key of REQUIRED) {
    if (!env[key]) throw new Error(`Missing required staging variable: ${key}`);
  }
  if (env.APP_ENV !== 'staging') throw new Error('APP_ENV must be staging');
  if (!LOOPBACK_HOSTS.has(env.HOSTNAME)) throw new Error('HOSTNAME must be loopback-only');
  if (!LOOPBACK_HOSTS.has(env.API_HOST)) throw new Error('API_HOST must be loopback-only');
  if (!isExistingDb) {
    if (!LOOPBACK_HOSTS.has(env.PGHOST)) throw new Error('PGHOST must be loopback-only');
  }
  if ((env.PORT !== '5010' && env.PORT !== '5020') || (env.API_PORT !== '7010' && env.API_PORT !== '7020')) {
    throw new Error('Staging ports must be PORT=5010/5020 and API_PORT=7010/7020');
  }
  if (!isExistingDb && env.PGDATABASE !== 'maknaflow_staging') throw new Error('PGDATABASE must be maknaflow_staging');

  const forbiddenPattern = /(tail[0-9a-z.-]*\.ts\.net|100\.\d+\.\d+\.\d+)/i;
  for (const [key, value] of Object.entries(env)) {
    if (key === 'STAGING_WEB_ORIGIN' || key === 'MAKNA_PUBLIC_BASE_URL' || key === 'NEXTCLOUD_INTERNAL_BASE') continue;
    if (isExistingDb && key.startsWith('PG')) continue;
    if (typeof value === 'string' && forbiddenPattern.test(value)) {
      throw new Error(`Remote cluster address detected in ${key}`);
    }
  }
  return env;
}
