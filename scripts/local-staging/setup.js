import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import pg from 'pg';
import { loadStagingEnv } from './env.js';
import { ALL_MENU_KEYS, hashPassword } from '../../lib/schema/user-schema.js';

const { Client } = pg;
const env = loadStagingEnv();
const roleName = 'maknaflow_staging';
const databaseName = 'maknaflow_staging';

function quoteIdent(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function pgType(sqliteType = '') {
  const type = sqliteType.toUpperCase();
  if (type.includes('INT')) return 'BIGINT';
  if (type.includes('REAL') || type.includes('FLOAT') || type.includes('DOUBLE')) return 'DOUBLE PRECISION';
  if (type.includes('BLOB')) return 'BYTEA';
  if (type.includes('BOOL')) return 'BOOLEAN';
  if (type.includes('DATE') || type.includes('TIME')) return 'TIMESTAMP';
  return 'TEXT';
}

function pgDefault(value) {
  if (value === null || value === undefined) return '';
  const normalized = String(value).trim();
  if (/^CURRENT_TIMESTAMP$/i.test(normalized)) return ' DEFAULT CURRENT_TIMESTAMP';
  if (/^-?\d+(\.\d+)?$/.test(normalized)) return ` DEFAULT ${normalized}`;
  if (/^'.*'$/.test(normalized)) return ` DEFAULT ${normalized}`;
  return '';
}

async function ensureDatabase() {
  const admin = new Client({
    host: env.PGHOST,
    port: Number(env.PGPORT),
    database: 'postgres',
    user: process.env.USER
  });
  await admin.connect();
  const role = await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [roleName]);
  if (role.rowCount === 0) {
    await admin.query(`CREATE ROLE ${quoteIdent(roleName)} LOGIN PASSWORD '${env.PGPASSWORD.replaceAll("'", "''")}'`);
    console.log(`Created PostgreSQL role ${roleName}`);
  } else {
    await admin.query(`ALTER ROLE ${quoteIdent(roleName)} PASSWORD '${env.PGPASSWORD.replaceAll("'", "''")}'`);
  }
  const database = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
  if (database.rowCount === 0) {
    await admin.query(`CREATE DATABASE ${quoteIdent(databaseName)} OWNER ${quoteIdent(roleName)}`);
    console.log(`Created PostgreSQL database ${databaseName}`);
  }
  await admin.end();
}

async function createBlankSqliteSchema() {
  const sqlitePath = path.join(process.cwd(), 'data', 'makna_flow.db');
  fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
  if (fs.existsSync(sqlitePath)) fs.rmSync(sqlitePath);
  const module = await import('../../lib/db.sqlite-backup.js');
  const sqlite = module.getDb();
  await new Promise(resolve => setTimeout(resolve, 250));
  return sqlite;
}

