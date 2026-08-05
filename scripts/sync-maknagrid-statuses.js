/**
 * Script to synchronize social media publishing status from MAKNA Grid (makna_grid_db)
 * to MAKNA Flow local database (maknaflow_staging) on Node 2, specifically for tenant 'default_tenant'.
 * Matches records based on video_id.
 */

import fs from 'fs';
import path from 'path';
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
  console.log(`[Env] Loaded environment from ${envPath}`);
}

const isExecute = process.argv.includes('--execute');
const isDryRun = !isExecute;

async function syncStatuses() {
  console.log('================================================================');
  console.log('🔄 SINKRONISASI SOSIAL MEDIA PUBLISHING STATUS (2-PHASE)');
  console.log('   Source: maknagrid (Node 3: makna_grid_db)');
  console.log('   Target: maknaflow Node 2 (local: maknaflow_staging)');
  console.log('   Tenant: default_tenant');
  console.log(`   Mode  : ${isExecute ? '⚡ PHASE 2: LIVE EXECUTION ⚡' : '🔍 PHASE 1: DRY-RUN / MATCH ONLY 🔍'}`);
  console.log('================================================================');

  // 1. Setup Database Connections
  // Source Database: makna_grid_db on Node 3 (100.78.186.123)
  const sourcePool = new Pool({
    host: '100.78.186.123',
    port: 5432,
    user: 'makna_user',
    password: 'maknagridpass',
    database: 'makna_grid_db',
    connectionTimeoutMillis: 5000,
  });

  // Target Database: Local maknaflow_staging on Node 2 (127.0.0.1)
  const targetPool = new Pool({
    host: process.env.PGHOST || '127.0.0.1',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'maknaflow_staging',
    password: process.env.PGPASSWORD || 'MaknaStg2026!',
    database: process.env.PGDATABASE || 'maknaflow_staging',
    connectionTimeoutMillis: 5000,
  });

  try {
    // Test connections
    await sourcePool.query('SELECT 1');
    console.log('✅ Connected to Source Database (makna_grid_db)');
    await targetPool.query('SELECT 1');
    console.log('✅ Connected to Target Database (maknaflow_staging)');

    // 2. Fetch all rows from Source (maknagrid) content_flow_items
    console.log('📥 Fetching content flow items from Source...');
    const sourceRes = await sourcePool.query(`
      SELECT video_id, 
             tiktok_status, tiktok_publish_date, permalink_tiktok,
             facebook_status, facebook_publish_date, permalink_facebook,
             instagram_status, instagram_publish_date, permalink_instagram,
             youtube_status, youtube_publish_date, permalink_youtube
      FROM content_flow_items
      WHERE video_id IS NOT NULL AND video_id <> ''
    `);
    console.log(`   Found ${sourceRes.rows.length} items in Source DB.`);

    // 3. Fetch all rows from Target (maknaflow Node 2) content_flow_items for default_tenant
    console.log('📥 Fetching content flow items from Target (tenant: default_tenant)...');
    const targetRes = await targetPool.query(`
      SELECT id, video_id,
             tiktok_status, tiktok_publish_date, permalink_tiktok,
             facebook_status, facebook_publish_date, permalink_facebook,
             instagram_status, instagram_publish_date, permalink_instagram,
             youtube_status, youtube_publish_date, permalink_youtube
      FROM content_flow_items
      WHERE tenant_id = 'default_tenant' AND video_id IS NOT NULL AND video_id <> ''
    `);
    console.log(`   Found ${targetRes.rows.length} items in Target DB for default_tenant.`);

    // 4. Map Target items by video_id
    const targetMap = new Map();
    for (const row of targetRes.rows) {
      targetMap.set(row.video_id, row);
    }

    // 5. Compare and Identify Updates
    console.log('\n🔎 Comparing publishing statuses based on video_id...');
    let matchCount = 0;
    let updateCount = 0;
    const toUpdate = [];
    
    for (const sourceRow of sourceRes.rows) {
      const targetRow = targetMap.get(sourceRow.video_id);
      if (!targetRow) continue; // Skip if video_id doesn't exist in target

      matchCount++;

      // Check for differences in social media status fields
      const diffs = {};
      const fields = [
        'tiktok_status', 'tiktok_publish_date', 'permalink_tiktok',
        'facebook_status', 'facebook_publish_date', 'permalink_facebook',
        'instagram_status', 'instagram_publish_date', 'permalink_instagram',
        'youtube_status', 'youtube_publish_date', 'permalink_youtube'
      ];

      let isDifferent = false;
      for (const field of fields) {
        // Normalize null/undefined/empty string comparisons
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
        console.log(`   - Video ID: ${item.sourceRow.video_id}`);
        for (const [field, change] of Object.entries(item.diffs)) {
          console.log(`     └─ ${field}: "${change.from}" ➡️ "${change.to}"`);
        }

        if (isExecute) {
          // Perform the update
          await targetPool.query(`
            UPDATE content_flow_items
            SET tiktok_status = $1, tiktok_publish_date = $2, permalink_tiktok = $3,
                facebook_status = $4, facebook_publish_date = $5, permalink_facebook = $6,
                instagram_status = $7, instagram_publish_date = $8, permalink_instagram = $9,
                youtube_status = $10, youtube_publish_date = $11, permalink_youtube = $12,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $13 AND tenant_id = 'default_tenant'
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
          console.log(`     🔍 [Dry-Run] Target DB will be updated during Phase 2.`);
        }
      }
    }

    console.log('\n================================================================');
    console.log('🎉 PROSES SELESAI!');
    console.log(`   - Total Video ID Cocok: ${matchCount}`);
    console.log(`   - Total Butuh Update  : ${updateCount}`);
    if (isDryRun && updateCount > 0) {
      console.log(`   💡 Untuk mengeksekusi update (Fase 2), jalankan dengan flag --execute`);
    } else if (isExecute) {
      console.log(`   ✅ Semua ${updateCount} update telah berhasil diaplikasikan secara live.`);
    }
    console.log('================================================================');

  } catch (err) {
    console.error('❌ Terjadi kesalahan saat sinkronisasi:', err.message);
  } finally {
    await sourcePool.end();
    await targetPool.end();
  }
}

syncStatuses();
