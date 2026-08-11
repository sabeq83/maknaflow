/**
 * Database Data Healing Script for MAKNA Flow Products
 * Synchronizes legacy extraction_status with V2 enrichment_status and photo_status,
 * and recovers zombie/stale processing states.
 */

import { getPgPool } from '../lib/db-pg.js';

async function healProductDatabase(targetSchema = 'dev') {
  console.log(`\n======================================================`);
  console.log(`🩺 Running Product Database Healing on schema: ${targetSchema}`);
  console.log(`======================================================`);

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query(`SET search_path TO ${targetSchema};`);

    // Check if table exists
    const checkTable = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = '${targetSchema}' AND table_name = 'product_extractions'
    `);

    if (checkTable.rowCount === 0) {
      console.log(`⚠️ Table product_extractions does not exist in schema '${targetSchema}'. Skipping.`);
      return;
    }

    // Check if photo_status column exists
    const checkColumns = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = '${targetSchema}' AND table_name = 'product_extractions' AND column_name = 'photo_status'
    `);
    if (checkColumns.rowCount === 0) {
      console.log(`⚠️ Column photo_status does not exist in schema '${targetSchema}'. Skipping.`);
      return;
    }

    // 1. Sync extraction_status for products whose photo is approved/needs_review/failed and enrichment is completed/failed
    const syncRes = await client.query(`
      UPDATE product_extractions
      SET extraction_status = 'completed',
          updated_at = NOW()
      WHERE extraction_status IN ('pending_image', 'generating_image', 'pending')
        AND (
          photo_status IN ('approved', 'needs_review', 'completed')
          OR (enrichment_status = 'completed' AND photo_status = 'failed')
        )
      RETURNING id, product_name, tenant_id, photo_status
    `);
    console.log(`✅ [Step 1] Synchronized extraction_status to 'completed' for ${syncRes.rowCount} products with finished photo/enrichment status.`);

    // 2. Heal zombie photo_status = 'processing' with no task_id (stalled > 10m or missing worker)
    const photoHealRes = await client.query(`
      UPDATE product_extractions
      SET photo_status = 'failed',
          photo_error = 'Pemrosesan foto terputus (zombie processing timeout)',
          extraction_status = 'completed',
          updated_at = NOW()
      WHERE photo_status = 'processing'
        AND (photo_task_id IS NULL OR photo_provider IS NULL)
      RETURNING id, product_name, tenant_id
    `);
    console.log(`✅ [Step 2] Healed ${photoHealRes.rowCount} stale/zombie photo processing jobs to 'failed'.`);

    // 3. Heal zombie enrichment_status = 'processing'
    const enrichHealRes = await client.query(`
      UPDATE product_extractions
      SET enrichment_status = 'failed',
          enrichment_error = 'Pengayaan AI terputus (zombie processing timeout)',
          extraction_status = 'completed',
          updated_at = NOW()
      WHERE enrichment_status = 'processing'
        AND updated_at < NOW() - INTERVAL '10 minutes'
      RETURNING id, product_name, tenant_id
    `);
    console.log(`✅ [Step 3] Healed ${enrichHealRes.rowCount} stale/zombie enrichment processing jobs to 'failed'.`);

    // 4. Check summary
    const summary = await client.query(`
      SELECT 
        tenant_id, 
        extraction_status, 
        enrichment_status, 
        photo_status, 
        COUNT(*)::int as count 
      FROM product_extractions 
      GROUP BY tenant_id, extraction_status, enrichment_status, photo_status
      ORDER BY tenant_id, count DESC
    `);
    console.log('\n📊 Post-healing status summary in schema', targetSchema, ':');
    console.table(summary.rows);

  } catch (err) {
    console.error(`❌ Error healing database in schema ${targetSchema}:`, err);
  } finally {
    client.release();
  }
}

async function main() {
  const schemas = process.env.TARGET_SCHEMAS ? process.env.TARGET_SCHEMAS.split(',') : ['dev', 'staging', 'public'];
  for (const schema of schemas) {
    await healProductDatabase(schema.trim());
  }
  process.exit(0);
}

main();
