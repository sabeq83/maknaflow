import { pgQuery } from './lib/db-pg.js';

async function main() {
  for (const schema of ['dev', 'staging']) {
    console.log(`\n=== Keys in ${schema} schema ===`);
    await pgQuery(`SET search_path TO ${schema};`);
    try {
      const keys = await pgQuery("SELECT id, tenant_id, key_name, status, is_active, daily_limit FROM gemini_api_keys;");
      console.log(`Found ${keys.rows.length} keys in ${schema}.`);
      for (const k of keys.rows) {
        console.log(`- ID: ${k.id}, Tenant: ${k.tenant_id}, Name: ${k.key_name}, Status: ${k.status}, Active: ${k.is_active}, Limit: ${k.daily_limit}`);
      }
    } catch (e) {
      console.error(`Error in ${schema}:`, e.message);
    }
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
