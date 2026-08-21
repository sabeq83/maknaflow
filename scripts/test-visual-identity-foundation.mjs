import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { loadStagingEnv } from './local-staging/env.js';

// Load environment variables for DB access
Object.assign(process.env, loadStagingEnv());

import { 
  validateAndNormalizeVisualIdentity, 
  normalizeLegacyVisualOverrides 
} from '../lib/visual-identity-contract.js';

import { 
  listSystemVisualIdentities, 
  getSystemVisualIdentity 
} from '../lib/visual-identity-system-presets.js';

import { 
  listVisualIdentities, 
  getVisualIdentity, 
  createVisualIdentity, 
  updateVisualIdentity, 
  archiveVisualIdentity, 
  cloneVisualIdentity 
} from '../lib/visual-identity-repository.js';

import { 
  resolveVisualIdentity, 
  resolveVisualIdentitySnapshot, 
  resolveVisualOverrides 
} from '../lib/visual-override-resolver.js';

import { tenantContext } from '../lib/tenant-context.js';
import { closePgPool, pgQuery } from '../lib/db-pg.js';

console.log('🔄 Running Visual Identity Foundation unit & integration tests...');

// 1. Contract & Validator Unit Tests
console.log('  1. Testing contract & validation...');
const validConfig = {
  label: 'Test Identity',
  subject: {
    kind: 'human',
    faceless_mode: 'hands_only',
    demographic_key: 'syari_classic'
  },
  wardrobe: {
    mode: 'fixed',
    preset_key: 'sage_muted'
  }
};

const normalized = validateAndNormalizeVisualIdentity(validConfig);
assert.equal(normalized.label, 'Test Identity');
assert.equal(normalized.subject.kind, 'human');
assert.equal(normalized.guardrails.face_visibility, 'prohibited'); // Locked!

// Visible face attempt check
const maliciousConfig = {
  ...validConfig,
  guardrails: {
    face_visibility: 'allowed'
  }
};
const normalizedMalicious = validateAndNormalizeVisualIdentity(maliciousConfig);
assert.equal(normalizedMalicious.guardrails.face_visibility, 'prohibited'); // Must be locked!

// Invalid human faceless mode validation
assert.throws(() => {
  validateAndNormalizeVisualIdentity({
    ...validConfig,
    subject: {
      kind: 'human',
      faceless_mode: 'not_applicable'
    }
  });
}, /faceless_mode cannot be not_applicable for human/);

console.log('  ✅ Contract tests passed.');

// 2. Legacy Mapping Unit Tests
console.log('  2. Testing legacy normalization...');
const legacyVso = {
  character_concept: 'faceless',
  subject_demographic: 'syari_classic',
  wardrobe_style: 'sage_muted',
  lighting_style: 'window_daylight',
  visual_style_preset: 'cinematic_realistic'
};

const converted = normalizeLegacyVisualOverrides(legacyVso);
assert.equal(converted.subject.kind, 'human');
assert.equal(converted.subject.faceless_mode, 'hands_only');
assert.equal(converted.wardrobe.preset_key, 'sage_muted');
assert.equal(converted.lighting.preset_key, 'window_daylight');

const mascotVso = {
  subject_demographic: 'mascot_universe_herbal',
  visual_style_preset: '3d_claymation_cozy'
};
const convertedMascot = normalizeLegacyVisualOverrides(mascotVso);
assert.equal(convertedMascot.subject.kind, 'animal');
assert.equal(convertedMascot.subject.faceless_mode, 'not_applicable');
assert.equal(convertedMascot.style.preset_key, '3d_claymation_cozy');

console.log('  ✅ Legacy mapping tests passed.');

// 3. System Presets Tests
console.log('  3. Testing system catalog...');
const systemList = listSystemVisualIdentities();
assert.ok(systemList.length > 0);
const sagePreset = getSystemVisualIdentity('hands_only_muslimah_sage_kitchen');
assert.ok(sagePreset);
assert.equal(sagePreset.label, 'Muslimah Sage Kitchen');
console.log('  ✅ System presets tests passed.');

// 4. Repository & Database Integration Tests
console.log('  4. Testing repository and tenant isolation...');

