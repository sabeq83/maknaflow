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
            ADD COLUMN IF NOT EXISTS pillar_distribution_mode TEXT DEFAULT 'balanced',
            ADD COLUMN IF NOT EXISTS promotion_context TEXT,
            ADD COLUMN IF NOT EXISTS custom_instructions TEXT
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
          CREATE TABLE IF NOT EXISTS opc_start_frame_request_audits (
            id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, campaign_id TEXT NOT NULL,
            campaign_item_id TEXT NOT NULL, clip_index INTEGER NOT NULL, origin TEXT NOT NULL,
            requires_product_reference BOOLEAN NOT NULL, requirement_reason TEXT,
            reference_count INTEGER NOT NULL DEFAULT 0, reference_source_field TEXT,
            reference_sha256 TEXT, prompt_sha256 TEXT NOT NULL, request_fingerprint TEXT NOT NULL,
            provider_task_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS opc_start_frame_request_audits_lookup_idx
            ON opc_start_frame_request_audits(tenant_id,campaign_id,campaign_item_id,clip_index,created_at DESC);
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
            external_media_status TEXT,
            external_object_type TEXT,
            provider_stage TEXT,
            provider_state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
            verified_at TIMESTAMPTZ,
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

          ALTER TABLE publishing_jobs
            ADD COLUMN IF NOT EXISTS external_media_status TEXT,
            ADD COLUMN IF NOT EXISTS external_object_type TEXT,
            ADD COLUMN IF NOT EXISTS provider_stage TEXT,
            ADD COLUMN IF NOT EXISTS provider_state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
            ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

          -- Repliz fields
          ALTER TABLE publishing_accounts ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'meta';
          ALTER TABLE publishing_accounts ADD COLUMN IF NOT EXISTS provider_account_id TEXT;
          ALTER TABLE publishing_accounts ALTER COLUMN token_ciphertext DROP NOT NULL;

          ALTER TABLE publishing_jobs ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'meta';
          ALTER TABLE publishing_jobs ADD COLUMN IF NOT EXISTS external_schedule_id TEXT;
          ALTER TABLE publishing_jobs ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT FALSE;

          -- Drop old platform check constraints dynamically
          DO $$
          DECLARE const_name TEXT;
          BEGIN
            FOR const_name IN
              SELECT conname FROM pg_constraint
              WHERE conrelid = 'publishing_accounts'::regclass AND contype = 'c' 
                AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'publishing_accounts'::regclass AND attname = 'platform')]
            LOOP
              EXECUTE format('ALTER TABLE publishing_accounts DROP CONSTRAINT %I', const_name);
            END LOOP;

            FOR const_name IN
              SELECT conname FROM pg_constraint
              WHERE conrelid = 'publishing_jobs'::regclass AND contype = 'c' 
                AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'publishing_jobs'::regclass AND attname = 'platform')]
            LOOP
              EXECUTE format('ALTER TABLE publishing_jobs DROP CONSTRAINT %I', const_name);
            END LOOP;
          END $$;

          -- Add new check constraints
          ALTER TABLE publishing_accounts ADD CONSTRAINT publishing_accounts_platform_check 
            CHECK (platform IN ('facebook', 'instagram', 'threads', 'tiktok', 'linkedin', 'youtube'));
          ALTER TABLE publishing_jobs ADD CONSTRAINT publishing_jobs_platform_check 
            CHECK (platform IN ('facebook', 'instagram', 'threads', 'tiktok', 'linkedin', 'youtube'));

          -- Add provider constraints
          DO $$
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'publishing_accounts'::regclass AND conname = 'publishing_accounts_provider_check') THEN
              ALTER TABLE publishing_accounts ADD CONSTRAINT publishing_accounts_provider_check CHECK (provider IN ('meta', 'repliz'));
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'publishing_jobs'::regclass AND conname = 'publishing_jobs_provider_check') THEN
              ALTER TABLE publishing_jobs ADD CONSTRAINT publishing_jobs_provider_check CHECK (provider IN ('meta', 'repliz'));
            END IF;
          END $$;

          CREATE UNIQUE INDEX IF NOT EXISTS publishing_accounts_repliz_uq 
            ON publishing_accounts (tenant_id, provider, provider_account_id) WHERE (provider = 'repliz');
        `);

        console.log('[PostgreSQL] Publishing Scheduler migration completed.');
      } catch (err) {
        console.warn('[PostgreSQL Auto-Migration Warning] Publishing Scheduler migration:', err.message);
      } finally {
        if (client) { try { await client.query('SELECT pg_advisory_unlock_all()'); } catch(_) {} client.release(); }
      }
    };
    migratePublishingScheduler();

    const migrateContentFlowPublishingColumns = async () => {
      let client;
      try {
        client = await pool.connect();
        await client.query(`SELECT pg_advisory_lock(hashtext('makna_cf_publishing_columns_v1'));`);
        await client.query(`
          ALTER TABLE content_flow_items
            ADD COLUMN IF NOT EXISTS tiktok_status TEXT DEFAULT 'Not Published',
            ADD COLUMN IF NOT EXISTS tiktok_publish_date TEXT,
            ADD COLUMN IF NOT EXISTS permalink_tiktok TEXT,
            ADD COLUMN IF NOT EXISTS youtube_status TEXT DEFAULT 'Not Published',
            ADD COLUMN IF NOT EXISTS youtube_publish_date TEXT,
            ADD COLUMN IF NOT EXISTS permalink_youtube TEXT,
            ADD COLUMN IF NOT EXISTS threads_status TEXT DEFAULT 'Not Published',
            ADD COLUMN IF NOT EXISTS threads_publish_date TEXT,
            ADD COLUMN IF NOT EXISTS permalink_threads TEXT,
            ADD COLUMN IF NOT EXISTS linkedin_status TEXT DEFAULT 'Not Published',
            ADD COLUMN IF NOT EXISTS linkedin_publish_date TEXT,
            ADD COLUMN IF NOT EXISTS permalink_linkedin TEXT;
        `);
        console.log('[PostgreSQL] ContentFlow publishing columns migration completed (tiktok/youtube/threads/linkedin).');
      } catch (err) {
        console.warn('[PostgreSQL Auto-Migration Warning] ContentFlow publishing columns migration:', err.message);
      } finally {
        if (client) { try { await client.query('SELECT pg_advisory_unlock_all()'); } catch(_) {} client.release(); }
      }
    };
    migrateContentFlowPublishingColumns();

    const migrateDeconstructTenantAndLibrary = async () => {
      let migrationClient;
      try {
        migrationClient = await pool.connect();
        await migrationClient.query(`SELECT pg_advisory_lock(hashtext('makna_deconstruct_library_v1'));`);
        await migrationClient.query(`
          ALTER TABLE re_deconstruct_batches
            ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default_tenant';

          ALTER TABLE re_deconstructed_assets
            ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            ADD COLUMN IF NOT EXISTS niche TEXT,
            ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS deconstructed_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

          -- Ubah tipe data created_at ke TIMESTAMPTZ agar timezone terformat dengan benar (GMT+7)
          ALTER TABLE re_deconstructed_assets 
            ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';

          ALTER TABLE re_deconstruct_batches 
            ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
        `);
        await migrationClient.query(`CREATE INDEX IF NOT EXISTS re_deconstruct_assets_library_idx ON re_deconstructed_assets (tenant_id, status, niche, created_at DESC);`);
        await migrationClient.query(`CREATE INDEX IF NOT EXISTS re_deconstruct_assets_queue_idx ON re_deconstructed_assets (tenant_id, batch_id, status, created_at);`);

        // Create re_niches table to store big niches
        await migrationClient.query(`
          CREATE TABLE IF NOT EXISTS re_niches (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
        // Seed default niches if empty
        const countNiches = await migrationClient.query(`SELECT COUNT(*)::int as cnt FROM re_niches;`);
        if (countNiches.rows[0].cnt === 0) {
          await migrationClient.query(`
            INSERT INTO re_niches (id, name, description) VALUES
            ('health', 'Health', 'Healthy tips, herbs, home remedies, fitness'),
            ('cooking', 'Cooking', 'Savory food recipe, breakfast ideas, cooking tutorials'),
            ('baking', 'Baking', 'Cakes, pastry, cookies, bread recipes'),
            ('skincare', 'Skincare', 'Beauty routines, product reviews, anti-aging, acne solutions'),
            ('home_care', 'Home Care', 'Cleaning hacks, pest control, DIY organizers, laundry tips'),
            ('fashion', 'Fashion', 'OOTD, style tips, outfit matchings'),
            ('tech_gadgets', 'Tech & Gadgets', 'Phone reviews, smart home tools, tech setups')
          `);
          console.log('[PostgreSQL] Seeded default re_niches successfully.');
        }

        // Fix scheduler_jobs auto-increment sequence for PostgreSQL compatibility
        await migrationClient.query(`CREATE SEQUENCE IF NOT EXISTS scheduler_jobs_id_seq;`);
        await migrationClient.query(`ALTER TABLE scheduler_jobs ALTER COLUMN id SET DEFAULT nextval('scheduler_jobs_id_seq');`);
        await migrationClient.query(`SELECT setval('scheduler_jobs_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM scheduler_jobs), 0) + 1, 1), false);`);

        console.log('[PostgreSQL] Deconstruct Lab tenant & library migration completed.');
      } catch (err) {
        console.warn('[PostgreSQL Auto-Migration Warning] Gagal migrasi Deconstruct Lab:', err.message);
      } finally {
        if (migrationClient) {
          await migrationClient.query(`SELECT pg_advisory_unlock(hashtext('makna_deconstruct_library_v1'));`).catch(() => {});
          migrationClient.release();
        }
      }
    };
    migrateDeconstructTenantAndLibrary();

    const migrateVisualIdentityFoundation = async () => {
      let client;
      try {
        client = await pool.connect();
        await client.query(`SELECT pg_advisory_lock(hashtext('makna_visual_identity_foundation_v1'));`);
        
        // 1. Create visual_identity_presets table
        await client.query(`
          CREATE TABLE IF NOT EXISTS visual_identity_presets (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            preset_key TEXT NOT NULL,
            label TEXT NOT NULL,
            description TEXT,
            config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
            status TEXT NOT NULL DEFAULT 'active',
            version INTEGER NOT NULL DEFAULT 1,
            created_by TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (tenant_id, preset_key)
          );
          CREATE INDEX IF NOT EXISTS idx_vip_tenant_status ON visual_identity_presets (tenant_id, status);
        `);

        // 2. Add columns to campaign tables
        const tables = ['re_campaigns', 'pillar_campaigns', 'sheets_campaigns'];
        for (const tbl of tables) {
          await client.query(`
            ALTER TABLE ${tbl}
              ADD COLUMN IF NOT EXISTS visual_identity_preset_id TEXT,
              ADD COLUMN IF NOT EXISTS visual_identity_preset_version INTEGER
          `);
        }
        console.log('[PostgreSQL] Visual Identity Foundation migration completed.');
      } catch (err) {
        console.warn('[PostgreSQL Auto-Migration Warning] Gagal migrasi Visual Identity Foundation:', err.message);
      } finally {
        if (client) {
          try { await client.query('SELECT pg_advisory_unlock_all()'); } catch(_) {}
          client.release();
        }
      }
    };
    migrateVisualIdentityFoundation();

    const migrateMultiplierTasksTenantAndBatch = async () => {
      let client;
      try {
        client = await pool.connect();
        await client.query(`SELECT pg_advisory_lock(hashtext('makna_multiplier_tasks_v1'));`);
        await client.query(`
          CREATE TABLE IF NOT EXISTS re_multiplier_tasks (
            id TEXT PRIMARY KEY,
            deconstruct_asset_id TEXT REFERENCES re_deconstructed_assets(id) ON DELETE CASCADE,
            target_product_url TEXT,
            affiliate_url TEXT,
            vso_config_json TEXT,
            bridging_config_json TEXT,
            audio_config_json TEXT,
            remake_storyboard_json TEXT,
            t2i_i2v_prompts_json TEXT,
            new_caption TEXT,
            glabs_task_ids TEXT,
            ffmpeg_output_path TEXT,
            status TEXT DEFAULT 'pending_resolution',
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
          );
          ALTER TABLE re_multiplier_tasks
            ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            ADD COLUMN IF NOT EXISTS batch_id TEXT,
            ADD COLUMN IF NOT EXISTS target_product_id TEXT,
            ADD COLUMN IF NOT EXISTS row_index INTEGER,
            ADD COLUMN IF NOT EXISTS product_snapshot_json JSONB,
            ADD COLUMN IF NOT EXISTS error_message TEXT,
            ADD COLUMN IF NOT EXISTS t2i_images_json TEXT,
            ADD COLUMN IF NOT EXISTS paused_previous_status TEXT;
          CREATE INDEX IF NOT EXISTS re_multiplier_tasks_tenant_status_created_idx ON re_multiplier_tasks (tenant_id, status, created_at);
          CREATE INDEX IF NOT EXISTS re_multiplier_tasks_batch_lookup_idx ON re_multiplier_tasks (tenant_id, batch_id, row_index);
        `);
        console.log('[PostgreSQL] Multiplier Tasks tenant & batch migration completed.');
      } catch (err) {
        console.warn('[PostgreSQL Auto-Migration Warning] Gagal migrasi Multiplier Tasks:', err.message);
      } finally {
        if (client) { try { await client.query('SELECT pg_advisory_unlock_all()'); } catch(_) {} client.release(); }
      }
    };
    migrateMultiplierTasksTenantAndBatch();

    const migrateVisualReferenceAssets = async () => {
      let client;
      try {
        client = await pool.connect();
        await client.query(`SELECT pg_advisory_lock(hashtext('makna_visual_reference_assets_v1'));`);
        await client.query(`
          CREATE TABLE IF NOT EXISTS visual_reference_assets (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            owner_type TEXT NOT NULL,
            owner_id TEXT NOT NULL,
            universe_id TEXT,
            asset_role TEXT NOT NULL,
            version INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'draft',
            source_type TEXT NOT NULL,
            storage_path TEXT,
            public_path TEXT,
            mime_type TEXT,
            byte_size BIGINT,
            sha256 TEXT,
            width INTEGER,
            height INTEGER,
            generation_prompt TEXT,
            negative_prompt TEXT,
            provider TEXT,
            provider_task_id TEXT,
            provider_result_url TEXT,
            metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
            review_notes TEXT,
            failure_code TEXT,
            failure_message TEXT,
            created_by TEXT,
            approved_by TEXT,
            approved_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (tenant_id, owner_type, owner_id, asset_role, version)
          );
          CREATE INDEX IF NOT EXISTS idx_vra_lookup ON visual_reference_assets (tenant_id, owner_type, owner_id, asset_role, status);
          CREATE UNIQUE INDEX IF NOT EXISTS idx_vra_one_approved ON visual_reference_assets (tenant_id, owner_type, owner_id, asset_role) WHERE status = 'approved';
          CREATE INDEX IF NOT EXISTS idx_vra_provider_task ON visual_reference_assets (tenant_id, provider_task_id) WHERE provider_task_id IS NOT NULL;
        `);
        console.log('[PostgreSQL] Visual Reference Assets migration completed.');
      } catch (err) {
        console.warn('[PostgreSQL Auto-Migration Warning] Gagal migrasi Visual Reference Assets:', err.message);
      } finally {
        if (client) {
          try { await client.query('SELECT pg_advisory_unlock_all()'); } catch(_) {}
          client.release();
        }
      }
    };
    migrateVisualReferenceAssets();

    const migrateYouTubeStudioMvp = async () => {
      let client;
      try {
        client = await pool.connect();
        await client.query(`SELECT pg_advisory_lock(hashtext('makna_youtube_studio_mvp_v1'));`);
        
        await client.query(`
          CREATE TABLE IF NOT EXISTS youtube_channels (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            name TEXT NOT NULL,
            channel_handle TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            primary_locale TEXT NOT NULL DEFAULT 'id-ID',
            youtube_account_ref TEXT,
            created_by TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_ytc_tenant ON youtube_channels (tenant_id, status);

          CREATE TABLE IF NOT EXISTS youtube_channel_strategies (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            channel_id TEXT NOT NULL REFERENCES youtube_channels(id) ON DELETE CASCADE,
            status TEXT NOT NULL DEFAULT 'active',
            config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
            universe_id TEXT,
            universe_snapshot_json JSONB,
            visual_identity_preset_id TEXT,
            visual_identity_version INTEGER,
            visual_identity_snapshot_json JSONB,
            created_by TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_yts_tenant ON youtube_channel_strategies (tenant_id, channel_id, status);

          CREATE TABLE IF NOT EXISTS youtube_series (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            channel_id TEXT NOT NULL REFERENCES youtube_channels(id) ON DELETE CASCADE,
            strategy_id TEXT NOT NULL REFERENCES youtube_channel_strategies(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            pillar TEXT,
            config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
            status TEXT NOT NULL DEFAULT 'active',
            created_by TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_yt_series ON youtube_series (tenant_id, channel_id, status);

          CREATE TABLE IF NOT EXISTS youtube_episodes (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            channel_id TEXT NOT NULL REFERENCES youtube_channels(id) ON DELETE CASCADE,
            series_id TEXT NOT NULL REFERENCES youtube_series(id) ON DELETE CASCADE,
            strategy_id TEXT NOT NULL REFERENCES youtube_channel_strategies(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            locale TEXT NOT NULL,
            target_duration_seconds INTEGER NOT NULL DEFAULT 600,
            priority INTEGER NOT NULL DEFAULT 0,
            target_publish_at TIMESTAMP,
            status TEXT NOT NULL DEFAULT 'Idea',
            production_snapshot_json JSONB,
            created_by TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_yt_episodes ON youtube_episodes (tenant_id, channel_id, status);

          CREATE TABLE IF NOT EXISTS youtube_episode_blueprints (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            episode_id TEXT NOT NULL REFERENCES youtube_episodes(id) ON DELETE CASCADE,
            content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
            version INTEGER NOT NULL DEFAULT 1,
            status TEXT NOT NULL DEFAULT 'draft',
            created_by TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_yt_blueprints ON youtube_episode_blueprints (tenant_id, episode_id);

          CREATE TABLE IF NOT EXISTS youtube_episode_scripts (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            episode_id TEXT NOT NULL REFERENCES youtube_episodes(id) ON DELETE CASCADE,
            blueprint_id TEXT NOT NULL REFERENCES youtube_episode_blueprints(id) ON DELETE CASCADE,
            locale TEXT NOT NULL,
            script_json JSONB NOT NULL DEFAULT '{}'::jsonb,
            version INTEGER NOT NULL DEFAULT 1,
            status TEXT NOT NULL DEFAULT 'draft',
            review_note TEXT,
            approved_by TEXT,
            approved_at TIMESTAMP,
            created_by TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_yt_scripts ON youtube_episode_scripts (tenant_id, episode_id, status);

          CREATE TABLE IF NOT EXISTS youtube_production_packages (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            episode_id TEXT NOT NULL REFERENCES youtube_episodes(id) ON DELETE CASCADE,
            approved_script_id TEXT NOT NULL REFERENCES youtube_episode_scripts(id) ON DELETE CASCADE,
            scene_manifest_json JSONB NOT NULL DEFAULT '{}'::jsonb,
            voice_manifest_json JSONB NOT NULL DEFAULT '{}'::jsonb,
            subtitle_asset_json JSONB,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_yt_prod_packages ON youtube_production_packages (tenant_id, episode_id);

          CREATE TABLE IF NOT EXISTS youtube_render_jobs (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            episode_id TEXT NOT NULL REFERENCES youtube_episodes(id) ON DELETE CASCADE,
            production_package_id TEXT REFERENCES youtube_production_packages(id) ON DELETE CASCADE,
            job_type TEXT NOT NULL DEFAULT 'final',
            idempotency_key TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'queued',
            progress INTEGER NOT NULL DEFAULT 0,
            input_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
            output_asset_json JSONB DEFAULT '{}'::jsonb,
            error_code TEXT,
            error_message TEXT,
            cost_json JSONB DEFAULT '{}'::jsonb,
            started_at TIMESTAMP,
            completed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id, idempotency_key)
          );
          CREATE INDEX IF NOT EXISTS idx_yt_render_jobs ON youtube_render_jobs (tenant_id, episode_id, status);

          CREATE TABLE IF NOT EXISTS youtube_publishing_packages (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            episode_id TEXT NOT NULL REFERENCES youtube_episodes(id) ON DELETE CASCADE,
            title TEXT,
            description TEXT,
            chapters_json JSONB,
            thumbnail_asset_json JSONB,
            upload_privacy TEXT NOT NULL DEFAULT 'private',
            approval_status TEXT NOT NULL DEFAULT 'draft',
            youtube_video_id TEXT,
            youtube_studio_url TEXT,
            upload_status TEXT NOT NULL DEFAULT 'draft',
            error_message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_yt_publishing ON youtube_publishing_packages (tenant_id, episode_id);

          CREATE TABLE IF NOT EXISTS youtube_episode_short_derivatives (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            episode_id TEXT NOT NULL REFERENCES youtube_episodes(id) ON DELETE CASCADE,
            start_ms INTEGER NOT NULL,
            end_ms INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'draft',
            short_workflow_ref TEXT,
            metadata_json JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_yt_derivatives ON youtube_episode_short_derivatives (tenant_id, episode_id);
        `);
        console.log('[PostgreSQL] YouTube Studio MVP migration completed.');
      } catch (err) {
        console.warn('[PostgreSQL Auto-Migration Warning] Gagal migrasi YouTube Studio MVP:', err.message);
      } finally {
        if (client) {
          try { await client.query('SELECT pg_advisory_unlock_all()'); } catch(_) {}
          client.release();
        }
      }
    };
    migrateYouTubeStudioMvp();

    const migrateYouTubeStudioEditorial = async () => {
      let client;
      try {
        client = await pool.connect();
        await client.query(`SELECT pg_advisory_lock(hashtext('makna_youtube_studio_editorial_v1'));`);
        
        await client.query(`
          -- Add brief_json to youtube_channel_strategies if not exists
          ALTER TABLE youtube_channel_strategies ADD COLUMN IF NOT EXISTS brief_json JSONB DEFAULT '{}'::jsonb;
          
          -- Alter default value of status in youtube_channel_strategies to draft
          ALTER TABLE youtube_channel_strategies ALTER COLUMN status SET DEFAULT 'draft';
          
          -- Create unique index idx_yts_one_active_per_channel to enforce single active strategy per channel
          CREATE UNIQUE INDEX IF NOT EXISTS idx_yts_one_active_per_channel
            ON youtube_channel_strategies (tenant_id, channel_id)
            WHERE status = 'active';

          -- Create table youtube_episode_ideas
          CREATE TABLE IF NOT EXISTS youtube_episode_ideas (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            channel_id TEXT NOT NULL REFERENCES youtube_channels(id) ON DELETE CASCADE,
            series_id TEXT NOT NULL REFERENCES youtube_series(id) ON DELETE CASCADE,
            strategy_id TEXT NOT NULL REFERENCES youtube_channel_strategies(id) ON DELETE CASCADE,
            locale TEXT NOT NULL,
            title TEXT NOT NULL,
            angle TEXT,
            content_promise TEXT,
            rationale TEXT,
            target_duration_seconds INTEGER NOT NULL DEFAULT 600,
            status TEXT NOT NULL DEFAULT 'suggested',
            source TEXT DEFAULT 'ai',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_ytei_tenant_series ON youtube_episode_ideas (tenant_id, series_id, status);

          -- Add source_idea_id to youtube_episodes
          ALTER TABLE youtube_episodes ADD COLUMN IF NOT EXISTS source_idea_id TEXT;
        `);
        console.log('[PostgreSQL] YouTube Studio Editorial migration completed.');
      } catch (err) {
        console.warn('[PostgreSQL Auto-Migration Warning] Gagal migrasi YouTube Studio Editorial:', err.message);
      } finally {
        if (client) {
          try { await client.query('SELECT pg_advisory_unlock_all()'); } catch(_) {}
          client.release();
        }
      }
    };
    migrateYouTubeStudioEditorial();

    const migrateYouTubeStudioBlueprintScript = async () => {
      let client;
      try {
        client = await pool.connect();
        await client.query(`SELECT pg_advisory_lock(hashtext('makna_youtube_studio_blueprint_script_v1'));`);
        await client.query(`
          -- Create table research briefs
          CREATE TABLE IF NOT EXISTS youtube_episode_research_briefs (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            episode_id TEXT NOT NULL REFERENCES youtube_episodes(id) ON DELETE CASCADE,
            content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
            version INTEGER NOT NULL DEFAULT 1,
            status TEXT NOT NULL DEFAULT 'draft',
            created_by TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE UNIQUE INDEX IF NOT EXISTS idx_yterb_tenant_episode_ver 
            ON youtube_episode_research_briefs (tenant_id, episode_id, version);

          -- Alter blueprints table
          ALTER TABLE youtube_episode_blueprints 
            ADD COLUMN IF NOT EXISTS approved_by TEXT,
            ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS context_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb;
          CREATE UNIQUE INDEX IF NOT EXISTS idx_ytebp_tenant_episode_ver 
            ON youtube_episode_blueprints (tenant_id, episode_id, version);

          -- Alter scripts table
          ALTER TABLE youtube_episode_scripts 
            ADD COLUMN IF NOT EXISTS context_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb;
          CREATE UNIQUE INDEX IF NOT EXISTS idx_ytesc_tenant_episode_ver 
            ON youtube_episode_scripts (tenant_id, episode_id, version);
        `);
        console.log('[PostgreSQL] YouTube Studio Blueprint & Script Phase 2 migrations completed.');
      } catch (e) {
        console.warn('[PostgreSQL Auto-Migration Warning] Phase 2 migration failed:', e.message);
      } finally {
        if (client) {
          try { await client.query('SELECT pg_advisory_unlock_all()'); } catch(_) {}
          client.release();
        }
      }
    };
    migrateYouTubeStudioBlueprintScript();

    const migrateYouTubeStudioPhase2_5 = async () => {
      let client;
      try {
        client = await pool.connect();
        await client.query(`SELECT pg_advisory_lock(hashtext('makna_youtube_studio_phase_2_5'));`);
        await client.query(`
          ALTER TABLE youtube_episodes
            ADD COLUMN IF NOT EXISTS duration_source TEXT NOT NULL DEFAULT 'channel',
            ADD COLUMN IF NOT EXISTS generation_profile_key TEXT;
        `);
        console.log('[PostgreSQL] YouTube Studio Duration & Profiles Phase 2.5 migrations completed.');
      } catch (e) {
        console.warn('[PostgreSQL Auto-Migration Warning] Phase 2.5 migration failed:', e.message);
      } finally {
        if (client) {
          try { await client.query('SELECT pg_advisory_unlock_all()'); } catch(_) {}
          client.release();
        }
      }
    };
    migrateYouTubeStudioPhase2_5();

    const migrateYouTubeStudioPhase3 = async () => {
      let client;
      try {
        client = await pool.connect();
        await client.query(`SELECT pg_advisory_lock(hashtext('makna_youtube_studio_phase_3'));`);
        await client.query(`
          -- Alter existing youtube_production_packages table to add new columns if they don't exist
          ALTER TABLE youtube_production_packages ADD COLUMN IF NOT EXISTS plan_json JSONB;
          ALTER TABLE youtube_production_packages ADD COLUMN IF NOT EXISTS generation_profile_key TEXT;
          ALTER TABLE youtube_production_packages ADD COLUMN IF NOT EXISTS context_snapshot_json JSONB;
          ALTER TABLE youtube_production_packages ADD COLUMN IF NOT EXISTS approved_by TEXT;
          ALTER TABLE youtube_production_packages ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
          ALTER TABLE youtube_production_packages ADD COLUMN IF NOT EXISTS preview_asset_json JSONB;
          ALTER TABLE youtube_production_packages ADD COLUMN IF NOT EXISTS final_asset_json JSONB;

          -- youtube_production_packages
          CREATE TABLE IF NOT EXISTS youtube_production_packages (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            episode_id TEXT NOT NULL REFERENCES youtube_episodes(id) ON DELETE CASCADE,
            approved_script_id TEXT NOT NULL,
            generation_profile_key TEXT NOT NULL,
            plan_json JSONB NOT NULL DEFAULT '{}'::jsonb,
            context_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
            status TEXT NOT NULL DEFAULT 'draft',
            approved_by TEXT,
            approved_at TIMESTAMP,
            preview_asset_json JSONB,
            final_asset_json JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );

          -- youtube_production_assets
          CREATE TABLE IF NOT EXISTS youtube_production_assets (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            production_package_id TEXT NOT NULL REFERENCES youtube_production_packages(id) ON DELETE CASCADE,
            scene_index INTEGER NOT NULL,
            shot_index INTEGER NOT NULL,
            asset_type TEXT NOT NULL,
            generation_profile_key TEXT,
            generation_duration_seconds INTEGER,
            prompt_snapshot TEXT,
            provider_task_id TEXT,
            source_asset_json JSONB,
            output_asset_json JSONB,
            status TEXT NOT NULL DEFAULT 'queued',
            attempt_count INTEGER NOT NULL DEFAULT 0,
            cost_json JSONB DEFAULT '{}'::jsonb,
            error_code TEXT,
            error_message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );

          -- youtube_production_jobs
          CREATE TABLE IF NOT EXISTS youtube_production_jobs (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            production_package_id TEXT NOT NULL REFERENCES youtube_production_packages(id) ON DELETE CASCADE,
            asset_id TEXT REFERENCES youtube_production_assets(id) ON DELETE CASCADE,
            job_kind TEXT NOT NULL,
            idempotency_key TEXT UNIQUE NOT NULL,
            status TEXT NOT NULL DEFAULT 'queued',
            progress INTEGER NOT NULL DEFAULT 0,
            payload_snapshot_json JSONB DEFAULT '{}'::jsonb,
            error_code TEXT,
            error_message TEXT,
            started_at TIMESTAMP,
            completed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
        // Ensure scheduler_jobs has auto-increment sequence (may already exist if Deconstruct Lab ran)
        await client.query(`CREATE SEQUENCE IF NOT EXISTS scheduler_jobs_id_seq;`);
        await client.query(`ALTER TABLE scheduler_jobs ALTER COLUMN id SET DEFAULT nextval('scheduler_jobs_id_seq');`);
        await client.query(`SELECT setval('scheduler_jobs_id_seq', GREATEST(COALESCE((SELECT MAX(id) FROM scheduler_jobs), 0) + 1, 1), false);`);

        console.log('[PostgreSQL] YouTube Studio Production Factory Phase 3 migrations completed.');
      } catch (e) {
        console.warn('[PostgreSQL Auto-Migration Warning] Phase 3 migration failed:', e.message);
      } finally {
        if (client) {
          try { await client.query('SELECT pg_advisory_unlock_all()'); } catch(_) {}
          client.release();
        }
      }
    };
    migrateYouTubeStudioPhase3();

    // ── YouTube Studio KB Foundation (Fase 3.5A) ──
    const migrateYouTubeStudioKbFoundation = async () => {
      let client;
      try {
        client = await pool.connect();
        await client.query(`SELECT pg_advisory_lock(hashtext('makna_youtube_studio_kb_v1'));`);
        await client.query(`
          -- youtube_knowledge_bases: one document per (tenant, scope, scope_id, kb_type)
          CREATE TABLE IF NOT EXISTS youtube_knowledge_bases (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            kb_type TEXT NOT NULL,
            scope TEXT NOT NULL CHECK (scope IN ('tenant', 'channel', 'series')),
            scope_id TEXT NOT NULL,
            title TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','active','superseded','archived')),
            created_by TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_yt_kb_scope ON youtube_knowledge_bases (tenant_id, scope, scope_id, kb_type);
          CREATE INDEX IF NOT EXISTS idx_yt_kb_status ON youtube_knowledge_bases (tenant_id, status);

          -- youtube_knowledge_base_revisions: immutable revision history
          CREATE TABLE IF NOT EXISTS youtube_knowledge_base_revisions (
            id TEXT PRIMARY KEY,
            kb_id TEXT NOT NULL REFERENCES youtube_knowledge_bases(id) ON DELETE CASCADE,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            revision_number INTEGER NOT NULL DEFAULT 1,
            status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','active','superseded','archived')),
            content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
            ai_generated BOOLEAN NOT NULL DEFAULT false,
            parent_revision_id TEXT REFERENCES youtube_knowledge_base_revisions(id),
            activated_by TEXT,
            activated_at TIMESTAMP,
            archived_by TEXT,
            archived_at TIMESTAMP,
            created_by TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_yt_kb_revisions ON youtube_knowledge_base_revisions (kb_id, status);
          CREATE INDEX IF NOT EXISTS idx_yt_kb_active_rev ON youtube_knowledge_base_revisions (tenant_id, kb_id, status) WHERE status = 'active';

          -- youtube_kb_bindings: attach active KB revisions to channel or series
          CREATE TABLE IF NOT EXISTS youtube_kb_bindings (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            scope TEXT NOT NULL CHECK (scope IN ('channel', 'series')),
            scope_id TEXT NOT NULL,
            kb_id TEXT NOT NULL REFERENCES youtube_knowledge_bases(id) ON DELETE CASCADE,
            kb_type TEXT NOT NULL,
            is_override BOOLEAN NOT NULL DEFAULT false,
            created_by TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (tenant_id, scope, scope_id, kb_type)
          );
          CREATE INDEX IF NOT EXISTS idx_yt_kb_bindings ON youtube_kb_bindings (tenant_id, scope, scope_id);
        `);
        console.log('[PostgreSQL] YouTube Studio KB Foundation migration completed.');
      } catch (e) {
        console.warn('[PostgreSQL Auto-Migration Warning] KB Foundation migration failed:', e.message);
      } finally {
        if (client) {
          try { await client.query('SELECT pg_advisory_unlock(hashtext(\'makna_youtube_studio_kb_v1\'));'); } catch(_) {}
          client.release();
        }
      }
    };
    migrateYouTubeStudioKbFoundation();

    // ── YouTube Studio Hybrid Production (Fase 3.5B) ──
    const migrateYouTubeStudioHybridProduction = async () => {
      let client;
      try {
        client = await pool.connect();
        await client.query(`SELECT pg_advisory_lock(hashtext('makna_youtube_studio_hybrid_v1'));`);
        await client.query(`
          -- youtube_production_batches table
          CREATE TABLE IF NOT EXISTS youtube_production_batches (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
            production_package_id TEXT NOT NULL REFERENCES youtube_production_packages(id) ON DELETE CASCADE,
            batch_type TEXT NOT NULL CHECK (batch_type IN ('prompt_package', 'start_frame', 'voiceover', 'visual_video')),
            status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'processing', 'reviewing', 'completed', 'failed')),
            created_by TEXT,
            approved_by TEXT,
            approved_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_yt_prod_batches ON youtube_production_batches (tenant_id, production_package_id, batch_type);

          -- Add hybrid fields to youtube_production_assets
          ALTER TABLE youtube_production_assets ADD COLUMN IF NOT EXISTS generation_mode TEXT;
          ALTER TABLE youtube_production_assets ADD COLUMN IF NOT EXISTS t2i_prompt TEXT;
          ALTER TABLE youtube_production_assets ADD COLUMN IF NOT EXISTS i2v_prompt TEXT;
          ALTER TABLE youtube_production_assets ADD COLUMN IF NOT EXISTS t2v_prompt TEXT;
          ALTER TABLE youtube_production_assets ADD COLUMN IF NOT EXISTS negative_prompt TEXT;
          ALTER TABLE youtube_production_assets ADD COLUMN IF NOT EXISTS continuity_tokens TEXT;
          ALTER TABLE youtube_production_assets ADD COLUMN IF NOT EXISTS batch_id TEXT REFERENCES youtube_production_batches(id) ON DELETE SET NULL;
        `);
        console.log('[PostgreSQL] YouTube Studio Hybrid Production migration completed.');
      } catch (e) {
        console.warn('[PostgreSQL Auto-Migration Warning] Hybrid Production migration failed:', e.message);
      } finally {
        if (client) {
          try { await client.query('SELECT pg_advisory_unlock(hashtext(\'makna_youtube_studio_hybrid_v1\'));'); } catch(_) {}
          client.release();
        }
      }
    };
    migrateYouTubeStudioHybridProduction();
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
