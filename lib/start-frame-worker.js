import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { pgQuery } from './db-pg.js';
import { tenantContext } from './tenant-context.js';
import { claimStartFrameAsset, recordCompletedStartFrameAsset, recoverStaleStartFrameAssets } from './pillar-start-frame-service.js';
import { startFrameProviderAdapter } from './start-frame-provider-adapter.js';
import { getDb, updatePillarCampaignItem } from './db.js';
import { structuredLog } from './structured-logger.js';

const state = globalThis.__startFrameWorker || { interval: null, running: false, lastError: null, lastTick: null };
globalThis.__startFrameWorker = state;

const parseJson = (value, fallback = {}) => { try { return typeof value === 'string' ? JSON.parse(value) : value || fallback; } catch { return fallback; } };

async function releaseForPolling(asset, seconds = 5) {
  await pgQuery(`UPDATE pillar_campaign_item_assets SET status='provider_processing',lease_owner=NULL,lease_expires_at=NULL,
    next_attempt_at=CURRENT_TIMESTAMP+($1*INTERVAL '1 second'),updated_at=CURRENT_TIMESTAMP WHERE id=$2`, [seconds, asset.id]);
}

async function retryAsset(asset, error) {
  const terminal = Number(asset.attempt_count || 0) >= 5;
  const delay = Math.min(300, 10 * (2 ** Math.max(0, Number(asset.attempt_count || 1) - 1)));
  await pgQuery(`UPDATE pillar_campaign_item_assets SET status=$1,last_error_code=$2,last_error_message=$3,
    lease_owner=NULL,lease_expires_at=NULL,next_attempt_at=CASE WHEN $1='retry_wait' THEN CURRENT_TIMESTAMP+($4*INTERVAL '1 second') ELSE NULL END,
    updated_at=CURRENT_TIMESTAMP WHERE id=$5`, [terminal ? 'failed' : 'retry_wait', error.code || 'START_FRAME_PROVIDER_FAILED', error.message, delay, asset.id]);
  if (terminal) await updatePillarCampaignItem(asset.campaign_item_id, { regenerate_start_frames_status: 'failed', regenerate_start_frames_progress: error.message });
}

async function processAsset(asset) {
  try {
    if (!asset.provider_task_id) {
      const submitted = await startFrameProviderAdapter.submit(parseJson(asset.request_json));
      await pgQuery(`UPDATE pillar_campaign_item_assets SET provider_task_id=$1,status='provider_processing',submitted_at=CURRENT_TIMESTAMP,
        lease_owner=NULL,lease_expires_at=NULL,next_attempt_at=CURRENT_TIMESTAMP+INTERVAL '5 seconds',updated_at=CURRENT_TIMESTAMP WHERE id=$2`, [submitted.taskId, asset.id]);
      return;
    }
    const result = await startFrameProviderAdapter.poll(asset.provider_task_id);
    if (result.status === 'pending') return releaseForPolling(asset);
    if (result.status === 'failed') throw new Error(result.error);
    const response = await fetch(result.downloadUrl);
    if (!response.ok) throw new Error(`Download start frame gagal: HTTP ${response.status}`);
    const filename = `opc_start_frame_${asset.campaign_item_id}_clip_${asset.clip_index}_r${asset.revision}.png`;
    const directory = path.join(process.cwd(), 'public', 'uploads', 'start_frames');
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, filename), Buffer.from(await response.arrayBuffer()));
    const localPath = `/uploads/start_frames/${filename}`;
    const db = getDb();
    const item = await db.prepare('SELECT t2i_images_json FROM pillar_campaign_items WHERE id=?').get(asset.campaign_item_id);
    const paths = parseJson(item?.t2i_images_json, []);
    while (paths.length < Number(asset.clip_index)) paths.push(null);
    paths[Number(asset.clip_index) - 1] = localPath;
    await updatePillarCampaignItem(asset.campaign_item_id, { t2i_images_json: JSON.stringify(paths), t2i_start_frame_path: localPath });
    await recordCompletedStartFrameAsset(asset.campaign_item_id, { clipIndex: asset.clip_index, localPath, revision: asset.revision });
  } catch (error) {
    await retryAsset(asset, error);
    structuredLog('error', 'start_frame_asset_failed', { tenant_id: asset.tenant_id, item_id: asset.campaign_item_id, asset_id: asset.id, error: { code: error.code, message: error.message } });
  }
}

export async function runStartFrameWorkerTick() {
  if (state.running) return;
  state.running = true;
  state.lastTick = new Date().toISOString();
  try {
    const tenants = (await pgQuery(`SELECT DISTINCT tenant_id FROM pillar_campaign_item_assets WHERE asset_type='start_frame'
      AND status IN('queued','retry_wait','provider_processing','processing')`)).rows;
    for (const { tenant_id: tenantId } of tenants) await tenantContext.run(tenantId, async () => {
      await recoverStaleStartFrameAssets();
      for (let index = 0; index < 4; index++) {
        const asset = await claimStartFrameAsset(`${os.hostname()}:${process.pid}`);
        if (!asset) break;
        await processAsset(asset);
      }
    });
  } catch (error) {
    state.lastError = error.message;
    structuredLog('error', 'start_frame_worker_tick_failed', { error: { code: error.code, message: error.message } });
  } finally { state.running = false; }
}

export function startStartFrameWorker() {
  if (state.interval) return state.interval;
  const interval = Math.max(5000, Number(process.env.START_FRAME_WORKER_INTERVAL_MS || 15000));
  runStartFrameWorkerTick();
  state.interval = setInterval(runStartFrameWorkerTick, interval);
  return state.interval;
}

export function getStartFrameWorkerRuntime() { return { ...state, running: Boolean(state.interval) }; }
