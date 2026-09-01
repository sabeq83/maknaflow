import crypto from 'crypto';
import { getPgPool, pgQuery, withPgTransaction } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';
import { resolveOperatorPreset } from './operator-presets.js';
import {
  CONTENT_RUN_ERROR_CODES,
  ContentRunError,
  hashContentRunRequest,
  normalizeContentRunRequest
} from './content-run-contract.js';

export async function enqueueRunOnce(input, identity, idempotencyKey) {
  if (process.env.ENABLE_HERMES_RUN_ONCE === 'false') {
    throw new ContentRunError('Hermes run-once sementara dinonaktifkan.', CONTENT_RUN_ERROR_CODES.RUN_ONCE_DISABLED, 503);
  }

  if (!idempotencyKey || typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
    throw new ContentRunError('Idempotency-Key header wajib disertakan.', CONTENT_RUN_ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED, 400);
  }

  const cleanIdempotencyKey = idempotencyKey.trim();
  const normalized = normalizeContentRunRequest(input);
  const requestSha256 = hashContentRunRequest(normalized);
  const tenantId = identity?.tenantId || getActiveTenantId() || 'default_tenant';

  // 1. Validasi Brand Profile
  const brandRes = await pgQuery(
    'SELECT id, brand_name, status FROM brand_profiles WHERE id = $1 AND tenant_id = $2 LIMIT 1',
    [normalized.brand_profile_id, tenantId]
  );
  if (brandRes.rowCount === 0) {
    throw new ContentRunError(
      `Brand profile "${normalized.brand_profile_id}" tidak ditemukan.`,
      CONTENT_RUN_ERROR_CODES.BRAND_NOT_FOUND,
      404
    );
  }
  const brand = brandRes.rows[0];

  // 2. Validasi Product
  const productRes = await pgQuery(
    'SELECT id, product_name, product_description, target_audience FROM product_extractions WHERE id = $1 AND tenant_id = $2 LIMIT 1',
    [normalized.product_id, tenantId]
  );
  if (productRes.rowCount === 0) {
    throw new ContentRunError(
      `Produk "${normalized.product_id}" tidak ditemukan.`,
      CONTENT_RUN_ERROR_CODES.PRODUCT_NOT_FOUND,
      404
    );
  }
  const product = productRes.rows[0];

  // 3. Validasi Brand-Product binding
  const bindingRes = await pgQuery(
    'SELECT id, is_active FROM brand_products WHERE brand_profile_id = $1 AND product_id = $2 AND tenant_id = $3 LIMIT 1',
    [brand.id, product.id, tenantId]
  );
  let brandProductId = bindingRes.rows[0]?.id || null;
  if (!brandProductId) {
    brandProductId = `bp_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
    await pgQuery(
      `INSERT INTO brand_products (id, tenant_id, brand_profile_id, product_id, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (tenant_id, brand_profile_id, product_id) DO UPDATE SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP`,
      [brandProductId, tenantId, brand.id, product.id]
    );
  }

  // 4. Validasi Preset
  let resolvedPreset;
  try {
    resolvedPreset = resolveOperatorPreset(normalized.preset_key);
  } catch (err) {
    throw new ContentRunError(
      `Preset "${normalized.preset_key}" tidak ditemukan.`,
      CONTENT_RUN_ERROR_CODES.PRESET_NOT_FOUND,
      404
    );
  }

  // 5. Cek Idempotency Replay / Conflict
  const existingRunRes = await pgQuery(
    'SELECT * FROM content_automation_runs WHERE tenant_id = $1 AND idempotency_key = $2 LIMIT 1',
    [tenantId, cleanIdempotencyKey]
  );

  if (existingRunRes.rowCount > 0) {
    const existingRun = existingRunRes.rows[0];
    if (existingRun.request_sha256 && existingRun.request_sha256 !== requestSha256) {
      throw new ContentRunError(
        'Idempotency key sudah digunakan untuk payload yang berbeda.',
        CONTENT_RUN_ERROR_CODES.IDEMPOTENCY_CONFLICT,
        409
      );
    }
    const agentRunRes = await pgQuery(
      'SELECT id FROM agent_automation_runs WHERE tenant_id = $1 AND run_id = $2 LIMIT 1',
      [tenantId, existingRun.id]
    );
    const existingAgentRunId = agentRunRes.rows[0]?.id || null;
    return {
      success: true,
      run_id: existingRun.id,
      agent_run_id: existingAgentRunId,
      status: existingRun.status,
      status_url: `/api/operator/v2/content-runs/${existingRun.id}`,
      review_url: `/content-automations?run=${existingRun.id}`,
      replayed: true
    };
  }

  // 6. Susun Operator Request JSON
  const operatorRequest = {
    planner: {
      planner_focus: 'product_campaign',
      planner_count: normalized.video_count,
      brand_id: brand.id,
      product_id: product.id,
      brand_product_id: brandProductId,
      product_name: product.product_name,
      product_description: product.product_description || '',
      target_audience: product.target_audience || 'General Audience',
      platform: normalized.platform
    },
    selection: { mode: 'all', row_ids: [] },
    research: normalized.research ? {
      ...normalized.research,
      production_count: normalized.video_count
    } : null,
    opc: {
      preset: normalized.preset_key,
      basic_strategy: {
        brand_profile_id: brand.id,
        product_id: product.id,
        target_product_id: product.id
      },
      workflow: {
        approval_mode: normalized.review_mode,
        auto_sync_contentflow: true,
        enable_social_post: false
      }
    },
    production: {
      enable_social_post: false,
      auto_sync_contentflow: true,
      campaign_name: normalized.name
    },
    publishing_policy: normalized.publishing_policy
  };

  // 7. Transactional Enqueue
  const result = await withPgTransaction(async (client) => {
    const scheduleId = `cas_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
    const runId = `car_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
    const actor = identity?.actor || 'operator_api';

    await client.query(`
      INSERT INTO content_automation_schedules (
        id, tenant_id, name, campaign_kind, brand_profile_id, product_id, brand_product_id,
        status, timezone, frequency, schedule_config_json, operator_request_json,
        missed_run_policy, grace_minutes, max_catch_up_runs, retry_policy_json,
        consecutive_failure_count, auto_pause_threshold, next_run_at, created_by,
        execution_mode, created_at, updated_at
      ) VALUES (
        $1, $2, $3, 'product_campaign', $4, $5, $6,
        'paused', 'Asia/Jakarta', 'daily', '{}'::jsonb, $7::jsonb,
        'skip', 60, 1, '{"max_attempts":3,"base_seconds":60,"max_seconds":900}'::jsonb,
        0, 5, NULL, $8,
        'run_once', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `, [
      scheduleId,
      tenantId,
      normalized.name,
      brand.id,
      product.id,
      brandProductId,
      JSON.stringify(operatorRequest),
      actor
    ]);

    await client.query(`
      INSERT INTO content_automation_runs (
        id, tenant_id, schedule_id, scheduled_for, idempotency_key, campaign_kind,
        status, attempt_count, request_sha256, created_at
      ) VALUES (
        $1, $2, $3, CURRENT_TIMESTAMP, $4, 'product_campaign',
        'queued', 0, $5, CURRENT_TIMESTAMP
      )
    `, [
      runId,
      tenantId,
      scheduleId,
      cleanIdempotencyKey,
      requestSha256
    ]);

    let agentRunId = null;
    if (normalized.research) {
      agentRunId = `arun_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
      await client.query(`
        INSERT INTO agent_automation_runs (
          id, tenant_id, schedule_id, run_id, status, idempotency_key,
          research_policy_json, publishing_policy_json, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, 'scheduled', $5,
          $6::jsonb, $7::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `, [
        agentRunId,
        tenantId,
        scheduleId,
        runId,
        cleanIdempotencyKey,
        JSON.stringify(normalized.research),
        JSON.stringify(normalized.publishing_policy)
      ]);
    }

    await client.query(`
      INSERT INTO content_automation_audit_events (
        tenant_id, actor_id, event_type, schedule_id, run_id, event_json, created_at
      ) VALUES (
        $1, $2, 'run_once_enqueued', $3, $4, $5::jsonb, CURRENT_TIMESTAMP
      )
    `, [
      tenantId,
      actor,
      scheduleId,
      runId,
      JSON.stringify({
        product_id: product.id,
        brand_profile_id: brand.id,
        video_count: normalized.video_count,
        preset_key: normalized.preset_key,
        has_research: Boolean(normalized.research)
      })
    ]);

    return {
      run_id: runId,
      agent_run_id: agentRunId,
      status: normalized.research ? 'research_queued' : 'queued'
    };
  });

  return {
    success: true,
    run_id: result.run_id,
    agent_run_id: result.agent_run_id,
    status: result.status,
    status_url: `/api/operator/v2/content-runs/${result.run_id}`,
    review_url: `/content-automations?run=${result.run_id}`,
    replayed: false
  };
}

