import crypto from 'crypto';
import { getDb, updatePillarCampaignItem } from './db.js';
import { pgQuery } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';

export class PillarCampaignApprovalError extends Error {
  constructor(message, status = 400, code = 'PILLAR_APPROVAL_VALIDATION') {
    super(message);
    this.name = 'PillarCampaignApprovalError';
    this.status = status;
    this.code = code;
  }
}

function parseJson(value, fallback) {
  try { return JSON.parse(value || ''); } catch (_) { return fallback; }
}

export async function approvePillarCampaignItem(itemId, changes = {}) {
  if (!itemId) throw new PillarCampaignApprovalError('itemId is required');
  const db = getDb();
  const item = await db.prepare('SELECT * FROM pillar_campaign_items WHERE id = ?').get(itemId);
  if (!item) throw new PillarCampaignApprovalError('Campaign item not found', 404, 'PILLAR_ITEM_NOT_FOUND');
  const campaign = await db.prepare('SELECT * FROM pillar_campaigns WHERE id = ?').get(item.campaign_id);
  if (!campaign) throw new PillarCampaignApprovalError('Campaign not found', 404, 'PILLAR_CAMPAIGN_NOT_FOUND');
  const requestedRevision = changes.review_revision || '';
  const dbRevision = item.review_revision || '';
  if (dbRevision !== requestedRevision) {
    throw new PillarCampaignApprovalError('Revision review berubah. Muat ulang sebelum approval.', 409, 'PILLAR_APPROVAL_STALE_REVISION');
  }
  if (campaign.approval_mode === 'start_frames' && !['completed', 'skipped'].includes(item.start_frame_status)) {
    throw new PillarCampaignApprovalError('Seluruh start frame wajib siap sebelum approval.', 409, 'PILLAR_START_FRAMES_INCOMPLETE');
  }
  if (requestedRevision && item.approved_revision === requestedRevision && item.workflow_status === 'production_processing') {
    return { itemId: Number(itemId), workflowStatus: item.workflow_status, onlySaved: false, idempotent: true };
  }

  const newVideoPlan = changes.new_video_plan;
  const videoDna = changes.video_dna || {};
  if (!Array.isArray(newVideoPlan) || newVideoPlan.length === 0) {
    throw new PillarCampaignApprovalError('new_video_plan wajib berupa array yang tidak kosong.');
  }
  const oldResult = parseJson(item.result_json, {});
  const storyboard = newVideoPlan.map((plan, index) => ({
    scene: plan.clip_index || index + 1,
    duration: '8s',
    visual_description: plan.visual_action || plan.i2v_prompt || plan.t2v_prompt || plan.t2i_prompt || '',
    camera_movement: '',
    audio_mood: ''
  }));
  const voiceover = newVideoPlan.map((plan, index) => ({
    scene: plan.clip_index || index + 1,
    narration: plan.new_vo || '',
    duration: '8s'
  }));
  const promptList = key => newVideoPlan.map((plan, index) => ({
    clip: plan.clip_index || index + 1,
    prompt: plan[key] || ''
  }));
  const updatedResult = {
    ...oldResult,
    storyboard,
    voiceover,
    t2v_prompts: promptList('t2v_prompt'),
    t2i_prompts: promptList('t2i_prompt'),
    i2v_prompts: promptList('i2v_prompt'),
    tiktok_caption: changes.tiktok_caption || oldResult.tiktok_caption || '',
    ig_caption: changes.ig_caption || oldResult.ig_caption || '',
    yt_title: changes.yt_title || oldResult.yt_title || '',
    yt_desc: changes.yt_desc || oldResult.yt_desc || ''
  };

  const settings = {
    enable_tts: changes.enable_tts !== undefined ? Boolean(changes.enable_tts) : Boolean(campaign.enable_tts),
    enable_glabs: changes.enable_glabs !== undefined ? Boolean(changes.enable_glabs) : Boolean(campaign.enable_glabs),
    enable_ffmpeg: changes.enable_ffmpeg !== undefined ? Boolean(changes.enable_ffmpeg) : Boolean(campaign.enable_ffmpeg),
    voice_provider: changes.voice_provider || campaign.voice_provider || 'minimax',
    voice_persona: changes.voice_persona || campaign.voice_persona || 'Indonesian_casual_reporter_vv2',
    voice_speed: changes.voice_speed !== undefined ? Number(changes.voice_speed) : Number(campaign.voice_speed || 1),
    voice_volume: changes.voice_volume !== undefined ? Number(changes.voice_volume) : Number(campaign.voice_volume || 1),
    ffmpeg_video_scale: changes.ffmpeg_video_scale !== undefined ? Number(changes.ffmpeg_video_scale) : Number(campaign.ffmpeg_video_scale || 1),
    ffmpeg_sfx_volume: changes.ffmpeg_sfx_volume !== undefined ? Number(changes.ffmpeg_sfx_volume) : Number(campaign.ffmpeg_sfx_volume || 0),
    ffmpeg_bgm_volume: changes.ffmpeg_bgm_volume !== undefined ? Number(changes.ffmpeg_bgm_volume) : Number(campaign.ffmpeg_bgm_volume || 0.15),
    ffmpeg_sync_option: changes.ffmpeg_sync_option || campaign.ffmpeg_sync_option || 'smart_sync'
  };
  await db.prepare(`
    UPDATE pillar_campaigns
    SET enable_tts = ?, enable_glabs = ?, enable_ffmpeg = ?,
        voice_provider = ?, voice_persona = ?, voice_speed = ?, voice_volume = ?,
        ffmpeg_video_scale = ?, ffmpeg_sfx_volume = ?, ffmpeg_bgm_volume = ?, ffmpeg_sync_option = ?
        ${changes.only_save ? '' : ", status = 'running', scheduler_pause_at = NULL"}
    WHERE id = ?
  `).run(
    settings.enable_tts ? 1 : 0,
    settings.enable_glabs ? 1 : 0,
    settings.enable_ffmpeg ? 1 : 0,
    settings.voice_provider,
    settings.voice_persona,
    settings.voice_speed,
    settings.voice_volume,
    settings.ffmpeg_video_scale,
    settings.ffmpeg_sfx_volume,
    settings.ffmpeg_bgm_volume,
    settings.ffmpeg_sync_option,
    campaign.id
  );

  const itemUpdates = {
    new_video_plan_json: JSON.stringify(newVideoPlan),
    video_dna_json: JSON.stringify(videoDna),
    result_json: JSON.stringify(updatedResult),
    selected_vo_version: changes.selected_vo_version || item.selected_vo_version || 'original'
  };
  if (!changes.only_save) {
    Object.assign(itemUpdates, {
      workflow_status: 'production_processing',
      tts_status: settings.enable_tts ? 'pending' : 'skipped',
      visual_status: settings.enable_glabs ? 'pending' : 'skipped',
      ffmpeg_status: settings.enable_ffmpeg ? 'pending' : 'skipped',
      social_post_status: 'pending',
      approved_revision: requestedRevision || item.review_revision || null,
      approved_at: new Date(),
      approved_by: changes.actor_id || null
    });
  }
  await updatePillarCampaignItem(itemId, itemUpdates);
  return {
    itemId: Number(itemId),
    workflowStatus: changes.only_save ? item.workflow_status : 'production_processing',
    onlySaved: Boolean(changes.only_save)
  };
}

