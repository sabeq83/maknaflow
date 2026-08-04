import { getDb, loadDbCaches } from '../lib/db.js';

async function main() {
  await loadDbCaches();
  const db = getDb();
  try {
    const item = await db.prepare('SELECT * FROM pillar_campaign_items LIMIT 1 -- tenant_id').get();
    console.log('Columns:', Object.keys(item || {}));
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}

main();
