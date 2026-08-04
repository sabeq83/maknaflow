import { getDb, loadDbCaches } from '../lib/db.js';
import { syncItemAssetsToCloud } from '../lib/manual-asset-uploader.js';

async function main() {
  // Explicitly initialize caches first to bypass the 500ms deferred startup delay
  await loadDbCaches();

  const db = getDb();
  try {
    const itemId = 46;
    console.log(`=== Starting manual upload sync for Item #${itemId} ===`);
    const result = await syncItemAssetsToCloud('opc', itemId);
    console.log('Upload sync result:', result);

    console.log('\n=== Checking updated database row status ===');
    const item = await db.prepare('SELECT id, upload_status, drive_link FROM pillar_campaign_items WHERE id = ? -- tenant_id').get(itemId);
    console.log(item);
  } catch (err) {
    console.error('Error during manual sync:', err);
    console.error('Error stack:', err.stack);
  }
  process.exit(0);
}

main();
