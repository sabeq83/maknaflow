import { pgQuery } from './lib/db-pg.js';
import { testGeminiConnection } from './lib/gemini.js';
import { loadDbCaches } from './lib/db.js';
import { tenantContext } from './lib/tenant-context.js';

async function main() {
  await pgQuery('SET search_path TO dev;');
  await loadDbCaches();

  const keys = await pgQuery("SELECT id, key_name, api_key, status, is_active FROM gemini_api_keys WHERE tenant_id = 'default_tenant';");
  console.log(`Found ${keys.rows.length} keys for default_tenant.`);

  for (const k of keys.rows) {
    console.log(`Testing key: ${k.key_name} (ID: ${k.id}, status: ${k.status})...`);
    // Mask key
    const maskedKey = k.api_key.substring(0, 8) + '...' + k.api_key.substring(k.api_key.length - 4);
    console.log(`Masked Key: ${maskedKey}`);
    
    const result = await testGeminiConnection(k.api_key);
    if (result.success) {
      console.log(`✅ Success: ${result.message}`);
    } else {
      console.log(`❌ Failed: ${result.message}`);
    }
  }

  // Also test the single key gemini_api_key in tenant_settings
  const singleKeyRes = await pgQuery("SELECT setting_value FROM tenant_settings WHERE tenant_id = 'default_tenant' AND setting_key = 'gemini_api_key';");
  if (singleKeyRes.rows.length > 0) {
    const singleKey = singleKeyRes.rows[0].setting_value;
    console.log(`\nTesting single key from tenant_settings (gemini_api_key)...`);
    const maskedKey = singleKey.substring(0, 8) + '...' + singleKey.substring(singleKey.length - 4);
    console.log(`Masked Key: ${maskedKey}`);
    const result = await testGeminiConnection(singleKey);
    if (result.success) {
      console.log(`✅ Success: ${result.message}`);
    } else {
      console.log(`❌ Failed: ${result.message}`);
    }
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
