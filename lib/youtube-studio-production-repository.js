import { pgQuery, withPgTransaction } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';
import { assertProductionTransition, assertHybridBatchTransition } from './youtube-studio-contract.js';

export async function getProductionPackageByEpisode(episodeId) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery(`
    SELECT * FROM youtube_production_packages 
    WHERE episode_id = $1 AND tenant_id = $2 
    ORDER BY created_at DESC LIMIT 1
  `, [episodeId, tenantId]);
  return res.rows[0] || null;
}

export async function getProductionPackage(packageId) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery(`
    SELECT * FROM youtube_production_packages 
    WHERE id = $1 AND tenant_id = $2
  `, [packageId, tenantId]);
  return res.rows[0] || null;
}

export async function getProductionAssets(packageId) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery(`
    SELECT * FROM youtube_production_assets 
    WHERE production_package_id = $1 AND tenant_id = $2 
    ORDER BY scene_index ASC, shot_index ASC
  `, [packageId, tenantId]);
  return res.rows;
}

export async function getProductionJobs(packageId) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery(`
    SELECT * FROM youtube_production_jobs 
    WHERE production_package_id = $1 AND tenant_id = $2 
    ORDER BY created_at ASC
  `, [packageId, tenantId]);
  return res.rows;
}

export async function createProductionPlanDraft({ episodeId, plan, snapshot, approvedScriptId, actor }) {
  const tenantId = getActiveTenantId();
  
  return await withPgTransaction(async (client) => {
    // 1. Clean up any existing draft package and assets for the episode to avoid duplicates
    await client.query(`
      DELETE FROM youtube_production_assets 
      WHERE production_package_id IN (
        SELECT id FROM youtube_production_packages 
        WHERE episode_id = $1 AND tenant_id = $2 AND status = 'draft'
      )
    `, [episodeId, tenantId]);

    await client.query(`
      DELETE FROM youtube_production_packages 
      WHERE episode_id = $1 AND tenant_id = $2 AND status = 'draft'
    `, [episodeId, tenantId]);

    // 2. Insert new package draft
    const packageId = `ytpp_${Math.random().toString(36).slice(2, 10)}`;
    const pkgRes = await client.query(`
      INSERT INTO youtube_production_packages (
        id, tenant_id, episode_id, approved_script_id, generation_profile_key, plan_json, context_snapshot_json, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft') RETURNING *
    `, [packageId, tenantId, episodeId, approvedScriptId, plan.generation_profile_key, JSON.stringify(plan), JSON.stringify(snapshot)]);

    // 3. Insert assets
    for (let i = 0; i < plan.scenes.length; i++) {
      const scene = plan.scenes[i];
      
      // Voiceover Asset (represented by shot_index = -1)
      const voId = `ytpa_vo_${Math.random().toString(36).slice(2, 10)}`;
      await client.query(`
        INSERT INTO youtube_production_assets (
          id, tenant_id, production_package_id, scene_index, shot_index, asset_type, prompt_snapshot, status, generation_mode
        )
        VALUES ($1, $2, $3, $4, -1, 'voiceover', $5, 'draft', 'static_asset')
      `, [voId, tenantId, packageId, i, scene.voiceover]);

      // Visual Shots
      for (let j = 0; j < scene.shots.length; j++) {
        const shot = scene.shots[j];
        const visId = `ytpa_vis_${Math.random().toString(36).slice(2, 10)}`;
        await client.query(`
          INSERT INTO youtube_production_assets (
            id, tenant_id, production_package_id, scene_index, shot_index, asset_type, 
            generation_profile_key, generation_duration_seconds, prompt_snapshot, status,
            generation_mode, t2i_prompt, i2v_prompt, t2v_prompt, negative_prompt, continuity_tokens
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        `, [
          visId, tenantId, packageId, i, j, shot.asset_type, plan.generation_profile_key, 
          shot.generation_duration_seconds, shot.prompt || '', 'draft',
          shot.generation_mode || 't2v', shot.t2i_prompt || null, shot.i2v_prompt || null, 
          shot.t2v_prompt || null, shot.negative_prompt || null, shot.continuity_tokens || null
        ]);
      }
    }

    return pkgRes.rows[0];
  });
}

export function assertPackageProductionMode(pkg, expectedMode) {
  const planJson = pkg.plan_json || {};
  const actualMode = planJson.production_mode || 'legacy_t2v';
  if (actualMode !== expectedMode) {
    throw new Error(`Invalid package production mode. Expected: "${expectedMode}", got: "${actualMode}"`);
  }
}

