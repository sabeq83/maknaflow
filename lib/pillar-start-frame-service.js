import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDb, updatePillarCampaignItem } from './db.js';
import { getActiveTenantId } from './tenant-context.js';
import { pgQuery, getPgPool } from './db-pg.js';
import { calculateStartFrameAggregate } from './start-frame-contract.js';

function parseJson(value, fallback = []) {
  try { return JSON.parse(value || ''); } catch (_) { return fallback; }
}

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
  const isBridging = Boolean(campaign.is_bridging_active && campaign.is_bridging_active !== '0' && campaign.is_bridging_active !== 0);
  const bridgeClipsCount = isBridging ? Math.max(1, Number(campaign.bridge_duration_clips) || 1) : 0;
  const expectedStartFrames = isBridging ? Math.max(1, (Number(campaign.target_clips_count) || 4) - bridgeClipsCount) : (Number(campaign.target_clips_count) || 4);
  const aggregate = calculateStartFrameAggregate({ visualMode: campaign.visual_mode, expectedCount: expectedStartFrames, paths: imagePaths.filter(Boolean) });
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
    start_frame_status: aggregate.status,
    start_frame_revision: revision,
    start_frame_expected_count: aggregate.expected,
    start_frame_completed_count: aggregate.completed,
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

export async function queueStartFrameRevision(itemId, clips, { expectedCount = clips.length, carryForwardCompleted = false } = {}) {
  const db = getDb();
  const item = await db.prepare('SELECT * FROM pillar_campaign_items WHERE id=?').get(itemId);
  if (!item) throw new Error('OPC item tidak ditemukan.');
  const campaign = await db.prepare('SELECT * FROM pillar_campaigns WHERE id=?').get(item.campaign_id);
  const revision = Number(item.start_frame_revision || 0) + 1;
  const targetIndexes = clips.map(clip => Number(clip.clip_index));
  const { resolveProductReferenceRequirement } = await import('./opc-start-frame-contract.js');

  if (carryForwardCompleted) {
    await pgQuery(`INSERT INTO pillar_campaign_item_assets
      (id,tenant_id,campaign_id,campaign_item_id,clip_index,asset_type,revision,status,attempt_count,local_path,checksum,completed_at,reference_critical)
      SELECT 'pcia_' || substr(md5(random()::text || clock_timestamp()::text || clip_index::text),1,16),tenant_id,campaign_id,campaign_item_id,
        clip_index,asset_type,$1,'completed',0,local_path,checksum,CURRENT_TIMESTAMP,reference_critical
      FROM (SELECT DISTINCT ON (clip_index) * FROM pillar_campaign_item_assets
        WHERE tenant_id=$2 AND campaign_item_id=$3 AND asset_type='start_frame' AND status='completed'
          AND NOT (clip_index=ANY($4::int[])) ORDER BY clip_index,revision DESC) previous
      ON CONFLICT(tenant_id,campaign_item_id,clip_index,asset_type,revision) DO NOTHING`,
    [revision, getActiveTenantId(), String(item.id), targetIndexes]);
  }

  for (const clip of clips) {
    const isCritical = campaign ? Boolean(resolveProductReferenceRequirement({ campaign, item, clipIndex: clip.clip_index }).required) : false;
    await pgQuery(`INSERT INTO pillar_campaign_item_assets
      (id,tenant_id,campaign_id,campaign_item_id,clip_index,asset_type,revision,status,attempt_count,request_json,reference_critical)
      VALUES($1,$2,$3,$4,$5,'start_frame',$6,'queued',0,$7,$8)
      ON CONFLICT(tenant_id,campaign_item_id,clip_index,asset_type,revision) DO UPDATE SET
        reference_critical=EXCLUDED.reference_critical`,
    [`pcia_${crypto.randomUUID().replaceAll('-','').slice(0,16)}`, getActiveTenantId(), String(item.campaign_id), String(item.id), Number(clip.clip_index), revision, JSON.stringify(clip.context ? { context: clip.context, audit: clip.audit || null } : (clip.request || {})), isCritical]);
  }

  await updatePillarCampaignItem(item.id, {
    start_frame_revision: revision,
    start_frame_status: 'processing',
    start_frame_expected_count: expectedCount,
    start_frame_completed_count: carryForwardCompleted ? Math.max(0, expectedCount - clips.length) : 0,
    workflow_status: 'start_frames_processing',
    regenerate_start_frames_status: 'queued',
    regenerate_start_frames_progress: `${carryForwardCompleted ? Math.max(0, expectedCount - clips.length) : 0}/${expectedCount}`
  });
  return { itemId: Number(item.id), revision, queued: clips.length };
}

/**
 * Queue a single start frame revision idempotently
 */
