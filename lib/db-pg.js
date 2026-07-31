import pkg from 'pg';
const { Pool } = pkg;

const PG_HOST = process.env.PGHOST || '100.78.186.123';
const PG_PORT = parseInt(process.env.PGPORT || '5432', 10);
const PG_USER = process.env.PGUSER || 'makna_user';
const PG_PASSWORD = process.env.PGPASSWORD || 'maknagridpass';
const PG_DATABASE = process.env.PGDATABASE || 'maknaflow_db';

let pool;

export function getPgPool() {
  if (!pool) {
    pool = new Pool({
      host: PG_HOST,
      port: PG_PORT,
      user: PG_USER,
      password: PG_PASSWORD,
      database: PG_DATABASE,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('[PostgreSQL Pool Error]', err);
    });

    pool.on('connect', (client) => {
      const searchPath = process.env.PG_SEARCH_PATH || 'public';
      client.query(`SET search_path TO ${searchPath};`).catch(err => {
        console.error(`[PostgreSQL] Failed to set search_path to ${searchPath}:`, err.message);
      });
    });

    console.log(`[PostgreSQL] Connection Pool initialized to ${PG_HOST}:${PG_PORT}/${PG_DATABASE} (schema: ${process.env.PG_SEARCH_PATH || 'public'})`);

    pool.query(`ALTER TABLE content_flow_items ADD COLUMN IF NOT EXISTS catatan TEXT;`).catch(err => {
      console.warn('[PostgreSQL Auto-Migration Warning] Gagal memeriksa/menambahkan kolom catatan:', err.message);
    });

    const migrateBridgeCols = async () => {
      try {
        const schema = process.env.PG_SEARCH_PATH || 'public';
        // check if bridge_injector_campaigns table exists
        const tableCheck = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = $1 
            AND table_name = 'bridge_injector_campaigns'
          );
        `, [schema]);
        
        if (tableCheck.rows[0].exists) {
          await pool.query(`ALTER TABLE bridge_injector_campaigns ADD COLUMN IF NOT EXISTS account_name TEXT;`);
          await pool.query(`ALTER TABLE bridge_injector_campaigns ADD COLUMN IF NOT EXISTS paused_previous_status TEXT;`);
          await pool.query(`ALTER TABLE bridge_injector_campaigns ADD COLUMN IF NOT EXISTS voice_provider TEXT DEFAULT 'minimax';`);
          await pool.query(`ALTER TABLE bridge_injector_campaigns ADD COLUMN IF NOT EXISTS voice_persona TEXT DEFAULT 'Indonesian_casual_reporter_vv2';`);
        }
        
        const itemsCheck = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = $1 
            AND table_name = 'bridge_injector_items'
          );
        `, [schema]);
        
        if (itemsCheck.rows[0].exists) {
          await pool.query(`ALTER TABLE bridge_injector_items ADD COLUMN IF NOT EXISTS account_name TEXT;`);
          await pool.query(`ALTER TABLE bridge_injector_items ADD COLUMN IF NOT EXISTS voice_provider TEXT DEFAULT 'minimax';`);
          await pool.query(`ALTER TABLE bridge_injector_items ADD COLUMN IF NOT EXISTS voice_persona TEXT DEFAULT 'Indonesian_casual_reporter_vv2';`);
          await pool.query(`ALTER TABLE bridge_injector_items ADD COLUMN IF NOT EXISTS original_clip1_filename TEXT;`);
          await pool.query(`ALTER TABLE bridge_injector_items ADD COLUMN IF NOT EXISTS nextcloud_url TEXT;`);
        }
        console.log('[PostgreSQL Staging] Auto-migration check completed for bridge_injector tables.');
      } catch (err) {
        console.warn('[PostgreSQL Auto-Migration Warning] Gagal migrasi kolom bridge_injector:', err.message);
      }
    };
    migrateBridgeCols();

    const bpNewCols = [
      'storage_provider TEXT',
      'nextcloud_target_folder TEXT',
      'drive_target_folder TEXT',
      'drive_glabs_folder_id TEXT',
      'webhook_host TEXT',
      'webhook_port TEXT',
      'webhook_api_key TEXT'
    ];
    for (const col of bpNewCols) {
      const [name, type] = col.split(' ');
      pool.query(`ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS ${name} ${type};`).catch(err => {
        console.warn(`[PostgreSQL Auto-Migration Warning] Gagal memeriksa/menambahkan kolom ${name}:`, err.message);
      });
    }

    pool.query(`
      CREATE TABLE IF NOT EXISTS glabs_task_routes (
        task_id TEXT PRIMARY KEY,
        host TEXT NOT NULL,
        port TEXT NOT NULL,
        api_key TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(err => {
      console.warn('[PostgreSQL Auto-Migration Warning] Gagal membuat tabel glabs_task_routes:', err.message);
    });
  }
  return pool;
}

export async function pgQuery(text, params = []) {
  const pool = getPgPool();
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`[PostgreSQL Slow Query] ${duration}ms: ${text.slice(0, 80)}`);
    }
    return res;
  } catch (err) {
    console.error('[PostgreSQL Query Error]', err.message, 'SQL:', text);
    throw err;
  }
}
