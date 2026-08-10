import pkg from 'pg';
import { AsyncLocalStorage } from 'async_hooks';
const { Pool } = pkg;
const pgTransactionContext = new AsyncLocalStorage();

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
      max: parseInt(process.env.PGPOOL_MAX || '20', 10),
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

    const migrateContentFlowTenant = async () => {
      let migrationClient;
      try {
        migrationClient = await pool.connect();
        await migrationClient.query(`SELECT pg_advisory_lock(hashtext('makna_contentflow_tenant_v1'));`);
        await migrationClient.query(`
          ALTER TABLE content_flow_items
            ADD COLUMN IF NOT EXISTS catatan TEXT,
            ADD COLUMN IF NOT EXISTS tenant_id TEXT,
            ADD COLUMN IF NOT EXISTS migration_source TEXT,
            ADD COLUMN IF NOT EXISTS migration_batch_id TEXT,
            ADD COLUMN IF NOT EXISTS legacy_id TEXT,
            ADD COLUMN IF NOT EXISTS legacy_url_asset TEXT,
            ADD COLUMN IF NOT EXISTS asset_migration_status TEXT;
          UPDATE content_flow_items SET tenant_id='default_tenant' WHERE tenant_id IS NULL;
          ALTER TABLE content_flow_items ALTER COLUMN tenant_id SET DEFAULT 'default_tenant';
          ALTER TABLE content_flow_items ALTER COLUMN tenant_id SET NOT NULL;
        `);
        const duplicates = await migrationClient.query(`
          SELECT video_id, tenant_id, COUNT(*)::int AS count
          FROM content_flow_items
          GROUP BY video_id, tenant_id HAVING COUNT(*) > 1 LIMIT 1
        `);
        if (duplicates.rowCount) throw new Error(`Duplicate ContentFlow video_id ditemukan: ${duplicates.rows[0].video_id}`);
        await migrationClient.query(`CREATE INDEX IF NOT EXISTS content_flow_items_tenant_created_idx ON content_flow_items(tenant_id,created_at DESC);`);
        await migrationClient.query(`CREATE INDEX IF NOT EXISTS content_flow_items_tenant_source_idx ON content_flow_items(tenant_id,source_type,source_campaign_id,source_item_id);`);
        await migrationClient.query(`CREATE UNIQUE INDEX IF NOT EXISTS content_flow_items_tenant_video_uq ON content_flow_items(tenant_id,video_id);`);
        console.log('[PostgreSQL] ContentFlow tenant migration completed.');
      } catch (err) {
        console.warn('[PostgreSQL Auto-Migration Warning] Gagal migrasi ContentFlow tenant:', err.message);
      } finally {
        if (migrationClient) {
          await migrationClient.query(`SELECT pg_advisory_unlock(hashtext('makna_contentflow_tenant_v1'));`).catch(() => {});
          migrationClient.release();
        }
      }
    };
    migrateContentFlowTenant();

    const migrateContentPlannerDualMode = async () => {
      try {
        await pool.query(`
          ALTER TABLE content_planners
            ADD COLUMN IF NOT EXISTS planner_focus TEXT DEFAULT 'product_campaign',
            ADD COLUMN IF NOT EXISTS brand_context TEXT,
            ADD COLUMN IF NOT EXISTS content_goal TEXT,
            ADD COLUMN IF NOT EXISTS pillars_json TEXT DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS pillar_distribution_mode TEXT DEFAULT 'balanced'
        `);
        await pool.query(`
          ALTER TABLE content_planner_rows
            ADD COLUMN IF NOT EXISTS content_subject TEXT,
            ADD COLUMN IF NOT EXISTS product_reference TEXT,
            ADD COLUMN IF NOT EXISTS commercial_intent TEXT DEFAULT 'soft_sell',
            ADD COLUMN IF NOT EXISTS cta_type TEXT DEFAULT 'product'
        `);
        await pool.query(`UPDATE content_planners SET planner_focus = 'product_campaign' WHERE planner_focus IS NULL`);
        console.log('[PostgreSQL] Content Planner dual-mode migration completed.');
      } catch (err) {
        console.warn('[PostgreSQL Auto-Migration Warning] Gagal migrasi Content Planner dual-mode:', err.message);
      }
    };
    migrateContentPlannerDualMode();

    // Content World / Cartoon Universe support (Tahap 1)
    const migrateContentWorldSupport = async () => {
      try {
        await pool.query(`
          ALTER TABLE content_planners
            ADD COLUMN IF NOT EXISTS content_world TEXT DEFAULT 'real_world',
            ADD COLUMN IF NOT EXISTS knowledge_domain TEXT DEFAULT 'general',
            ADD COLUMN IF NOT EXISTS universe_profile TEXT,
            ADD COLUMN IF NOT EXISTS universe_config_json TEXT
        `);
        await pool.query(`
          ALTER TABLE content_planner_rows
            ADD COLUMN IF NOT EXISTS main_character TEXT,
            ADD COLUMN IF NOT EXISTS supporting_characters TEXT,
            ADD COLUMN IF NOT EXISTS story_premise TEXT,
            ADD COLUMN IF NOT EXISTS pet_problem TEXT,
            ADD COLUMN IF NOT EXISTS product_role TEXT,
            ADD COLUMN IF NOT EXISTS product_reveal_beat TEXT,
            ADD COLUMN IF NOT EXISTS universe_profile TEXT
        `);
        console.log('[PostgreSQL] Content World / Cartoon Universe migration completed.');
      } catch (err) {
        console.warn('[PostgreSQL Auto-Migration Warning] Content World migration:', err.message);
      }
    };
    migrateContentWorldSupport();

    // Cartoon Universe support on Pillar Campaigns (Tahap 2)
    const migrateOpcContentWorld = async () => {
      try {
        await pool.query(`
          ALTER TABLE pillar_campaigns
            ADD COLUMN IF NOT EXISTS content_world TEXT DEFAULT 'real_world',
            ADD COLUMN IF NOT EXISTS story_template TEXT,
            ADD COLUMN IF NOT EXISTS universe_profile TEXT,
            ADD COLUMN IF NOT EXISTS universe_snapshot_json TEXT
        `);
        console.log('[PostgreSQL] OPC Content World migration completed.');
      } catch (err) {
        console.warn('[PostgreSQL Auto-Migration Warning] OPC Content World:', err.message);
      }
    };
    migrateOpcContentWorld();

    pool.query(`
      ALTER TABLE pillar_campaigns
        ADD COLUMN IF NOT EXISTS target_demographic TEXT,
        ADD COLUMN IF NOT EXISTS target_demographic_custom TEXT;
    `).catch(err => {
      console.warn('[PostgreSQL Auto-Migration Warning] Gagal migrasi demographic OPC:', err.message);
    });

    const migrateOperatorJobs = async () => {
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS operator_jobs (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            idempotency_key TEXT NOT NULL,
            request_hash TEXT NOT NULL,
            request_json TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'queued',
            current_stage TEXT NOT NULL DEFAULT 'queued',
            planner_id TEXT,
            campaign_id TEXT,
            result_json TEXT,
            error_code TEXT,
            error_message TEXT,
            locked_at TIMESTAMP,
            locked_by TEXT,
            next_attempt_at TIMESTAMP,
            attempt_count INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await pool.query(`ALTER TABLE operator_jobs ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMP;`);
        await pool.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS operator_jobs_tenant_idempotency_uq
          ON operator_jobs (tenant_id, idempotency_key);
        `);
        await pool.query(`
          CREATE TABLE IF NOT EXISTS operator_job_events (
            id BIGSERIAL PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            job_id TEXT NOT NULL REFERENCES operator_jobs(id) ON DELETE CASCADE,
            event_type TEXT NOT NULL,
            event_json TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await pool.query(`
          CREATE INDEX IF NOT EXISTS operator_job_events_job_idx
          ON operator_job_events (tenant_id, job_id, created_at);
        `);
        console.log('[PostgreSQL] Operator jobs migration completed.');
      } catch (err) {
        console.warn('[PostgreSQL Auto-Migration Warning] Gagal migrasi Operator API:', err.message);
      }
    };
    migrateOperatorJobs();

    const migrateContentAutomations = async () => {
      let migrationClient;
      try {
        migrationClient = await pool.connect();
        await migrationClient.query(`SELECT pg_advisory_lock(hashtext('makna_content_automations_v1'));`);
        await migrationClient.query(`
          CREATE TABLE IF NOT EXISTS content_automation_schedules (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'default_tenant', name TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'paused', timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
            frequency TEXT NOT NULL, schedule_config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
            operator_request_json JSONB NOT NULL, missed_run_policy TEXT NOT NULL DEFAULT 'skip',
            grace_minutes INTEGER NOT NULL DEFAULT 60, next_run_at TIMESTAMPTZ, last_run_at TIMESTAMPTZ,
            created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS content_automation_due_idx
            ON content_automation_schedules(status, next_run_at) WHERE status = 'active';
          CREATE TABLE IF NOT EXISTS content_automation_runs (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            schedule_id TEXT NOT NULL REFERENCES content_automation_schedules(id) ON DELETE CASCADE,
            scheduled_for TIMESTAMPTZ NOT NULL, idempotency_key TEXT NOT NULL,
            operator_job_id TEXT REFERENCES operator_jobs(id) ON DELETE SET NULL,
            status TEXT NOT NULL DEFAULT 'queued', attempt_count INTEGER NOT NULL DEFAULT 0,
            error_code TEXT, error_message TEXT, started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id, schedule_id, scheduled_for), UNIQUE(tenant_id, idempotency_key)
          );
          CREATE INDEX IF NOT EXISTS content_automation_runs_schedule_idx
            ON content_automation_runs(tenant_id, schedule_id, created_at DESC);
          CREATE TABLE IF NOT EXISTS content_automation_notifications (
            id BIGSERIAL PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            run_id TEXT NOT NULL REFERENCES content_automation_runs(id) ON DELETE CASCADE,
            type TEXT NOT NULL, title TEXT NOT NULL, message TEXT, action_url TEXT,
            read_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id, run_id, type)
          );
          ALTER TABLE content_automation_schedules
            ADD COLUMN IF NOT EXISTS max_catch_up_runs INTEGER NOT NULL DEFAULT 3,
            ADD COLUMN IF NOT EXISTS retry_policy_json JSONB NOT NULL DEFAULT '{"max_attempts":3,"base_seconds":60,"max_seconds":900}'::jsonb,
            ADD COLUMN IF NOT EXISTS consecutive_failure_count INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS auto_pause_threshold INTEGER NOT NULL DEFAULT 5;
          ALTER TABLE content_automation_runs
            ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS failure_class TEXT,
            ADD COLUMN IF NOT EXISTS skip_reason TEXT;
          CREATE INDEX IF NOT EXISTS content_automation_retry_idx
            ON content_automation_runs(status, next_attempt_at) WHERE status = 'retry_wait';
          CREATE TABLE IF NOT EXISTS content_automation_audit_events (
            id BIGSERIAL PRIMARY KEY, tenant_id TEXT NOT NULL, actor_id TEXT,
            event_type TEXT NOT NULL, schedule_id TEXT, run_id TEXT,
            event_json JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS content_automation_audit_tenant_idx
            ON content_automation_audit_events(tenant_id, created_at DESC);
          CREATE TABLE IF NOT EXISTS content_automation_notification_preferences (
            tenant_id TEXT PRIMARY KEY, enabled BOOLEAN NOT NULL DEFAULT FALSE,
            channel TEXT NOT NULL DEFAULT 'telegram', chat_id TEXT,
            bot_token_ciphertext TEXT, events_json JSONB NOT NULL DEFAULT '["awaiting_approval","failed","auto_paused","missed_run"]'::jsonb,
            quiet_start TEXT, quiet_end TEXT, timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
            updated_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
          CREATE TABLE IF NOT EXISTS content_automation_notification_outbox (
            id BIGSERIAL PRIMARY KEY, tenant_id TEXT NOT NULL,
            run_id TEXT REFERENCES content_automation_runs(id) ON DELETE CASCADE,
            schedule_id TEXT REFERENCES content_automation_schedules(id) ON DELETE CASCADE,
            event_key TEXT NOT NULL, channel TEXT NOT NULL, event_type TEXT NOT NULL,
            payload_json JSONB NOT NULL DEFAULT '{}'::jsonb, status TEXT NOT NULL DEFAULT 'queued',
            attempt_count INTEGER NOT NULL DEFAULT 0, next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            locked_at TIMESTAMPTZ, locked_by TEXT, provider_message_id TEXT,
            last_error TEXT, sent_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id,event_key,channel)
          );
          CREATE INDEX IF NOT EXISTS content_automation_outbox_due_idx
            ON content_automation_notification_outbox(status,next_attempt_at) WHERE status IN('queued','retry_wait');
        `);
        console.log('[PostgreSQL] Content automation migration completed.');
      } catch (err) {
        console.warn('[PostgreSQL Auto-Migration Warning] Gagal migrasi Content Automations:', err.message);
      } finally {
        if (migrationClient) {
          await migrationClient.query(`SELECT pg_advisory_unlock(hashtext('makna_content_automations_v1'));`).catch(() => {});
          migrationClient.release();
        }
      }
    };
    migrateContentAutomations();

    const migrateTenantControlPlane = async () => {
      let migrationClient;
      try {
        migrationClient = await pool.connect();
        await migrationClient.query(`SELECT pg_advisory_lock(hashtext('makna_tenant_control_plane_v1'));`);
        await pool.query(`
          ALTER TABLE tenants
            ADD COLUMN IF NOT EXISTS slug TEXT,
            ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
            ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
        `);
        await pool.query(`UPDATE tenants SET slug = LOWER(REGEXP_REPLACE(id, '[^a-zA-Z0-9]+', '-', 'g')) WHERE slug IS NULL;`);
        await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_uq ON tenants (slug);`);
        await pool.query(`
          CREATE TABLE IF NOT EXISTS tenant_audit_events (
            id BIGSERIAL PRIMARY KEY,
            actor_user_id TEXT,
            tenant_id TEXT REFERENCES tenants(id) ON DELETE SET NULL,
            event_type TEXT NOT NULL,
            event_json TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await pool.query(`
          CREATE TABLE IF NOT EXISTS operator_credentials (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            token_hash TEXT UNIQUE NOT NULL,
            scopes TEXT NOT NULL DEFAULT 'content:create,content:read,content:approve',
            status TEXT NOT NULL DEFAULT 'active',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS users_tenant_idx ON users (tenant_id);`);

        await pool.query(`CREATE SEQUENCE IF NOT EXISTS gemini_api_keys_id_seq;`);
        await pool.query(`ALTER TABLE gemini_api_keys ALTER COLUMN id SET DEFAULT nextval('gemini_api_keys_id_seq');`);
        await pool.query(`SELECT setval('gemini_api_keys_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM gemini_api_keys), 0) + 1, 1), false);`);
        await pool.query(`
          DO $$
          DECLARE constraint_name TEXT;
          BEGIN
            FOR constraint_name IN
              SELECT c.conname
              FROM pg_constraint c
              JOIN pg_class t ON t.oid = c.conrelid
              WHERE t.relname = 'gemini_api_keys'
                AND c.contype = 'u'
                AND pg_get_constraintdef(c.oid) = 'UNIQUE (api_key)'
            LOOP
              EXECUTE format('ALTER TABLE gemini_api_keys DROP CONSTRAINT %I', constraint_name);
            END LOOP;
          END $$;
        `);
        await pool.query(`DROP INDEX IF EXISTS gemini_api_keys_api_key_key;`);
        await pool.query(`
          DO $$
          DECLARE index_name TEXT;
          BEGIN
            FOR index_name IN
              SELECT idx.relname
              FROM pg_index i
              JOIN pg_class idx ON idx.oid = i.indexrelid
              JOIN pg_class tbl ON tbl.oid = i.indrelid
              WHERE tbl.relname = 'gemini_api_keys'
                AND i.indisunique
                AND pg_get_indexdef(i.indexrelid) ~ '\\(api_key\\)$'
                AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = i.indexrelid)
            LOOP
              EXECUTE format('DROP INDEX IF EXISTS %I', index_name);
            END LOOP;
          END $$;
        `);
        await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS gemini_api_keys_tenant_api_key_uq ON gemini_api_keys (tenant_id, api_key);`);
        console.log('[PostgreSQL] Tenant control-plane and Gemini key pool migration completed.');
      } catch (err) {
        console.warn('[PostgreSQL Auto-Migration Warning] Gagal migrasi tenant control-plane:', err.message);
      } finally {
        if (migrationClient) {
          await migrationClient.query(`SELECT pg_advisory_unlock(hashtext('makna_tenant_control_plane_v1'));`).catch(() => {});
          migrationClient.release();
        }
      }
    };
    migrateTenantControlPlane();

    const migratePillarCampaignIntegrity = async () => {
      let migrationClient;
      try {
        migrationClient = await pool.connect();
        await migrationClient.query(`SELECT pg_advisory_lock(hashtext('makna_pillar_campaign_integrity_v1'));`);
        await migrationClient.query(`CREATE SEQUENCE IF NOT EXISTS pillar_campaign_items_id_seq;`);
        await migrationClient.query(`ALTER TABLE pillar_campaign_items ALTER COLUMN id SET DEFAULT nextval('pillar_campaign_items_id_seq');`);
        await migrationClient.query(`SELECT setval('pillar_campaign_items_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM pillar_campaign_items), 0) + 1, 1), false);`);
        await migrationClient.query(`CREATE SEQUENCE IF NOT EXISTS re_campaign_items_id_seq;`);
        await migrationClient.query(`ALTER TABLE re_campaign_items ALTER COLUMN id SET DEFAULT nextval('re_campaign_items_id_seq');`);
        await migrationClient.query(`SELECT setval('re_campaign_items_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM re_campaign_items), 0) + 1, 1), false);`);
        await migrationClient.query(`CREATE SEQUENCE IF NOT EXISTS bridge_injector_items_id_seq;`);
        await migrationClient.query(`ALTER TABLE bridge_injector_items ALTER COLUMN id SET DEFAULT nextval('bridge_injector_items_id_seq');`);
        await migrationClient.query(`SELECT setval('bridge_injector_items_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM bridge_injector_items), 0) + 1, 1), false);`);
        await migrationClient.query(`
          ALTER TABLE pillar_campaigns
            ADD COLUMN IF NOT EXISTS account_name TEXT,
            ADD COLUMN IF NOT EXISTS source_planner_id TEXT,
            ADD COLUMN IF NOT EXISTS ai_directive TEXT,
            ADD COLUMN IF NOT EXISTS mandatory_outro_line TEXT;
        `);
        await migrationClient.query(`CREATE INDEX IF NOT EXISTS pillar_campaigns_source_planner_idx ON pillar_campaigns (tenant_id, source_planner_id);`);
        await migrationClient.query(`CREATE INDEX IF NOT EXISTS pillar_campaign_items_campaign_idx ON pillar_campaign_items (campaign_id, id);`);
        await migrationClient.query(`
          ALTER TABLE re_campaigns
            ADD COLUMN IF NOT EXISTS ai_directive TEXT,
            ADD COLUMN IF NOT EXISTS mandatory_outro_line TEXT;
        `);
        await migrationClient.query(`CREATE SEQUENCE IF NOT EXISTS system_audit_logs_id_seq;`);
        await migrationClient.query(`ALTER TABLE system_audit_logs ALTER COLUMN id SET DEFAULT nextval('system_audit_logs_id_seq');`);
        await migrationClient.query(`SELECT setval('system_audit_logs_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM system_audit_logs), 0) + 1, 1), false);`);
        console.log('[PostgreSQL] Pillar campaign integrity migration completed.');
      } catch (err) {
        console.warn('[PostgreSQL Auto-Migration Warning] Gagal migrasi integritas OPC:', err.message);
      } finally {
        if (migrationClient) {
          await migrationClient.query(`SELECT pg_advisory_unlock(hashtext('makna_pillar_campaign_integrity_v1'));`).catch(() => {});
          migrationClient.release();
        }
      }
    };
    migratePillarCampaignIntegrity();

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
          await pool.query(`ALTER TABLE bridge_injector_campaigns ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default_tenant';`);
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
          await pool.query(`ALTER TABLE bridge_injector_items ADD COLUMN IF NOT EXISTS original_voiceover TEXT;`);
          await pool.query(`ALTER TABLE bridge_injector_items ADD COLUMN IF NOT EXISTS tiktok_safe_voiceover TEXT;`);
          await pool.query(`ALTER TABLE bridge_injector_items ADD COLUMN IF NOT EXISTS compliance_status TEXT DEFAULT 'pending';`);
          await pool.query(`ALTER TABLE bridge_injector_items ADD COLUMN IF NOT EXISTS compliance_score TEXT DEFAULT 'low';`);
          await pool.query(`ALTER TABLE bridge_injector_items ADD COLUMN IF NOT EXISTS compliance_log_json TEXT;`);
          await pool.query(`ALTER TABLE bridge_injector_items ADD COLUMN IF NOT EXISTS selected_vo_version TEXT DEFAULT 'original';`);
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
      ALTER TABLE brand_profiles
        ADD COLUMN IF NOT EXISTS editorial_brand_context TEXT,
        ADD COLUMN IF NOT EXISTS editorial_content_goal TEXT,
        ADD COLUMN IF NOT EXISTS editorial_content_pillars_json TEXT DEFAULT '[]'
    `).then(() => pool.query(`
      UPDATE brand_profiles
      SET editorial_content_pillars_json='[]'
      WHERE editorial_content_pillars_json IS NULL
    `)).catch(err => {
      console.warn('[PostgreSQL Auto-Migration Warning] Gagal migrasi default Brand Editorial:', err.message);
    });

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
  const executor = pgTransactionContext.getStore() || pool;
  const start = Date.now();
  try {
    const res = await executor.query(text, params);
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

export async function withPgTransaction(callback) {
  const client = await getPgPool().connect();
  try {
    await client.query('BEGIN');
    const result = await pgTransactionContext.run(client, () => callback(client));
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closePgPool() {
  if (!pool) return;
  const activePool = pool;
  pool = null;
  await activePool.end();
}
