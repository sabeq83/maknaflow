import { getPgPool } from '../lib/db-pg.js';

async function main() {
  const pool = getPgPool();
  try {
    console.log('=== Schema of content_planners ===');
    const res = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'content_planners'
    `);
    console.log(res.rows);
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}

main();
