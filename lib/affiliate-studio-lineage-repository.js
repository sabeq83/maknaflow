import { pgQuery } from './db-pg.js';
import crypto from 'crypto';

export const LIFECYCLE_STAGES = [
  'calendar',
  'planner',
  'approved',
  'production',
  'ready',
  'publishing',
  'published',
  'measured',
  'archived'
];

/**
 * Record or upsert a continuous lineage node.
 */
export async function recordLineage({
  tenantId = 'default_tenant',
  brandProfileId,
  affiliateProgramId = null,
  contentScheduleId = null,
  contentPlannerId = null,
  plannerRowId = null,
  affiliateContentRunId = null,
  publishingQueueId = null,
  externalPostId = null,
  lifecycleStage = 'calendar',
  metadata = {}
}) {
  if (!brandProfileId) {
    throw new Error('brandProfileId is required for lineage tracking');
  }

  const id = `lin_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

  const query = `
    INSERT INTO affiliate_content_lineage (
      id, tenant_id, brand_profile_id, affiliate_program_id,
      content_schedule_id, content_planner_id, planner_row_id,
      affiliate_content_run_id, publishing_queue_id, external_post_id,
      lifecycle_stage, metadata, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING *;
  `;

  const values = [
    id,
    tenantId,
    brandProfileId,
    affiliateProgramId,
    contentScheduleId,
    contentPlannerId,
    plannerRowId,
    affiliateContentRunId,
    publishingQueueId,
    externalPostId,
    lifecycleStage,
    JSON.stringify(metadata || {})
  ];

  const res = await pgQuery(query, values);
  return res.rows[0];
}

/**
 * Get lineage node by schedule ID
 */
export async function getLineageByScheduleId(tenantId, brandProfileId, scheduleId) {
  const query = `
    SELECT * FROM affiliate_content_lineage
    WHERE tenant_id = $1 AND brand_profile_id = $2 AND content_schedule_id = $3
    ORDER BY created_at DESC
    LIMIT 1;
  `;
  const res = await pgQuery(query, [tenantId || 'default_tenant', brandProfileId, scheduleId]);
  return res.rows[0] || null;
}

/**
 * Get lineage node by planner row ID
 */
export async function getLineageByPlannerRowId(tenantId, brandProfileId, plannerRowId) {
  const query = `
    SELECT * FROM affiliate_content_lineage
    WHERE tenant_id = $1 AND brand_profile_id = $2 AND planner_row_id = $3
    ORDER BY created_at DESC
    LIMIT 1;
  `;
  const res = await pgQuery(query, [tenantId || 'default_tenant', brandProfileId, plannerRowId]);
  return res.rows[0] || null;
}

/**
 * Get lineage node by content run ID
 */
export async function getLineageByRunId(tenantId, brandProfileId, runId) {
  const query = `
    SELECT * FROM affiliate_content_lineage
    WHERE tenant_id = $1 AND brand_profile_id = $2 AND affiliate_content_run_id = $3
    ORDER BY created_at DESC
    LIMIT 1;
  `;
  const res = await pgQuery(query, [tenantId || 'default_tenant', brandProfileId, runId]);
  return res.rows[0] || null;
}

/**
 * Advance or update lifecycle stage of a lineage node
 */
export async function updateLineageStage(tenantId, brandProfileId, lineageId, nextStage, additionalMetadata = {}) {
  if (!LIFECYCLE_STAGES.includes(nextStage)) {
    throw new Error(`Invalid lifecycleStage: ${nextStage}`);
  }

  const query = `
    UPDATE affiliate_content_lineage
    SET 
      lifecycle_stage = $1,
      metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
      updated_at = CURRENT_TIMESTAMP
    WHERE tenant_id = $3 AND brand_profile_id = $4 AND id = $5
    RETURNING *;
  `;

  const res = await pgQuery(query, [
    nextStage,
    JSON.stringify(additionalMetadata || {}),
    tenantId || 'default_tenant',
    brandProfileId,
    lineageId
  ]);

  return res.rows[0] || null;
}

/**
 * List lineage history trail for a brand with optional stage filter
 */
export async function getBrandLineageTrail(tenantId, brandProfileId, filters = {}) {
  let query = `
    SELECT * FROM affiliate_content_lineage
    WHERE tenant_id = $1 AND brand_profile_id = $2
  `;
  const params = [tenantId || 'default_tenant', brandProfileId];

  if (filters.lifecycleStage) {
    params.push(filters.lifecycleStage);
    query += ` AND lifecycle_stage = $${params.length}`;
  }

  if (filters.contentPlannerId) {
    params.push(filters.contentPlannerId);
    query += ` AND content_planner_id = $${params.length}`;
  }

  query += ` ORDER BY created_at DESC LIMIT ${parseInt(filters.limit || 100, 10)};`;

  const res = await pgQuery(query, params);
  return res.rows;
}

/**
 * Upsert normalized scene projection for Production Workspace
 */
export async function upsertSceneProjections(tenantId, brandProfileId, runId, scenes = []) {
  const savedScenes = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const sceneIndex = scene.scene_index !== undefined ? scene.scene_index : (i + 1);
    const id = scene.id || `scn_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

    const query = `
      INSERT INTO affiliate_production_scene_projection (
        id, tenant_id, brand_profile_id, affiliate_content_run_id,
        scene_index, duration_sec, storyboard_text, visual_prompt,
        voiceover_script, t2i_engine, t2i_prompt, i2v_engine,
        i2v_motion_prompt, audio_asset_url, image_asset_url,
        video_asset_url, scene_status, metadata, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT (tenant_id, affiliate_content_run_id, scene_index) DO UPDATE SET
        duration_sec = EXCLUDED.duration_sec,
        storyboard_text = EXCLUDED.storyboard_text,
        visual_prompt = EXCLUDED.visual_prompt,
        voiceover_script = EXCLUDED.voiceover_script,
        t2i_engine = EXCLUDED.t2i_engine,
        t2i_prompt = EXCLUDED.t2i_prompt,
        i2v_engine = EXCLUDED.i2v_engine,
        i2v_motion_prompt = EXCLUDED.i2v_motion_prompt,
        audio_asset_url = EXCLUDED.audio_asset_url,
        image_asset_url = EXCLUDED.image_asset_url,
        video_asset_url = EXCLUDED.video_asset_url,
        scene_status = EXCLUDED.scene_status,
        metadata = affiliate_production_scene_projection.metadata || EXCLUDED.metadata,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;

    const values = [
      id,
      tenantId || 'default_tenant',
      brandProfileId,
      runId,
      sceneIndex,
      scene.duration_sec || 3.0,
      scene.storyboard_text || '',
      scene.visual_prompt || '',
      scene.voiceover_script || '',
      scene.t2i_engine || 'sdxl',
      scene.t2i_prompt || '',
      scene.i2v_engine || 'kling',
      scene.i2v_motion_prompt || '',
      scene.audio_asset_url || null,
      scene.image_asset_url || null,
      scene.video_asset_url || null,
      scene.scene_status || 'pending',
      JSON.stringify(scene.metadata || {})
    ];

    const res = await pgQuery(query, values);
    savedScenes.push(res.rows[0]);
  }

  return savedScenes;
}

/**
 * Get scene projections by run ID
 */
export async function getSceneProjections(tenantId, brandProfileId, runId) {
  const query = `
    SELECT * FROM affiliate_production_scene_projection
    WHERE tenant_id = $1 AND brand_profile_id = $2 AND affiliate_content_run_id = $3
    ORDER BY scene_index ASC;
  `;
  const res = await pgQuery(query, [tenantId || 'default_tenant', brandProfileId, runId]);
  return res.rows;
}

/**
 * Idempotent backfill helper to connect existing historical content runs to lineage
 */
export async function backfillExistingLineage(tenantId = 'default_tenant', brandProfileId) {
  if (!brandProfileId) return { backfilledCount: 0 };

  const selectQuery = `
    SELECT r.* 
    FROM affiliate_content_runs r
    LEFT JOIN affiliate_content_lineage l 
      ON l.tenant_id = r.tenant_id 
      AND l.brand_profile_id = r.brand_profile_id 
      AND l.affiliate_content_run_id = r.id
    WHERE r.tenant_id = $1 
      AND r.brand_profile_id = $2 
      AND l.id IS NULL;
  `;

  const runsRes = await pgQuery(selectQuery, [tenantId, brandProfileId]);
  const unlinkedRuns = runsRes.rows;
  let backfilledCount = 0;

  for (const run of unlinkedRuns) {
    let stage = 'production';
    if (run.normalized_status === 'Ready') stage = 'ready';
    else if (run.normalized_status === 'Scheduled') stage = 'publishing';
    else if (run.normalized_status === 'Published') stage = 'published';

    await recordLineage({
      tenantId: run.tenant_id,
      brandProfileId: run.brand_profile_id,
      affiliateProgramId: run.affiliate_program_id,
      contentPlannerId: run.content_planner_id,
      plannerRowId: run.planner_row_id,
      affiliateContentRunId: run.id,
      lifecycleStage: stage,
      metadata: {
        backfilled: true,
        original_engine: run.engine_type,
        normalized_status: run.normalized_status
      }
    });
    backfilledCount++;
  }

  return { backfilledCount };
}
