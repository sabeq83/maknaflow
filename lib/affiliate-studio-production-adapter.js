import { pgQuery } from './db-pg.js';
import { getAuthorizedAffiliateBrand } from './affiliate-studio-brand-read-adapter.js';

export async function createContentRun(user, brandId, programId, plannerId, rowId, engineType, engineCampaignId, engineItemId = null, metadata = {}) {
  if (!user || user.tenantId === '__none__') return null;

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return null;

  const tenantId = user.tenantId;

  // 1. Fetch Program & Product snapshots
  const progRows = (await pgQuery(
    `SELECT * FROM affiliate_programs WHERE id = $1 AND tenant_id = $2`,
    [programId, tenantId]
  )).rows;
  if (progRows.length === 0) return null;
  const program = progRows[0];

  // Fetch product snapshot associated via row links
  const rowLinkRows = (await pgQuery(
    `SELECT * FROM affiliate_planner_row_links 
     WHERE tenant_id = $1 AND affiliate_program_id = $2 AND content_planner_id = $3 AND planner_row_id = $4`,
    [tenantId, programId, plannerId, rowId]
  )).rows;

  let productSnapshot = {};
  if (rowLinkRows.length > 0 && rowLinkRows[0].program_product_id) {
    const prodRows = (await pgQuery(
      `SELECT product_snapshot FROM affiliate_program_products WHERE id = $1 AND tenant_id = $2`,
      [rowLinkRows[0].program_product_id, tenantId]
    )).rows;
    productSnapshot = prodRows[0]?.product_snapshot || {};
  }

  const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const brandSnapshot = { id: brand.id, name: brand.name };

  await pgQuery(
    `INSERT INTO affiliate_content_runs (
      id, tenant_id, brand_profile_id, affiliate_program_id, content_planner_id, planner_row_id,
      engine_type, engine_campaign_id, engine_item_id, normalized_status,
      brand_snapshot_json, product_snapshot_json, offer_snapshot_json, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      runId, tenantId, brand.id, programId, plannerId, rowId,
      engineType, engineCampaignId, engineItemId, 'Planned',
      JSON.stringify(brandSnapshot), JSON.stringify(productSnapshot), JSON.stringify({}), JSON.stringify(metadata)
    ]
  );

  await logRunEvent(tenantId, runId, 'run_created', user.id, { engineType, engineCampaignId });

  return runId;
}

export async function listProgramContentRuns(user, brandId, programId) {
  if (!user || user.tenantId === '__none__') return [];

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return [];

  const tenantId = user.tenantId;

  const runs = (await pgQuery(
    `SELECT r.*, cpr.sequence, cpr.pillar, cpr.category_cep, cpr.context
     FROM affiliate_content_runs r
     JOIN content_planner_rows cpr ON cpr.id = r.planner_row_id
     WHERE r.tenant_id = $1 AND r.brand_profile_id = $2 AND r.affiliate_program_id = $3
     ORDER BY r.created_at DESC`,
    [tenantId, brand.id, programId]
  )).rows;

  return runs.map(r => ({
    id: r.id,
    engineType: r.engine_type,
    engineCampaignId: r.engine_campaign_id,
    engineItemId: r.engine_item_id,
    normalizedStatus: r.normalized_status,
    sequence: r.sequence,
    pillar: r.pillar,
    categoryCep: r.category_cep,
    context: r.context,
    brandSnapshot: r.brand_snapshot_json,
    productSnapshot: r.product_snapshot_json,
    createdAt: r.created_at,
    deepLink: getEngineDeepLink(r.engine_type, r.engine_campaign_id, r.engine_item_id)
  }));
}

export async function reconcileProgramRuns(user, brandId, programId) {
  if (!user || user.tenantId === '__none__') return false;

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return false;

  const tenantId = user.tenantId;

  const runs = (await pgQuery(
    `SELECT * FROM affiliate_content_runs 
     WHERE tenant_id = $1 AND brand_profile_id = $2 AND affiliate_program_id = $3`,
    [tenantId, brand.id, programId]
  )).rows;

  for (const run of runs) {
    let rawStatus = null;
    let itemStatus = null;

    try {
      if (run.engine_type === 're') {
        const camp = (await pgQuery(`SELECT status FROM re_campaigns WHERE id = $1`, [run.engine_campaign_id])).rows[0];
        rawStatus = camp?.status;
        if (run.engine_item_id) {
          const item = (await pgQuery(`SELECT ffmpeg_status, visual_status FROM re_campaign_items WHERE campaign_id = $1 AND id = $2`, [run.engine_campaign_id, run.engine_item_id])).rows[0];
          itemStatus = item;
        }
      } else if (run.engine_type === 'pillar') {
        const camp = (await pgQuery(`SELECT status FROM pillar_campaigns WHERE id = $1`, [run.engine_campaign_id])).rows[0];
        rawStatus = camp?.status;
        if (run.engine_item_id) {
          const item = (await pgQuery(`SELECT tts_status, ffmpeg_status FROM pillar_campaign_items WHERE campaign_id = $1 AND id = $2`, [run.engine_campaign_id, run.engine_item_id])).rows[0];
          itemStatus = item;
        }
      } else if (run.engine_type === 'recipe') {
        const camp = (await pgQuery(`SELECT status FROM recipe_campaigns WHERE id = $1`, [run.engine_campaign_id])).rows[0];
        rawStatus = camp?.status;
        if (run.engine_item_id) {
          const item = (await pgQuery(`SELECT status FROM recipe_items WHERE campaign_id = $1 AND id = $2`, [run.engine_campaign_id, run.engine_item_id])).rows[0];
          itemStatus = item;
        }
      } else if (run.engine_type === 'multiplier') {
        const task = (await pgQuery(`SELECT status FROM re_multiplier_tasks WHERE id = $1`, [run.engine_campaign_id])).rows[0];
        rawStatus = task?.status;
      } else if (run.engine_type === 'instant') {
        const camp = (await pgQuery(`SELECT status FROM instant_campaigns WHERE id = $1`, [run.engine_campaign_id])).rows[0];
        rawStatus = camp?.status;
      } else if (run.engine_type === 'bridge') {
        const camp = (await pgQuery(`SELECT status FROM bridge_injector_campaigns WHERE id = $1`, [run.engine_campaign_id])).rows[0];
        rawStatus = camp?.status;
      }

      const nextStatus = projectNormalizedStatus(run.engine_type, rawStatus, itemStatus);
      if (nextStatus !== run.normalized_status) {
        await pgQuery(
          `UPDATE affiliate_content_runs SET normalized_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [nextStatus, run.id]
        );
        await logRunEvent(tenantId, run.id, 'status_reconciled', 'system', { oldStatus: run.normalized_status, newStatus: nextStatus });
      }
    } catch (err) {
      console.error(`[Reconcile Error] runId=${run.id}`, err);
    }
  }

  return true;
}

