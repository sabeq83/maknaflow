import assert from 'node:assert/strict';
import { loadStagingEnv } from './local-staging/env.js';

Object.assign(process.env, loadStagingEnv());

// Mock Fetch API for offline testing
globalThis.fetch = async (url, options) => {
  if (url.includes('generativelanguage.googleapis.com')) {
    const body = options?.body ? JSON.parse(options.body) : {};
    const textPrompt = body.contents?.[0]?.parts?.[0]?.text || '';
    
    if (url.includes('generateContent') && url.includes('tts')) {
      // Mock Gemini TTS content
      return {
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                inlineData: {
                  data: Buffer.from('mock_linear_pcm_voiceover_data_content_bytes').toString('base64')
                }
              }]
            }
          }]
        })
      };
    } else {
      // Mock AI Production Plan json output
      const mockPlan = {
        generation_profile_key: 'google_flow_omni_flash',
        estimated_total_duration_seconds: 600,
        scenes: [
          {
            scene_index: 0,
            narrative_duration_seconds: 16,
            voiceover: "Halo sahabat Makna Flow.",
            shots: [
              {
                shot_index: 0,
                asset_type: "generated_visual",
                generation_duration_seconds: 8,
                prompt: "Cinematic visual intro prompt",
                transition_to_next: "cut"
              },
              {
                shot_index: 1,
                asset_type: "generated_visual",
                generation_duration_seconds: 8,
                prompt: "Visual transition shot prompt",
                transition_to_next: "cut"
              }
            ],
            audio_cue: "calm pad"
          }
        ]
      };
      return {
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify(mockPlan)
              }]
            }
          }]
        })
      };
    }
  }

  // G-Labs mock endpoints
  if (url.includes(':8765/api/')) {
    if (url.includes('/api/video/generate')) {
      return {
        ok: true,
        json: async () => ({ task_id: 'mock_glabs_task_999', status: 'pending' })
      };
    }
    if (url.includes('/api/status/')) {
      return {
        ok: true,
        json: async () => ({ status: 'succeeded' })
      };
    }
    if (url.includes('/api/result/')) {
      return {
        ok: true,
        json: async () => ({ results: ['templates/placeholder_16_9.mp4'] })
      };
    }
  }

  return {
    ok: true,
    json: async () => ({ success: true })
  };
};

import { validateProductionPlan } from '../lib/youtube-studio-contract.js';
import { getGenerationProfile } from '../lib/youtube-studio-generation-profiles.js';
import { generateProductionPlan } from '../lib/youtube-studio-production-planner.js';
import { 
  createProductionPlanDraft, 
  approveProductionPlan,
  getProductionPackageByEpisode, 
  getProductionAssets,
  invalidateShotAndAssemblies
} from '../lib/youtube-studio-production-repository.js';
import { processProductionJob } from '../lib/youtube-studio-production-worker.js';
import { pgQuery, closePgPool } from '../lib/db-pg.js';
import { tenantContext } from '../lib/tenant-context.js';
import { setSetting } from '../lib/db.js';

console.log('🔄 Running YouTube Studio Phase 3 Production Factory tests...');

