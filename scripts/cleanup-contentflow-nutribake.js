import { pgQuery } from '../lib/db-pg.js';
import { getDb } from '../lib/db.js';
import { scanAndSyncExistingCampaigns } from '../lib/contentflow-ingest.js';

async function main() {
  console.log('🧹 Starting ContentFlow database cleanup and deduplication...');

  // 1. PostgreSQL Node 3 Cleanup
  try {
    console.log('📡 [PostgreSQL] Deleting duplicate content_flow_items with cf_nutribake_re_% and cf_re_% prefixes...');
    const delRes1 = await pgQuery("DELETE FROM content_flow_items WHERE id LIKE 'cf_nutribake_re_%' OR id LIKE 'cf_re_%';");
    console.log(` ✅ [PostgreSQL] Deleted rows: ${delRes1.rowCount}`);

    console.log('📡 [PostgreSQL] Converting all account names to lowercase...');
    const updateRes1 = await pgQuery("UPDATE content_flow_items SET account_name = LOWER(account_name) WHERE account_name IS NOT NULL;");
    console.log(` ✅ [PostgreSQL] Updated rows: ${updateRes1.rowCount}`);
  } catch (pgErr) {
    console.error(' ❌ [PostgreSQL Error]', pgErr.message);
  }

  // 2. SQLite Node 1 Local Cleanup
  try {
    console.log('🖥️ [SQLite] Deleting duplicate content_flow_items with cf_nutribake_re_% and cf_re_% prefixes...');
    const db = getDb();
    
    const delRes2 = await db.prepare("DELETE FROM content_flow_items WHERE id LIKE 'cf_nutribake_re_%' OR id LIKE 'cf_re_%';").run();
    console.log(` ✅ [SQLite] Deleted rows: ${delRes2.changes}`);

    console.log('🖥️ [SQLite] Converting all account names to lowercase...');
    const updateRes2 = await db.prepare("UPDATE content_flow_items SET account_name = LOWER(account_name) WHERE account_name IS NOT NULL;").run();
    console.log(` ✅ [SQLite] Updated rows: ${updateRes2.changes}`);
  } catch (sqErr) {
    console.error(' ❌ [SQLite Error]', sqErr.message);
  }

  // 3. Re-scan and Sync all campaign items to recreate standard items with correct details
  try {
    console.log('🔄 Re-running full scan and sync of all campaign items into ContentFlow...');
    const totalSynced = await scanAndSyncExistingCampaigns();
    console.log(` ✅ Successfully scanned and synchronized ${totalSynced} items with proper casing and aligned IDs!`);
  } catch (syncErr) {
    console.error(' ❌ [Sync Error]', syncErr.message);
  }

  console.log('🎉 Cleanup and synchronization completed successfully!');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Fatal cleanup script error:', err);
  process.exit(1);
});
