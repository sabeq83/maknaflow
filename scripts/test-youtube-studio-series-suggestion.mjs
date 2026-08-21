import assert from 'node:assert/strict';
import { loadStagingEnv } from './local-staging/env.js';

Object.assign(process.env, loadStagingEnv());

import { 
  createChannel,
  createOrUpdateStrategyDraft,
  activateStrategy
} from '../lib/youtube-studio-repository.js';
import { generateSeriesConcepts } from '../lib/youtube-studio-planner.js';
import { validateSeriesConcept } from '../lib/youtube-studio-contract.js';
import { tenantContext } from '../lib/tenant-context.js';
import { closePgPool, pgQuery } from '../lib/db-pg.js';
import { setSetting } from '../lib/db.js';

console.log('🔄 Running YouTube Studio Step 3 AI Series Suggestion automated tests...');

async function runTests() {
  await tenantContext.run('test_tenant_d', async () => {
    // 1. Contract Validation
    console.log('  1. Testing Series Concept validator contracts...');
    await assert.rejects(
      async () => validateSeriesConcept(null),
      /Konsep series kosong/
    );
    await assert.rejects(
      async () => validateSeriesConcept({ name: '' }),
      /Nama konsep series wajib diisi/
    );
    await assert.rejects(
      async () => validateSeriesConcept({ name: 'Series A', pillar: '' }),
      /Mapping pillar konsep series wajib diisi/
    );
    await assert.rejects(
      async () => validateSeriesConcept({ name: 'Series A', pillar: 'React', description: '' }),
      /Deskripsi konsep series wajib diisi/
    );

    const validConcept = {
      name: 'Advanced React Hooks',
      pillar: 'React Development',
      description: 'Deep dive tutorials into custom hook design patterns.',
      concept_angle: 'Real world examples only'
    };
    const validated = validateSeriesConcept(validConcept);
    assert.equal(validated.name, 'Advanced React Hooks');

    // 2. Setup Channel Strategy context
    console.log('  2. Setup active channel strategy...');
    // Seed tenant and Gemini API key into tenant settings for test_tenant_d
    await pgQuery(`
      INSERT INTO tenants (id, name)
      VALUES ($1, $2)
      ON CONFLICT (id) DO NOTHING
    `, ['test_tenant_d', 'Test Tenant D']);

    const apiKeyRes = await pgQuery(`
      SELECT setting_value FROM tenant_settings 
      WHERE setting_key = 'gemini_api_key' AND setting_value IS NOT NULL AND setting_value != '' 
      LIMIT 1
    `);
    const resolvedApiKey = apiKeyRes.rows[0]?.setting_value || process.env.GEMINI_API_KEY || 'AIzaSyBLBzhB27BQA8ura8zeX0BGlY9eb7m08Y4';
    if (!resolvedApiKey) {
      throw new Error('Gemini API key is not configured in DB settings or env.');
    }

    await setSetting('gemini_api_key', resolvedApiKey);

    const channel = await createChannel({ name: 'Series Generator Channel', primary_locale: 'id-ID' }, { username: 'test_user' });
    const mockBrief = { niche: 'React', audience: 'Developers', geography: 'Global', objective: 'Leads' };
    const mockConfig = { positioning: 'NextJS Tutorials', audience_persona: { who: 'Coders' }, content_pillars: [{ name: 'React Development' }], editorial_tone: 'Casual', video_format: { target_duration_seconds: 600 } };
    
    const draft = await createOrUpdateStrategyDraft(channel.id, { brief: mockBrief, config: mockConfig }, { username: 'test_user' });
    const strategy = await activateStrategy(channel.id, draft.id, { username: 'test_user' });

    // 3. Test Generator Execution
    console.log('  3. Testing Gemini generateSeriesConcepts call...');
    const suggestions = await generateSeriesConcepts(channel, strategy);
    assert.ok(Array.isArray(suggestions));
    assert.equal(suggestions.length, 3); // prompt specifies exactly 3 concepts
    suggestions.forEach(concept => {
      assert.ok(concept.name);
      assert.equal(concept.pillar, 'React Development'); // must map to the strategy pillars
      assert.ok(concept.description);
    });

    console.log('  ✅ YouTube Studio Step 3 AI Series Suggestion tests completed successfully!');
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
