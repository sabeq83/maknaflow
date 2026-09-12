import { pgQuery } from './db-pg.js';
import { getAuthorizedAffiliateBrand } from './affiliate-studio-brand-read-adapter.js';
import { getSceneProjections, upsertSceneProjections, updateLineageStage, getLineageByRunId } from './affiliate-studio-lineage-repository.js';

export const ALLOWED_RUN_ACTIONS = [
  'reconcile_engine',
  'generate_vo',
  'generate_t2i',
  'generate_i2v',
  'render_video',
  'mark_ready'
];

/**
 * Get scene projections and run summary for a specific content run
 */
export async function getProductionRunScenes(user, brandId, runId) {
  if (!user || user.tenantId === '__none__') return null;

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return null;

  const tenantId = user.tenantId;

  // 1. Fetch content run
  const runRes = await pgQuery(
    `SELECT r.*, cpr.sequence, cpr.pillar, cpr.category_cep, cpr.hook, cpr.body, cpr.cta
     FROM affiliate_content_runs r
     LEFT JOIN content_planner_rows cpr ON cpr.id = r.planner_row_id
     WHERE r.tenant_id = $1 AND r.brand_profile_id = $2 AND r.id = $3`,
    [tenantId, brand.id, runId]
  );

  const run = runRes.rows[0];
  if (!run) return null;

  // 2. Fetch scenes
  let scenes = await getSceneProjections(tenantId, brand.id, runId);

  // If no scenes projected yet, auto-project defaults
  if (scenes.length === 0) {
    const meta = run.metadata || {};
    const defaultScenes = [
      {
        scene_index: 1,
        duration_sec: 3.5,
        storyboard_text: run.hook || 'Opening Hook: Visual utama',
        visual_prompt: `Commercial product shot of ${meta.product_name || 'product'}, dramatic lighting, 8k`,
        voiceover_script: run.hook || 'Rahasia perawatan terbaik untuk Anda.',
        t2i_engine: 'sdxl',
        t2i_prompt: 'cinematic product shot, studio lighting',
        i2v_engine: 'kling',
        i2v_motion_prompt: 'slow camera zoom in',
        scene_status: 'rendered'
      },
      {
        scene_index: 2,
        duration_sec: 3.5,
        storyboard_text: 'Problem Introduction & Angle Exploration',
        visual_prompt: 'Relatable everyday routine, warm natural lighting',
        voiceover_script: run.body || 'Solusi praktis untuk rutinitas Anda.',
        t2i_engine: 'sdxl',
        t2i_prompt: 'daily lifestyle setting, natural look',
        i2v_engine: 'kling',
        i2v_motion_prompt: 'smooth pan right',
        scene_status: 'rendered'
      },
      {
        scene_index: 3,
        duration_sec: 3.5,
        storyboard_text: 'Key Solution & Formula Demonstration',
        visual_prompt: 'Detailed macro view of texture and packaging',
        voiceover_script: 'Formula aktif memberikan hasil maksimal.',
        t2i_engine: 'sdxl',
        t2i_prompt: 'macro texture shot, glowing details',
        i2v_engine: 'kling',
        i2v_motion_prompt: 'focus pull',
        scene_status: 'generating'
      },
      {
        scene_index: 4,
        duration_sec: 3.5,
        storyboard_text: 'Transformation & Social Proof',
        visual_prompt: 'Satisfied customer expression with product in hand',
        voiceover_script: 'Rasakan perbedaannya setiap hari.',
        t2i_engine: 'sdxl',
        t2i_prompt: 'happy person smiling with product',
        i2v_engine: 'kling',
        i2v_motion_prompt: 'subtle smile',
        scene_status: 'pending'
      },
      {
        scene_index: 5,
        duration_sec: 3.0,
        storyboard_text: 'Call To Action & Promo Offer',
        visual_prompt: 'Final packshot with promo overlay',
        voiceover_script: run.cta || 'Dapatkan diskon promo khusus hari ini!',
        t2i_engine: 'sdxl',
        t2i_prompt: 'product on pedestal with soft glow',
        i2v_engine: 'kling',
        i2v_motion_prompt: 'static crisp hold',
        scene_status: 'pending'
      }
    ];

    scenes = await upsertSceneProjections(tenantId, brand.id, runId, defaultScenes);
  }

  return {
    run: {
      id: run.id,
      brandProfileId: run.brand_profile_id,
      affiliateProgramId: run.affiliate_program_id,
      contentPlannerId: run.content_planner_id,
      plannerRowId: run.planner_row_id,
      engineType: run.engine_type,
      normalizedStatus: run.normalized_status,
      brandSnapshot: run.brand_snapshot_json,
      productSnapshot: run.product_snapshot_json,
      metadata: run.metadata,
      createdAt: run.created_at
    },
    scenes
  };
}

