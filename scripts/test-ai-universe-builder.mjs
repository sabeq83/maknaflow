import assert from 'node:assert/strict';
import {
  validateUniverseBrief,
  validateAndNormalizeUniverseDraft,
  UniverseAiValidationError,
  slugify,
  keyify
} from '../lib/universe-ai-contract.js';

console.log('🔄 Running Contract unit tests...');

// 1. Slugify & Keyify tests
assert.equal(slugify('Warm Kitchen!'), 'warm-kitchen');
assert.equal(slugify('  A  B  C '), 'a-b-c');
assert.equal(keyify('Warm Kitchen!'), 'warm_kitchen');
assert.equal(keyify('  A  B  C '), 'a_b_c');
console.log('✅ slugify and keyify helper tests passed.');

// 2. Validate Universe Brief
// Valid animal brief
const validAnimalBrief = {
  name: 'PawVille Town',
  purpose: 'Marketing pet food',
  knowledge_domain: 'pet_supplies',
  universe_type: 'animal',
  target_audience: 'pet owners',
  tone: 'playful',
  visual_direction: 'claymation',
  character_count: 2,
  location_count: 2,
  content_pillars: ['tips', 'nutrition']
};

const normalizedAnimalBrief = validateUniverseBrief(validAnimalBrief);
assert.equal(normalizedAnimalBrief.name, 'PawVille Town');
assert.equal(normalizedAnimalBrief.character_count, 2);
assert.equal(normalizedAnimalBrief.location_count, 2);

// Invalid count rejection
try {
  validateUniverseBrief({ ...validAnimalBrief, character_count: 6 });
  assert.fail('Should fail on character count 6');
} catch (e) {
  assert(e instanceof UniverseAiValidationError);
}

// Invalid enum domain rejection
try {
  validateUniverseBrief({ ...validAnimalBrief, knowledge_domain: 'unknown_domain' });
  assert.fail('Should fail on unknown domain');
} catch (e) {
  assert(e instanceof UniverseAiValidationError);
}
console.log('✅ Brief validation tests passed.');

// 3. Draft validation
// Valid full animal draft
const validAnimalDraft = {
  profile: {
    name: 'PawVille Town',
    universe_type: 'animal',
    knowledge_domain: 'pet_supplies',
    premise: 'Pets talking',
    tone: 'playful',
    default_pillars_json: ['Pillar 1']
  },
  characters: [
    { name: 'Mochi', character_key: 'mochi', species: 'Cat', role: 'main_character', depiction_mode: 'normal', canonical_prompt: 'Claymation cat' },
    { name: 'Coco', character_key: 'coco', species: 'Dog', role: 'supporting', depiction_mode: 'normal', canonical_prompt: 'Claymation dog' }
  ],
  locations: [
    { name: 'Main Square', location_key: 'main_square', visual_description: 'sunny square' },
    { name: 'Pet Shop', location_key: 'pet_shop', visual_description: 'shops' }
  ]
};

const normalizedAnimalDraft = validateAndNormalizeUniverseDraft(validAnimalDraft, { expectedCharacterCount: 2, expectedLocationCount: 2 });
assert.equal(normalizedAnimalDraft.profile.slug, 'pawville-town');
assert.equal(normalizedAnimalDraft.characters[0].character_key, 'mochi');
assert.equal(normalizedAnimalDraft.locations[1].location_key, 'pet_shop');

// Duplicate key rejection
const duplicateKeyDraft = {
  ...validAnimalDraft,
  characters: [
    { name: 'Mochi', character_key: 'mochi', species: 'Cat', canonical_prompt: 'cat' },
    { name: 'Mochi Duplicate', character_key: 'mochi', species: 'Cat', canonical_prompt: 'cat' }
  ]
};
try {
  validateAndNormalizeUniverseDraft(duplicateKeyDraft, { expectedCharacterCount: 2 });
  assert.fail('Should reject duplicate character keys');
} catch (e) {
  assert(e instanceof UniverseAiValidationError);
  assert(e.details.some(d => d.includes('Duplicate character key')));
}