export async function approveProductionPlan(packageId, actor) {
  const tenantId = getActiveTenantId();
  
  return await withPgTransaction(async (client) => {
    // 1. Fetch draft package
    const pkgRes = await client.query('SELECT * FROM youtube_production_packages WHERE id = $1 AND tenant_id = $2', [packageId, tenantId]);
    const pkg = pkgRes.rows[0];
    if (!pkg) throw new Error('Production plan package not found');
    assertPackageProductionMode(pkg, 'legacy_t2v');
    assertProductionTransition(pkg.status, 'approved');

    // Update package status to approved
    await client.query(`
      UPDATE youtube_production_packages 
      SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2
    `, [actor?.username || 'system', packageId]);

    // Update assets status to queued
    await client.query(`
      UPDATE youtube_production_assets 
      SET status = 'queued', updated_at = CURRENT_TIMESTAMP 
      WHERE production_package_id = $1
    `, [packageId]);

    // Update episode status to In Production
    await client.query(`
      UPDATE youtube_episodes SET status = 'In Production' WHERE id = $1
    `, [pkg.episode_id]);

    // 2. Queue generator jobs
    const assetsRes = await client.query('SELECT * FROM youtube_production_assets WHERE production_package_id = $1', [packageId]);
    const assets = assetsRes.rows;

    for (const asset of assets) {
      const jobId = `ytpj_${Math.random().toString(36).slice(2, 10)}`;
      const idempotencyKey = `idemp_prod_job_${asset.id}_v1`;
      const jobKind = asset.asset_type === 'voiceover' ? 'voiceover' : 'visual';

      // Insert job inside transaction
      await client.query(`
        INSERT INTO youtube_production_jobs (id, tenant_id, production_package_id, asset_id, job_kind, idempotency_key, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'queued')
      `, [jobId, tenantId, packageId, asset.id, jobKind, idempotencyKey]);

      // Enqueue job via central scheduler queue (Postgres)
      await pgQuery(`
        INSERT INTO scheduler_jobs (queue_name, payload) 
        VALUES ($1, $2)
      `, ['youtube_production_asset', JSON.stringify({ job_id: jobId, tenant_id: tenantId })]);
    }

    // Move package to generating state
    await client.query(`
      UPDATE youtube_production_packages SET status = 'generating', updated_at = CURRENT_TIMESTAMP WHERE id = $1
    `, [packageId]);

    return pkg;
  });
}

export async function claimProductionJob(jobId) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery(`
    UPDATE youtube_production_jobs 
    SET status = 'running', started_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND tenant_id = $2 AND status = 'queued' RETURNING *
  `, [jobId, tenantId]);
  return res.rows[0] || null;
}

export async function completeProductionJob(jobId, outputAssetJson, costJson) {
  const tenantId = getActiveTenantId();

  return await withPgTransaction(async (client) => {
    // 1. Complete Job
    const jobRes = await client.query(`
      UPDATE youtube_production_jobs 
      SET status = 'completed', progress = 100, completed_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND tenant_id = $2 RETURNING *
    `, [jobId, tenantId]);
    const job = jobRes.rows[0];
    if (!job) throw new Error('Job not found or already processed');

    // 2. Update asset status
    await client.query(`
      UPDATE youtube_production_assets 
      SET status = 'succeeded', output_asset_json = $1, cost_json = $2, error_message = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [JSON.stringify(outputAssetJson), JSON.stringify(costJson || {}), job.asset_id]);

    // 3. Check if all assets for the package are completed
    const packageId = job.production_package_id;
    const remainingRes = await client.query(`
      SELECT COUNT(*) FROM youtube_production_assets 
      WHERE production_package_id = $1 AND status != 'succeeded'
    `, [packageId]);
    
    const remaining = parseInt(remainingRes.rows[0].count, 10);
    if (remaining === 0) {
      // Trigger Assembly Job
      const assemblyJobId = `ytpj_asm_${Math.random().toString(36).slice(2, 10)}`;
      const assemblyIdemp = `idemp_assembly_${packageId}_v1`;

      await client.query(`
        INSERT INTO youtube_production_jobs (id, tenant_id, production_package_id, job_kind, idempotency_key, status)
        VALUES ($1, $2, $3, 'assembly', $4, 'queued')
        ON CONFLICT (idempotency_key) DO NOTHING
      `, [assemblyJobId, tenantId, packageId, assemblyIdemp]);

      await pgQuery(`
        INSERT INTO scheduler_jobs (queue_name, payload) 
        VALUES ($1, $2)
      `, ['youtube_production_assembly', JSON.stringify({ package_id: packageId, job_id: assemblyJobId, tenant_id: tenantId })]);
    }
  });
}

export async function failProductionJob(jobId, errorCode, errorMessage) {
  const tenantId = getActiveTenantId();
  return await withPgTransaction(async (client) => {
    const jobRes = await client.query(`
      UPDATE youtube_production_jobs 
      SET status = 'failed', error_code = $1, error_message = $2, completed_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND tenant_id = $4 RETURNING *
    `, [errorCode, errorMessage, jobId, tenantId]);
    const job = jobRes.rows[0];

    if (job && job.asset_id) {
      await client.query(`
        UPDATE youtube_production_assets 
        SET status = 'failed', error_code = $1, error_message = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [errorCode, errorMessage, job.asset_id]);
    }
  });
}

