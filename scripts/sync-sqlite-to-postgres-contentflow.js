import { getDb } from '../lib/db.js';
import { pgQuery } from '../lib/db-pg.js';
import { generateVideoId } from '../lib/id-generator.js';

const db = getDb();

console.log('🚀 Executing Single-Pass ContentFlow Sync: SQLite Node 1 ➡️ PostgreSQL Storage Node 3...');

const sqliteItems = await db.prepare(`SELECT * FROM content_flow_items WHERE source_type = 'opc'`).all();
console.log(`Found ${sqliteItems.length} OPC items in SQLite local DB.`);

let syncedCount = 0;
for (const item of sqliteItems) {
  // Standardize Video ID if missing or generic
  let stdVideoId = item.video_id;
  if (!stdVideoId || stdVideoId.startsWith('VID-')) {
    const seq = String(item.source_item_id || '01').split('.')[0];
    stdVideoId = generateVideoId({
      accountName: item.account_name,
      modulePrefix: 'opc',
      campaignId: item.source_campaign_id,
      sequence: seq
    });
    // Update back to SQLite
    await db.prepare('UPDATE content_flow_items SET video_id = ? WHERE id = ?').run(stdVideoId, item.id);
  }

  // Push to PostgreSQL Storage DB Node 3
  try {
    await pgQuery(`
      INSERT INTO content_flow_items (
        id, source_type, source_campaign_id, source_item_id, account_name, video_id,
        campaign_title, hook, nama_produk, link_affiliate, link_produk, caption,
        production_date, url_asset, drive_link, nextcloud_url, pipeline_status,
        tiktok_status, facebook_status, instagram_status, youtube_status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      ON CONFLICT (id) DO UPDATE SET
        account_name = EXCLUDED.account_name,
        video_id = EXCLUDED.video_id,
        campaign_title = EXCLUDED.campaign_title,
        hook = EXCLUDED.hook,
        nama_produk = EXCLUDED.nama_produk,
        link_produk = EXCLUDED.link_produk,
        caption = EXCLUDED.caption,
        url_asset = EXCLUDED.url_asset,
        drive_link = EXCLUDED.drive_link,
        pipeline_status = EXCLUDED.pipeline_status,
        updated_at = EXCLUDED.updated_at;
    `, [
      item.id, item.source_type, item.source_campaign_id, String(item.source_item_id || ''),
      item.account_name, stdVideoId, item.campaign_title, item.hook, item.nama_produk,
      item.link_affiliate || '', item.link_produk || '', item.caption || '',
      item.production_date, item.url_asset, item.drive_link || '', item.nextcloud_url || '',
      item.pipeline_status || 'Completed', item.tiktok_status || 'Not Published',
      item.facebook_status || 'Not Published', item.instagram_status || 'Not Published',
      item.youtube_status || 'Not Published', item.created_at, new Date().toISOString()
    ]);
    syncedCount++;
    console.log(`  ✅ Synced [${item.id}] (Video ID: ${stdVideoId}) to PostgreSQL Node 3`);
  } catch (err) {
    console.error(`❌ Error syncing item ${item.id} to PostgreSQL:`, err.message);
  }
}

console.log(`🎉 Successfully synced ${syncedCount} OPC items with Standardized Video IDs to PostgreSQL Node 3!`);
process.exit(0);
