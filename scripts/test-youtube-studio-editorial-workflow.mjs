import assert from 'node:assert/strict';
import { loadStagingEnv } from './local-staging/env.js';

Object.assign(process.env, loadStagingEnv());

import { 
  createChannel,
  createOrUpdateStrategyDraft,
  activateStrategy,
  createSeries,
  adoptEpisodeIdea,
  createPlannedEpisode,
  getChannelStrategy,
  listEpisodeIdeas
} from '../lib/youtube-studio-repository.js';
import { normalizeLocale, assertEpisodeTransition } from '../lib/youtube-studio-contract.js';
import { tenantContext } from '../lib/tenant-context.js';
import { closePgPool, pgQuery } from '../lib/db-pg.js';

console.log('🔄 Running YouTube Studio Phase 1 Editorial Workflow automated tests...');

async function runTests() {
  await tenantContext.run('test_tenant_b', async () => {
    // 1. Locale Canonicalisation
    console.log('  1. Testing BCP-47 Locale Canonicalisation...');
    assert.equal(normalizeLocale('id_ID'), 'id-ID');
    assert.equal(normalizeLocale('en_US'), 'en-US');
    assert.equal(normalizeLocale(''), 'id-ID');

    // 2. Channel Creation
    console.log('  2. Testing Channel creation...');
    const channel = await createChannel({ name: 'Editorial Channel', primary_locale: 'id_ID' }, { username: 'test_user' });
    assert.equal(channel.name, 'Editorial Channel');
    assert.equal(channel.primary_locale, 'id-ID'); // should be canonicalised or saved

    // 3. Strategy Draft updates
    console.log('  3. Testing Strategy Draft update...');
    const mockBrief = { niche: 'Gadget Review', audience: 'Tech enthusiasts', geography: 'Indonesia', objective: 'AdSense' };
    const mockConfig = { positioning: 'Gadget reviews', audience_persona: { who: 'Tech fans' }, content_pillars: [{ name: 'Reviews' }], editorial_tone: 'Casual', video_format: { target_duration_seconds: 600 } };
    
    const draft = await createOrUpdateStrategyDraft(channel.id, { brief: mockBrief, config: mockConfig }, { username: 'test_user' });
    assert.equal(draft.status, 'draft');

    // 4. Series creation fails without active strategy
    console.log('  4. Testing Series creation rejection without active strategy...');
    await assert.rejects(
      async () => await createSeries({ channel_id: channel.id, name: 'Tech Pillar' }, { username: 'test_user' }),
      /Cannot create series: channel has no active strategy/
    );

    // 5. Strategy Activation
    console.log('  5. Testing Strategy Activation...');
    const active = await activateStrategy(channel.id, draft.id, { username: 'test_user' });
    assert.equal(active.status, 'active');

    // Double activate/duplicate active check
    const draft2 = await createOrUpdateStrategyDraft(channel.id, { brief: mockBrief, config: mockConfig }, { username: 'test_user' });
    const active2 = await activateStrategy(channel.id, draft2.id, { username: 'test_user' });
    
    const countActive = await pgQuery('SELECT COUNT(*) FROM youtube_channel_strategies WHERE channel_id = $1 AND status = \'active\'', [channel.id]);
    assert.equal(countActive.rows[0].count, '1');

    // 6. Series creation succeeded now
    console.log('  6. Testing Series creation with active strategy...');
    const series = await createSeries({ channel_id: channel.id, name: 'Tech Reviews' }, { username: 'test_user' });
    assert.equal(series.name, 'Tech Reviews');

    // 7. Episode Idea Backlog adopt/reject Happy path
    console.log('  7. Testing Episode Idea backlog adoption...');
    const ideaId = `test_idea_${Date.now()}`;
    await pgQuery(`
      INSERT INTO youtube_episode_ideas (id, tenant_id, channel_id, series_id, strategy_id, locale, title, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'suggested')
    `, [ideaId, 'test_tenant_b', channel.id, series.id, active2.id, 'id-ID', 'Idea Title']);

    // Adopt idea
    const epAdopted = await adoptEpisodeIdea(ideaId, { username: 'test_user' });
    assert.equal(epAdopted.status, 'Planned');
    assert.equal(epAdopted.source_idea_id, ideaId);

    // Idempotency: second adopt returns the same episode and does not duplicate
    const epAdopted2 = await adoptEpisodeIdea(ideaId, { username: 'test_user' });
    assert.equal(epAdopted2.id, epAdopted.id);

    // 8. Manual Episode Creation
    console.log('  8. Testing Manual Episode creation under active strategy...');
    const manualEp = await createPlannedEpisode({
      channelId: channel.id,
      seriesId: series.id,
      title: 'Manual Title',
      locale: 'id-ID'
    }, { username: 'test_user' });
    assert.equal(manualEp.status, 'Planned');
    assert.equal(manualEp.strategy_id, active2.id); // server-resolved

    console.log('  ✅ YouTube Studio Editorial Workflow tests completed successfully.');
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
