import { pgQuery } from './lib/db-pg.js';
import { getSetting, loadDbCaches } from './lib/db.js';
import { tenantContext } from './lib/tenant-context.js';

async function main() {
  console.log('=== Checking DB search_path ===');
  const pathRes = await pgQuery('SHOW search_path;');
  console.log('Current search_path:', pathRes.rows);

  // Check dev schema first
  console.log('\n--- Checking dev schema ---');
  await pgQuery('SET search_path TO dev;');
  await checkSchemaData();

  // Check staging schema
  console.log('\n--- Checking staging schema ---');
  await pgQuery('SET search_path TO staging;');
  await checkSchemaData();
}

async function checkSchemaData() {
  try {
    const keys = await pgQuery('SELECT id, tenant_id, key_name, status, is_active, daily_limit, tier FROM gemini_api_keys;');
    console.log('Gemini API Keys count:', keys.rows.length);
    console.table(keys.rows.map(k => ({
      id: k.id,
      tenant_id: k.tenant_id,
      key_name: k.key_name,
      status: k.status,
      is_active: k.is_active,
      daily_limit: k.daily_limit,
      tier: k.tier
    })));

    const settings = await pgQuery("SELECT * FROM settings WHERE key LIKE '%gemini%';");
    console.log('Global settings (gemini):');
    console.table(settings.rows);

    const tenantSettings = await pgQuery("SELECT * FROM tenant_settings WHERE setting_key LIKE '%gemini%';");
    console.log('Tenant settings (gemini):');
    console.table(tenantSettings.rows);

  } catch (err) {
    console.error('Error checking schema:', err);
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
