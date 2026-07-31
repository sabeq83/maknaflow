import pkg from 'pg';
const { Client } = pkg;
import { getDb } from '../lib/db.js';

const PG_HOST = process.env.PGHOST || '100.78.186.123';
const PG_PORT = parseInt(process.env.PGPORT || '5432', 10);
const PG_USER = process.env.PGUSER || 'makna_user';
const PG_PASSWORD = process.env.PGPASSWORD || 'maknagridpass';
const PG_DATABASE = process.env.PGDATABASE || 'maknaflow_db';

async function migrateSqliteToPostgres() {
  console.log('🚀 === STARTING SQLITE TO POSTGRESQL DATA MIGRATION === 🚀');
  console.log(`Connecting to PostgreSQL at ${PG_HOST}:${PG_PORT}/${PG_DATABASE}...`);

  const pgClient = new Client({
    host: PG_HOST,
    port: PG_PORT,
    user: PG_USER,
    password: PG_PASSWORD,
    database: PG_DATABASE
  });

  await pgClient.connect();
  const searchPath = process.env.PG_SEARCH_PATH || 'public';
  await pgClient.query(`SET search_path TO ${searchPath};`);
  console.log(`✓ Connected to PostgreSQL Node 3 successfully! (search_path: ${searchPath})`);

  const sqliteDb = getDb();
  const tables = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();

  console.log(`Found ${tables.length} tables in SQLite database.`);

  let totalMigratedRows = 0;

  for (const { name: tableName } of tables) {
    const tableInfo = sqliteDb.prepare(`PRAGMA table_info("${tableName}")`).all();
    if (!tableInfo || tableInfo.length === 0) continue;

    const pkCols = tableInfo.filter(col => col.pk > 0).map(col => `"${col.name}"`);
    const columnDefs = tableInfo.map(col => {
      let pgType = 'TEXT';
      const colTypeUpper = (col.type || '').toUpperCase();
      if (colTypeUpper.includes('INT')) pgType = 'BIGINT';
      else if (colTypeUpper.includes('REAL') || colTypeUpper.includes('FLOAT') || colTypeUpper.includes('DOUBLE')) pgType = 'DOUBLE PRECISION';
      else if (colTypeUpper.includes('BLOB')) pgType = 'BYTEA';

      const isInlinePk = pkCols.length === 1 && col.pk === 1;
      return `"${col.name}" ${pgType}${isInlinePk ? ' PRIMARY KEY' : ''}`;
    });

    if (pkCols.length > 1) {
      columnDefs.push(`PRIMARY KEY (${pkCols.join(', ')})`);
    }

    // Create table in PostgreSQL
    const createTableSql = `CREATE TABLE IF NOT EXISTS "${tableName}" (${columnDefs.join(', ')});`;
    await pgClient.query(createTableSql);

    // Read rows from SQLite
    const rows = sqliteDb.prepare(`SELECT * FROM "${tableName}"`).all();
    if (rows.length === 0) {
      console.log(`  [${tableName}] 0 rows (table created)`);
      continue;
    }

    const cols = tableInfo.map(c => c.name);
    const colNamesStr = cols.map(c => `"${c}"`).join(', ');

    // Batch insert into PostgreSQL
    let count = 0;
    for (const row of rows) {
      const placeholders = cols.map((_, idx) => `$${idx + 1}`).join(', ');
      const values = cols.map(c => row[c] === undefined ? null : row[c]);

      // Conflict handling for Primary Keys
      const pkCols = tableInfo.filter(c => c.pk > 0).map(c => `"${c.name}"`);
      let onConflictSql = 'ON CONFLICT DO NOTHING';
      if (pkCols.length > 0) {
        const updateSets = cols.filter(c => !pkCols.includes(`"${c}"`)).map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');
        if (updateSets.length > 0) {
          onConflictSql = `ON CONFLICT (${pkCols.join(', ')}) DO UPDATE SET ${updateSets}`;
        }
      }

      const insertSql = `INSERT INTO "${tableName}" (${colNamesStr}) VALUES (${placeholders}) ${onConflictSql};`;
      try {
        await pgClient.query(insertSql, values);
        count++;
      } catch (err) {
        console.error(`  ❌ Error inserting row into ${tableName}:`, err.message);
      }
    }

    console.log(`  ✓ [${tableName}] Migrated ${count}/${rows.length} rows`);
    totalMigratedRows += count;
  }

  await pgClient.end();
  console.log('\n🎉 === MIGRATION COMPLETED SUCCESSFULLY! === 🎉');
  console.log(`Total Rows Migrated to PostgreSQL: ${totalMigratedRows}`);
}

migrateSqliteToPostgres().catch(err => {
  console.error('Fatal Migration Error:', err);
  process.exit(1);
});
