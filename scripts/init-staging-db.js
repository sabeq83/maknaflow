import pkg from 'pg';
const { Client } = pkg;
import { execSync } from 'child_process';

const PG_HOST = process.env.PGHOST || '100.78.186.123';
const PG_PORT = parseInt(process.env.PGPORT || '5432', 10);
const PG_USER = process.env.PGUSER || 'makna_user';
const PG_PASSWORD = process.env.PGPASSWORD || 'maknagridpass';
const PG_DATABASE = process.env.PGDATABASE || 'maknaflow_db';
const SCHEMA_NAME = 'staging';

async function initStagingDb() {
  console.log('================================================================');
  console.log('🛠️ INITIALIZING POSTGRESQL STAGING SCHEMA');
  console.log('================================================================');
  
  // Hubungkan langsung ke database maknaflow_db
  const pgClient = new Client({
    host: PG_HOST,
    port: PG_PORT,
    user: PG_USER,
    password: PG_PASSWORD,
    database: PG_DATABASE
  });

  try {
    await pgClient.connect();
    console.log(`✓ Connected to PostgreSQL at ${PG_HOST}:${PG_PORT}/${PG_DATABASE}`);
    
    // Buat schema staging
    console.log(`📡 Ensuring schema '${SCHEMA_NAME}' exists...`);
    await pgClient.query(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA_NAME};`);
    console.log(`✓ Schema '${SCHEMA_NAME}' is ready.`);
  } catch (err) {
    console.error('❌ Error checking/creating PostgreSQL staging schema:', err.message);
    process.exit(1);
  } finally {
    await pgClient.end();
  }

  console.log('\n📦 Migrating schema and initial data to staging schema...');
  try {
    // Panggil script migrasi bawaan dengan menyetel search path ke staging
    execSync('node scripts/migrate-sqlite-to-postgres.js', {
      env: {
        ...process.env,
        PGDATABASE: PG_DATABASE,
        PG_SEARCH_PATH: SCHEMA_NAME
      },
      stdio: 'inherit'
    });
    console.log('\n🎉 Staging schema initialized and migrated successfully!');
  } catch (err) {
    console.error('❌ Error during data migration to staging schema:', err.message);
    process.exit(1);
  }
}

initStagingDb();
