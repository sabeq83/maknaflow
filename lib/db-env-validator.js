import fs from 'node:fs';
import path from 'node:path';

export function loadAndValidateDbEnv(options = {}) {
  const { allowDefaultFallback = false, requireDevSchema = true } = options;

  // If environment variables are missing, attempt to load from .env.local
  const envLocalPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) {
    const content = fs.readFileSync(envLocalPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }

  const required = ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required database environment variable: ${key}`);
    }
  }

  const schema = process.env.PG_SEARCH_PATH || 'dev';
  if (requireDevSchema && schema !== 'dev') {
    throw new Error(`Invalid database schema: "${schema}". Script must run explicitly against "dev" schema.`);
  }

  return {
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    schema
  };
}
