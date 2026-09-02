import os from 'os';
import {
  appendOperatorJobEvent,
  claimNextOperatorJob,
  getDb,
  getOperatorJob,
  listActiveOperatorJobs,
  recoverStaleOperatorJobs,
  updateOperatorJob
} from './db.js';
import { tenantContext } from './tenant-context.js';
import { pgQuery } from './db-pg.js';
import { createDraftContentPlanner, executeContentPlanner } from './content-planner-engine.js';
import { ingestPlannerToPillarCampaign } from './pillar-campaign-ingest.js';
import { approvePillarCampaignItemUnchanged } from './pillar-campaign-approval.js';
import { buildOperatorReviewArtifact } from './operator-review-artifact.js';

const workerState = globalThis.__maknaOperatorWorkerState || {
  interval: null,
  running: false
};
globalThis.__maknaOperatorWorkerState = workerState;

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch (_) { return fallback; }
}

function deterministicCampaignId(jobId) {
  const clean = String(jobId).replace(/[^a-z0-9]/gi, '').toLowerCase();
  return `opc_${clean.slice(3, 9)}_${clean.slice(-6)}`;
}

function isStepDone(value) {
  return value === 'completed' || value === 'skipped';
}

function itemHasFailed(item) {
  return ['generation_status', 'tts_status', 'visual_status', 'ffmpeg_status']
    .some(field => item[field] === 'failed') && Number(item.retry_count || 0) >= 3;
}

function itemIsComplete(item) {
  const contentflowDone = !item.auto_sync_contentflow || ['completed','skipped'].includes(item.contentflow_sync_status);
  return item.generation_status === 'completed'
    && isStepDone(item.tts_status)
    && isStepDone(item.visual_status)
    && isStepDone(item.ffmpeg_status)
    && contentflowDone;
}

function getCurrentStage(items) {
  if (items.some(item => item.contentflow_sync_status === 'processing' || item.contentflow_sync_status === 'retry_wait')) return 'syncing_contentflow';
  if (items.some(item => item.workflow_status === 'start_frames_processing')) return 'generating_start_frames';
  if (items.some(item => item.workflow_status === 'ready_for_review')) return 'approval';
  if (items.some(item => !isStepDone(item.ffmpeg_status) && isStepDone(item.visual_status))) return 'ffmpeg';
  if (items.some(item => !isStepDone(item.visual_status) && isStepDone(item.tts_status))) return 'visuals';
  if (items.some(item => !isStepDone(item.tts_status) && item.generation_status === 'completed')) return 'tts';
  if (items.some(item => item.generation_status !== 'completed')) return 'storyboard';
  return 'completed';
}

function serializeItem(item) {
  const result = parseJson(item.result_json);
  return {
    id: item.id,
    workflow_status: item.workflow_status,
    generation_status: item.generation_status,
    tts_status: item.tts_status,
    visual_status: item.visual_status,
    ffmpeg_status: item.ffmpeg_status,
    upload_status: item.upload_status,
    video_final_path: item.ffmpeg_output_path || null,
    nextcloud_url: item.drive_link || null,
    caption: result.tiktok_caption || result.ig_caption || result.caption || null,
    contentflow_item_id: item.contentflow_item_id || null
  };
}

export async function buildOperatorJobStatus(jobOrId) {
  const job = typeof jobOrId === 'string' ? await getOperatorJob(jobOrId) : jobOrId;
  if (!job) return null;
  if (!job.campaign_id) {
    return { ...job, progress: { completed_items: 0, total_items: 0 }, items: [] };
  }
  const db = getDb();
  const items = await db.prepare('SELECT i.*,c.auto_sync_contentflow FROM pillar_campaign_items i JOIN pillar_campaigns c ON c.id=i.campaign_id WHERE i.campaign_id = ? ORDER BY i.id ASC').all(job.campaign_id);
  const review = items.some(item => item.workflow_status === 'ready_for_review')
    ? await buildOperatorReviewArtifact(job)
    : null;
  return {
    ...job,
    progress: {
      completed_items: items.filter(itemIsComplete).length,
      total_items: items.length
    },
    items: items.map(serializeItem),
    ...(review ? { review: { ...review, markdown: undefined } } : {})
  };
}

