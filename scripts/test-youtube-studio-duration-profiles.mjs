import assert from 'node:assert/strict';
import { loadStagingEnv } from './local-staging/env.js';

Object.assign(process.env, loadStagingEnv());

import { 
  resolveEpisodeDuration, 
  normalizeTargetDuration, 
  validateGeneratedShotDuration, 
  validateProductionShotPlan 
} from '../lib/youtube-studio-contract.js';
import { 
  listPublicGenerationProfiles, 
  getGenerationProfile 
} from '../lib/youtube-studio-generation-profiles.js';
import { 
  createChannel, 
  createOrUpdateStrategyDraft, 
  activateStrategy,
  createSeries,
  createPlannedEpisode,
  adoptEpisodeIdea,
  updateEpisodeDuration,
  setEpisodeGenerationProfile,
  getEpisode
} from '../lib/youtube-studio-repository.js';
import { closePgPool, pgQuery } from '../lib/db-pg.js';
import { tenantContext } from '../lib/tenant-context.js';
import { setSetting } from '../lib/db.js';

console.log('🔄 Running YouTube Studio Phase 2.5 Duration & Profiles automated tests...');

async function runTests() {
  try {
    // 1. Test target duration bounds normalization
    console.log('  1. Testing normalizeTargetDuration boundaries...');
    assert.equal(normalizeTargetDuration(30), 60); // min bounded to 60s
    assert.equal(normalizeTargetDuration(4000), 3600); // max bounded to 3600s
    assert.equal(normalizeTargetDuration(600), 600);
    assert.equal(normalizeTargetDuration('invalid'), 600); // fallback

    // 2. Test resolveEpisodeDuration hierarchy resolver
    console.log('  2. Testing resolveEpisodeDuration hierarchy resolver...');
    const mockStrategy = { config_json: { video_format: { default_target_duration_seconds: 480 } } };
    const mockSeriesInherit = { config_json: { duration_mode: 'inherit' } };
    const mockSeriesOverride = { config_json: { duration_mode: 'override', target_duration_seconds: 900 } };
    
    // Fallback case
    assert.deepEqual(resolveEpisodeDuration({}), { target_duration_seconds: 600, duration_source: 'channel' });
    
    // Inherit from Channel Strategy
    assert.deepEqual(
      resolveEpisodeDuration({ channelStrategy: mockStrategy }), 
      { target_duration_seconds: 480, duration_source: 'channel' }
    );
    
    // Series inherit
    assert.deepEqual(
      resolveEpisodeDuration({ channelStrategy: mockStrategy, series: mockSeriesInherit }), 
      { target_duration_seconds: 480, duration_source: 'channel' }
    );
    
    // Series override
    assert.deepEqual(
      resolveEpisodeDuration({ channelStrategy: mockStrategy, series: mockSeriesOverride }), 
      { target_duration_seconds: 900, duration_source: 'series' }
    );
    
    // Episode override (highest priority)
    assert.deepEqual(
      resolveEpisodeDuration({ channelStrategy: mockStrategy, series: mockSeriesOverride, episodeOverride: 1200 }), 
      { target_duration_seconds: 1200, duration_source: 'episode' }
    );

    // 3. Test Generation Profiles registry
    console.log('  3. Testing generation profile metadata capability...');
    const profiles = listPublicGenerationProfiles();
    assert(profiles.length >= 2);
    
    const omni = getGenerationProfile('google_flow_omni_flash');
    assert.equal(omni.provider, 'google_flow');
    assert.deepEqual(omni.generatedShotDurations, [4, 6, 8, 10]);

    const veo = getGenerationProfile('google_flow_veo_3_1_lite');
    assert.deepEqual(veo.generatedShotDurations, [8]);

    // 4. Test visual shot duration validator bounds
    console.log('  4. Testing visual shot duration bounds validation...');
    assert.equal(validateGeneratedShotDuration({ asset_type: 'broll', generation_duration_seconds: 15 }, omni), true); // non-generated ignored
    assert.equal(validateGeneratedShotDuration({ asset_type: 'generated_visual', generation_duration_seconds: 8 }, omni), true);
    
    assert.throws(() => {
      validateGeneratedShotDuration({ asset_type: 'generated_visual', generation_duration_seconds: 7 }, omni);
    }, /not supported by profile/);

    assert.throws(() => {
      validateGeneratedShotDuration({ asset_type: 'generated_visual', generation_duration_seconds: 4 }, veo);
    }, /not supported by profile/);

    // 5. Test production shot plan scene coverage
    console.log('  5. Testing production shot plan timing coverage...');
    const mockScene = {
      narrative_duration_seconds: 20,
      shots: [
        { asset_type: 'generated_visual', generation_duration_seconds: 10 },
        { asset_type: 'generated_visual', generation_duration_seconds: 10 }
      ]
    };
    assert.equal(validateProductionShotPlan(mockScene, omni), true);

    const mockSceneMismatch = {
      narrative_duration_seconds: 25,
      shots: [
        { asset_type: 'generated_visual', generation_duration_seconds: 10 },
        { asset_type: 'generated_visual', generation_duration_seconds: 10 }
      ]
    };
    assert.throws(() => {
      validateProductionShotPlan(mockSceneMismatch, omni);
    }, /does not match narrative scene duration/);

    // 6. DB Integration Tests inside Tenant Context
    console.log('  6. Performing active DB repository transactional testing...');
    await tenantContext.run('test_tenant_d', async () => {
      // Seed tenant settings with dummy key
      await pgQuery(`
        INSERT INTO tenants (id, name)
        VALUES ($1, $2)
        ON CONFLICT (id) DO NOTHING
      `, ['test_tenant_d', 'Test Tenant D']);
      await setSetting('gemini_api_key', 'AIzaSyBLBzhB27BQA8ura8zeX0BGlY9eb7m08Y4');

      // Create channel, strategy, series, planned episodes
      const channel = await createChannel({ name: 'Duration Test Channel', primary_locale: 'id-ID' }, { username: 'test_user' });
      
      const strategyBrief = { 
        niche: 'Cooking', 
        audience: 'Home cooks', 
        geography: 'Indonesia', 
        objective: 'AdSense',
        default_target_duration_seconds: 480 // 8 minutes
      };
      const strategyDraft = await createOrUpdateStrategyDraft(channel.id, {
        brief: strategyBrief,
        config: {
          positioning: 'Simple home recipes',
          audience_persona: { who: 'Home cooks', need: 'Quick recipes', geography: 'ID' },
          editorial_tone: 'Friendly',
          video_format: { default_target_duration_seconds: 480, cadence: 'weekly' },
          content_pillars: [{ name: 'Recipes', purpose: 'Cooking', example_angles: ['3 min egg'] }],
          monetization_path: ['adsense'],
          cta_strategy: 'Subscribe',
          risk_guardrails: ['No raw food']
        }
      }, { username: 'test_user' });

      await activateStrategy(channel.id, strategyDraft.id, { username: 'test_user' });

      // Create series with duration override to 12 minutes (720s)
      const series = await createSeries({
        channel_id: channel.id,
        name: 'Gourmet series',
        pillar: 'Recipes',
        config: {
          duration_mode: 'override',
          target_duration_seconds: 720
        }
      });

      // Rencana episode 1: inherit durasi series (720s)
      const ep1 = await createPlannedEpisode({
        channelId: channel.id,
        seriesId: series.id,
        title: 'Gourmet Steak 101',
        locale: 'id-ID'
      }, { username: 'test_user' });

      assert.equal(ep1.target_duration_seconds, 720);
      assert.equal(ep1.duration_source, 'series');

      // Rencana episode 2: override durasi episode ke 5 menit (300s)
      const ep2 = await createPlannedEpisode({
        channelId: channel.id,
        seriesId: series.id,
        title: 'Quick Salad',
        locale: 'id-ID',
        targetDurationOverride: 300
      }, { username: 'test_user' });

      assert.equal(ep2.target_duration_seconds, 300);
      assert.equal(ep2.duration_source, 'episode');

      // Rencana episode 3: test updateEpisodeDuration override sebelum research dimulai
      const ep3 = await updateEpisodeDuration(ep1.id, 900, { username: 'test_user' });
      assert.equal(ep3.target_duration_seconds, 900);
      assert.equal(ep3.duration_source, 'episode');

      // Test select generation profile: should fail since status is 'Planned' not 'Script Approved'
      await assert.rejects(async () => {
        await setEpisodeGenerationProfile(ep1.id, 'google_flow_omni_flash', { username: 'test_user' });
      }, /can only be selected after the script is approved/);

      // Transition episode status to Script Approved manually to test profile selector
      await pgQuery(`
        UPDATE youtube_episodes SET status = 'Script Approved' WHERE id = $1
      `, [ep1.id]);

      const ep1Approved = await setEpisodeGenerationProfile(ep1.id, 'google_flow_omni_flash', { username: 'test_user' });
      assert.equal(ep1Approved.generation_profile_key, 'google_flow_omni_flash');

      const reloadedEp1 = await getEpisode(ep1.id);
      assert.equal(reloadedEp1.generation_profile_key, 'google_flow_omni_flash');
    });

    console.log('✅ All Phase 2.5 duration & capability profile tests passed successfully!');
  } catch (err) {
    console.error('❌ Tests failed:', err);
    process.exit(1);
  } finally {
    await closePgPool();
  }
}

runTests();
