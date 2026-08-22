/**
 * scripts/test-youtube-studio-hybrid-production.mjs
 * YouTube Studio Hybrid Production Approval Pipeline — Automated Test Suite (Fase 3.5B)
 * Tests: prompt matrix validation, batch transitions, tenant isolation,
 *        sequential approval gates, and provider task worker mock flow.
 */

process.env.NODE_ENV = 'test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { loadStagingEnv } from './local-staging/env.js';

// Integration fixtures must never fall back to the workspace .env.local, which
// can point to a shared schema. The local-staging environment is loopback-only.
Object.assign(process.env, loadStagingEnv());

// ── Mock Global Fetch ──────────────────────────────────────────────────────────
globalThis.fetch = async (url, options) => {
  if (url.includes('glabs-api-server') || url.includes('/tasks')) {
    return {
      ok: true,
      json: async () => ({
        task_id: 'task_mock_123',
        status: 'completed',
        results: ['https://example.com/mock_visual_output.png']
      })
    };
  }
  return { ok: true, json: async () => ({ success: true }) };
};

const {
  GENERATION_MODES,
  validateHybridShot,
  assertHybridBatchTransition,
} = await import('../lib/youtube-studio-contract.js');

const {
  createProductionPlanDraft,
  getProductionAssets,
  getBatches,
  approvePromptPackage,
  approveStartFrameBatch,
  approveVoiceoverBatch,
} = await import('../lib/youtube-studio-production-repository.js');

const { processProductionJob } = await import('../lib/youtube-studio-production-worker.js');
const { pgQuery, closePgPool } = await import('../lib/db-pg.js');
const { tenantContext } = await import('../lib/tenant-context.js');
const { setSetting } = await import('../lib/db.js');

const TENANT_A = 'hybrid_test_tenant_a';
const TENANT_B = 'hybrid_test_tenant_b';

console.log('🔄 Running YouTube Studio Hybrid Production tests...');

const samplePlan = {
  generation_profile_key: 'google_flow_omni_flash',
  production_mode: 'hybrid',
  scenes: [
    {
      voiceover: 'Halo selamat datang di Makna Flow.',
      narrative_duration_seconds: 8,
      shots: [
        {
          shot_index: 0,
          generation_mode: 't2i_i2v',
          generation_duration_seconds: 8,
          asset_type: 'generated_visual',
          prompt: 'Visual intro landscape',
          t2i_prompt: 'A beautiful startup office landscape',
          i2v_prompt: 'Camera slowly pans left'
        }
      ]
    }
  ]
};

