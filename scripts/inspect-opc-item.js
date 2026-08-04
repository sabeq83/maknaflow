import { getDb, loadDbCaches } from '../lib/db.js';

async function main() {
  await loadDbCaches();
  const db = getDb();
  try {
    console.log('=== Checking campaign items account_name ===');
    const rows = await db.prepare(`
      SELECT id, account_name, video_id, pipeline_status
      FROM content_flow_items
      WHERE source_campaign_id = 'opc_260804_opb4zk'
      -- tenant_id
    `).all();
    console.log(rows);
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}

main();
