import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import pkg from 'pg';
const { Pool } = pkg;

// Load environment variables from .env.staging.local
const envPath = path.join(process.cwd(), '.env.staging.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.substring(0, idx).trim();
    const val = trimmed.substring(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    process.env[key] = val;
  }
}

const isExecute = process.argv.includes('--execute');

async function sync() {
  console.log('================================================================');
  console.log('🔄 SINKRONISASI STATUS PUBLISHING DARI SQLITE KE POSTGRES');
  console.log('   Source: SQLite /mnt/c/tmp/makna_grid_temp.db');
  console.log('   Target: PostgreSQL maknaflow_staging (local)');
  console.log(`   Mode  : ${isExecute ? '⚡ EXECUTE ⚡' : '🔍 DRY-RUN 🔍'}`);
  console.log('================================================================');

  // 1. Load SQLite
  const sqlitePath = '/mnt/c/tmp/makna_grid_temp.db';
  if (!fs.existsSync(sqlitePath)) {
    console.error(`❌ SQLite file not found at ${sqlitePath}`);
    process.exit(1);
  }
  const db = new Database(sqlitePath, { readonly: true });
  console.log('✅ Connected to SQLite database.');

  // 2. Connect to Postgres
  const targetPool = new Pool({
    host: process.env.PGHOST || '127.0.0.1',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'maknaflow_staging',
    password: process.env.PGPASSWORD || 'MaknaStg2026!',
    database: process.env.PGDATABASE || 'maknaflow_staging',
  });
  await targetPool.query('SELECT 1');
  console.log('✅ Connected to Target PostgreSQL database.');

  // 3. Fetch from SQLite
  const sqliteRows = db.prepare(`
    SELECT video_id, 
           tiktok_status, tiktok_publish_date, permalink_tiktok,
           facebook_status, facebook_publish_date, permalink_facebook,
           instagram_status, instagram_publish_date, permalink_instagram,
           youtube_status, youtube_publish_date, permalink_youtube
    FROM content_flow_items
    WHERE video_id IS NOT NULL AND video_id <> ''
  `).all();
  console.log(`📥 Found ${sqliteRows.length} rows in SQLite content_flow_items.`);

  // 4. Fetch from Postgres
  const pgRes = await targetPool.query(`
    SELECT id, video_id, tenant_id,
           tiktok_status, tiktok_publish_date, permalink_tiktok,
           facebook_status, facebook_publish_date, permalink_facebook,
           instagram_status, instagram_publish_date, permalink_instagram,
           youtube_status, youtube_publish_date, permalink_youtube
    FROM content_flow_items
    WHERE video_id IS NOT NULL AND video_id <> ''
  `);
  console.log(`📥 Found ${pgRes.rows.length} rows in Target PostgreSQL.`);

  // 5. Map Target items by video_id
  const targetMap = new Map();
  for (const row of pgRes.rows) {
    targetMap.set(row.video_id, row);
  }

  // 6. Compare and Identify Updates
  let matchCount = 0;
  let updateCount = 0;
  const toUpdate = [];

  const fields = [
    'tiktok_status', 'tiktok_publish_date', 'permalink_tiktok',
    'facebook_status', 'facebook_publish_date', 'permalink_facebook',
    'instagram_status', 'instagram_publish_date', 'permalink_instagram',
    'youtube_status', 'youtube_publish_date', 'permalink_youtube'
  ];

  for (const sourceRow of sqliteRows) {
    const targetRow = targetMap.get(sourceRow.video_id);
    if (!targetRow) continue;

    matchCount++;

    const diffs = {};
    let isDifferent = false;
    for (const field of fields) {
      const sourceVal = sourceRow[field] || null;
      const targetVal = targetRow[field] || null;
      if (sourceVal !== targetVal) {
        diffs[field] = { from: targetVal, to: sourceVal };
        isDifferent = true;
      }
    }

    if (isDifferent) {
      updateCount++;
      toUpdate.push({ sourceRow, targetRow, diffs });
    }
  }

  if (toUpdate.length === 0) {
    console.log('✨ All matching video IDs already have identical publishing statuses. No sync needed.');
  } else {
    console.log(`📋 Found ${toUpdate.length} video IDs with status differences:`);
    for (const item of toUpdate) {
      console.log(`   - Video ID: ${item.sourceRow.video_id} (Tenant: ${item.targetRow.tenant_id})`);
      for (const [field, change] of Object.entries(item.diffs)) {
        console.log(`     └─ ${field}: "${change.from}" ➡️ "${change.to}"`);
      }

      if (isExecute) {
        await targetPool.query(`
          UPDATE content_flow_items
          SET tiktok_status = $1, tiktok_publish_date = $2, permalink_tiktok = $3,
              facebook_status = $4, facebook_publish_date = $5, permalink_facebook = $6,
              instagram_status = $7, instagram_publish_date = $8, permalink_instagram = $9,
              youtube_status = $10, youtube_publish_date = $11, permalink_youtube = $12,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $13
        `, [
          item.sourceRow.tiktok_status || 'Not Published',
          item.sourceRow.tiktok_publish_date || null,
          item.sourceRow.permalink_tiktok || null,
          item.sourceRow.facebook_status || 'Not Published',
          item.sourceRow.facebook_publish_date || null,
          item.sourceRow.permalink_facebook || null,
          item.sourceRow.instagram_status || 'Not Published',
          item.sourceRow.instagram_publish_date || null,
          item.sourceRow.permalink_instagram || null,
          item.sourceRow.youtube_status || 'Not Published',
          item.sourceRow.youtube_publish_date || null,
          item.sourceRow.permalink_youtube || null,
          item.targetRow.id
        ]);
        console.log(`     ✅ Status updated in Target DB.`);
      } else {
        console.log(`     🔍 [Dry-Run] Target DB will be updated during execution.`);
      }
    }
  }

  console.log('\n================================================================');
  console.log('🎉 PROSES SELESAI!');
  console.log(`   - Total Video ID Cocok: ${matchCount}`);
  console.log(`   - Total Butuh Update  : ${updateCount}`);
  if (!isExecute && updateCount > 0) {
    console.log(`   💡 Untuk mengeksekusi update, jalankan dengan flag --execute`);
  }
  console.log('================================================================');

  db.close();
  await targetPool.end();
}

sync().catch(console.error);