export async function approvePillarCampaignItemUnchanged(itemId, options = {}) {
  const db = getDb();
  const item = await db.prepare('SELECT * FROM pillar_campaign_items WHERE id = ?').get(itemId);
  if (!item) throw new PillarCampaignApprovalError('Campaign item not found', 404, 'PILLAR_ITEM_NOT_FOUND');
  const result = parseJson(item.result_json, {});
  return approvePillarCampaignItem(itemId, {
    new_video_plan: parseJson(item.new_video_plan_json, []),
    video_dna: parseJson(item.video_dna_json, {}),
    tiktok_caption: result.tiktok_caption,
    ig_caption: result.ig_caption,
    yt_title: result.yt_title,
    yt_desc: result.yt_desc,
    review_revision: options.review_revision || item.review_revision || null,
    actor_id: options.actor_id || null
  });
}

const REVIEW_ACTIONS = new Set(['approve', 'hold', 'resume', 'reject']);

export async function transitionPillarReview({ itemId, action, reviewRevision, reason = null, actorId = null, idempotencyKey = null, changes = null }) {
  if (!REVIEW_ACTIONS.has(action)) throw new PillarCampaignApprovalError('Review action tidak valid.', 400, 'PILLAR_REVIEW_ACTION_INVALID');
  
  const tenantId = getActiveTenantId();
  const item = (await pgQuery(`SELECT i.* FROM pillar_campaign_items i
    JOIN pillar_campaigns c ON c.id=i.campaign_id WHERE c.tenant_id=$1 AND i.id=$2`, [tenantId, itemId])).rows[0];
  if (!item) throw new PillarCampaignApprovalError('Campaign item not found', 404, 'PILLAR_ITEM_NOT_FOUND');

  const dbRevision = item.review_revision || '';
  const reqRevision = reviewRevision || '';

  if (!reqRevision && dbRevision) {
    throw new PillarCampaignApprovalError('review_revision wajib diisi.', 400, 'PILLAR_REVIEW_REVISION_REQUIRED');
  }
  if (dbRevision !== reqRevision) {
    throw new PillarCampaignApprovalError('Revision review berubah. Muat ulang sebelum melanjutkan.', 409, 'PILLAR_APPROVAL_STALE_REVISION');
  }

  if (['hold', 'reject'].includes(action) && !String(reason || '').trim()) throw new PillarCampaignApprovalError('Alasan wajib diisi.', 400, 'PILLAR_REVIEW_REASON_REQUIRED');
  const key = idempotencyKey || `review:${tenantId}:${itemId}:${reqRevision}:${action}`;
  const actionId = `pra_${crypto.createHash('sha256').update(`${tenantId}:${key}`).digest('hex').slice(0, 24)}`;
  const inserted = await pgQuery(
    `INSERT INTO pillar_campaign_review_actions(id,tenant_id,campaign_item_id,review_revision,action,idempotency_key,actor_id,reason)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(tenant_id,idempotency_key) DO NOTHING RETURNING id`,
    [actionId, tenantId, String(itemId), reqRevision, action, key, actorId, reason]
  );
  if (!inserted.rowCount) {
    const existing = (await pgQuery('SELECT result_json FROM pillar_campaign_review_actions WHERE tenant_id=$1 AND idempotency_key=$2', [tenantId, key])).rows[0];
    if (existing?.result_json) return { ...(typeof existing.result_json === 'string' ? JSON.parse(existing.result_json) : existing.result_json), idempotent: true };
    throw new PillarCampaignApprovalError('Review action sedang diproses.', 409, 'PILLAR_REVIEW_ACTION_IN_PROGRESS');
  }
  try {
    let result;
    if (action === 'approve') {
      if (['held', 'rejected'].includes(item.review_state)) throw new PillarCampaignApprovalError('Item masih ditahan atau ditolak.', 409, 'PILLAR_REVIEW_STATE_BLOCKED');
      result = changes
        ? await approvePillarCampaignItem(itemId, { ...changes, review_revision: reqRevision, actor_id: actorId })
        : await approvePillarCampaignItemUnchanged(itemId, { review_revision: reqRevision, actor_id: actorId });
      await updatePillarCampaignItem(itemId, { review_state: 'approved', review_reason: null, review_actor_id: actorId, review_state_updated_at: new Date() });
    } else {
      const transitions = {
        hold: { from: ['draft', 'ready', 'resumed'], state: 'held', workflow: 'review_held' },
        resume: { from: ['held'], state: 'resumed', workflow: 'ready_for_review' },
        reject: { from: ['draft', 'ready', 'resumed', 'held'], state: 'rejected', workflow: 'review_rejected' }
      };
      const transition = transitions[action];
      const current = item.review_state === 'draft' && item.workflow_status === 'ready_for_review' ? 'ready' : item.review_state;
      if (!transition.from.includes(current)) throw new PillarCampaignApprovalError(`Transisi ${current} → ${action} tidak diizinkan.`, 409, 'PILLAR_REVIEW_TRANSITION_INVALID');
      const changed = await pgQuery(`UPDATE pillar_campaign_items SET review_state=$1,review_reason=$2,review_actor_id=$3,
        review_state_updated_at=CURRENT_TIMESTAMP,workflow_status=$4 WHERE id=$5 AND review_revision=$6 AND review_state=$7 RETURNING id`,
      [transition.state, action === 'resume' ? null : reason, actorId, transition.workflow, itemId, reviewRevision, item.review_state]);
      if (!changed.rowCount) throw new PillarCampaignApprovalError('State review berubah oleh proses lain. Muat ulang item.', 409, 'PILLAR_REVIEW_CONCURRENT_UPDATE');
      result = { itemId: Number(itemId), action, reviewState: transition.state, workflowStatus: transition.workflow };
    }
    await pgQuery('UPDATE pillar_campaign_review_actions SET result_json=$1 WHERE id=$2', [JSON.stringify(result), actionId]);
    const eventLabels = {
      approve: ['review_approved', 'Item disetujui', 'Item OPC disetujui dan masuk antrean produksi.'],
      hold: ['review_held', 'Item ditahan', `Item OPC ditahan: ${reason}`],
      resume: ['review_resumed', 'Review dilanjutkan', 'Item OPC dikembalikan ke antrean review.'],
      reject: ['review_rejected', 'Item ditolak', `Item OPC ditolak: ${reason}`]
    };
    const [eventType, title, message] = eventLabels[action];
    const { emitCampaignItemEvent } = await import('./content-automation-event-service.js');
    await emitCampaignItemEvent({ tenantId, campaignId: item.campaign_id, itemId: String(itemId), revision: reviewRevision, eventType, title, message, actionUrl: `/pillar-campaigns/${item.campaign_id}` }).catch(() => {});
    return result;
  } catch (error) {
    await pgQuery('DELETE FROM pillar_campaign_review_actions WHERE id=$1 AND result_json IS NULL', [actionId]).catch(() => {});
    throw error;
  }
}
