import assert from 'node:assert/strict';
import { loadStagingEnv } from './local-staging/env.js';

Object.assign(process.env, loadStagingEnv());

import { 
  listChannels, 
  createChannel, 
  createSeries, 
  createEpisode, 
  getEpisode, 
  approveScript, 
  getLatestScript 
} from '../lib/youtube-studio-repository.js';
import { assertEpisodeTransition, EPISODE_STATES } from '../lib/youtube-studio-contract.js';
import { tenantContext } from '../lib/tenant-context.js';
import { closePgPool, pgQuery } from '../lib/db-pg.js';

console.log('🔄 Running YouTube Studio MVP automated tests...');

async function runTests() {
  await tenantContext.run('test_tenant_a', async () => {
    // 1. Channel CRUD
    console.log('  1. Testing Channel creation...');
    const channel = await createChannel({ name: 'Test Channel', primary_locale: 'en-US' }, { username: 'test_user' });
    assert.equal(channel.name, 'Test Channel');
    assert.equal(channel.primary_locale, 'en-US');

    // 2. Strategy details
    console.log('  2. Testing Strategy creation...');
    const { updateChannelStrategy, getChannelStrategy } = await import('../lib/youtube-studio-repository.js');
    const strategy = await updateChannelStrategy(channel.id, { config: { niche: 'Education' } }, { username: 'test_user' });
    assert.equal(strategy.config_json.niche, 'Education');

    // 3. Series & Episode CRUD
    console.log('  3. Testing Series & Episodes...');
    const series = await createSeries({ channel_id: channel.id, strategy_id: strategy.id, name: 'Series 1', pillar: 'AI' }, { username: 'test_user' });
    assert.equal(series.name, 'Series 1');

    const episode = await createEpisode({ channel_id: channel.id, series_id: series.id, strategy_id: strategy.id, title: 'Episode 1', locale: 'en-US' }, { username: 'test_user' });
    assert.equal(episode.title, 'Episode 1');
    assert.equal(episode.status, 'Idea');

    // 4. Assert State Transition
    console.log('  4. Testing state transition constraints...');
    assertEpisodeTransition('Idea', 'Planned');
    assert.throws(() => assertEpisodeTransition('Idea', 'In Production'), /State transition illegal/);

    // 5. Test blueprint/script generation mocking
    console.log('  5. Testing script generation and approval...');
    const blueprintId = `test_bp_${Date.now()}`;
    await pgQuery('INSERT INTO youtube_episode_blueprints (id, episode_id, tenant_id) VALUES ($1, $2, $3)', [blueprintId, episode.id, 'test_tenant_a']);
    
    const scriptId = `test_sc_${Date.now()}`;
    await pgQuery('INSERT INTO youtube_episode_scripts (id, episode_id, blueprint_id, locale, tenant_id, status) VALUES ($1, $2, $3, $4, $5, $6)', [scriptId, episode.id, blueprintId, 'en-US', 'test_tenant_a', 'draft']);

    const approved = await approveScript(scriptId, { username: 'test_user' });
    assert.equal(approved.status, 'approved');

    const updatedEp = await getEpisode(episode.id);
    assert.equal(updatedEp.status, EPISODE_STATES.SCRIPT_APPROVED);

    console.log('  ✅ YouTube Studio automated integration tests completed successfully.');
  });
}

runTests()
  .catch(err => {
    console.error('❌ Tests failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await closePgPool();
    process.exit(0);
  });
