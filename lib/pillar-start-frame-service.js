import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDb, updatePillarCampaignItem } from './db.js';
import { getActiveTenantId } from './tenant-context.js';
import { pgQuery } from './db-pg.js';
import { calculateStartFrameAggregate } from './start-frame-contract.js';

function parseJson(value, fallback = []) { try { return JSON.parse(value || ''); } catch (_) { return fallback; } }
function checksumFile(localPath) {
  if (!localPath) return null;
  const absolute = path.isAbsolute(localPath) ? localPath : path.join(process.cwd(), 'public', localPath.replace(/^\//, ''));
  return fs.existsSync(absolute) ? crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex') : null;
}

export async function finalizeStartFrameCheckpoint(itemId, { paths = null, revision: requestedRevision = null } = {}) {
  const db = getDb();
  const item = await db.prepare('SELECT * FROM pillar_campaign_items WHERE id=?').get(itemId);
  if (!item) throw new Error('OPC item tidak ditemukan.');
  const campaign = await db.prepare('SELECT * FROM pillar_campaigns WHERE id=?').get(item.campaign_id);
  if (!campaign) throw new Error('OPC campaign tidak ditemukan.');
  const imagePaths = paths || parseJson(item.t2i_images_json, []);
  const aggregate = calculateStartFrameAggregate({ visualMode: campaign.visual_mode, expectedCount: campaign.target_clips_count, paths: imagePaths });
  const revision = requestedRevision === null ? Math.max(1, Number(item.start_frame_revision || 0)) : Number(requestedRevision);
  if (aggregate.status !== 'skipped') {
    for (let index = 0; index < aggregate.expected; index++) {
      const localPath = imagePaths[index] || null;
      if (!localPath) continue;
      await pgQuery(`INSERT INTO pillar_campaign_item_assets
        (id,tenant_id,campaign_id,campaign_item_id,clip_index,asset_type,revision,status,local_path,checksum)
        VALUES($1,$2,$3,$4,$5,'start_frame',$6,$7,$8,$9)
        ON CONFLICT(tenant_id,campaign_item_id,clip_index,asset_type,revision) DO UPDATE SET
          status=EXCLUDED.status,local_path=EXCLUDED.local_path,checksum=EXCLUDED.checksum,updated_at=CURRENT_TIMESTAMP`,
      [`pcia_${crypto.randomUUID().replaceAll('-','').slice(0,16)}`, getActiveTenantId(), String(item.campaign_id), String(item.id), index + 1, revision, 'completed', localPath, checksumFile(localPath)]);
    }
  }
  const requiresStartFrames = campaign.approval_mode === 'start_frames';
  const readyForReview = campaign.execution_mode !== 'full_autopilot' && (!requiresStartFrames || aggregate.ready);
  await updatePillarCampaignItem(item.id, {
    start_frame_status: aggregate.status, start_frame_revision: revision,
    start_frame_expected_count: aggregate.expected, start_frame_completed_count: aggregate.completed,
    workflow_status: campaign.execution_mode === 'full_autopilot' ? 'production_processing' : (readyForReview ? 'ready_for_review' : 'start_frames_processing'),
    regenerate_start_frames_status: aggregate.ready ? null : item.regenerate_start_frames_status,
    regenerate_start_frames_progress: aggregate.ready ? null : `${aggregate.completed}/${aggregate.expected}`,
    review_state: readyForReview ? 'ready' : item.review_state,
    review_state_updated_at: readyForReview ? new Date() : item.review_state_updated_at
  });
  return aggregate;
}

export async function refreshStartFrameCheckpoint(itemId) {
  return finalizeStartFrameCheckpoint(itemId, { revision: null });
}

export async function queueStartFrameRevision(itemId, clips) {
  const db = getDb();
  const item = await db.prepare('SELECT * FROM pillar_campaign_items WHERE id=?').get(itemId);
  if (!item) throw new Error('OPC item tidak ditemukan.');
  const revision = Number(item.start_frame_revision || 0) + 1;
  for (const clip of clips) {
    await pgQuery(`INSERT INTO pillar_campaign_item_assets
      (id,tenant_id,campaign_id,campaign_item_id,clip_index,asset_type,revision,status,attempt_count,request_json)
      VALUES($1,$2,$3,$4,$5,'start_frame',$6,'queued',0,$7)
      ON CONFLICT(tenant_id,campaign_item_id,clip_index,asset_type,revision) DO NOTHING`,
    [`pcia_${crypto.randomUUID().replaceAll('-','').slice(0,16)}`, getActiveTenantId(), String(item.campaign_id), String(item.id), Number(clip.clip_index), revision, JSON.stringify(clip.request || {})]);
  }
  await updatePillarCampaignItem(item.id, {
    start_frame_revision: revision,
    start_frame_status: 'processing',
    start_frame_expected_count: clips.length,
    start_frame_completed_count: 0,
    workflow_status: 'start_frames_processing',
    regenerate_start_frames_status: 'queued',
    regenerate_start_frames_progress: `0/${clips.length}`
  });
  return { itemId: Number(item.id), revision, queued: clips.length };
}

export async function claimStartFrameAsset(workerId, { leaseSeconds = 300 } = {}) {
  const tenantId = getActiveTenantId();
  return (await pgQuery(`WITH candidate AS (
    SELECT id,status AS claimed_status FROM pillar_campaign_item_assets WHERE tenant_id=$1 AND asset_type='start_frame'
      AND status IN('queued','retry_wait','provider_processing') AND (next_attempt_at IS NULL OR next_attempt_at<=CURRENT_TIMESTAMP)
      AND (lease_expires_at IS NULL OR lease_expires_at<CURRENT_TIMESTAMP)
    ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
    UPDATE pillar_campaign_item_assets a SET status='processing',attempt_count=attempt_count+1,
      lease_owner=$2,lease_expires_at=CURRENT_TIMESTAMP+($3*INTERVAL '1 second'),updated_at=CURRENT_TIMESTAMP
    FROM candidate WHERE a.id=candidate.id RETURNING a.*,candidate.claimed_status`, [tenantId, workerId, leaseSeconds])).rows[0] || null;
}

export async function recoverStaleStartFrameAssets() {
  return (await pgQuery(`UPDATE pillar_campaign_item_assets SET status='retry_wait',lease_owner=NULL,
    lease_expires_at=NULL,next_attempt_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
    WHERE tenant_id=$1 AND asset_type='start_frame' AND status='processing' AND lease_expires_at<CURRENT_TIMESTAMP RETURNING id`,
  [getActiveTenantId()])).rowCount;
}

export async function recordCompletedStartFrameAsset(itemId, { clipIndex, localPath, revision = null }) {
  const db = getDb();
  const item = await db.prepare('SELECT * FROM pillar_campaign_items WHERE id=?').get(itemId);
  if (!item) throw new Error('OPC item tidak ditemukan.');
  const targetRevision = Number(revision || item.start_frame_revision || 1);
  await pgQuery(`INSERT INTO pillar_campaign_item_assets
    (id,tenant_id,campaign_id,campaign_item_id,clip_index,asset_type,revision,status,local_path,checksum,completed_at)
    VALUES($1,$2,$3,$4,$5,'start_frame',$6,'completed',$7,$8,CURRENT_TIMESTAMP)
    ON CONFLICT(tenant_id,campaign_item_id,clip_index,asset_type,revision) DO UPDATE SET
      status='completed',local_path=EXCLUDED.local_path,checksum=EXCLUDED.checksum,completed_at=CURRENT_TIMESTAMP,
      lease_owner=NULL,lease_expires_at=NULL,updated_at=CURRENT_TIMESTAMP`,
  [`pcia_${crypto.randomUUID().replaceAll('-','').slice(0,16)}`, getActiveTenantId(), String(item.campaign_id), String(item.id), Number(clipIndex), targetRevision, localPath, checksumFile(localPath)]);
  return refreshStartFrameCheckpoint(itemId);
}