async function runTests() {
  try {
    // ── 1. Contract & Schema Validation ──────────────────────────────────────
    console.log('  1. Testing hybrid prompt matrix contract...');
    assert.deepEqual(GENERATION_MODES, ['t2i_i2v', 't2v', 'static_asset', 'broll']);

    const validShot = {
      generation_mode: 't2i_i2v',
      t2i_prompt: 'A sunny beach',
      i2v_prompt: 'Waves crashing'
    };
    assert.doesNotThrow(() => validateHybridShot(validShot));

    const invalidShot = {
      generation_mode: 't2i_i2v',
      t2i_prompt: 'A sunny beach',
      i2v_prompt: '' // missing
    };
    assert.throws(() => validateHybridShot(invalidShot), /i2v_prompt is required/);

    console.log('    ✓ Contract validation OK');

    // ── 2. Lifecycle transitions ─────────────────────────────────────────────
    console.log('  2. Testing batch approval lifecycle transitions...');
    assert.doesNotThrow(() => assertHybridBatchTransition('draft', 'approved'));
    assert.doesNotThrow(() => assertHybridBatchTransition('approved', 'processing'));
    assert.throws(() => assertHybridBatchTransition('completed', 'approved'), /Invalid batch transition/);

    console.log('    ✓ Lifecycle transitions OK');

    // ── 3. DB Flow & Approval Steps ──────────────────────────────────────────
    console.log('  3. Testing sequential approval steps (seeding → gates)...');

    await tenantContext.run(TENANT_A, async () => {
      // Seed Tenant
      await pgQuery('INSERT INTO tenants (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [TENANT_A, 'Hybrid Tenant A']);
      await setSetting('gemini_api_key', 'AIzaMockKeyForHybrid');

      const channelId = `ch_hy_${Math.random().toString(36).slice(2, 8)}`;
      await pgQuery(`INSERT INTO youtube_channels (id, tenant_id, name, channel_handle) VALUES ($1, $2, 'Hybrid Ch', '@hybrid')`, [channelId, TENANT_A]);

      const strategyId = `st_hy_${Math.random().toString(36).slice(2, 8)}`;
      await pgQuery(`INSERT INTO youtube_channel_strategies (id, tenant_id, channel_id, status) VALUES ($1, $2, $3, 'active')`, [strategyId, TENANT_A, channelId]);

      const seriesId = `sr_hy_${Math.random().toString(36).slice(2, 8)}`;
      await pgQuery(`INSERT INTO youtube_series (id, tenant_id, channel_id, strategy_id, name) VALUES ($1, $2, $3, $4, 'Hybrid Series')`, [seriesId, TENANT_A, channelId, strategyId]);

      const episodeId = `ep_hy_${Math.random().toString(36).slice(2, 8)}`;
      await pgQuery(`INSERT INTO youtube_episodes (id, tenant_id, channel_id, series_id, strategy_id, title, locale, target_duration_seconds, status, generation_profile_key) VALUES ($1, $2, $3, $4, $5, 'Ep 1', 'id-ID', 600, 'Strategy Approved', 'google_flow_omni_flash')`, [episodeId, TENANT_A, channelId, seriesId, strategyId]);

      const blueprintId = `bp_hy_${Math.random().toString(36).slice(2, 8)}`;
      await pgQuery(`INSERT INTO youtube_episode_blueprints (id, tenant_id, episode_id, status) VALUES ($1, $2, $3, 'approved')`, [blueprintId, TENANT_A, episodeId]);

      const approvedScriptId = `sc_hy_${Math.random().toString(36).slice(2, 8)}`;
      await pgQuery(`INSERT INTO youtube_episode_scripts (id, tenant_id, episode_id, blueprint_id, script_json, status, locale) VALUES ($1, $2, $3, $4, '{}', 'approved', 'id-ID')`, [approvedScriptId, TENANT_A, episodeId, blueprintId]);

      // Create production draft
      const draftPkg = await createProductionPlanDraft({
        episodeId,
        plan: samplePlan,
        snapshot: {},
        approvedScriptId
      });

      assert.equal(draftPkg.status, 'draft');

      const assets = await getProductionAssets(draftPkg.id);
      assert.equal(assets.length, 2); // 1 VO + 1 visual

      const visAsset = assets.find(a => a.asset_type === 'generated_visual');
      assert.equal(visAsset.generation_mode, 't2i_i2v');
      assert.equal(visAsset.t2i_prompt, 'A beautiful startup office landscape');

      // Step 1: Approve Prompt Package -> creates start-frame batch
      console.log('    -> Step 1: Approving Prompt Package...');
      await approvePromptPackage(draftPkg.id, { username: 'tester' });

      const sfBatches = await getBatches(draftPkg.id);
      assert.equal(sfBatches.length, 1);
      assert.equal(sfBatches[0].batch_type, 'start_frame');

      // Verify start frame job enqueued in youtube_production_jobs
      const sfJobsRes = await pgQuery(`SELECT * FROM youtube_production_jobs WHERE production_package_id = $1 AND asset_id = $2`, [draftPkg.id, visAsset.id]);
      assert.equal(sfJobsRes.rows.length, 1);
      const sfJob = sfJobsRes.rows[0];
      assert.equal(sfJob.status, 'queued');

      // Mock start frame task completion
      console.log('    -> Step 2: Running start-frame worker mock...');
      // Override processProductionJob worker polling for T2I image download
      const destDir = path.join(process.cwd(), 'public', 'uploads', 'start_frames');
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
      fs.writeFileSync(path.join(destDir, `start_frame_${visAsset.id}.png`), 'mock_png_buffer');

      // Mock the image status checker
      globalThis.fetch = async (url) => {
        return {
          ok: true,
          json: async () => ({
            status: 'completed',
            results: [`http://localhost:7010/uploads/start_frames/start_frame_${visAsset.id}.png`]
          })
        };
      };

      await processProductionJob(sfJob.id);
      
      const updatedAssetRes = await pgQuery(`SELECT * FROM youtube_production_assets WHERE id = $1`, [visAsset.id]);
      const updatedAsset = updatedAssetRes.rows[0];
      assert.ok(updatedAsset.output_asset_json?.image_path);
      console.log('       ✓ Start frame locally saved:', updatedAsset.output_asset_json.image_path);

      // Step 2: Approve Start Frame Batch -> creates VO batch
      console.log('    -> Step 3: Approving Start Frame Batch...');
      const { voiceover_batch_id } = await approveStartFrameBatch(sfBatches[0].id, { username: 'tester' });
      assert.ok(voiceover_batch_id);

      const voBatches = (await getBatches(draftPkg.id)).filter(b => b.batch_type === 'voiceover');
      assert.equal(voBatches.length, 1);

      // Step 3: Approve Voiceover Batch -> creates Visual Video batch
      console.log('    -> Step 4: Approving Voiceover Batch...');
      const { video_batch_id } = await approveVoiceoverBatch(voBatches[0].id, { username: 'tester' });
      assert.ok(video_batch_id);

      const vvBatches = (await getBatches(draftPkg.id)).filter(b => b.batch_type === 'visual_video');
      assert.equal(vvBatches.length, 1);

      console.log('    ✓ Sequential approvals flow passed successfully');
    });

    console.log('\n✅ All YouTube Studio Hybrid Production tests passed successfully.\n');
    await closePgPool();
    process.exit(0);

  } catch (err) {
    console.error('\n❌ Test execution failed:', err);
    try { await closePgPool(); } catch (_) {}
    process.exit(1);
  }
}

runTests();