export async function invalidateShotAndAssemblies(assetId, actor) {
  const tenantId = getActiveTenantId();

  return await withPgTransaction(async (client) => {
    // 1. Fetch asset
    const assetRes = await client.query('SELECT * FROM youtube_production_assets WHERE id = $1 AND tenant_id = $2', [assetId, tenantId]);
    const asset = assetRes.rows[0];
    if (!asset) throw new Error('Asset not found');

    const packageId = asset.production_package_id;

    // Reset asset status
    await client.query(`
      UPDATE youtube_production_assets 
      SET status = 'queued', output_asset_json = NULL, error_code = NULL, error_message = NULL, attempt_count = attempt_count + 1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1
    `, [assetId]);

    // Reset package status back to generating, invalidate preview/final videos
    await client.query(`
      UPDATE youtube_production_packages 
      SET status = 'generating', preview_asset_json = NULL, final_asset_json = NULL, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1
    `, [packageId]);

    // Delete old assembly/final jobs
    await client.query(`
      DELETE FROM youtube_production_jobs 
      WHERE production_package_id = $1 AND job_kind IN ('assembly', 'final_render')
    `, [packageId]);

    // Create visual/voice job again
    const jobId = `ytpj_${Math.random().toString(36).slice(2, 10)}`;
    const idempotencyKey = `idemp_prod_job_${asset.id}_v${asset.attempt_count + 2}`;
    const jobKind = asset.asset_type === 'voiceover' ? 'voiceover' : 'visual';

    await client.query(`
      INSERT INTO youtube_production_jobs (id, tenant_id, production_package_id, asset_id, job_kind, idempotency_key, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'queued')
    `, [jobId, tenantId, packageId, asset.id, jobKind, idempotencyKey]);

    await pgQuery(`
      INSERT INTO scheduler_jobs (queue_name, payload) 
      VALUES ($1, $2)
    `, ['youtube_production_asset', JSON.stringify({ job_id: jobId, tenant_id: tenantId })]);
  });
}

// ── Batch Management & Hybrid Pipeline (Fase 3.5B) ──

export async function createProductionBatch({ packageId, batchType, status = 'draft', actor }) {
  const tenantId = getActiveTenantId();
  const id = `ytpb_${Math.random().toString(36).slice(2, 10)}`;

  await pgQuery(`
    INSERT INTO youtube_production_batches (id, tenant_id, production_package_id, batch_type, status, created_by)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [id, tenantId, packageId, batchType, status, actor?.username || 'system']);

  return { id, tenant_id: tenantId, production_package_id: packageId, batch_type: batchType, status };
}

export async function getBatches(packageId) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery(`
    SELECT * FROM youtube_production_batches
    WHERE production_package_id = $1 AND tenant_id = $2
    ORDER BY created_at ASC
  `, [packageId, tenantId]);
  return res.rows;
}

export async function getBatchById(batchId) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery(`
    SELECT * FROM youtube_production_batches
    WHERE id = $1 AND tenant_id = $2
  `, [batchId, tenantId]);
  return res.rows[0] || null;
}

export async function updateBatchStatus({ batchId, status, actor }) {
  const tenantId = getActiveTenantId();
  return await withPgTransaction(async (client) => {
    const res = await client.query('SELECT * FROM youtube_production_batches WHERE id = $1 AND tenant_id = $2', [batchId, tenantId]);
    const batch = res.rows[0];
    if (!batch) throw new Error('Batch not found');

    assertHybridBatchTransition(batch.status, status);

    await client.query(`
      UPDATE youtube_production_batches
      SET status = $1, approved_by = CASE WHEN $1 = 'approved' THEN $2 ELSE approved_by END,
          approved_at = CASE WHEN $1 = 'approved' THEN CURRENT_TIMESTAMP ELSE approved_at END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [status, actor?.username || 'system', batchId]);

    return { ...batch, status };
  });
}

