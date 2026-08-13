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
    const searchPath = process.env.PG_SEARCH_PATH || 'public';
    pool = new Pool({
      host: PG_HOST,
      port: PG_PORT,
      user: PG_USER,
      password: PG_PASSWORD,
      database: PG_DATABASE,
      max: parseInt(process.env.PGPOOL_MAX || '20', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      options: `-c search_path=${searchPath}`,
    });

    pool.on('error', (err) => {
      console.error('[PostgreSQL Pool Error]', err);
    });

    pool.on('connect', (client) => {
      client.query(`SET search_path TO ${searchPath};`).catch(err => {
        console.error(`[PostgreSQL] Failed to set search_path to ${searchPath}:`, err.message);
      });
    });

    console.log(`[PostgreSQL] Connection Pool initialized to ${PG_HOST}:${PG_PORT}/${PG_DATABASE} (schema: ${searchPath})`);

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
            ADD COLUMN IF NOT EXISTS auto_pause_threshold INTEGER NOT NULL DEFAULT 5,
            ADD COLUMN IF NOT EXISTS campaign_kind TEXT NOT NULL DEFAULT 'brand_editorial',
            ADD COLUMN IF NOT EXISTS brand_profile_id TEXT,
            ADD COLUMN IF NOT EXISTS product_id TEXT,
            ADD COLUMN IF NOT EXISTS brand_product_id TEXT;
          CREATE INDEX IF NOT EXISTS content_automation_schedule_product_idx
            ON content_automation_schedules(tenant_id,campaign_kind,product_id) WHERE status<>'archived';
          ALTER TABLE content_automation_runs
            ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS failure_class TEXT,
            ADD COLUMN IF NOT EXISTS skip_reason TEXT,
            ADD COLUMN IF NOT EXISTS campaign_kind TEXT NOT NULL DEFAULT 'brand_editorial',
            ADD COLUMN IF NOT EXISTS product_snapshot_json JSONB,
            ADD COLUMN IF NOT EXISTS review_revision TEXT,
            ADD COLUMN IF NOT EXISTS approved_item_count INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS total_item_count INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS contentflow_synced_count INTEGER NOT NULL DEFAULT 0;
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
          ALTER TABLE pillar_campaigns
            ADD COLUMN IF NOT EXISTS approval_mode TEXT NOT NULL DEFAULT 'creative',
            ADD COLUMN IF NOT EXISTS auto_sync_contentflow BOOLEAN NOT NULL DEFAULT FALSE;
          ALTER TABLE pillar_campaign_items
            ADD COLUMN IF NOT EXISTS start_frame_status TEXT NOT NULL DEFAULT 'pending',
            ADD COLUMN IF NOT EXISTS start_frame_revision INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS start_frame_expected_count INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS start_frame_completed_count INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS review_revision TEXT,
            ADD COLUMN IF NOT EXISTS approved_revision TEXT,
            ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS approved_by TEXT,
            ADD COLUMN IF NOT EXISTS contentflow_sync_status TEXT NOT NULL DEFAULT 'pending',
            ADD COLUMN IF NOT EXISTS contentflow_sync_attempts INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS contentflow_synced_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS contentflow_item_id TEXT,
            ADD COLUMN IF NOT EXISTS contentflow_error TEXT,
            ADD COLUMN IF NOT EXISTS review_state TEXT NOT NULL DEFAULT 'draft',
            ADD COLUMN IF NOT EXISTS review_reason TEXT,
            ADD COLUMN IF NOT EXISTS review_actor_id TEXT,
            ADD COLUMN IF NOT EXISTS review_state_updated_at TIMESTAMPTZ;
          CREATE TABLE IF NOT EXISTS pillar_campaign_item_assets (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, campaign_id TEXT NOT NULL,
            campaign_item_id TEXT NOT NULL, clip_index INTEGER NOT NULL,
            asset_type TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1,
            status TEXT NOT NULL DEFAULT 'pending', provider_task_id TEXT,
            local_path TEXT, vault_url TEXT, checksum TEXT, error_message TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id,campaign_item_id,clip_index,asset_type,revision)
          );
          CREATE INDEX IF NOT EXISTS pillar_campaign_item_assets_lookup_idx
            ON pillar_campaign_item_assets(tenant_id,campaign_item_id,asset_type,status);
        `);
        await migrationClient.query(`
          ALTER TABLE pillar_campaign_item_assets
            ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS last_error_code TEXT,
            ADD COLUMN IF NOT EXISTS last_error_message TEXT,
            ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS lease_owner TEXT,
            ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS request_json JSONB;
          CREATE INDEX IF NOT EXISTS pillar_campaign_item_assets_claim_idx
            ON pillar_campaign_item_assets(tenant_id,status,next_attempt_at,lease_expires_at,created_at);
          CREATE TABLE IF NOT EXISTS pillar_campaign_review_actions (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, campaign_item_id TEXT NOT NULL,
            review_revision TEXT NOT NULL, action TEXT NOT NULL, idempotency_key TEXT NOT NULL,
            actor_id TEXT, reason TEXT, result_json JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id,idempotency_key)
          );
          CREATE INDEX IF NOT EXISTS pillar_campaign_review_actions_item_idx
            ON pillar_campaign_review_actions(tenant_id,campaign_item_id,created_at DESC);
          CREATE TABLE IF NOT EXISTS pillar_campaign_stage_executions (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, campaign_item_id TEXT NOT NULL,
            stage TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, idempotency_key TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending', provider_task_id TEXT,
            output_json JSONB, error_json JSONB, attempt_count INTEGER NOT NULL DEFAULT 0,
            lease_owner TEXT, lease_expires_at TIMESTAMPTZ, started_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id,idempotency_key)
          );
          CREATE INDEX IF NOT EXISTS pillar_campaign_stage_executions_claim_idx
            ON pillar_campaign_stage_executions(tenant_id,status,lease_expires_at,created_at);
          INSERT INTO tenant_settings(tenant_id,setting_key,setting_value)
            SELECT id,'content_automation_product_campaign_enabled','true' FROM tenants
            ON CONFLICT(tenant_id,setting_key) DO NOTHING;
          INSERT INTO tenant_settings(tenant_id,setting_key,setting_value)
            SELECT id,'content_automation_product_campaign_pilot_enabled','false' FROM tenants
            ON CONFLICT(tenant_id,setting_key) DO NOTHING;
        `);
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

    const migrateStrategicCampaignCols = async () => {
      let migrationClient;
      try {
        migrationClient = await pool.connect();
        await migrationClient.query(`SELECT pg_advisory_lock(hashtext('makna_strategic_campaign_cols_v1'));`);
        await migrationClient.query(`
          ALTER TABLE strategic_campaigns
            ADD COLUMN IF NOT EXISTS brand_profile_id TEXT;
        `);
        console.log('[PostgreSQL] Strategic campaigns columns migration completed.');
      } catch (err) {
        console.warn('[PostgreSQL Auto-Migration Warning] Gagal migrasi strategic_campaigns:', err.message);
      } finally {
        if (migrationClient) {
          await migrationClient.query(`SELECT pg_advisory_unlock(hashtext('makna_strategic_campaign_cols_v1'));`).catch(() => {});
          migrationClient.release();
        }
      }
    };
    migrateStrategicCampaignCols();

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

    // Universe Platform (Tahap 3)
    const migrateUniversePlatform = async () => {
      const client = await pool.connect();
      try {
        await client.query(`SELECT pg_advisory_lock(hashtext('makna_universe_platform_v1'))`);

        // universe_profiles
        await client.query(`
          CREATE TABLE IF NOT EXISTS universe_profiles (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            name TEXT NOT NULL,
            slug TEXT NOT NULL,
            premise TEXT,
            tone TEXT,
            knowledge_domain TEXT DEFAULT 'general',
            human_presence TEXT DEFAULT 'none',
            default_visual_style TEXT DEFAULT 'cinematic_3d_clay',
            default_aspect_ratio TEXT DEFAULT '9:16',
            default_scene_count INTEGER DEFAULT 7,
            default_scene_duration INTEGER DEFAULT 8,
            default_story_template TEXT DEFAULT 'pet_problem_solution_7beat',
            cta_personality TEXT,
            default_pillars_json JSONB DEFAULT '[]'::jsonb,
            rules_json JSONB DEFAULT '{}'::jsonb,
            negative_prompts_json JSONB DEFAULT '[]'::jsonb,
            style_reference_path TEXT,
            status TEXT DEFAULT 'active',
            version INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await client.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_universe_profiles_tenant_slug
            ON universe_profiles (tenant_id, slug);
        `);

        // universe_characters
        await client.query(`
          CREATE TABLE IF NOT EXISTS universe_characters (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            universe_id TEXT NOT NULL,
            name TEXT NOT NULL,
            character_key TEXT NOT NULL,
            species TEXT,
            breed TEXT,
            body_shape TEXT,
            fur_color TEXT,
            eye_color TEXT,
            wardrobe TEXT,
            personality TEXT,
            movement_style TEXT,
            relative_size TEXT DEFAULT 'medium',
            role TEXT DEFAULT 'supporting',
            canonical_prompt TEXT NOT NULL,
            forbidden_changes_json JSONB DEFAULT '[]'::jsonb,
            reference_image_path TEXT,
            version INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await client.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_universe_chars_univ_key
            ON universe_characters (universe_id, character_key);
        `);

        // universe_locations
        await client.query(`
          CREATE TABLE IF NOT EXISTS universe_locations (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            universe_id TEXT NOT NULL,
            name TEXT NOT NULL,
            location_key TEXT NOT NULL,
            visual_description TEXT,
            lighting_default TEXT,
            props TEXT,
            reference_image_path TEXT,
            version INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await client.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_universe_locs_univ_key
            ON universe_locations (universe_id, location_key);
        `);

        // universe_episodes
        await client.query(`
          CREATE TABLE IF NOT EXISTS universe_episodes (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            universe_id TEXT NOT NULL,
            planner_row_id TEXT,
            campaign_item_id TEXT,
            product_used TEXT,
            problem_used TEXT,
            main_character TEXT,
            supporting_characters TEXT,
            location TEXT,
            hook_keywords TEXT,
            resolution_pattern TEXT,
            cta_used TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_universe_episodes_univ
            ON universe_episodes (universe_id, tenant_id);
        `);

        console.log('[PostgreSQL] Universe Platform migration completed (4 tables created).');
      } catch (err) {
        console.warn('[PostgreSQL Auto-Migration Warning] Universe Platform:', err.message);
      } finally {
        await client.query(`SELECT pg_advisory_unlock(hashtext('makna_universe_platform_v1'))`).catch(() => {});
        client.release();
      }
    };
    migrateUniversePlatform();

    // Tahap 3.5: Human Claymation Universe Support
    const migrateUniversePlatformV2 = async () => {
      let client;
      try {
        client = await pool.connect();
        await client.query(`SELECT pg_advisory_lock(hashtext('makna_universe_v2_migration'));`);
        await client.query(`
          ALTER TABLE universe_profiles
            ADD COLUMN IF NOT EXISTS universe_type TEXT DEFAULT 'animal',
            ADD COLUMN IF NOT EXISTS depiction_policy TEXT,
            ADD COLUMN IF NOT EXISTS historical_period TEXT
        `);
        await client.query(`
          ALTER TABLE universe_characters
            ADD COLUMN IF NOT EXISTS depiction_mode TEXT DEFAULT 'normal',
            ADD COLUMN IF NOT EXISTS reference_type TEXT DEFAULT 'identity',
            ADD COLUMN IF NOT EXISTS historical_period TEXT
        `);
        await client.query(`
          ALTER TABLE universe_locations
            ADD COLUMN IF NOT EXISTS historical_period TEXT,
            ADD COLUMN IF NOT EXISTS reference_type TEXT DEFAULT 'location'
        `);
        await client.query(`
          ALTER TABLE users
          ADD COLUMN IF NOT EXISTS api_key TEXT,
          ADD COLUMN IF NOT EXISTS is_api_enabled INTEGER DEFAULT 0;
        `);
        console.log('[PostgreSQL] Universe Platform V2 migration completed (Tahap 3.5).');
      } catch (err) {
        console.warn('[PostgreSQL Auto-Migration Warning] Universe V2 migration:', err.message);
      } finally {
        if (client) { try { await client.query('SELECT pg_advisory_unlock_all()'); } catch(_) {} client.release(); }
      }
    };
    migrateUniversePlatformV2();

    const migrateProductPhotoPipeline = async () => {
      let client;
      try {
        client = await pool.connect();
        await client.query(`SELECT pg_advisory_lock(hashtext('makna_product_photo_pipeline_v1'));`);
        await client.query(`
          ALTER TABLE product_extractions
          ADD COLUMN IF NOT EXISTS page TEXT,
          ADD COLUMN IF NOT EXISTS packaging_status TEXT,
          ADD COLUMN IF NOT EXISTS packaging_notes TEXT,
          ADD COLUMN IF NOT EXISTS import_status TEXT DEFAULT 'completed',
          ADD COLUMN IF NOT EXISTS enrichment_status TEXT DEFAULT 'pending',
          ADD COLUMN IF NOT EXISTS photo_status TEXT DEFAULT 'approved',
          ADD COLUMN IF NOT EXISTS photo_provider TEXT,
          ADD COLUMN IF NOT EXISTS photo_task_id TEXT,
          ADD COLUMN IF NOT EXISTS photo_error TEXT,
          ADD COLUMN IF NOT EXISTS enrichment_error TEXT,
          ADD COLUMN IF NOT EXISTS enrichment_reviewed_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS photo_reviewed_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS normalized_source_url TEXT,
          ADD COLUMN IF NOT EXISTS raw_photo_sha256 TEXT,
          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_product_extractions_enrichment_status ON product_extractions(tenant_id, enrichment_status, created_at);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_product_extractions_photo_status ON product_extractions(tenant_id, photo_status, created_at);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_product_extractions_normalized_url ON product_extractions(tenant_id, normalized_source_url);`);
        await client.query(`UPDATE product_extractions SET packaging_status = CASE WHEN is_in_packaging = 1 THEN 'packaged' ELSE 'unpackaged' END WHERE packaging_status IS NULL;`);
        await client.query(`UPDATE product_extractions SET photo_task_id = glabs_task_id WHERE photo_task_id IS NULL AND glabs_task_id IS NOT NULL;`);
      } catch (err) {
        console.warn('[PostgreSQL Auto-Migration Warning] Product Photo Pipeline migration:', err.message);
      } finally {
        if (client) { try { await client.query('SELECT pg_advisory_unlock_all()'); } catch(_) {} client.release(); }
      }
    };
    migrateProductPhotoPipeline();

    const migrateBrandProductAffiliateRouting = async () => {
      let client;
      try {
        client = await pool.connect();
        await client.query(`SELECT pg_advisory_lock(hashtext('makna_brand_product_affiliate_routing_v1'));`);

        // 1. brand_products
        await client.query(`
          CREATE TABLE IF NOT EXISTS brand_products (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            brand_profile_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            affiliate_link TEXT,
            tracking_code TEXT,
            landing_page_url TEXT,
            product_name_override TEXT,
            cta_override TEXT,
            notes TEXT,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (tenant_id, brand_profile_id, product_id)
          );
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS brand_products_brand_idx
            ON brand_products (tenant_id, brand_profile_id, is_active);
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS brand_products_product_idx
            ON brand_products (tenant_id, product_id);
        `);

        // 2. campaign_product_bindings
        await client.query(`
          CREATE TABLE IF NOT EXISTS campaign_product_bindings (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            source_type TEXT NOT NULL,
            source_campaign_id TEXT NOT NULL,
            source_item_id TEXT,
            brand_profile_id TEXT,
            brand_product_id TEXT,
            product_id TEXT NOT NULL,
            product_name_snapshot TEXT,
            product_url_snapshot TEXT,
            affiliate_link_snapshot TEXT,
            tracking_code_snapshot TEXT,
            affiliate_source TEXT NOT NULL,
            affiliate_status TEXT NOT NULL,
            resolved_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await client.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS campaign_product_bindings_source_uq
            ON campaign_product_bindings (
              tenant_id,
              source_type,
              source_campaign_id,
              COALESCE(source_item_id, '')
            );
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS campaign_product_bindings_product_idx
            ON campaign_product_bindings (tenant_id, product_id, brand_profile_id);
        `);

        // 3. content_flow_items columns
        await client.query(`
          ALTER TABLE content_flow_items
            ADD COLUMN IF NOT EXISTS brand_profile_id TEXT,
            ADD COLUMN IF NOT EXISTS brand_product_id TEXT,
            ADD COLUMN IF NOT EXISTS product_id TEXT,
            ADD COLUMN IF NOT EXISTS affiliate_source TEXT,
            ADD COLUMN IF NOT EXISTS affiliate_status TEXT,
            ADD COLUMN IF NOT EXISTS affiliate_resolved_at TIMESTAMPTZ;
        `);

        console.log('[PostgreSQL] Brand–Product Affiliate Routing migration completed.');
      } catch (err) {
        console.warn('[PostgreSQL Auto-Migration Warning] Brand–Product Affiliate Routing migration:', err.message);
      } finally {
        if (client) { try { await client.query('SELECT pg_advisory_unlock_all()'); } catch(_) {} client.release(); }
      }
    };
    migrateBrandProductAffiliateRouting();

    const migratePublishingScheduler = async () => {
      let client;
      try {
        client = await pool.connect();
        await client.query(`SELECT pg_advisory_lock(hashtext('makna_publishing_scheduler_v1'));`);

        await client.query(`
          CREATE TABLE IF NOT EXISTS publishing_accounts (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            platform TEXT NOT NULL CHECK (platform IN ('facebook','instagram')),
            display_name TEXT NOT NULL,
            facebook_page_id TEXT,
            instagram_user_id TEXT,
            linked_facebook_page_id TEXT,
            token_ciphertext TEXT NOT NULL,
            token_expires_at TIMESTAMPTZ,
            permissions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
            timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
            status TEXT NOT NULL DEFAULT 'active',
            paused_at TIMESTAMPTZ,
            last_verified_at TIMESTAMPTZ,
            last_error_code TEXT,
            last_error_message TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (tenant_id, platform, facebook_page_id, instagram_user_id)
          );

          CREATE TABLE IF NOT EXISTS publishing_jobs (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            content_id TEXT NOT NULL,
            account_id TEXT NOT NULL REFERENCES publishing_accounts(id) ON DELETE CASCADE,
            platform TEXT NOT NULL CHECK (platform IN ('facebook','instagram')),
            publish_mode TEXT NOT NULL CHECK (publish_mode IN ('draft','live')),
            media_type TEXT NOT NULL,
            caption_snapshot TEXT NOT NULL,
            media_url_snapshot TEXT NOT NULL,
            scheduled_at TIMESTAMPTZ NOT NULL,
            status TEXT NOT NULL DEFAULT 'scheduled',
            approval_status TEXT NOT NULL DEFAULT 'not_required',
            approved_by TEXT,
            approved_at TIMESTAMPTZ,
            attempt_count INTEGER NOT NULL DEFAULT 0,
            max_attempts INTEGER NOT NULL DEFAULT 3,
            next_attempt_at TIMESTAMPTZ,
            locked_at TIMESTAMPTZ,
            locked_by TEXT,
            external_container_id TEXT,
            external_post_id TEXT,
            external_permalink TEXT,
            last_error_code TEXT,
            last_error_message TEXT,
            idempotency_key TEXT NOT NULL,
            published_at TIMESTAMPTZ,
            cancelled_at TIMESTAMPTZ,
            created_by TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (tenant_id, idempotency_key)
          );

          CREATE TABLE IF NOT EXISTS publishing_attempts (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            job_id TEXT NOT NULL REFERENCES publishing_jobs(id) ON DELETE CASCADE,
            attempt_number INTEGER NOT NULL,
            correlation_id TEXT NOT NULL,
            stage TEXT NOT NULL,
            outcome TEXT NOT NULL,
            http_status INTEGER,
            provider_error_code TEXT,
            sanitized_message TEXT,
            external_container_id TEXT,
            external_post_id TEXT,
            started_at TIMESTAMPTZ NOT NULL,
            finished_at TIMESTAMPTZ,
            UNIQUE (job_id, attempt_number, stage)
          );

          CREATE TABLE IF NOT EXISTS publishing_control (
            tenant_id TEXT PRIMARY KEY,
            is_paused BOOLEAN NOT NULL DEFAULT FALSE,
            paused_at TIMESTAMPTZ,
            paused_by TEXT,
            pause_reason TEXT,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
          );

          CREATE INDEX IF NOT EXISTS publishing_jobs_due_idx
            ON publishing_jobs(status, scheduled_at, next_attempt_at);
          CREATE INDEX IF NOT EXISTS publishing_jobs_tenant_content_idx
            ON publishing_jobs(tenant_id, content_id, created_at DESC);
          CREATE INDEX IF NOT EXISTS publishing_jobs_account_idx
            ON publishing_jobs(tenant_id, account_id, scheduled_at DESC);
          CREATE INDEX IF NOT EXISTS publishing_attempts_job_idx
            ON publishing_attempts(job_id, attempt_number);
        `);

        console.log('[PostgreSQL] Publishing Scheduler migration completed.');
      } catch (err) {
        console.warn('[PostgreSQL Auto-Migration Warning] Publishing Scheduler migration:', err.message);
      } finally {
        if (client) { try { await client.query('SELECT pg_advisory_unlock_all()'); } catch(_) {} client.release(); }
      }
    };
    migratePublishingScheduler();
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
