import { getPgPool } from '../lib/db-pg.js';

async function main() {
  const pool = getPgPool();
  const campaignId = 're_260804_9vhs3i';
  try {
    const tables = ['re_campaigns', 'strategic_campaigns', 'pillar_campaigns', 'recipe_campaigns', 'instant_campaigns'];
    for (const table of tables) {
      try {
        const res = await pool.query(`SELECT id FROM ${table} WHERE id = $1`, [campaignId]);
        if (res.rows.length > 0) {
          console.log(`Found in ${table}:`, res.rows[0]);
        }
      } catch (e) {
        console.error(`Error querying ${table}:`, e.message);
      }
    }
    const itemTables = ['re_campaign_items', 'strategic_campaign_items', 'pillar_campaign_items', 'recipe_items', 'instant_campaign_items'];
    for (const table of itemTables) {
      try {
        const res = await pool.query(`SELECT id, campaign_id FROM ${table} WHERE campaign_id = $1`, [campaignId]);
        if (res.rows.length > 0) {
          console.log(`Found items in ${table}: count =`, res.rows.length);
        }
      } catch (e) {
        console.error(`Error querying items in ${table}:`, e.message);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}

main();