export async function queueSingleStartFrameRevision(itemId, { clip_index, context, audit }, { idempotencyKey = null } = {}) {
  const db = getDb();
  const item = await db.prepare('SELECT * FROM pillar_campaign_items WHERE id=?').get(itemId);
  if (!item) throw new Error('OPC item tidak ditemukan.');
  const campaign = await db.prepare('SELECT * FROM pillar_campaigns WHERE id=?').get(item.campaign_id);
  if (!campaign) throw new Error('OPC campaign tidak ditemukan.');

  const clipIndexNum = Number(clip_index);
  const tenantId = getActiveTenantId();
  const { resolveProductReferenceRequirement } = await import('./opc-start-frame-contract.js');
  const isCritical = Boolean(resolveProductReferenceRequirement({ campaign, item, clipIndex: clipIndexNum }).required);

  // Check for active duplicate task on same (tenant_id, campaign_item_id, clip_index)
  const activeCheck = await pgQuery(
    `SELECT * FROM pillar_campaign_item_assets
     WHERE tenant_id = $1
       AND campaign_item_id = $2
       AND clip_index = $3
       AND asset_type = 'start_frame'
       AND status IN ('queued', 'waiting_lane', 'processing', 'provider_processing')
     ORDER BY revision DESC LIMIT 1`,
    [tenantId, String(item.id), clipIndexNum]
  );

  if (activeCheck.rows.length > 0) {
    const existing = activeCheck.rows[0];
    return {
      assetId: existing.id,
      revision: existing.revision,
      referenceCritical: existing.reference_critical,
      status: existing.status,
      duplicate: true
    };
  }

  // Create new revision asset
  const targetRevision = Number(item.start_frame_revision || 0) + 1;
  const assetId = `pcia_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;

  await pgQuery(
    `INSERT INTO pillar_campaign_item_assets (
      id, tenant_id, campaign_id, campaign_item_id, clip_index,
      asset_type, revision, status, attempt_count, request_json, reference_critical
    ) VALUES ($1, $2, $3, $4, $5, 'start_frame', $6, 'queued', 0, $7, $8)
    ON CONFLICT (tenant_id, campaign_item_id, clip_index, asset_type, revision) DO UPDATE SET
      status = 'queued',
      reference_critical = EXCLUDED.reference_critical,
      request_json = EXCLUDED.request_json,
      updated_at = CURRENT_TIMESTAMP`,
    [
      assetId,
      tenantId,
      String(item.campaign_id),
      String(item.id),
      clipIndexNum,
      targetRevision,
      JSON.stringify({ context: context || {}, audit: audit || null, idempotencyKey }),
      isCritical
    ]
  );

  await updatePillarCampaignItem(item.id, {
    start_frame_revision: targetRevision,
    start_frame_status: 'processing',
    regenerate_start_frames_status: 'queued',
    regenerate_start_frames_progress: '0/1',
    workflow_status: 'start_frames_processing'
  });

  return {
    assetId,
    revision: targetRevision,
    referenceCritical: isCritical,
    status: 'queued',
    duplicate: false
  };
}

/**
 * Transaction-safe activation of a completed start frame asset.
 * Prevents late older revisions from overwriting newer active revisions.
 */
export async function activateCompletedStartFrame(assetId, { localPath, checksum, revision = null, clipIndex = null, itemId = null }) {
  const tenantId = getActiveTenantId();
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const assetRes = await client.query(
      `SELECT * FROM pillar_campaign_item_assets WHERE id = $1 FOR UPDATE`,
      [assetId]
    );
    if (!assetRes.rows.length) {
      await client.query('ROLLBACK');
      throw new Error(`Asset ${assetId} tidak ditemukan.`);
    }
    const asset = assetRes.rows[0];
    const targetItemId = itemId || asset.campaign_item_id;
    const targetClipIndex = clipIndex || asset.clip_index;
    const targetRevision = revision || asset.revision;

    const db = getDb();
    const item = await db.prepare('SELECT * FROM pillar_campaign_items WHERE id = ?').get(targetItemId);
    if (!item) {
      await client.query('ROLLBACK');
      throw new Error(`Campaign item ${targetItemId} tidak ditemukan.`);
    }

    const currentItemRevision = Number(item.start_frame_revision || 0);

    // Only activate in t2i_images_json if this revision >= currentItemRevision
    let activated = false;
    if (Number(targetRevision) >= currentItemRevision) {
      const paths = parseJson(item.t2i_images_json, []);
      while (paths.length < Number(targetClipIndex)) {
        paths.push(null);
      }
      paths[Number(targetClipIndex) - 1] = localPath;

      await updatePillarCampaignItem(item.id, {
        t2i_images_json: JSON.stringify(paths),
        t2i_start_frame_path: localPath
      });

      // Mark this asset as activated and completed
      await client.query(
        `UPDATE pillar_campaign_item_assets
         SET status = 'completed',
             local_path = $1,
             checksum = $2,
             completed_at = CURRENT_TIMESTAMP,
             activated_at = CURRENT_TIMESTAMP,
             download_completed_at = CURRENT_TIMESTAMP,
             lease_owner = NULL,
             lease_expires_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [localPath, checksum || null, assetId]
      );

      // Mark older completed revisions of this clip as superseded
      await client.query(
        `UPDATE pillar_campaign_item_assets
         SET superseded_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = $1
           AND campaign_item_id = $2
           AND clip_index = $3
           AND asset_type = 'start_frame'
           AND revision < $4
           AND superseded_at IS NULL`,
        [tenantId, String(targetItemId), Number(targetClipIndex), Number(targetRevision)]
      );
      activated = true;
    } else {
      // Late older revision: mark as superseded without replacing t2i_images_json
      await client.query(
        `UPDATE pillar_campaign_item_assets
         SET status = 'completed',
             local_path = $1,
             checksum = $2,
             completed_at = CURRENT_TIMESTAMP,
             superseded_at = CURRENT_TIMESTAMP,
             download_completed_at = CURRENT_TIMESTAMP,
             lease_owner = NULL,
             lease_expires_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [localPath, checksum || null, assetId]
      );
    }

    await client.query('COMMIT');

    // Update aggregate checkpoint
    await refreshStartFrameCheckpoint(targetItemId);

    return { success: true, activated, revision: targetRevision };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function claimIsolatedStartFrameAsset(workerId, { leaseSeconds = 300 } = {}) {
  const tenantId = getActiveTenantId();
  return (await pgQuery(`WITH candidate AS (
    SELECT c.id, c.status AS claimed_status
    FROM pillar_campaign_item_assets c
    WHERE c.tenant_id = $1
      AND c.asset_type = 'start_frame'
      AND c.status IN ('queued', 'waiting_lane', 'retry_wait', 'provider_processing')
      AND (c.next_attempt_at IS NULL OR c.next_attempt_at <= CURRENT_TIMESTAMP)
      AND (c.lease_expires_at IS NULL OR c.lease_expires_at < CURRENT_TIMESTAMP)
      AND (
        (c.reference_critical = TRUE AND NOT EXISTS (
          SELECT 1 FROM pillar_campaign_item_assets sibling
          WHERE sibling.tenant_id = c.tenant_id
            AND sibling.campaign_item_id = c.campaign_item_id
            AND sibling.id != c.id
            AND sibling.asset_type = 'start_frame'
            AND sibling.status IN ('processing', 'provider_processing')
            AND (sibling.lease_expires_at IS NULL OR sibling.lease_expires_at >= CURRENT_TIMESTAMP)
        ))
        OR
        (c.reference_critical = FALSE AND NOT EXISTS (
          SELECT 1 FROM pillar_campaign_item_assets sibling
          WHERE sibling.tenant_id = c.tenant_id
            AND sibling.campaign_item_id = c.campaign_item_id
            AND sibling.id != c.id
            AND sibling.asset_type = 'start_frame'
            AND sibling.reference_critical = TRUE
            AND sibling.status IN ('processing', 'provider_processing')
            AND (sibling.lease_expires_at IS NULL OR sibling.lease_expires_at >= CURRENT_TIMESTAMP)
        ))
      )
    ORDER BY c.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE pillar_campaign_item_assets a
  SET status = 'processing',
      attempt_count = attempt_count + 1,
      lease_owner = $2,
      lease_expires_at = CURRENT_TIMESTAMP + ($3 * INTERVAL '1 second'),
      updated_at = CURRENT_TIMESTAMP
  FROM candidate
  WHERE a.id = candidate.id
  RETURNING a.*, candidate.claimed_status`, [tenantId, workerId, leaseSeconds])).rows[0] || null;
}

export const claimStartFrameAsset = claimIsolatedStartFrameAsset;

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
  const campaign = await db.prepare('SELECT * FROM pillar_campaigns WHERE id=?').get(item.campaign_id);
  const targetRevision = Number(revision || item.start_frame_revision || 1);
  const { resolveProductReferenceRequirement } = await import('./opc-start-frame-contract.js');
  const isCritical = campaign ? Boolean(resolveProductReferenceRequirement({ campaign, item, clipIndex }).required) : false;

  await pgQuery(`INSERT INTO pillar_campaign_item_assets
    (id,tenant_id,campaign_id,campaign_item_id,clip_index,asset_type,revision,status,local_path,checksum,completed_at,reference_critical)
    VALUES($1,$2,$3,$4,$5,'start_frame',$6,'completed',$7,$8,CURRENT_TIMESTAMP,$9)
    ON CONFLICT(tenant_id,campaign_item_id,clip_index,asset_type,revision) DO UPDATE SET
      status='completed',local_path=EXCLUDED.local_path,checksum=EXCLUDED.checksum,completed_at=CURRENT_TIMESTAMP,
      reference_critical=EXCLUDED.reference_critical,
      lease_owner=NULL,lease_expires_at=NULL,updated_at=CURRENT_TIMESTAMP`,
  [`pcia_${crypto.randomUUID().replaceAll('-','').slice(0,16)}`, getActiveTenantId(), String(item.campaign_id), String(item.id), Number(clipIndex), targetRevision, localPath, checksumFile(localPath), isCritical]);
  return refreshStartFrameCheckpoint(itemId);
}
