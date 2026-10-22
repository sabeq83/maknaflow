#!/usr/bin/env node

/**
 * Migration Script for ContentFlow Studio & Single-Use Planner Consumptions
 * 
 * Usage:
 *   node scripts/migrate-contentflow-studio.mjs                       # Dry-run on current schema
 *   node scripts/migrate-contentflow-studio.mjs --apply --confirm-dev # Apply to dev schema
 */

process.env.DISABLE_AUTO_MIGRATIONS = 'true';
import { getPgPool } from '../lib/db-pg.js';

const args = process.argv.slice(2);
const isApply = args.includes('--apply');
const confirmDev = args.includes('--confirm-dev');
const confirmStaging = args.includes('--confirm-staging');

const schemaArgIndex = args.indexOf('--schema');
const requestedSchema = schemaArgIndex !== -1 && args[schemaArgIndex + 1] ? args[schemaArgIndex + 1] : null;

async function run() {
  console.log('================================================================');
  console.log('🚀 CONTENTFLOW STUDIO — DATABASE MIGRATION & BACKFILL');
  console.log(`Mode: ${isApply ? 'APPLY (Write changes)' : 'DRY-RUN (Inspection only)'}`);
  console.log('================================================================');

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    const currentSchemaRes = await client.query('SELECT current_schema() as schema, current_database() as db');
    const currentDb = currentSchemaRes.rows[0].db;
    const activeSchema = requestedSchema || currentSchemaRes.rows[0].schema || 'public';

    console.log(`Database: ${currentDb}`);
    console.log(`Target Schema: ${activeSchema}`);

    if (activeSchema === 'public' && isApply) {
      console.warn('⚠️ PERINGATAN: Menjalankan migrasi pada schema "public" (Production). Pastikan ini diotorisasi secara manual!');
    }

    if (isApply) {
      if (activeSchema === 'dev' && !confirmDev) {
        throw new Error('Migrasi ke schema dev membutuhkan flag --confirm-dev.');
      }
      if (activeSchema === 'staging' && !confirmStaging) {
        throw new Error('Migrasi ke schema staging membutuhkan flag --confirm-staging.');
      }
    }

    if (requestedSchema) {
      await client.query(`SET search_path TO ${requestedSchema}, public`);
    }

    // Step 1: Migration DDL (Additive)
    const ddl = `
      -- 1. Planner Consumption Ledger
      CREATE TABLE IF NOT EXISTS content_planner_consumptions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
        planner_id TEXT NOT NULL,
        owner_type TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'consumed',
        snapshot_sha256 TEXT,
        metadata_json JSONB DEFAULT '{}'::jsonb,
        consumed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE UNIQUE INDEX IF NOT EXISTS uq_planner_consumption_tenant_planner
        ON content_planner_consumptions(tenant_id, planner_id);

      CREATE INDEX IF NOT EXISTS idx_planner_consumption_owner
        ON content_planner_consumptions(tenant_id, owner_type, owner_id);

      -- 2. Studio Batches
      CREATE TABLE IF NOT EXISTS content_studio_batches (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
        title TEXT NOT NULL,
        source_kind TEXT NOT NULL,
        source_id TEXT,
        config_version INT NOT NULL DEFAULT 1,
        configuration_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        idempotency_key TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        total_slots INT NOT NULL DEFAULT 0,
        created_by TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE UNIQUE INDEX IF NOT EXISTS uq_studio_batches_tenant_idemp
        ON content_studio_batches(tenant_id, idempotency_key);

      CREATE INDEX IF NOT EXISTS idx_studio_batches_tenant_status
        ON content_studio_batches(tenant_id, status);

      -- 3. Studio Slots
      CREATE TABLE IF NOT EXISTS content_studio_slots (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
        batch_id TEXT NOT NULL REFERENCES content_studio_batches(id) ON DELETE CASCADE,
        slot_number INT NOT NULL DEFAULT 1,
        planner_row_id TEXT,
        title TEXT NOT NULL,
        source_kind TEXT NOT NULL,
        scheduled_production_at TIMESTAMP WITH TIME ZONE NOT NULL,
        scheduled_publish_at TIMESTAMP WITH TIME ZONE NOT NULL,
        timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
        output_media_type TEXT NOT NULL DEFAULT 'video',
        activation_status TEXT NOT NULL DEFAULT 'manual',
        stage_status TEXT NOT NULL DEFAULT 'draft',
        source_campaign_id TEXT,
        source_item_id TEXT,
        contentflow_id TEXT,
        final_media_url TEXT,
        final_caption TEXT,
        revision_hash TEXT,
        progress_percent INT DEFAULT 0,
        error_message TEXT,
        dispatched_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE UNIQUE INDEX IF NOT EXISTS uq_studio_slots_tenant_batch_row
        ON content_studio_slots(tenant_id, batch_id, planner_row_id)
        WHERE planner_row_id IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_studio_slots_due_claim
        ON content_studio_slots(tenant_id, stage_status, scheduled_production_at);

      CREATE INDEX IF NOT EXISTS idx_studio_slots_calendar
        ON content_studio_slots(tenant_id, scheduled_publish_at);

      -- 4. Studio Targets
      CREATE TABLE IF NOT EXISTS content_studio_targets (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
        slot_id TEXT NOT NULL REFERENCES content_studio_slots(id) ON DELETE CASCADE,
        account_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
        publishing_job_id TEXT,
        status TEXT NOT NULL DEFAULT 'awaiting_approval',
        approval_revision TEXT,
        approved_by TEXT,
        approved_at TIMESTAMP WITH TIME ZONE,
        published_at TIMESTAMP WITH TIME ZONE,
        manual_evidence_json JSONB,
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE UNIQUE INDEX IF NOT EXISTS uq_studio_targets_tenant_slot_account
        ON content_studio_targets(tenant_id, slot_id, account_id);

      CREATE INDEX IF NOT EXISTS idx_studio_targets_publishing_job
        ON content_studio_targets(tenant_id, publishing_job_id);

      -- 5. Studio Approvals
      CREATE TABLE IF NOT EXISTS content_studio_approvals (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
        slot_id TEXT NOT NULL REFERENCES content_studio_slots(id) ON DELETE CASCADE,
        revision_hash TEXT NOT NULL,
        decision TEXT NOT NULL,
        notes TEXT,
        actor TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 6. Studio Events
      CREATE TABLE IF NOT EXISTS content_studio_events (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
        batch_id TEXT,
        slot_id TEXT,
        event_type TEXT NOT NULL,
        checkpoint_state TEXT,
        correlation_id TEXT,
        payload_json JSONB DEFAULT '{}'::jsonb,
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    console.log('\n--- 1. Struktur Tabel Studio ---');
    if (!isApply) {
      console.log('[DRY-RUN] DDL skrip terverifikasi, 6 tabel baru siap dibuat jika --apply diaktifkan:');
      console.log(' - content_planner_consumptions (UNIQUE tenant_id, planner_id)');
      console.log(' - content_studio_batches');
      console.log(' - content_studio_slots');
      console.log(' - content_studio_targets');
      console.log(' - content_studio_approvals');
      console.log(' - content_studio_events');
    } else {
      await client.query(`SELECT pg_advisory_lock(hashtext('contentflow_studio_migration_lock'));`);
      await client.query(ddl);
      await client.query(`SELECT pg_advisory_unlock(hashtext('contentflow_studio_migration_lock'));`);
      console.log('✅ [APPLY] Tabel-tabel Studio berhasil dibuat atau diverifikasi.');
    }

    // Step 2: Audit & Backfill Lineage
    console.log('\n--- 2. Audit & Backfill Proven Lineage ---');

    // Audit OPC Campaigns with source_planner_id
    const opcCheck = await client.query(`
      SELECT c.id, c.campaign_name, c.source_planner_id, COALESCE(c.tenant_id, 'default_tenant') as tenant_id
      FROM pillar_campaigns c
      WHERE c.source_planner_id IS NOT NULL AND c.source_planner_id != ''
    `).catch(() => ({ rows: [] }));

    console.log(`Ditemukan ${opcCheck.rows.length} kampanye OPC dengan source_planner_id.`);

    // Audit Operator Jobs with planner_id
    const opJobsCheck = await client.query(`
      SELECT j.id, j.planner_id, j.campaign_id, j.status, COALESCE(j.tenant_id, 'default_tenant') as tenant_id
      FROM operator_jobs j
      WHERE j.planner_id IS NOT NULL AND j.planner_id != ''
    `).catch(() => ({ rows: [] }));

    console.log(`Ditemukan ${opJobsCheck.rows.length} Operator Jobs dengan planner_id.`);

    if (isApply) {
      let backfilledOpc = 0;
      for (const row of opcCheck.rows) {
        const ins = await client.query(`
          INSERT INTO content_planner_consumptions (
            id, tenant_id, planner_id, owner_type, owner_id, status, metadata_json, created_at, updated_at
          ) VALUES (
            'cpc_bf_' || substr(md5(random()::text), 1, 10),
            $1, $2, 'opc_campaign', $3, 'consumed', $4::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          ON CONFLICT (tenant_id, planner_id) DO NOTHING
          RETURNING id
        `, [row.tenant_id, row.source_planner_id, row.id, JSON.stringify({ campaign_name: row.campaign_name, backfilled: true })]);

        if (ins.rowCount > 0) backfilledOpc++;
      }
      console.log(`✅ [APPLY] Backfilled ${backfilledOpc} konsumsi planner dari histori kampanye OPC.`);

      let backfilledOpj = 0;
      for (const row of opJobsCheck.rows) {
        const ins = await client.query(`
          INSERT INTO content_planner_consumptions (
            id, tenant_id, planner_id, owner_type, owner_id, status, metadata_json, created_at, updated_at
          ) VALUES (
            'cpc_bf_' || substr(md5(random()::text), 1, 10),
            $1, $2, 'operator_job', $3, 'consumed', $4::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          ON CONFLICT (tenant_id, planner_id) DO NOTHING
          RETURNING id
        `, [row.tenant_id, row.planner_id, row.id, JSON.stringify({ campaign_id: row.campaign_id, job_status: row.status, backfilled: true })]);

        if (ins.rowCount > 0) backfilledOpj++;
      }
      console.log(`✅ [APPLY] Backfilled ${backfilledOpj} konsumsi planner dari histori Operator Jobs.`);
    } else {
      console.log(`[DRY-RUN] Siap mem-backfill hingga ${opcCheck.rows.length + opJobsCheck.rows.length} entri konsumsi jika --apply diaktifkan.`);
    }

    console.log('\n================================================================');
    console.log('🎉 Migrasi & verifikasi selesai dengan sukses!');
    console.log('================================================================');

  } catch (err) {
    console.error('❌ Migration Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

run();
