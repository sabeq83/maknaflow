import { getDb, updatePillarCampaignItem } from './db.js';

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
      social_post_status: 'pending'
    });
  }
  await updatePillarCampaignItem(itemId, itemUpdates);
  return {
    itemId: Number(itemId),
    workflowStatus: changes.only_save ? item.workflow_status : 'production_processing',
    onlySaved: Boolean(changes.only_save)
  };
}

export async function approvePillarCampaignItemUnchanged(itemId) {
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
    yt_desc: result.yt_desc
  });
}
