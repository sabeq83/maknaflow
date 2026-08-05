/**
 * Script to migrate content_flow_items from maknagrid (Node 3: makna_grid_db)
 * to maknaflow-staging (Node 2: local maknaflow_staging) with safety measures:
 * - ID auto-prefixing ('mg_') to prevent Primary Key collisions.
 * - Date string casting to timestamp (safely handling null/empty).
 * - Enforcing tenant_id = 'default_tenant'.
 * - Setting migration_source = 'maknagrid' for easy tracking.
 * - Select-before-upsert to prevent duplicate key conflicts on both id and (tenant_id, video_id).
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.staging.local if running locally
const envPath = path.join(__dirname, '..', '.env.staging.local');
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

async function runMigration() {
  console.log('================================================================');
  console.log('🚀 MIGRATION: MAKNA GRID -> MAKNAFLOW STAGING (MULTI-CONSTRAINT SAFE)');
  console.log(`   Mode: ${isExecute ? '⚡ LIVE EXECUTION ⚡' : '🔍 DRY-RUN / AUDIT ONLY 🔍'}`);
  console.log('================================================================');

  // Source DB: maknagrid on Node 3 (100.78.186.123)
  const sourcePool = new Pool({
    host: '100.78.186.123',
    port: 5432,
    user: 'makna_user',
    password: 'maknagridpass',
    database: 'makna_grid_db',
    connectionTimeoutMillis: 5000,
  });

  // Target DB: maknaflow_staging on Node 2 (local relative to Node 2)
  const targetPool = new Pool({
    host: process.env.PGHOST || '127.0.0.1',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'maknaflow_staging',
    password: process.env.PGPASSWORD || 'MaknaStg2026!',
    database: process.env.PGDATABASE || 'maknaflow_staging',
    connectionTimeoutMillis: 5000,
  });

  try {
    // 1. Connect
    console.log('🔌 Connecting to source database (maknagrid)...');
    await sourcePool.query('SELECT 1');
    console.log('✅ Connected to source database.');

    console.log('🔌 Connecting to target database (maknaflow-staging)...');
    await targetPool.query('SELECT 1');
    console.log('✅ Connected to target database.');

    // 2. Fetch all rows from source
    console.log('\n📥 Fetching rows from maknagrid.content_flow_items...');
    const sourceRes = await sourcePool.query(`
      SELECT * FROM content_flow_items
    `);
    const totalRows = sourceRes.rows.length;
    console.log(`   Fetched ${totalRows} rows from source.`);

    if (totalRows === 0) {
      console.log('✨ No rows found to migrate.');
      return;
    }

    // 3. Process and Insert
    console.log(`\n⚙️ Processing and migrating ${totalRows} rows...`);
    let insertedCount = 0;
    let updatedCount = 0;
    let failCount = 0;

    for (const row of sourceRes.rows) {
      const safeId = `mg_${row.id}`;
      
      // Parse dates safely
      const parseDate = (val) => {
        if (!val || val === '' || val === 'null' || val === 'undefined') return null;
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
      };

      const productionDate = parseDate(row.production_date);
      const createdAt = parseDate(row.created_at) || new Date();
      const updatedAt = parseDate(row.updated_at) || new Date();
      const videoId = row.video_id || '';

      // Normalize account_name
      let accountName = row.account_name || null;
      if (accountName && accountName.includes('dapurbotani')) {
        accountName = 'dapurbotani';
      }

      if (isExecute) {
        try {
          // Check for existence by (tenant_id, video_id) or safeId
          const checkRes = await targetPool.query(`
            SELECT id FROM content_flow_items 
            WHERE (tenant_id = 'default_tenant' AND video_id = $1) OR id = $2
          `, [videoId, safeId]);

          if (checkRes.rows.length > 0) {
            // Row already exists - update it using its existing ID
            const targetId = checkRes.rows[0].id;
            await targetPool.query(`
              UPDATE content_flow_items SET
                source_type = $1,
                source_campaign_id = $2,
                source_item_id = $3,
                account_name = $4,
                video_id = $5,
                campaign_title = $6,
                hook = $7,
                nama_produk = $8,
                link_affiliate = $9,
                link_produk = $10,
                caption = $11,
                production_date = $12,
                url_asset = $13,
                drive_link = $14,
                nextcloud_url = $15,
                pipeline_status = $16,
                tiktok_status = $17,
                tiktok_publish_date = $18,
                permalink_tiktok = $19,
                facebook_status = $20,
                facebook_publish_date = $21,
                permalink_facebook = $22,
                instagram_status = $23,
                instagram_publish_date = $24,
                permalink_instagram = $25,
                youtube_status = $26,
                youtube_publish_date = $27,
                permalink_youtube = $28,
                updated_at = $29,
                catatan = $30,
                migration_source = $31
              WHERE id = $32
            `, [
              row.source_type || 'opc',
              row.source_campaign_id || null,
              row.source_item_id || null,
              accountName,
              videoId,
              row.campaign_title || null,
              row.hook || null,
              row.nama_produk || null,
              row.link_affiliate || null,
              row.link_produk || null,
              row.caption || null,
              productionDate,
              row.url_asset || null,
              row.drive_link || null,
              row.nextcloud_url || null,
              row.pipeline_status || 'Completed',
              row.tiktok_status || 'Not Published',
              row.tiktok_publish_date || null,
              row.permalink_tiktok || null,
              row.facebook_status || 'Not Published',
              row.facebook_publish_date || null,
              row.permalink_facebook || null,
              row.instagram_status || 'Not Published',
              row.instagram_publish_date || null,
              row.permalink_instagram || null,
              row.youtube_status || 'Not Published',
              row.youtube_publish_date || null,
              row.permalink_youtube || null,
              updatedAt,
              row.catatan || null,
              'maknagrid',
              targetId
            ]);
            updatedCount++;
          } else {
            // Row does not exist - insert new one
            await targetPool.query(`
              INSERT INTO content_flow_items (
                id, source_type, source_campaign_id, source_item_id, account_name,
                video_id, campaign_title, hook, nama_produk, link_affiliate,
                link_produk, caption, production_date, url_asset, drive_link,
                nextcloud_url, pipeline_status, tiktok_status, tiktok_publish_date, permalink_tiktok,
                facebook_status, facebook_publish_date, permalink_facebook, instagram_status, instagram_publish_date,
                permalink_instagram, youtube_status, youtube_publish_date, permalink_youtube, created_at,
                updated_at, catatan, tenant_id, migration_source
              ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15,
                $16, $17, $18, $19, $20,
                $21, $22, $23, $24, $25,
                $26, $27, $28, $29, $30,
                $31, $32, $33, $34
              )
            `, [
              safeId,
              row.source_type || 'opc',
              row.source_campaign_id || null,
              row.source_item_id || null,
              accountName,
              videoId,
              row.campaign_title || null,
              row.hook || null,
              row.nama_produk || null,
              row.link_affiliate || null,
              row.link_produk || null,
              row.caption || null,
              productionDate,
              row.url_asset || null,
              row.drive_link || null,
              row.nextcloud_url || null,
              row.pipeline_status || 'Completed',
              row.tiktok_status || 'Not Published',
              row.tiktok_publish_date || null,
              row.permalink_tiktok || null,
              row.facebook_status || 'Not Published',
              row.facebook_publish_date || null,
              row.permalink_facebook || null,
              row.instagram_status || 'Not Published',
              row.instagram_publish_date || null,
              row.permalink_instagram || null,
              row.youtube_status || 'Not Published',
              row.youtube_publish_date || null,
              row.permalink_youtube || null,
              createdAt,
              updatedAt,
              row.catatan || null,
              'default_tenant',
              'maknagrid'
            ]);
            insertedCount++;
          }
        } catch (err) {
          failCount++;
          console.error(`❌ Failed to migrate row ID ${row.id} (safeId: ${safeId}, videoId: ${videoId}):`, err.message);
        }
      } else {
        // Dry run validation
        insertedCount++;
      }
    }

    console.log('\n================================================================');
    console.log('🎉 MIGRATION COMPLETED SUMMARY:');
    console.log(`   - Total Processed Rows : ${totalRows}`);
    console.log(`   - Inserted Count       : ${insertedCount}`);
    console.log(`   - Updated Count       : ${updatedCount}`);
    console.log(`   - Failed Count         : ${failCount}`);
    if (!isExecute) {
      console.log(`   💡 Dry-run completed. To execute live, run with the --execute flag.`);
    }
    console.log('================================================================');

  } catch (err) {
    console.error('❌ Migration aborted due to fatal error:', err.message);
  } finally {
    await sourcePool.end();
    await targetPool.end();
  }
}

runMigration();
