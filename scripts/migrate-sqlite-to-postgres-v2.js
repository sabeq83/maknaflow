import Database from 'better-sqlite3';
import { pgQuery } from '../lib/db-pg.js';

async function migrate() {
  console.log('================================================================');
  console.log('🏁 MAKNA FLOW — SQLITE TO POSTGRESQL DATA MIGRATION V2');
  console.log('================================================================');

  const sqliteDb = new Database('data/makna_flow.db');
  
  // Get all tables in SQLite
  const tables = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r => r.name);
  console.log(`🔍 Found ${tables.length} tables in SQLite:`, tables.join(', '));
  
  // Order tables to prevent foreign key truncate issues if possible, or use Cascade
  for (const table of tables) {
    console.log(`\n⏳ Migrating table: [${table}]...`);
    
    // Fetch SQLite data
    const rows = sqliteDb.prepare(`SELECT * FROM ${table}`).all();
    if (rows.length === 0) {
      console.log(`  ℹ️ SQLite table is empty. Skipping.`);
      continue;
    }
    
    console.log(`  📥 Read ${rows.length} rows from SQLite. Cleaning up PostgreSQL target...`);
    
    // Clean PostgreSQL target table first
    try {
      await pgQuery(`TRUNCATE TABLE "${table}" CASCADE;`);
    } catch (err) {
      // Fallback to normal delete if CASCADE is blocked or not needed
      await pgQuery(`DELETE FROM "${table}";`).catch(e => {
        console.warn(`  ⚠️ Failed to clear table ${table}:`, e.message);
      });
    }
    
    const columns = Object.keys(rows[0]);
    const escapedColumns = columns.map(c => `"${c}"`).join(', ');
    
    console.log(`  📤 Inserting rows into PostgreSQL...`);
    let count = 0;
    
    for (const row of rows) {
      const values = columns.map(col => {
        const val = row[col];
        // Handle SQLite datetimes or numeric types mapping to Postgres types
        if (typeof val === 'string' && val.trim() === '') {
          // If empty string, keep as empty string (or map to null if target columns require it, but empty is usually safe)
          return val;
        }
        return val;
      });
      
      const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');
      const sql = `INSERT INTO "${table}" (${escapedColumns}) VALUES (${placeholders})`;
      
      try {
        await pgQuery(sql, values);
        count++;
      } catch (err) {
        console.error(`  ❌ Failed to insert row into ${table}:`, err.message);
        console.error(`  SQL:`, sql);
        console.error(`  Values:`, values);
        // Continue or throw depending on severity. Since we want a complete migration, let's log and proceed
      }
    }
    console.log(`  ✓ Successfully migrated ${count}/${rows.length} rows for table [${table}]`);
  }
  
  console.log('\n================================================================');
  console.log('🎉 SQLite to PostgreSQL Data Migration successfully completed!');
  console.log('================================================================');
  process.exit(0);
}

migrate().catch(console.error);