async function runRepoTests() {
  const tenantA = `tenant_test_a_${Date.now().toString(36)}`;
  const tenantB = `tenant_test_b_${Date.now().toString(36)}`;
  const actor = 'test-runner';

  // Seed tenants
  await pgQuery("INSERT INTO tenants (id, name, slug) VALUES ($1, 'Tenant A', $1)", [tenantA]);
  await pgQuery("INSERT INTO tenants (id, name, slug) VALUES ($1, 'Tenant B', $1)", [tenantB]);

  try {
    // Test CRUD under Tenant A context
    await tenantContext.run(tenantA, async () => {
      // Create user preset
      const presetKey = `preset_a_${Date.now().toString(36)}`;
      const preset = await createVisualIdentity({
        label: 'Tenant A Preset',
        preset_key: presetKey,
        config: {
          subject: { kind: 'human', faceless_mode: 'hands_only', demographic_key: 'syari_classic' },
          wardrobe: { mode: 'fixed', preset_key: 'sage_muted' }
        }
      }, actor);

      assert.equal(preset.label, 'Tenant A Preset');
      assert.equal(preset.version, 1);
      assert.equal(preset.status, 'active');

      // Update preset
      const updated = await updateVisualIdentity(preset.id, {
        label: 'Tenant A Preset Updated',
        config: preset.config
      }, actor);
      assert.equal(updated.label, 'Tenant A Preset Updated');
      assert.equal(updated.version, 2); // Version must increment

      // Clone preset
      const cloned = await cloneVisualIdentity(preset.id, { label: 'Tenant A Preset Cloned' }, actor);
      assert.equal(cloned.label, 'Tenant A Preset Cloned');
      assert.equal(cloned.version, 1);

      // Verify lists merges user + system presets
      const allActive = await listVisualIdentities({ status: 'active' });
      assert.ok(allActive.find(p => p.id === preset.id));
      assert.ok(allActive.find(p => p.id === 'hands_only_muslimah_sage_kitchen')); // system preset

      // Archive preset
      await archiveVisualIdentity(preset.id, actor);
      const activeAfterArchive = await listVisualIdentities({ status: 'active' });
      assert.ok(!activeAfterArchive.find(p => p.id === preset.id)); // Should be hidden

      const archivedOnly = await listVisualIdentities({ status: 'archived' });
      assert.ok(archivedOnly.find(p => p.id === preset.id)); // Should be in archived list
    });

    // Test Tenant Isolation
    await tenantContext.run(tenantB, async () => {
      const bList = await listVisualIdentities({ status: 'active' });
      // Should contain system presets, but NOT Tenant A presets
      assert.ok(bList.find(p => p.id === 'hands_only_muslimah_sage_kitchen'));
      assert.ok(!bList.find(p => p.label.startsWith('Tenant A')));
    });

    console.log('  ✅ Repository and tenant isolation tests passed.');
  } finally {
    // Cleanup database
    await pgQuery('DELETE FROM visual_identity_presets WHERE tenant_id IN ($1, $2)', [tenantA, tenantB]);
    await pgQuery('DELETE FROM tenants WHERE id IN ($1, $2)', [tenantA, tenantB]);
  }
}

// 5. Resolver Integration Tests
console.log('  5. Testing central resolver resolution...');

async function runResolverTests() {
  // Test resolve dynamic sequential wardrobe
  const resolvedSeq0 = await resolveVisualIdentity({
    inlineConfig: {
      subject: { kind: 'human', faceless_mode: 'hands_only', demographic_key: 'syari_classic' },
      wardrobe: { mode: 'sequential' }
    },
    itemContext: { itemIndex: 0 }
  });

  const resolvedSeq1 = await resolveVisualIdentity({
    inlineConfig: {
      subject: { kind: 'human', faceless_mode: 'hands_only', demographic_key: 'syari_classic' },
      wardrobe: { mode: 'sequential' }
    },
    itemContext: { itemIndex: 1 }
  });

  assert.notEqual(resolvedSeq0.resolved.wardrobe_prompt, resolvedSeq1.resolved.wardrobe_prompt);

  // Test deterministic stable-random resolution
  const resolvedRandA = await resolveVisualIdentity({
    inlineConfig: {
      subject: { kind: 'human', faceless_mode: 'hands_only', demographic_key: 'syari_classic' },
      wardrobe: { mode: 'stable_random' }
    },
    itemContext: { stableSeed: 'seed_key_abc_123' }
  });

  const resolvedRandB = await resolveVisualIdentity({
    inlineConfig: {
      subject: { kind: 'human', faceless_mode: 'hands_only', demographic_key: 'syari_classic' },
      wardrobe: { mode: 'stable_random' }
    },
    itemContext: { stableSeed: 'seed_key_abc_123' }
  });

  assert.deepEqual(resolvedRandA.resolved.wardrobe_prompt, resolvedRandB.resolved.wardrobe_prompt);

  // Test backward compatibility wrapper
  const legacyResolved = resolveVisualOverrides({
    visualOverrides: {
      subject_demographic: 'syari_classic',
      wardrobe_style: 'sequential'
    },
    itemIndex: 0
  });

  assert.equal(legacyResolved.wardrobe_style, 'custom');
  assert.ok(legacyResolved.wardrobe_style_custom);

  console.log('  ✅ Resolver resolution tests passed.');
}

async function runRegressionTests() {
  console.log('  6. Testing regression, immutability & fallbacks...');
  
  // Immutability: resolving an already resolved snapshot does not modify it
  const snapshot = {
    schema_version: 'visual_identity_snapshot_v1',
    identity_ref: { id: 'hands_only_muslimah_sage_kitchen', version: 1, source: 'system' },
    resolved: {
      subject_prompt: 'Test Subject',
      wardrobe_prompt: 'Test Wardrobe',
      lighting_prompt: 'Test Lighting'
    }
  };
  const resolved = resolveVisualOverrides({ visualOverrides: snapshot });
  assert.equal(resolved.schema_version, 'visual_identity_snapshot_v1');
  assert.equal(resolved.resolved.subject_prompt, 'Test Subject');
  assert.deepEqual(resolved.identity_ref, snapshot.identity_ref);

  // Legacy Fallback Campaign: resolving pure flat legacy overrides works
  const legacyMap = resolveVisualOverrides({
    visualOverrides: {
      character_concept: 'pov',
      subject_demographic: 'caucasian_male',
      wardrobe_style: 'male_terracotta',
      lighting_style: 'studio_softbox'
    },
    itemIndex: 0
  });
  assert.equal(legacyMap.schema_version, 'visual_identity_snapshot_v1');
  assert.ok(legacyMap.resolved.subject_prompt.includes('man') || legacyMap.resolved.subject_prompt.includes('male'));
  assert.ok(legacyMap.resolved.wardrobe_prompt.toLowerCase().includes('terracotta'));

  console.log('  ✅ Regression, immutability & fallback tests passed.');
}

async function runAll() {
  try {
    await runRepoTests();
    await runResolverTests();
    await runRegressionTests();
    console.log('🎉 All Visual Identity Foundation tests passed successfully!');
  } catch (err) {
    console.error('❌ Tests failed:', err);
    process.exit(1);
  } finally {
    await closePgPool();
    process.exit(0);
  }
}

runAll();
