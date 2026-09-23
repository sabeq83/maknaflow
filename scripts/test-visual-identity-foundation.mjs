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

// 1. Contract & Validator Unit Tests (Schema v2)
console.log('  1. Testing contract & validation (Schema v2)...');
const validConfig = {
  label: 'Test Identity',
  subject: {
    kind: 'human',
    faceless_mode: 'featureless_editorial',
    demographic_key: 'custom',
    population_mode: 'single_group_or_crowd'
  },
  visual_language: {
    primary_style: 'editorial_graphic_novel',
    supporting_styles: ['isometric_society', 'symbolic_surrealism'],
    disabled_styles: ['clay_political_theater']
  },
  mode_routing: {
    hook: 'symbolic_surrealism',
    mechanism: 'isometric_society'
  }
};

const normalized = validateAndNormalizeVisualIdentity(validConfig);
assert.equal(normalized.schema_version, '2');
assert.equal(normalized.label, 'Test Identity');
assert.equal(normalized.subject.kind, 'human');
assert.equal(normalized.subject.population_mode, 'single_group_or_crowd');
assert.equal(normalized.visual_language.primary_style, 'editorial_graphic_novel');
assert.deepEqual(normalized.visual_language.supporting_styles, ['isometric_society', 'symbolic_surrealism']);
assert.equal(normalized.mode_routing.hook, 'symbolic_surrealism');
assert.equal(normalized.mode_routing.mechanism, 'isometric_society');
assert.equal(normalized.guardrails.face_visibility, 'prohibited'); // Locked!
assert.equal(normalized.guardrails.intentional_crowd, 'allowed_faceless');

// Schema v1 backward compatibility test
const v1Config = {
  schema_version: '1',
  label: 'Old V1 Preset',
  subject: { kind: 'human', faceless_mode: 'hands_only', demographic_key: 'syari_classic' },
  style: { preset_key: '3d_claymation_cozy' }
};
const normalizedV1 = validateAndNormalizeVisualIdentity(v1Config);
assert.equal(normalizedV1.schema_version, '2');
assert.equal(normalizedV1.visual_language.primary_style, 'clay_political_theater');
assert.ok(normalizedV1.mode_routing.hook);

// Primary / Supporting collision test
const collisionConfig = {
  visual_language: {
    primary_style: 'editorial_graphic_novel',
    supporting_styles: ['editorial_graphic_novel', 'isometric_society', 'isometric_society']
  }
};
const normalizedCollision = validateAndNormalizeVisualIdentity(collisionConfig);
assert.equal(normalizedCollision.visual_language.primary_style, 'editorial_graphic_novel');
assert.deepEqual(normalizedCollision.visual_language.supporting_styles, ['isometric_society']);

// Inactive route fallback to primary test
const invalidRouteConfig = {
  visual_language: {
    primary_style: 'editorial_graphic_novel',
    supporting_styles: ['isometric_society']
  },
  mode_routing: {
    hook: 'clay_political_theater' // Inactive style!
  }
};
const normalizedInvalidRoute = validateAndNormalizeVisualIdentity(invalidRouteConfig);
assert.equal(normalizedInvalidRoute.mode_routing.hook, 'editorial_graphic_novel'); // Fallback to primary!

console.log('  ✅ Contract & normalization tests passed.');

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
assert.equal(converted.schema_version, '2');
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

console.log('  ✅ Legacy mapping tests passed.');

// 3. System Presets & Wa'y Siyasi Preset Tests
console.log('  3. Testing system catalog & Wa’y Siyasi preset...');
const systemList = listSystemVisualIdentities();
assert.ok(systemList.length > 0);

const waySiyasiPreset = getSystemVisualIdentity('way_siyasi_editorial_system');
assert.ok(waySiyasiPreset);
assert.equal(waySiyasiPreset.label, 'Wa’y Siyasi — Editorial System');
assert.equal(waySiyasiPreset.config.visual_language.primary_style, 'editorial_graphic_novel');
assert.ok(waySiyasiPreset.config.visual_language.supporting_styles.includes('isometric_society'));
assert.ok(waySiyasiPreset.config.visual_language.supporting_styles.includes('symbolic_surrealism'));
assert.ok(waySiyasiPreset.config.visual_language.supporting_styles.includes('paper_cutout_documentary'));
assert.equal(waySiyasiPreset.config.mode_routing.hook, 'symbolic_surrealism');
assert.equal(waySiyasiPreset.config.mode_routing.mechanism, 'isometric_society');
assert.equal(waySiyasiPreset.config.mode_routing.evidence_reveal, 'paper_cutout_documentary');