function projectNormalizedStatus(engineType, campaignStatus, itemStatus) {
  const statusStr = (campaignStatus || '').toLowerCase();
  
  if (statusStr === 'completed' || statusStr === 'success' || statusStr === 'done') {
    return 'Ready';
  }
  if (statusStr === 'failed' || statusStr === 'error') {
    return 'Planned';
  }

  if (itemStatus) {
    const itemFfmpeg = (itemStatus.ffmpeg_status || itemStatus.status || '').toLowerCase();
    if (itemFfmpeg === 'completed' || itemFfmpeg === 'success') return 'Ready';
    if (itemFfmpeg === 'failed' || itemFfmpeg === 'error') return 'Planned';
    if (itemFfmpeg === 'running' || itemFfmpeg === 'processing' || itemFfmpeg === 'rendering') return 'Rendering';
    if (itemStatus.visual_status === 'processing') return 'Generating';
    return 'Producing';
  }

  if (statusStr === 'running' || statusStr === 'processing') {
    return 'Producing';
  }
  if (statusStr === 'queued' || statusStr === 'pending') {
    return 'Queued';
  }
  return 'Planned';
}

function getEngineDeepLink(engineType, campaignId, itemId) {
  if (engineType === 're') return `/re-campaigns/${campaignId}`;
  if (engineType === 'pillar') return `/pillar-campaigns/${campaignId}`;
  if (engineType === 'recipe') return `/recipe-labs?campaignId=${campaignId}`;
  if (engineType === 'multiplier') return `/multiplier-lab/${campaignId}`;
  if (engineType === 'instant') return `/instant-factory?campaignId=${campaignId}`;
  if (engineType === 'bridge') return `/product-bridge-inject/${campaignId}`;
  return '#';
}

async function logRunEvent(tenantId, runId, eventType, actorId, payload) {
  const id = `ev_run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  await pgQuery(
    `INSERT INTO affiliate_content_run_events (id, tenant_id, affiliate_content_run_id, event_type, actor_id, payload)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, tenantId, runId, eventType, actorId, JSON.stringify(payload)]
  );
}
