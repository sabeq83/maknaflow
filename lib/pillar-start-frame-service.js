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

export async function finalizeStartFrameCheckpoint(itemId, { paths = null } = {}) {
  const db = getDb();
  const item = await db.prepare('SELECT * FROM pillar_campaign_items WHERE id=?').get(itemId);
  if (!item) throw new Error('OPC item tidak ditemukan.');
  const campaign = await db.prepare('SELECT * FROM pillar_campaigns WHERE id=?').get(item.campaign_id);
  if (!campaign) throw new Error('OPC campaign tidak ditemukan.');
  const imagePaths = paths || parseJson(item.t2i_images_json, []);
  const aggregate = calculateStartFrameAggregate({ visualMode: campaign.visual_mode, expectedCount: campaign.target_clips_count, paths: imagePaths });
  const revision = Number(item.start_frame_revision || 0) + 1;
  if (aggregate.status !== 'skipped') {
    for (let index = 0; index < aggregate.expected; index++) {
      const localPath = imagePaths[index] || null;
      await pgQuery(`INSERT INTO pillar_campaign_item_assets
        (id,tenant_id,campaign_id,campaign_item_id,clip_index,asset_type,revision,status,local_path,checksum)
        VALUES($1,$2,$3,$4,$5,'start_frame',$6,$7,$8,$9)
        ON CONFLICT(tenant_id,campaign_item_id,clip_index,asset_type,revision) DO UPDATE SET
          status=EXCLUDED.status,local_path=EXCLUDED.local_path,checksum=EXCLUDED.checksum,updated_at=CURRENT_TIMESTAMP`,
      [`pcia_${crypto.randomUUID().replaceAll('-','').slice(0,16)}`, getActiveTenantId(), String(item.campaign_id), String(item.id), index + 1, revision, localPath ? 'completed' : 'failed', localPath, checksumFile(localPath)]);
    }
  }
  const requiresStartFrames = campaign.approval_mode === 'start_frames';
  const readyForReview = campaign.execution_mode !== 'full_autopilot' && (!requiresStartFrames || aggregate.ready);
  await updatePillarCampaignItem(item.id, {
    start_frame_status: aggregate.status, start_frame_revision: revision,
    start_frame_expected_count: aggregate.expected, start_frame_completed_count: aggregate.completed,
    workflow_status: campaign.execution_mode === 'full_autopilot' ? 'production_processing' : (readyForReview ? 'ready_for_review' : 'start_frames_processing')
  });
  return aggregate;
}

export async function refreshStartFrameCheckpoint(itemId) {
  return finalizeStartFrameCheckpoint(itemId);
}