export async function processOperatorContentJob(job) {
  const request = parseJson(job.request_json);
  try {
    let plannerId = job.planner_id;
    if (!plannerId) {
      const draft = await createDraftContentPlanner(request.planner);
      plannerId = draft.planner_id;
      await updateOperatorJob(job.id, { planner_id: plannerId, current_stage: 'planner_execution' });
      await appendOperatorJobEvent(job.id, 'planner_created', { planner_id: plannerId });
    }

    const db = getDb();
    const planner = await db.prepare('SELECT status FROM content_planners WHERE id = ?').get(plannerId);
    if (!planner) throw new Error(`Planner ${plannerId} tidak ditemukan setelah checkpoint.`);
    if (planner.status !== 'completed') {
      const researchContext = request.research_revision_id ? {
        revisionId: request.research_revision_id,
        snapshotSha256: request.research_snapshot_sha256,
        brief: request.research_brief
      } : request.research_brief;

      await executeContentPlanner(plannerId, researchContext);
      await appendOperatorJobEvent(job.id, 'planner_completed', { planner_id: plannerId });
    }

    let campaignId = job.campaign_id;
    if (!campaignId) {
      campaignId = deterministicCampaignId(job.id);
      let selectedRowIds = request.selection?.mode === 'row_ids' ? request.selection.row_ids : [];
      if (request.selection?.mode === 'best_one') {
        const bestRow = await db.prepare(
          'SELECT id FROM content_planner_rows WHERE planner_id = ? ORDER BY sequence ASC, id ASC LIMIT 1'
        ).get(plannerId);
        if (!bestRow?.id) throw new Error('Planner tidak menghasilkan kandidat untuk selection best_one.');
        selectedRowIds = [String(bestRow.id)];
      }
      const campaign = await ingestPlannerToPillarCampaign({
        plannerId,
        selectedRowIds,
        campaignName: request.production?.campaign_name,
        globalSettings: request.production,
        campaignId
      });
      await appendOperatorJobEvent(job.id, 'campaign_created', {
        campaign_id: campaignId,
        ingested_count: campaign.ingestedCount,
        reused: Boolean(campaign.reused)
      });
    }

    await updateOperatorJob(job.id, {
      status: 'campaign_queued',
      current_stage: 'storyboard',
      planner_id: plannerId,
      campaign_id: campaignId,
      locked_at: null,
      locked_by: null,
      error_code: null,
      error_message: null
    });
  } catch (error) {
    const errorCode = error.code || 'OPERATOR_ORCHESTRATION_FAILED';
    const retryable = /QUOTA|RATE|TIMEOUT|ECONN|HIGH_DEMAND|TEMPORAR/i.test(`${errorCode} ${error.message}`);
    const canRetry = retryable && Number(job.attempt_count || 0) < 3;
    const retryDelayMs = Math.max(30000, Number(job.attempt_count || 1) * 30000);
    await updateOperatorJob(job.id, {
      status: canRetry ? 'queued' : 'failed',
      current_stage: canRetry ? 'retry_wait' : 'orchestration',
      locked_at: null,
      locked_by: null,
      next_attempt_at: canRetry ? new Date(Date.now() + retryDelayMs) : null,
      error_code: errorCode,
      error_message: error.message
    });
    await appendOperatorJobEvent(job.id, canRetry ? 'job_retry_scheduled' : 'job_failed', {
      code: errorCode,
      message: error.message,
      attempt: Number(job.attempt_count || 0),
      retry_delay_ms: canRetry ? retryDelayMs : null
    });
  }
}

export async function reconcileActiveOperatorJobs() {
  const jobs = await listActiveOperatorJobs();
  const db = getDb();
  for (const job of jobs) {
    const items = job.campaign_id
      ? await db.prepare('SELECT i.*,c.auto_sync_contentflow FROM pillar_campaign_items i JOIN pillar_campaigns c ON c.id=i.campaign_id WHERE i.campaign_id = ? ORDER BY i.id ASC').all(job.campaign_id)
      : [];
    if (!items.length) continue;
    const request = parseJson(job.request_json);
    const readyItems = items.filter(item => item.workflow_status === 'ready_for_review');
    if (readyItems.length && request.production?.approval_mode === 'none') {
      for (const item of readyItems) await approvePillarCampaignItemUnchanged(item.id);
      await appendOperatorJobEvent(job.id, 'items_auto_approved', { item_ids: readyItems.map(item => item.id) });
      await updateOperatorJob(job.id, { status: 'producing', current_stage: 'tts' });
      continue;
    }
    let status = 'producing';
    const stage = getCurrentStage(items);
    if (items.some(itemHasFailed)) status = 'failed';
    else if (stage === 'approval') status = 'awaiting_approval';
    else if (items.every(itemIsComplete)) status = 'completed';
    if (status !== job.status || stage !== job.current_stage) {
      await updateOperatorJob(job.id, {
        status,
        current_stage: stage,
        result_json: JSON.stringify({
          completed_items: items.filter(itemIsComplete).length,
          total_items: items.length
        })
      });
      await appendOperatorJobEvent(job.id, 'status_changed', { status, stage });
    }
  }
}

export async function runOperatorContentWorkerTick() {
  if (workerState.running) return;
  workerState.running = true;
  try {
    const tenants = await pgQuery(`SELECT DISTINCT tenant_id FROM operator_jobs WHERE status IN ('queued', 'planning', 'campaign_queued', 'awaiting_approval', 'producing')`);
    for (const { tenant_id: tenantId } of tenants.rows) {
      await tenantContext.run(tenantId, async () => {
        await recoverStaleOperatorJobs(Number(process.env.OPERATOR_JOB_LOCK_TIMEOUT_MS || 300000));
        const workerId = `${os.hostname()}:${process.pid}`;
        const job = await claimNextOperatorJob(workerId);
        if (job) await processOperatorContentJob(job);
        await reconcileActiveOperatorJobs();
      });
    }
  } finally {
    workerState.running = false;
  }
}

export function startOperatorContentWorker() {
  if (workerState.interval) return workerState.interval;
  const intervalMs = Math.max(1000, Number(process.env.OPERATOR_WORKER_INTERVAL_MS || 3000));
  runOperatorContentWorkerTick().catch(error => console.error('[Operator Worker] Initial tick failed:', error.message));
  workerState.interval = setInterval(() => {
    runOperatorContentWorkerTick().catch(error => console.error('[Operator Worker] Tick failed:', error.message));
  }, intervalMs);
  console.log(`🤖 MAKNA Operator Content Worker started (${intervalMs}ms).`);
  return workerState.interval;
}
