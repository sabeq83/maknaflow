import { pgQuery } from './db-pg.js';
import { getAuthorizedAffiliateBrand } from './affiliate-studio-brand-read-adapter.js';
import { createContentRun, reconcileProgramRuns } from './affiliate-studio-production-adapter.js';

export async function preflightCheck(user, brandId, programId, plannerId, rowId) {
  if (!user || user.tenantId === '__none__') return { ok: false, error: 'Unauthorized' };

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return { ok: false, error: 'Brand profile not found or access denied' };

  const tenantId = user.tenantId;

  // 1. Check if row link exists
  const linkRows = (await pgQuery(
    `SELECT aprl.*, app.product_snapshot FROM affiliate_planner_row_links aprl
     LEFT JOIN affiliate_program_products app ON app.id = aprl.program_product_id AND app.tenant_id = aprl.tenant_id
     WHERE aprl.tenant_id = $1 AND aprl.affiliate_program_id = $2 
       AND aprl.content_planner_id = $3 AND aprl.planner_row_id = $4`,
    [tenantId, programId, plannerId, rowId]
  )).rows;

  if (linkRows.length === 0) {
    return { ok: false, error: 'Planner row is not linked to this program' };
  }

  const link = linkRows[0];
  if (!link.program_product_id) {
    return { ok: false, error: 'No target product associated with this row' };
  }

  const snapshot = link.product_snapshot || {};
  const affiliate = snapshot.affiliate || {};
  if (!affiliate.link) {
    return { ok: false, error: 'Product is missing a resolved affiliate link' };
  }

  // 2. Check if already launched (Idempotency check)
  const existingRun = (await pgQuery(
    `SELECT id, normalized_status FROM affiliate_content_runs
     WHERE tenant_id = $1 AND brand_profile_id = $2 AND affiliate_program_id = $3
       AND content_planner_id = $4 AND planner_row_id = $5`,
    [tenantId, brand.id, programId, plannerId, rowId]
  )).rows;

  if (existingRun.length > 0) {
    const run = existingRun[0];
    if (run.normalized_status !== 'Planned' && run.normalized_status !== 'Failed') {
      return { ok: false, error: `A run is already in progress or completed (status: ${run.normalized_status})` };
    }
  }

  return { ok: true, link };
}

export async function launchEngineCampaign(user, brandId, programId, plannerId, rowId, engineType, config = {}) {
  const preflight = await preflightCheck(user, brandId, programId, plannerId, rowId);
  if (!preflight.ok) {
    throw new Error(preflight.error);
  }

  const { link } = preflight;
  const tenantId = user.tenantId;
  const brand = await getAuthorizedAffiliateBrand(user, brandId);

  // Generate unique campaign/run parameters
  const campaignName = `${brand.name} - Row ${link.planner_row_id} [Studio Run]`;
  const snapshot = link.product_snapshot || {};

  let engineCampaignId = `camp_aff_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  let engineItemId = null;

  // Insert mock/real entry into corresponding legacy engine table
  if (engineType === 're') {
    await pgQuery(
      `INSERT INTO re_campaigns (id, tenant_id, campaign_name, status, brand_profile_id, target_product_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [engineCampaignId, tenantId, campaignName, 'running', brand.id, snapshot.productId]
    );

    // Seed initial item
    const itemIdNum = 90000 + Math.floor(Math.random() * 10000);
    engineItemId = String(itemIdNum);
    await pgQuery(
      `INSERT INTO re_campaign_items (id, campaign_id, source_url, ffmpeg_status, visual_status)
       VALUES ($1, $2, $3, $4, $5)`,
      [itemIdNum, engineCampaignId, 'http://autolaunch.source', 'pending', 'pending']
    );
  } else if (engineType === 'pillar') {
    await pgQuery(
      `INSERT INTO pillar_campaigns (id, tenant_id, campaign_name, status, content_pillar, custom_hook, visual_action_guideline, brand_profile_id, target_product_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [engineCampaignId, tenantId, campaignName, 'pending', 'Pillar Context', 'Hook Context', 'Action Context', brand.id, snapshot.productId]
    );
  } else if (engineType === 'recipe') {
    await pgQuery(
      `INSERT INTO recipe_campaigns (id, tenant_id, campaign_name, status, brand_profile_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [engineCampaignId, tenantId, campaignName, 'pending', brand.id]
    );
  } else if (engineType === 'multiplier') {
    await pgQuery(
      `INSERT INTO re_multiplier_tasks (id, tenant_id, target_product_url, affiliate_url, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [engineCampaignId, tenantId, 'http://target.product', snapshot.affiliate?.link, 'pending_resolution']
    );
  } else if (engineType === 'instant') {
    await pgQuery(
      `INSERT INTO instant_campaigns (id, tenant_id, campaign_name, status)
       VALUES ($1, $2, $3, $4)`,
      [engineCampaignId, tenantId, campaignName, 'pending']
    );
  } else if (engineType === 'bridge') {
    await pgQuery(
      `INSERT INTO bridge_injector_campaigns (id, tenant_id, account_name, status)
       VALUES ($1, $2, $3, $4)`,
      [engineCampaignId, tenantId, brand.name, 'pending']
    );
  } else {
    throw new Error(`Unsupported engine type: ${engineType}`);
  }

  // Register content run linkage in Affiliate Studio
  const runId = await createContentRun(
    user,
    brand.id,
    programId,
    plannerId,
    rowId,
    engineType,
    engineCampaignId,
    engineItemId,
    { launched_by: user.id, auto_launched: true, ...config }
  );

  // Instantly reconcile status
  await reconcileProgramRuns(user, brand.id, programId);

  return { runId, engineCampaignId, engineItemId };
}
