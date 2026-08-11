import { pgQuery } from './lib/db-pg.js';

async function main() {
  await pgQuery(`SET search_path TO dev;`);

  const settings = await pgQuery(`SELECT key, val FROM settings WHERE key LIKE '%fb%' OR key LIKE '%token%';`);
  console.log('=== Settings in dev schema ===', settings.rows);
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