// Incomplete output rejection
try {
  validateAndNormalizeUniverseDraft({ profile: {} });
  assert.fail('Should reject incomplete draft');
} catch (e) {
  assert(e instanceof UniverseAiValidationError);
}

// Human normal face rejection
const humanNormalDraft = {
  profile: {
    name: 'Jejak Islam',
    universe_type: 'human',
    knowledge_domain: 'islamic_history',
    depiction_policy: 'No face shown'
  },
  characters: [
    { name: 'Ibn Battuta', character_key: 'ibn_battuta', role: 'main_character', depiction_mode: 'normal', canonical_prompt: 'Ibn Battuta traveling' }
  ],
  locations: [
    { name: 'Mosque', location_key: 'mosque', visual_description: 'Grand Mosque' }
  ]
};
try {
  validateAndNormalizeUniverseDraft(humanNormalDraft, { expectedCharacterCount: 1, expectedLocationCount: 1 });
  assert.fail('Should reject human character with depiction_mode normal');
} catch (e) {
  assert(e instanceof UniverseAiValidationError);
  assert(e.details.some(d => d.includes('dilarang menggunakan depiction_mode normal')));
}

// Faceless policy and negative prompts enforcement
const humanFacelessDraft = {
  profile: {
    name: 'Jejak Islam',
    universe_type: 'human',
    knowledge_domain: 'islamic_history',
    depiction_policy: 'No face shown'
  },
  characters: [
    { name: 'Ibn Battuta', character_key: 'ibn_battuta', role: 'main_character', depiction_mode: 'faceless', canonical_prompt: 'Ibn Battuta traveling' }
  ],
  locations: [
    { name: 'Mosque', location_key: 'mosque', visual_description: 'Grand Mosque' }
  ]
};
const normalizedHuman = validateAndNormalizeUniverseDraft(humanFacelessDraft, { expectedCharacterCount: 1, expectedLocationCount: 1 });
assert.equal(normalizedHuman.profile.human_presence, 'allowed');
assert(normalizedHuman.profile.negative_prompts_json.includes('no visible face'));
assert(normalizedHuman.characters[0].canonical_prompt.includes('(depicted as faceless)'));
assert.equal(normalizedHuman.profile.rules_json.anti_anachronism, 'wajib menghindari anakronisme visual dan verbal, pakaian dan teknologi harus sesuai periode historis');
console.log('✅ Draft validation & Faceless guardrail tests passed.');

// 4. Database Integration Tests
import { instantiateAiUniverse, SlugConflictError } from '../lib/universe-ai-repository.js';
import { tenantContext } from '../lib/tenant-context.js';
import { dbGet, dbAll } from '../lib/db.js';
import { closePgPool, getPgPool } from '../lib/db-pg.js';
import * as contractModule from '../lib/universe-ai-contract.js';