export async function buildBoundedContentRunStatus(runId, tenantId) {
  const runRes = await pgQuery(`
    SELECT r.*, s.name as schedule_name, s.operator_request_json, s.execution_mode
    FROM content_automation_runs r
    JOIN content_automation_schedules s ON s.id = r.schedule_id
    WHERE r.id = $1 AND r.tenant_id = $2
    LIMIT 1
  `, [runId, tenantId]);

  if (runRes.rowCount === 0) {
    throw new ContentRunError(`Run "${runId}" tidak ditemukan.`, CONTENT_RUN_ERROR_CODES.RUN_NOT_FOUND, 404);
  }

  const run = runRes.rows[0];
  const agentRunRes = await pgQuery(`
    SELECT id, status as agent_status, research_task_id, operator_job_id, last_error_code
    FROM agent_automation_runs
    WHERE run_id = $1 AND tenant_id = $2
    LIMIT 1
  `, [runId, tenantId]);
  const agentRun = agentRunRes.rows[0] || null;

  const operatorJobId = run.operator_job_id || agentRun?.operator_job_id || null;
  let opJob = null;
  let opItems = [];

  if (operatorJobId) {
    const jobRes = await pgQuery('SELECT * FROM operator_jobs WHERE id = $1 LIMIT 1', [operatorJobId]);
    opJob = jobRes.rows[0] || null;
    if (opJob?.campaign_id) {
      const itemsRes = await pgQuery(
        'SELECT id, workflow_status, generation_status, ffmpeg_status FROM pillar_campaign_items WHERE campaign_id = $1 ORDER BY id ASC',
        [opJob.campaign_id]
      );
      opItems = itemsRes.rows;
    }
  }

  let publicStatus = 'queued';
  let stage = 'queue';
  let actionRequired = null;

  if (run.status === 'failed' || agentRun?.agent_status === 'research_failed' || opJob?.status === 'failed') {
    publicStatus = 'failed';
    stage = 'failed';
  } else if (run.status === 'retry_wait') {
    publicStatus = 'retry_wait';
    stage = 'retry_wait';
  } else if (agentRun) {
    if (agentRun.agent_status === 'scheduled') {
      publicStatus = 'research_queued';
      stage = 'research';
    } else if (agentRun.agent_status === 'researching') {
      publicStatus = 'researching';
      stage = 'research';
    } else if (agentRun.agent_status === 'research_ready' || agentRun.agent_status === 'planning') {
      publicStatus = 'planning';
      stage = 'planner';
    } else if (agentRun.agent_status === 'awaiting_creative_approval') {
      publicStatus = 'awaiting_manual_review';
      stage = 'creative_review';
      actionRequired = 'Review creative storyboard in MAKNA';
    }
  }

  if (opJob && publicStatus !== 'failed') {
    if (opJob.status === 'awaiting_approval' || opItems.some(i => i.workflow_status === 'ready_for_review')) {
      publicStatus = 'awaiting_manual_review';
      stage = 'start_frames';
      actionRequired = 'Review start frames in MAKNA';
    } else if (opJob.current_stage === 'generating_start_frames' || opItems.some(i => i.workflow_status === 'start_frames_processing')) {
      publicStatus = 'generating_start_frames';
      stage = 'start_frames';
    } else if (opJob.current_stage === 'syncing_contentflow') {
      publicStatus = 'syncing_contentflow';
      stage = 'contentflow';
    } else if (opJob.status === 'producing' || opJob.status === 'campaign_queued') {
      publicStatus = 'producing';
      stage = 'production';
    } else if (opJob.status === 'completed' || run.status === 'completed') {
      publicStatus = 'completed_draft';
      stage = 'completed';
    }
  }

  if (run.status === 'completed' && publicStatus !== 'failed') {
    publicStatus = 'completed_draft';
    stage = 'completed';
  }

  const opReq = typeof run.operator_request_json === 'string'
    ? JSON.parse(run.operator_request_json)
    : run.operator_request_json || {};
  const requestedTotal = Number(opReq.planner?.planner_count || run.total_item_count || opItems.length || 0);

  const readyItems = opItems.filter(i =>
    i.generation_status === 'completed' &&
    ['completed', 'skipped'].includes(i.ffmpeg_status)
  ).length;

  const failedItems = opItems.filter(i =>
    i.generation_status === 'failed' || i.ffmpeg_status === 'failed'
  ).length;

  const publishingMode = opReq.publishing_policy?.mode || 'draft_only';

  return {
    success: true,
    run_id: run.id,
    status: publicStatus,
    stage,
    items: {
      total: requestedTotal || opItems.length,
      ready: readyItems,
      failed: failedItems
    },
    action_required: actionRequired,
    review_url: `/content-automations?run=${run.id}`,
    publishing_mode: publishingMode
  };
}
