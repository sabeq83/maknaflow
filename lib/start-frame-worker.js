import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { pgQuery } from './db-pg.js';
import { tenantContext } from './tenant-context.js';
import {
  claimStartFrameAsset,
  activateCompletedStartFrame,
  recoverStaleStartFrameAssets
} from './pillar-start-frame-service.js';
import { startFrameProviderAdapter } from './start-frame-provider-adapter.js';
import { saveRevisionedStartFrame } from './start-frame-storage.js';
import { heartbeatImageLane, releaseImageLane, recoverExpiredImageLanes } from './glabs-image-lane-service.js';
import { updatePillarCampaignItem } from './db.js';
import { structuredLog } from './structured-logger.js';

const state = globalThis.__startFrameWorker || { interval: null, running: false, lastError: null, lastTick: null };
globalThis.__startFrameWorker = state;

const parseJson = (value, fallback = {}) => {
  try { return typeof value === 'string' ? JSON.parse(value) : value || fallback; } catch { return fallback; }
};

async function releaseForPolling(asset, seconds = 4) {
  if (asset.lane_lease_id) {
    await heartbeatImageLane(asset.lane_lease_id, { extendSeconds: 60 }).catch(() => {});
  }
  await pgQuery(
    `UPDATE pillar_campaign_item_assets
     SET status = 'provider_processing',
         lease_owner = NULL,
         lease_expires_at = NULL,
         next_attempt_at = CURRENT_TIMESTAMP + ($1 * INTERVAL '1 second'),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [seconds, asset.id]
  );
}

async function releaseAssetForLaneRetry(asset, leaseId, seconds = 2) {
  await pgQuery(
    `UPDATE pillar_campaign_item_assets
     SET status = 'waiting_lane',
         lane_lease_id = $1,
         lease_owner = NULL,
         lease_expires_at = NULL,
         next_attempt_at = CURRENT_TIMESTAMP + ($2 * INTERVAL '1 second'),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
    [leaseId, seconds, asset.id]
  );
}

async function retryAsset(asset, error) {
  const terminal = Number(asset.attempt_count || 0) >= 5;
  const delay = Math.min(300, 10 * (2 ** Math.max(0, Number(asset.attempt_count || 1) - 1)));

  if (asset.lane_lease_id) {
    await releaseImageLane(asset.lane_lease_id, `retry:${error.message?.slice(0, 100)}`).catch(() => {});
  }

  await pgQuery(
    `UPDATE pillar_campaign_item_assets
     SET status = $1,
         last_error_code = $2,
         last_error_message = $3,
         lease_owner = NULL,
         lease_expires_at = NULL,
         next_attempt_at = CASE WHEN $1 = 'retry_wait' THEN CURRENT_TIMESTAMP + ($4 * INTERVAL '1 second') ELSE NULL END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $5`,
    [terminal ? 'failed' : 'retry_wait', error.code || 'START_FRAME_PROVIDER_FAILED', error.message, delay, asset.id]
  );

  if (terminal) {
    await updatePillarCampaignItem(asset.campaign_item_id, {
      regenerate_start_frames_status: 'failed',
      regenerate_start_frames_progress: error.message
    });
  }
}

async function processAsset(asset) {
  try {
    const requestData = parseJson(asset.request_json);

    if (!asset.provider_task_id) {
      const submitted = await startFrameProviderAdapter.submit({
        assetId: asset.id,
        context: requestData.context,
        auditId: requestData.audit?.id
      });

      if (submitted.status === 'waiting_lane') {
        return await releaseAssetForLaneRetry(asset, submitted.leaseId);
      }

      await pgQuery(
        `UPDATE pillar_campaign_item_assets
         SET provider_task_id = $1,
             lane_lease_id = $2,
             lane_key = $3,
             lane_mode = $4,
             status = 'provider_processing',
             provider_submitted_at = CURRENT_TIMESTAMP,
             lease_owner = NULL,
             lease_expires_at = NULL,
             next_attempt_at = CURRENT_TIMESTAMP + INTERVAL '4 seconds',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [submitted.taskId, submitted.leaseId, submitted.laneKey, submitted.laneMode, asset.id]
      );
      return;
    }

    // Task already submitted to G-Labs; poll status
    const result = await startFrameProviderAdapter.poll(asset.provider_task_id, {
      leaseId: asset.lane_lease_id
    });

    if (result.status === 'pending') {
      return await releaseForPolling(asset);
    }

    if (result.status === 'failed') {
      throw new Error(result.error || 'Provider task failed');
    }

    // Task completed! Download output file and store revisioned image
    const response = await fetch(result.downloadUrl);
    if (!response.ok) {
      throw new Error(`Download start frame gagal: HTTP ${response.status}`);
    }

    const imgBuffer = Buffer.from(await response.arrayBuffer());
    const saved = await saveRevisionedStartFrame({
      itemId: asset.campaign_item_id,
      clipIndex: asset.clip_index,
      revision: asset.revision,
      providerTaskId: asset.provider_task_id,
      buffer: imgBuffer
    });

    // Transaction-safe activation of completed asset
    await activateCompletedStartFrame(asset.id, {
      localPath: saved.relativePath,
      checksum: saved.checksum,
      revision: asset.revision,
      clipIndex: asset.clip_index,
      itemId: asset.campaign_item_id
    });

    // Release provider lane lease
    if (asset.lane_lease_id) {
      await releaseImageLane(asset.lane_lease_id, 'completed').catch(() => {});
    }

    await updatePillarCampaignItem(asset.campaign_item_id, {
      regenerate_start_frames_status: null,
      regenerate_start_frames_progress: null
    }).catch(() => {});

  } catch (error) {
    await retryAsset(asset, error);
    structuredLog('error', 'start_frame_asset_failed', {
      tenant_id: asset.tenant_id,
      item_id: asset.campaign_item_id,
      asset_id: asset.id,
      error: { code: error.code, message: error.message }
    });
  }
}

export async function runStartFrameWorkerTick() {
  if (state.running) return;
  state.running = true;
  state.lastTick = new Date().toISOString();
  try {
    const tenants = (await pgQuery(
      `SELECT DISTINCT tenant_id FROM pillar_campaign_item_assets
       WHERE asset_type = 'start_frame'
         AND status IN ('queued', 'waiting_lane', 'retry_wait', 'provider_processing', 'processing')`
    )).rows;

    for (const { tenant_id: tenantId } of tenants) {
      await tenantContext.run(tenantId, async () => {
        await recoverExpiredImageLanes(tenantId);
        await recoverStaleStartFrameAssets();
        for (let index = 0; index < 6; index++) {
          const asset = await claimStartFrameAsset(`${os.hostname()}:${process.pid}`);
          if (!asset) break;
          await processAsset(asset);
        }
      });
    }
  } catch (error) {
    state.lastError = error.message;
    structuredLog('error', 'start_frame_worker_tick_failed', {
      error: { code: error.code, message: error.message }
    });
  } finally {
    state.running = false;
  }
}

export function startStartFrameWorker() {
  if (state.interval) return state.interval;
  const interval = Math.max(3000, Number(process.env.START_FRAME_WORKER_INTERVAL_MS || 5000));
  runStartFrameWorkerTick();
  state.interval = setInterval(runStartFrameWorkerTick, interval);
  return state.interval;
}

export function getStartFrameWorkerRuntime() {
  return { ...state, running: Boolean(state.interval) };
}
