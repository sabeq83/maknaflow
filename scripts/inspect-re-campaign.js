import { getPgPool } from '../lib/db-pg.js';

async function main() {
  const pool = getPgPool();
  try {
    const campaignId = 're_260804_9vhs3i';
    const res = await pool.query('SELECT * FROM re_campaign_items WHERE campaign_id = $1 AND id = 2', [campaignId]);
    console.log(res.rows[0]);
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}

main();
