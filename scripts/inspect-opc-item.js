import { getPgPool } from '../lib/db-pg.js';

async function main() {
  const pool = getPgPool();
  try {
    console.log('=== Schema of re_campaigns ===');
    const res = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 're_campaigns'
    `);
    console.log(res.rows);
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}

main();