async function migrateSchema(sqlite, client) {
  const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  for (const { name } of tables) {
    const columns = sqlite.prepare(`PRAGMA table_info(${quoteIdent(name)})`).all();
    const primaryKeys = columns.filter(column => column.pk > 0).sort((a, b) => a.pk - b.pk);
    const definitions = columns.map(column => {
      const inlinePrimaryKey = primaryKeys.length === 1 && column.pk === 1 ? ' PRIMARY KEY' : '';
      const notNull = column.notnull ? ' NOT NULL' : '';
      return `${quoteIdent(column.name)} ${pgType(column.type)}${notNull}${pgDefault(column.dflt_value)}${inlinePrimaryKey}`;
    });
    if (primaryKeys.length > 1) {
      definitions.push(`PRIMARY KEY (${primaryKeys.map(column => quoteIdent(column.name)).join(', ')})`);
    }
    await client.query(`CREATE TABLE IF NOT EXISTS ${quoteIdent(name)} (${definitions.join(', ')})`);

    const indexes = sqlite.prepare(`PRAGMA index_list(${quoteIdent(name)})`).all();
    for (const index of indexes.filter(item => item.unique && item.origin !== 'pk')) {
      const indexColumns = sqlite.prepare(`PRAGMA index_info(${quoteIdent(index.name)})`).all();
      if (indexColumns.length === 0) continue;
      const safeName = `stg_${crypto.createHash('sha1').update(`${name}:${index.name}`).digest('hex').slice(0, 16)}`;
      await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS ${quoteIdent(safeName)} ON ${quoteIdent(name)} (${indexColumns.map(column => quoteIdent(column.name)).join(', ')})`);
    }
  }
  console.log(`Created or verified ${tables.length} PostgreSQL tables`);
}

async function applyStagingMigrations(client) {
  await client.query(`CREATE TABLE IF NOT EXISTS tenants (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await client.query(`CREATE TABLE IF NOT EXISTS tenant_settings (tenant_id TEXT NOT NULL, setting_key TEXT NOT NULL, setting_value TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (tenant_id, setting_key))`);
  await client.query(`INSERT INTO tenants (id, name) VALUES ('default_tenant', 'Local Staging') ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`);

  const tenantTables = ['users', 'brand_profiles', 'gemini_api_keys', 'content_planners', 'strategic_campaigns', 'pillar_campaigns', 're_campaigns', 'instant_campaigns', 'product_extractions', 'content_flow_items', 'ideas', 'knowledge_bases'];
  for (const table of tenantTables) {
    const exists = await client.query('SELECT to_regclass($1) AS table_name', [`public.${table}`]);
    if (exists.rows[0].table_name) {
      await client.query(`ALTER TABLE ${quoteIdent(table)} ADD COLUMN IF NOT EXISTS tenant_id TEXT`);
    }
  }
  await client.query(`ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS nextcloud_parent_folder TEXT`);
  await client.query(`ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS drive_parent_folder TEXT`);
  await client.query(`ALTER TABLE content_flow_items ADD COLUMN IF NOT EXISTS catatan TEXT`);
  await client.query(`ALTER TABLE content_flow_items ADD COLUMN IF NOT EXISTS migration_source TEXT`);
  await client.query(`ALTER TABLE content_flow_items ADD COLUMN IF NOT EXISTS migration_batch_id TEXT`);
  await client.query(`ALTER TABLE content_flow_items ADD COLUMN IF NOT EXISTS legacy_id TEXT`);
  await client.query(`ALTER TABLE content_flow_items ADD COLUMN IF NOT EXISTS legacy_url_asset TEXT`);
  await client.query(`ALTER TABLE content_flow_items ADD COLUMN IF NOT EXISTS asset_migration_status TEXT`);
  await client.query(`UPDATE content_flow_items SET tenant_id='default_tenant' WHERE tenant_id IS NULL`);
  await client.query(`ALTER TABLE content_flow_items ALTER COLUMN tenant_id SET DEFAULT 'default_tenant'`);
  await client.query(`ALTER TABLE content_flow_items ALTER COLUMN tenant_id SET NOT NULL`);
  await client.query(`CREATE INDEX IF NOT EXISTS content_flow_items_tenant_created_idx ON content_flow_items(tenant_id,created_at DESC)`);
  await client.query(`CREATE INDEX IF NOT EXISTS content_flow_items_tenant_source_idx ON content_flow_items(tenant_id,source_type,source_campaign_id,source_item_id)`);
  await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS content_flow_items_tenant_video_uq ON content_flow_items(tenant_id,video_id)`);
  await client.query(`ALTER TABLE content_planners ADD COLUMN IF NOT EXISTS planner_focus TEXT DEFAULT 'product_campaign'`);
  await client.query(`ALTER TABLE content_planners ADD COLUMN IF NOT EXISTS brand_context TEXT`);
  await client.query(`ALTER TABLE content_planners ADD COLUMN IF NOT EXISTS content_goal TEXT`);
  await client.query(`ALTER TABLE content_planners ADD COLUMN IF NOT EXISTS pillars_json TEXT DEFAULT '[]'`);
  await client.query(`ALTER TABLE content_planners ADD COLUMN IF NOT EXISTS pillar_distribution_mode TEXT DEFAULT 'balanced'`);
  await client.query(`ALTER TABLE content_planner_rows ADD COLUMN IF NOT EXISTS content_subject TEXT`);
  await client.query(`ALTER TABLE content_planner_rows ADD COLUMN IF NOT EXISTS product_reference TEXT`);
  await client.query(`ALTER TABLE content_planner_rows ADD COLUMN IF NOT EXISTS commercial_intent TEXT DEFAULT 'soft_sell'`);
  await client.query(`ALTER TABLE content_planner_rows ADD COLUMN IF NOT EXISTS cta_type TEXT DEFAULT 'product'`);
  await client.query(`CREATE TABLE IF NOT EXISTS glabs_task_routes (task_id TEXT PRIMARY KEY, host TEXT NOT NULL, port TEXT NOT NULL, api_key TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
}

async function seedAdmin(client) {
  const username = env.STAGING_ADMIN_USERNAME || 'admin';
  const password = env.STAGING_ADMIN_PASSWORD;
  if (!password) throw new Error('STAGING_ADMIN_PASSWORD is required');
  const userId = 'usr_admin_staging';
  await client.query(
    `INSERT INTO users (id, username, email, password_hash, role, status, tenant_id)
     VALUES ($1, $2, $3, $4, 'admin', 'active', 'default_tenant')
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'active', role = 'admin'`,
    [userId, username, 'admin@staging.local', hashPassword(password)]
  );
  const actualUser = await client.query('SELECT id FROM users WHERE username = $1', [username]);
  for (const menu of ALL_MENU_KEYS) {
    await client.query(
      `INSERT INTO user_menu_permissions (id, user_id, menu_key, can_read, can_write)
       VALUES ($1, $2, $3, 1, 1)
       ON CONFLICT (user_id, menu_key) DO UPDATE SET can_read = 1, can_write = 1`,
      [`perm_${actualUser.rows[0].id}_${menu.key}`, actualUser.rows[0].id, menu.key]
    );
  }
  console.log(`Seeded staging admin user: ${username}`);
}

async function main() {
  await ensureDatabase();
  const sqlite = await createBlankSqliteSchema();
  const client = new Client({ host: env.PGHOST, port: Number(env.PGPORT), user: env.PGUSER, password: env.PGPASSWORD, database: env.PGDATABASE });
  await client.connect();
  try {
    await migrateSchema(sqlite, client);
    await applyStagingMigrations(client);
    await seedAdmin(client);
    const result = await client.query("SELECT current_database() AS database, current_user AS role, (SELECT count(*) FROM users) AS users");
    console.log('Staging database ready:', result.rows[0]);
  } finally {
    sqlite.close();
    await client.end();
  }
}

main().catch(error => {
  console.error('Staging setup failed:', error.message);
  process.exit(1);
});
