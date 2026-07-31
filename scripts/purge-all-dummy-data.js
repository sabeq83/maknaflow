import { getDb } from '../lib/db.js';
import { pgQuery } from '../lib/db-pg.js';

export async function purgeAllDummyData() {
  const db = getDb();
  console.log('[Purge Dummy Data] Starting cleanup of dummybrand records and seed items...');

  const dummyProducts = [
    'Jus Seledri Detox', 'Kopi Susu Gula Aren Organik', 'Madu Hutan Murni Premium',
    'Moisturizer Skin Barrier', 'Granola Superfood Crunchy', 'Sabun Herbal Pepaya',
    'Salep Herbal Pegagan', 'Tonik Rambut Rosela', 'Infused Water Lemon Mint',
    'Cleansing Oil Rose Extract', 'Minyak Zaitun Extra Virgin', 'Teh Hijau Detox Jasmine',
    'Serum Cokelat Glow'
  ];

  // 1. Clean up SQLite content_flow_items
  try {
    const resCfSqlite = await db.prepare(`
      DELETE FROM content_flow_items 
      WHERE account_name LIKE 'dummybrand%' 
         OR account_name = 'dummybrand' 
         OR nama_produk IN (${dummyProducts.map(() => '?').join(',')})
    `).run(...dummyProducts);
    console.log(`[SQLite Purge] Deleted ${resCfSqlite.changes} dummy item(s) from local content_flow_items.`);
  } catch (e) {
    console.warn('[SQLite Purge] Error cleaning SQLite content_flow_items:', e.message);
  }

  // 2. Clean up SQLite brand_profiles & user_brands
  try {
    const resBp = await db.prepare("DELETE FROM brand_profiles WHERE id LIKE 'dummybrand%' OR brand_name LIKE 'dummybrand%'").run();
    const resUb = await db.prepare("DELETE FROM user_brands WHERE brand_id LIKE 'dummybrand%'").run();
    console.log(`[SQLite Purge] Deleted ${resBp.changes} brand_profiles and ${resUb.changes} user_brands.`);
  } catch (e) {
    console.warn('[SQLite Purge] Error cleaning brand_profiles:', e.message);
  }

  // 3. Clean up PostgreSQL Node 3 content_flow_items
  try {
    const pgRes = await pgQuery(`
      DELETE FROM content_flow_items 
      WHERE account_name LIKE 'dummybrand%' 
         OR account_name = 'dummybrand' 
         OR nama_produk = ANY($1::text[])
    `, [dummyProducts]);
    console.log(`[PostgreSQL Purge] Deleted ${pgRes.rowCount || 0} dummy item(s) from PostgreSQL Node 3.`);
  } catch (e) {
    console.warn('[PostgreSQL Purge] Error cleaning Node 3 PostgreSQL:', e.message);
  }

  console.log('🎉 [Purge Dummy Data] Cleanup complete!');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  purgeAllDummyData().catch(console.error);
}
