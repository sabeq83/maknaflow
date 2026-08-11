import { pgQuery } from './lib/db-pg.js';

async function main() {
  await pgQuery(`SET search_path TO dev;`);

  const settings = await pgQuery(`SELECT tenant_id, setting_key, setting_value FROM tenant_settings WHERE setting_key LIKE '%fb%' OR setting_key LIKE '%token%';`);
  console.log('=== Tenant Settings in dev schema ===', settings.rows);
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