async function runTests() {
  try {
    // 1. Test validateProductionPlan constraints
    console.log('  1. Testing validateProductionPlan bounds...');
    const profile = getGenerationProfile('google_flow_omni_flash');
    const validPlan = {
      generation_profile_key: 'google_flow_omni_flash',
      estimated_total_duration_seconds: 600,
      scenes: [
        {
          scene_index: 0,
          narrative_duration_seconds: 16,
          voiceover: "A",
          shots: [
            { shot_index: 0, asset_type: 'generated_visual', generation_duration_seconds: 8, prompt: 'A' },
            { shot_index: 1, asset_type: 'generated_visual', generation_duration_seconds: 8, prompt: 'B' }
          ]
        }
      ]
    };

    assert.ok(validateProductionPlan(validPlan, { profile, episodeDuration: 600 }));

    // 2. Mock Test Database Operations
    console.log('  2. Testing Database flow under tenant context...');
    await tenantContext.run('test_tenant_p3', async () => {
      await pgQuery(`
        INSERT INTO tenants (id, name)
        VALUES ($1, $2)
        ON CONFLICT (id) DO NOTHING
      `, ['test_tenant_p3', 'Test Tenant P3']);
      await setSetting('gemini_api_key', 'AIzaMockKeyForGeminiStudioTestRuns');
      // Setup test channel & episode
      const channelId = `ch_test_${Math.random().toString(36).slice(2, 10)}`;
      await pgQuery(`
        INSERT INTO youtube_channels (id, tenant_id, name, channel_handle)
        VALUES ($1, 'test_tenant_p3', 'Test Channel', '@test')
      `, [channelId]);

      const strategyId = `st_test_${Math.random().toString(36).slice(2, 10)}`;
      await pgQuery(`
        INSERT INTO youtube_channel_strategies (id, tenant_id, channel_id, status)
        VALUES ($1, 'test_tenant_p3', $2, 'active')
      `, [strategyId, channelId]);

      const seriesId = `sr_test_${Math.random().toString(36).slice(2, 10)}`;
      await pgQuery(`
        INSERT INTO youtube_series (id, tenant_id, channel_id, strategy_id, name)
        VALUES ($1, 'test_tenant_p3', $2, $3, 'Test Series')
      `, [seriesId, channelId, strategyId]);

      const episodeId = `ep_test_${Math.random().toString(36).slice(2, 10)}`;
      await pgQuery(`
        INSERT INTO youtube_episodes (id, tenant_id, channel_id, series_id, strategy_id, title, locale, target_duration_seconds, status, generation_profile_key)
        VALUES ($1, 'test_tenant_p3', $2, $3, $4, 'Test Episode', 'id-ID', 600, 'Script Approved', 'google_flow_omni_flash')
      `, [episodeId, channelId, seriesId, strategyId]);

      const blueprintId = `bp_test_${Math.random().toString(36).slice(2, 10)}`;
      await pgQuery(`
        INSERT INTO youtube_episode_blueprints (id, tenant_id, episode_id, status)
        VALUES ($1, 'test_tenant_p3', $2, 'approved')
      `, [blueprintId, episodeId]);

      const scriptId = `sc_test_${Math.random().toString(36).slice(2, 10)}`;
      await pgQuery(`
        INSERT INTO youtube_episode_scripts (id, tenant_id, episode_id, blueprint_id, script_json, status, locale)
        VALUES ($1, 'test_tenant_p3', $2, $3, $4, 'approved', 'id-ID')
      `, [scriptId, episodeId, blueprintId, JSON.stringify({ scenes: [{ estimated_duration_seconds: 16, voiceover: 'Hello' }] })]);

      // Mock generateProductionPlan
      const plan = await generateProductionPlan({
        episode: { title: 'Test Episode', target_duration_seconds: 600 },
        script: { script_json: { scenes: [{ estimated_duration_seconds: 16, voiceover: 'Hello' }] } },
        profile,
        visualIdentity: null,
        universe: null
      });

      // Create draft
      const draft = await createProductionPlanDraft({
        episodeId,
        plan,
        snapshot: {},
        approvedScriptId: scriptId,
        actor: { username: 'test_user' }
      });

      assert.equal(draft.status, 'draft');

      const assets = await getProductionAssets(draft.id);
      assert.equal(assets.length, 3); // 1 voiceover + 2 visual shots

      // Approve plan (moves status to approved -> generating)
      const approvedPkg = await approveProductionPlan(draft.id, { username: 'test_user' });
      assert.ok(approvedPkg);

      // Verify jobs were queued
      const jobsRes = await pgQuery('SELECT * FROM youtube_production_jobs WHERE production_package_id = $1', [draft.id]);
      assert.equal(jobsRes.rows.length, 3);

      // Process voiceover job
      const voJob = jobsRes.rows.find(j => j.job_kind === 'voiceover');
      const voJobResult = await processProductionJob(voJob.id);
      assert.ok(voJobResult.success);

      // Verify asset update
      const updatedAssets = await getProductionAssets(draft.id);
      const voAsset = updatedAssets.find(a => a.id === voJob.asset_id);
      assert.equal(voAsset.status, 'succeeded');

      // Test Selective Invalidation (Regenerate single asset)
      console.log('  3. Testing selective shot revision / invalidation...');
      await invalidateShotAndAssemblies(voAsset.id, { username: 'test_user' });
      
      const invalidatedAssets = await getProductionAssets(draft.id);
      const reVoAsset = invalidatedAssets.find(a => a.id === voAsset.id);
      assert.equal(reVoAsset.status, 'queued'); // Reset back to queued

      console.log('✅ All YouTube Studio Phase 3 production tests passed successfully.');
    });

  } catch (err) {
    console.error('❌ Test execution failed:', err);
    process.exit(1);
  } finally {
    await closePgPool();
  }
}

runTests();