async function runDbIntegrationTests() {
  console.log('🔄 Waiting 5s for DB migrations to finish...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  console.log('🔄 Running DB Integration tests...');
  const testTenant = 'test_tenant_ai_builder_' + Math.random().toString(36).slice(2, 7);

  await tenantContext.run(testTenant, async () => {
    const uniqueSlug = 'test-univ-' + Math.random().toString(36).slice(2, 7);
    const draftToSave = {
      profile: {
        name: 'Test Universe ' + uniqueSlug,
        universe_type: 'animal',
        knowledge_domain: 'pet_supplies',
        premise: 'Pets in transaction test',
        tone: 'funny',
        default_pillars_json: ['Pillar Test']
      },
      characters: [
        { name: 'Test Char', character_key: 'test_char', species: 'Cat', role: 'main_character', depiction_mode: 'normal', canonical_prompt: 'Claymation test character' }
      ],
      locations: [
        { name: 'Test Loc', location_key: 'test_loc', visual_description: 'Test environment description' }
      ]
    };

    // Test successful instantiation
    const result = await instantiateAiUniverse(draftToSave);
    assert(result.success);
    assert(result.id);
    assert.equal(result.slug, 'test-universe-' + uniqueSlug);

    // Verify inserted data exists
    const profile = await dbGet('SELECT * FROM universe_profiles WHERE id = ?', [result.id]);
    assert(profile);
    assert.equal(profile.name, 'Test Universe ' + uniqueSlug);
    // rules_json is returned as parsed object by postgres client
    const rules = typeof profile.rules_json === 'string' ? JSON.parse(profile.rules_json) : profile.rules_json;
    assert(rules.ai_origin);
    assert.equal(rules.ai_origin.source, 'ai_universe_builder');

    // Test unique slug constraint (SlugConflictError)
    try {
      await instantiateAiUniverse(draftToSave);
      assert.fail('Should fail on duplicate slug');
    } catch (e) {
      assert(e instanceof SlugConflictError);
      console.log('✅ Unique slug conflict handled.');
    }

    // Test Rollback on failure
    // We mock pool.connect to intercept client query and throw an error when inserting locations
    const pool = getPgPool();
    const originalConnect = pool.connect.bind(pool);
    pool.connect = async () => {
      const client = await originalConnect();
      const originalQuery = client.query.bind(client);
      client.query = async (sql, params) => {
        if (sql.includes('INSERT INTO universe_locations')) {
          client.query = originalQuery; // Restore original query method
          throw new Error('Simulated database error on location insert');
        }
        return originalQuery(sql, params);
      };
      return client;
    };

    const failedSlug = 'failed-univ-' + Math.random().toString(36).slice(2, 7);
    const rollbackDraft = {
      profile: {
        name: 'Failed Universe ' + failedSlug,
        universe_type: 'animal',
        knowledge_domain: 'pet_supplies',
        premise: 'Will fail on location insert',
        tone: 'funny',
        default_pillars_json: []
      },
      characters: [
        { name: 'Rollback Char', character_key: 'rollback_char', species: 'Cat', role: 'main_character', depiction_mode: 'normal', canonical_prompt: 'prompt' }
      ],
      locations: [
        // Location will trigger our simulated error
        { name: 'Rollback Loc', location_key: 'rollback_loc', visual_description: 'Failed loc' }
      ]
    };

    try {
      await instantiateAiUniverse(rollbackDraft);
      assert.fail('Should fail on simulated database error');
    } catch (e) {
      // Restore pool.connect immediately
      pool.connect = originalConnect;
      assert.equal(e.message, 'Simulated database error on location insert');
      console.log('✅ Simulated database error caught and transaction aborted.');

      // Verify that profile was NOT created (rolled back)
      const rolledBackProfile = await dbGet('SELECT * FROM universe_profiles WHERE slug = ?', ['failed-universe-' + failedSlug]);
      assert.equal(rolledBackProfile, null);
      console.log('✅ Atomic rollback verified. Profile not inserted.');
    }

    // Tenant isolation verification
    const otherTenant = 'other_tenant_' + Math.random().toString(36).slice(2, 7);
    await tenantContext.run(otherTenant, async () => {
      const otherProfile = await dbGet('SELECT * FROM universe_profiles WHERE slug = ?', [uniqueSlug]);
      assert.equal(otherProfile, null);
      console.log('✅ Tenant isolation verified. Other tenant cannot see universe.');
    });

  });
}

runDbIntegrationTests()
  .then(() => {
    console.log('🎉 ALL INTEGRATION TESTS PASSED!');
    closePgPool().then(() => process.exit(0));
  })
  .catch(err => {
    console.error('❌ Integration tests failed:', err);
    closePgPool().then(() => process.exit(1));
  });

