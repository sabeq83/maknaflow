import { getDb, loadDbCaches } from '../lib/db.js';
import { scanAndSyncExistingCampaigns } from '../lib/contentflow-ingest.js';

async function main() {
  await loadDbCaches();
  const db = getDb();
  try {
    console.log('=== Running scanAndSyncExistingCampaigns ===');
    try {
      await scanAndSyncExistingCampaigns('opc_260804_opb4zk');
      console.log('Scan completed successfully!');
    } catch (scanErr) {
      console.error('Scan failed with error:', scanErr.message);
      console.error('Error object:', scanErr);
      if (scanErr.stack) console.error('Stack:', scanErr.stack);
    }
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}

main();