export async function linkAssetsToBatch(batchId, assetIds) {
  const tenantId = getActiveTenantId();
  if (!assetIds || assetIds.length === 0) return;
  const placeholders = assetIds.map((_, i) => `$${i + 3}`).join(', ');
  await pgQuery(`
    UPDATE youtube_production_assets
    SET batch_id = $1, updated_at = CURRENT_TIMESTAMP
    WHERE tenant_id = $2 AND id IN (${placeholders})
  `, [batchId, tenantId, ...assetIds]);
}

export async function getBatchAssets(batchId) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery(`
    SELECT * FROM youtube_production_assets
    WHERE batch_id = $1 AND tenant_id = $2
    ORDER BY scene_index ASC, shot_index ASC
  `, [batchId, tenantId]);
  return res.rows;
}

/**
 * Step 1: User approves the prompt package.
 * Generates T2I start-frame batch and triggers initial T2I queues.
 */
export async function approvePromptPackage(packageId, actor) {
  const tenantId = getActiveTenantId();
  return await withPgTransaction(async (client) => {
    const pkgRes = await client.query('SELECT * FROM youtube_production_packages WHERE id = $1 AND tenant_id = $2', [packageId, tenantId]);
    const pkg = pkgRes.rows[0];
    if (!pkg) throw new Error('Package not found');
    assertPackageProductionMode(pkg, 'hybrid');

    // Update package status to approved
    await client.query(`
      UPDATE youtube_production_packages
      SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [actor?.username || 'system', packageId]);

    // Fetch visual assets requiring start frame (mode: t2i_i2v)
    const t2iAssetsRes = await client.query(`
      SELECT * FROM youtube_production_assets
      WHERE production_package_id = $1 AND generation_mode = 't2i_i2v' AND asset_type = 'generated_visual'
    `, [packageId]);
    const t2iAssets = t2iAssetsRes.rows;

    if (t2iAssets.length > 0) {
      // Create start-frame batch
      const sfBatchId = `ytpb_sf_${Math.random().toString(36).slice(2, 10)}`;
      await client.query(`
        INSERT INTO youtube_production_batches (id, tenant_id, production_package_id, batch_type, status, created_by)
        VALUES ($1, $2, $3, 'start_frame', 'approved', $4)
      `, [sfBatchId, tenantId, packageId, actor?.username || 'system']);

      // Associate assets with batch and queue them
      const assetIds = t2iAssets.map(a => a.id);
      const placeholders = assetIds.map((_, i) => `$${i + 3}`).join(', ');
      await client.query(`
        UPDATE youtube_production_assets
        SET batch_id = $1, status = 'queued', updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = $2 AND id IN (${placeholders})
      `, [sfBatchId, tenantId, ...assetIds]);

      // Enqueue start-frame generator jobs into central queue
      for (const asset of t2iAssets) {
        const jobId = `ytpj_sf_${Math.random().toString(36).slice(2, 10)}`;
        const idempotencyKey = `idemp_sf_job_${asset.id}_v1`;
        
        await client.query(`
          INSERT INTO youtube_production_jobs (id, tenant_id, production_package_id, asset_id, job_kind, idempotency_key, status)
          VALUES ($1, $2, $3, $4, 'visual', $5, 'queued')
        `, [jobId, tenantId, packageId, asset.id, idempotencyKey]);

        await client.query(`
          INSERT INTO scheduler_jobs (queue_name, payload) 
          VALUES ($1, $2)
        `, ['youtube_production_asset', JSON.stringify({ job_id: jobId, tenant_id: tenantId })]);
      }
    }

    return { approved: true };
  });
}

/**
 * Step 2: Approve start frame batch.
 * Trigger voiceover batch generation (TTS).
 */
export async function approveStartFrameBatch(batchId, actor) {
  const tenantId = getActiveTenantId();
  return await withPgTransaction(async (client) => {
    const batchRes = await client.query('SELECT * FROM youtube_production_batches WHERE id = $1 AND tenant_id = $2', [batchId, tenantId]);
    const batch = batchRes.rows[0];
    if (!batch) throw new Error('Start-frame batch not found');

    await client.query(`
      UPDATE youtube_production_batches
      SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [actor?.username || 'system', batchId]);

    // Create voiceover batch
    const voBatchId = `ytpb_vo_${Math.random().toString(36).slice(2, 10)}`;
    await client.query(`
      INSERT INTO youtube_production_batches (id, tenant_id, production_package_id, batch_type, status, created_by)
      VALUES ($1, $2, $3, 'voiceover', 'approved', $4)
    `, [voBatchId, tenantId, batch.production_package_id, actor?.username || 'system']);

    // Fetch voiceover assets for the package
    const voAssetsRes = await client.query(`
      SELECT * FROM youtube_production_assets
      WHERE production_package_id = $1 AND asset_type = 'voiceover'
    `, [batch.production_package_id]);
    const voAssets = voAssetsRes.rows;

    if (voAssets.length > 0) {
      const assetIds = voAssets.map(a => a.id);
      const placeholders = assetIds.map((_, i) => `$${i + 3}`).join(', ');
      await client.query(`
        UPDATE youtube_production_assets
        SET batch_id = $1, status = 'queued', updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = $2 AND id IN (${placeholders})
      `, [voBatchId, tenantId, ...assetIds]);

      // Enqueue voiceover generator jobs
      for (const asset of voAssets) {
        const jobId = `ytpj_vo_${Math.random().toString(36).slice(2, 10)}`;
        const idempotencyKey = `idemp_vo_job_${asset.id}_v1`;

        await client.query(`
          INSERT INTO youtube_production_jobs (id, tenant_id, production_package_id, asset_id, job_kind, idempotency_key, status)
          VALUES ($1, $2, $3, $4, 'voiceover', $5, 'queued')
        `, [jobId, tenantId, batch.production_package_id, asset.id, idempotencyKey]);

        await client.query(`
          INSERT INTO scheduler_jobs (queue_name, payload) 
          VALUES ($1, $2)
        `, ['youtube_production_asset', JSON.stringify({ job_id: jobId, tenant_id: tenantId })]);
      }
    }

    return { approved: true, voiceover_batch_id: voBatchId };
  });
}