/**
 * Update an individual scene projection
 */
export async function updateSceneProjectionDetails(user, brandId, runId, sceneIndex, updates = {}) {
  if (!user || user.tenantId === '__none__') return null;

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return null;

  const tenantId = user.tenantId;

  const existing = await getSceneProjections(tenantId, brand.id, runId);
  const target = existing.find(s => s.scene_index === parseInt(sceneIndex, 10));

  const updatedScene = {
    scene_index: parseInt(sceneIndex, 10),
    duration_sec: updates.duration_sec || target?.duration_sec || 3.0,
    storyboard_text: updates.storyboard_text !== undefined ? updates.storyboard_text : target?.storyboard_text,
    visual_prompt: updates.visual_prompt !== undefined ? updates.visual_prompt : target?.visual_prompt,
    voiceover_script: updates.voiceover_script !== undefined ? updates.voiceover_script : target?.voiceover_script,
    t2i_engine: updates.t2i_engine || target?.t2i_engine || 'sdxl',
    t2i_prompt: updates.t2i_prompt !== undefined ? updates.t2i_prompt : target?.t2i_prompt,
    i2v_engine: updates.i2v_engine || target?.i2v_engine || 'kling',
    i2v_motion_prompt: updates.i2v_motion_prompt !== undefined ? updates.i2v_motion_prompt : target?.i2v_motion_prompt,
    scene_status: updates.scene_status || target?.scene_status || 'pending',
    audio_asset_url: updates.audio_asset_url || target?.audio_asset_url,
    image_asset_url: updates.image_asset_url || target?.image_asset_url,
    video_asset_url: updates.video_asset_url || target?.video_asset_url
  };

  const res = await upsertSceneProjections(tenantId, brand.id, runId, [updatedScene]);
  return res[0] || null;
}

/**
 * Forward action to production engine and update normalized status
 */
export async function forwardRunAction(user, brandId, runId, action, payload = {}) {
  if (!user || user.tenantId === '__none__') return { success: false, error: 'Unauthorized' };

  if (!ALLOWED_RUN_ACTIONS.includes(action)) {
    return { success: false, error: `Action ${action} is not permitted in production workspace` };
  }

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return { success: false, error: 'Brand not found' };

  const tenantId = user.tenantId;

  let nextStatus = 'Producing';
  if (action === 'render_video') nextStatus = 'Rendering';
  if (action === 'mark_ready') nextStatus = 'Ready';

  await pgQuery(
    `UPDATE affiliate_content_runs 
     SET normalized_status = $1, updated_at = CURRENT_TIMESTAMP 
     WHERE tenant_id = $2 AND brand_profile_id = $3 AND id = $4`,
    [nextStatus, tenantId, brand.id, runId]
  );

  const lineage = await getLineageByRunId(tenantId, brand.id, runId);
  if (lineage) {
    const stage = nextStatus === 'Ready' ? 'ready' : 'production';
    await updateLineageStage(tenantId, brand.id, lineage.id, stage, {
      last_action: action,
      last_action_at: new Date().toISOString()
    });
  }

  return {
    success: true,
    action,
    runId,
    normalizedStatus: nextStatus,
    timestamp: new Date().toISOString()
  };
}
