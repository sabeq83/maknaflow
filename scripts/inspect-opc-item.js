import { getDb, loadDbCaches } from '../lib/db.js';

async function main() {
  await loadDbCaches();
  const db = getDb();
  try {
    console.log('=== Schema of content_planners ===');
    const colsPlanners = await db.prepare(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'content_planners'
    `).all();
    console.log(colsPlanners);

    console.log('=== Schema of content_planner_rows ===');
    const colsRows = await db.prepare(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'content_planner_rows'
    `).all();
    console.log(colsRows);
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}

main();