/**
 * Step 3: Approve voiceover batch.
 * Trigger visual generation (I2V / T2V).
 */
export async function approveVoiceoverBatch(batchId, actor) {
  const tenantId = getActiveTenantId();
  return await withPgTransaction(async (client) => {
    const batchRes = await client.query('SELECT * FROM youtube_production_batches WHERE id = $1 AND tenant_id = $2', [batchId, tenantId]);
    const batch = batchRes.rows[0];
    if (!batch) throw new Error('Voiceover batch not found');

    await client.query(`
      UPDATE youtube_production_batches
      SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [actor?.username || 'system', batchId]);

    // Create visual_video batch
    const videoBatchId = `ytpb_vv_${Math.random().toString(36).slice(2, 10)}`;
    await client.query(`
      INSERT INTO youtube_production_batches (id, tenant_id, production_package_id, batch_type, status, created_by)
      VALUES ($1, $2, $3, 'visual_video', 'approved', $4)
    `, [videoBatchId, tenantId, batch.production_package_id, actor?.username || 'system']);

    // Fetch all visual assets (including t2i_i2v and t2v)
    const visAssetsRes = await client.query(`
      SELECT * FROM youtube_production_assets
      WHERE production_package_id = $1 AND asset_type = 'generated_visual'
    `, [batch.production_package_id]);
    const visAssets = visAssetsRes.rows;

    if (visAssets.length > 0) {
      const assetIds = visAssets.map(a => a.id);
      const placeholders = assetIds.map((_, i) => `$${i + 3}`).join(', ');
      await client.query(`
        UPDATE youtube_production_assets
        SET batch_id = $1, status = 'queued', updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = $2 AND id IN (${placeholders})
      `, [videoBatchId, tenantId, ...assetIds]);

      // Enqueue visual video generator jobs (text_to_video or image_to_video)
      for (const asset of visAssets) {
        const jobId = `ytpj_vis_${Math.random().toString(36).slice(2, 10)}`;
        const idempotencyKey = `idemp_vis_job_${asset.id}_v1`;

        await client.query(`
          INSERT INTO youtube_production_jobs (id, tenant_id, production_package_id, asset_id, job_kind, idempotency_key, status)
          VALUES ($1, $2, $3, $4, 'visual', $5, 'queued')
        `, [jobId, tenantId, batch.production_package_id, asset.id, idempotencyKey]);

        await client.query(`
          INSERT INTO scheduler_jobs (queue_name, payload) 
          VALUES ($1, $2)
        `, ['youtube_production_asset', JSON.stringify({ job_id: jobId, tenant_id: tenantId })]);
      }
    }

    return { approved: true, video_batch_id: videoBatchId };
  });
}