const sagePreset = getSystemVisualIdentity('hands_only_muslimah_sage_kitchen');
assert.ok(sagePreset);
assert.equal(sagePreset.label, 'Muslimah Sage Kitchen');

console.log('  ✅ System presets & Wa’y Siyasi tests passed.');

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
          schema_version: '2',
          subject: { kind: 'human', faceless_mode: 'hands_only', demographic_key: 'syari_classic' },
          visual_language: { primary_style: 'editorial_graphic_novel', supporting_styles: ['isometric_society'] }
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
      assert.equal(updated.version, 2);

      // Clone preset
      const cloned = await cloneVisualIdentity(preset.id, { label: 'Tenant A Preset Cloned' }, actor);
      assert.equal(cloned.label, 'Tenant A Preset Cloned');
      assert.equal(cloned.version, 1);

      // Verify lists merges user + system presets
      const allActive = await listVisualIdentities({ status: 'active' });
      assert.ok(allActive.find(p => p.id === preset.id));
      assert.ok(allActive.find(p => p.id === 'way_siyasi_editorial_system'));

      // Archive preset
      await archiveVisualIdentity(preset.id, actor);
      const activeAfterArchive = await listVisualIdentities({ status: 'active' });
      assert.ok(!activeAfterArchive.find(p => p.id === preset.id));

      const archivedOnly = await listVisualIdentities({ status: 'archived' });
      assert.ok(archivedOnly.find(p => p.id === preset.id));
    });

    // Test Tenant Isolation
    await tenantContext.run(tenantB, async () => {
      const bList = await listVisualIdentities({ status: 'active' });
      assert.ok(bList.find(p => p.id === 'way_siyasi_editorial_system'));
      assert.ok(!bList.find(p => p.label.startsWith('Tenant A')));
    });

    console.log('  ✅ Repository and tenant isolation tests passed.');
  } finally {
    // Cleanup database
    await pgQuery('DELETE FROM visual_identity_presets WHERE tenant_id IN ($1, $2)', [tenantA, tenantB]);
    await pgQuery('DELETE FROM tenants WHERE id IN ($1, $2)', [tenantA, tenantB]);
  }
}

// 5. Resolver Integration & Narrative Routing Tests
console.log('  5. Testing resolver narrative routing & prompt layers...');

async function runResolverTests() {
  // Test Wa'y Siyasi narrative routing resolution
  const hookResolved = await resolveVisualIdentity({
    presetRef: 'way_siyasi_editorial_system',
    itemContext: { narrativeFunction: 'hook' }
  });
  assert.equal(hookResolved.resolved.active_visual_mode, 'symbolic_surrealism');
  assert.ok(hookResolved.resolved.style_prompt.includes('symbolic conceptual surrealism'));

  const mechResolved = await resolveVisualIdentity({
    presetRef: 'way_siyasi_editorial_system',
    itemContext: { narrativeFunction: 'mechanism' }
  });
  assert.equal(mechResolved.resolved.active_visual_mode, 'isometric_society');
  assert.ok(mechResolved.resolved.style_prompt.includes('isometric miniature society'));

  const evidenceResolved = await resolveVisualIdentity({
    presetRef: 'way_siyasi_editorial_system',
    itemContext: { narrativeFunction: 'evidence_reveal' }
  });
  assert.equal(evidenceResolved.resolved.active_visual_mode, 'paper_cutout_documentary');
  assert.ok(evidenceResolved.resolved.style_prompt.includes('paper cutout documentary'));

  // Default when narrative function is omitted
  const defaultResolved = await resolveVisualIdentity({
    presetRef: 'way_siyasi_editorial_system'
  });
  assert.equal(defaultResolved.resolved.active_visual_mode, 'editorial_graphic_novel');

  // Metaphor translation resolution test
  const metaphorResolved = await resolveVisualIdentity({
    presetRef: 'way_siyasi_editorial_system',
    itemContext: {
      narrativeFunction: 'hook',
      concept: 'Inflation erosion',
      primaryObject: 'Dissolving banknotes in hourglass',
      visualAction: 'Time-lapse melting away'
    }
  });
  assert.ok(metaphorResolved.resolved.metaphor_prompt.includes('Dissolving banknotes in hourglass'));

  // Deduplicated negative prompts
  assert.ok(defaultResolved.resolved.negative_prompt.includes('visible human face'));
  assert.ok(defaultResolved.resolved.negative_prompt.includes('photorealistic stock footage'));

  console.log('  ✅ Resolver narrative routing tests passed.');
}

async function runAll() {
  try {
    await runRepoTests();
    await runResolverTests();
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
