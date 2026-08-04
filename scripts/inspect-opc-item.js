import { getPgPool } from '../lib/db-pg.js';

async function main() {
  const pool = getPgPool();
  try {
    console.log('=== Schema of bridge_injector_items ===');
    const res = await pool.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'bridge_injector_items'
    `);
    console.log(res.rows);
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}

main();
