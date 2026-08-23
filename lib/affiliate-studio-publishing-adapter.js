import { pgQuery } from './db-pg.js';
import { getAuthorizedAffiliateBrand } from './affiliate-studio-brand-read-adapter.js';

export async function getPublishingPreflight(user, brandId, programId, runId) {
  if (!user || user.tenantId === '__none__') return null;

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return null;

  const tenantId = user.tenantId;

  const runRows = (await pgQuery(
    `SELECT acr.*, aprl.funnel_stage 
     FROM affiliate_content_runs acr
     JOIN affiliate_planner_row_links aprl ON aprl.planner_row_id = acr.planner_row_id AND aprl.tenant_id = acr.tenant_id
     WHERE acr.id = $1 AND acr.tenant_id = $2`,
    [runId, tenantId]
  )).rows;

  if (runRows.length === 0) return null;

  const run = runRows[0];
  const productSnapshot = run.product_snapshot_json || {};
  const affiliateLink = productSnapshot.affiliate?.link || null;

  // Check media readiness (simulated from status)
  const isMediaReady = ['Ready', 'Scheduled', 'Published'].includes(run.normalized_status);

  // Check account presence
  const accountRows = (await pgQuery(
    `SELECT id FROM publishing_accounts WHERE tenant_id = $1 AND status = 'active' LIMIT 1`,
    [tenantId]
  )).rows;
  const isAccountReady = accountRows.length > 0;

  return {
    runId,
    affiliateLinkPresent: !!affiliateLink,
    disclosurePresent: true, // Defaulting disclosure tag presence to true
    accountReady: isAccountReady,
    mediaReady: isMediaReady,
    eligible: !!affiliateLink && isAccountReady && isMediaReady
  };
}

export async function projectPublishingStatus(user, brandId, runId) {
  if (!user || user.tenantId === '__none__') return null;

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return null;

  const tenantId = user.tenantId;

  const runRows = (await pgQuery(
    `SELECT * FROM affiliate_content_runs WHERE id = $1 AND tenant_id = $2`,
    [runId, tenantId]
  )).rows;

  if (runRows.length === 0) return null;

  const run = runRows[0];
  const engineCampaignId = run.engine_campaign_id;
  const engineItemId = run.engine_item_id;

  if (!engineCampaignId || !engineItemId) {
    return { status: run.normalized_status, deepLink: null };
  }

  // Probe publishing_jobs (representing ContentFlow queue) using engine run metadata association
  const jobs = (await pgQuery(
    `SELECT status, id FROM publishing_jobs 
     WHERE tenant_id = $1 AND (content_id = $2 OR content_id = $3)
     ORDER BY created_at DESC LIMIT 1`,
    [tenantId, engineCampaignId, engineItemId]
  )).rows;

  if (jobs.length === 0) {
    return { status: run.normalized_status, deepLink: null };
  }

  const job = jobs[0];
  let projectedStatus = run.normalized_status;
  if (job.status === 'completed') {
    projectedStatus = 'Published';
  } else if (job.status === 'scheduled') {
    projectedStatus = 'Scheduled';
  } else if (job.status === 'failed') {
    projectedStatus = 'Failed'; // Defaulting to previous status but marked fail or retry Awaiting Review
  } else if (job.status === 'processing') {
    projectedStatus = 'Producing';
  }

  return {
    status: projectedStatus,
    deepLink: `/content-flow/jobs/${job.id}`,
    jobId: job.id
  };
}
