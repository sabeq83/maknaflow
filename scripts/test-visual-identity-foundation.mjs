import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { loadStagingEnv } from './local-staging/env.js';

// Load environment variables for DB access
Object.assign(process.env, loadStagingEnv());

import {
  DEFAULT_VISUAL_STYLE,
  VISUAL_STYLE_KEYS,
  VISUAL_LANGUAGE_CATALOG,
  getVisualStyleDefinition,
  isValidVisualStyle
} from '../lib/visual-language-catalog.js';

import { 
  validateAndNormalizeVisualIdentity, 
  normalizeLegacyVisualOverrides,
  LEGACY_STYLE_MAP,
  mapLegacyVisualStyle
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

// 1. Catalog & Taxonomy Tests
console.log('  1. Testing Central Catalog & Taxonomy...');
assert.equal(DEFAULT_VISUAL_STYLE, 'cinematic_realistic');
assert.ok(VISUAL_STYLE_KEYS.length >= 11);
assert.ok(VISUAL_STYLE_KEYS.includes('culinary_cinematic'));
assert.ok(VISUAL_STYLE_KEYS.includes('commercial_product_cinematic'));
assert.ok(VISUAL_STYLE_KEYS.includes('stylized_3d_character'));
assert.ok(VISUAL_STYLE_KEYS.includes('cozy_claymation'));

const defCinematic = getVisualStyleDefinition('cinematic_realistic');
assert.equal(defCinematic.family, 'cinematic');
assert.equal(defCinematic.medium, 'photorealistic');
assert.equal(defCinematic.role, 'primary');

// Empty key returns neutral default
assert.equal(getVisualStyleDefinition().key, 'cinematic_realistic');

// Unknown key throws structured error
assert.throws(() => {
  getVisualStyleDefinition('unknown_magic_style');
}, (err) => err.code === 'INVALID_VISUAL_STYLE');

console.log('  ✅ Central Catalog & Taxonomy tests passed.');

// 2. Contract & Strict Validation Tests (Schema v2)
console.log('  2. Testing Contract & Strict Validation (Schema v2)...');
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
assert.equal(normalized.visual_language.primary_style, 'editorial_graphic_novel');
assert.deepEqual(normalized.visual_language.supporting_styles, ['isometric_society', 'symbolic_surrealism']);
assert.equal(normalized.mode_routing.hook, 'symbolic_surrealism');
assert.equal(normalized.mode_routing.mechanism, 'isometric_society');
assert.equal(normalized.guardrails.face_visibility, 'prohibited'); // Locked!

// Schema v2 with invalid primary style throws INVALID_VISUAL_STYLE (No silent fallback!)
assert.throws(() => {
  validateAndNormalizeVisualIdentity({
    schema_version: '2',
    visual_language: { primary_style: 'completely_invalid_style' }
  });
}, (err) => err.code === 'INVALID_VISUAL_STYLE');

// Supporting-only role cannot be primary in schema v2
assert.throws(() => {
  validateAndNormalizeVisualIdentity({
    schema_version: '2',
    visual_language: { primary_style: 'isometric_society' }
  });
}, /supporting/);

// Schema v1 backward compatibility test
const v1Config = {
  schema_version: '1',
  label: 'Old V1 Preset',
  subject: { kind: 'human', faceless_mode: 'hands_only', demographic_key: 'syari_classic' },
  style: { preset_key: '3d_claymation_cozy' }
};
const normalizedV1 = validateAndNormalizeVisualIdentity(v1Config);
assert.equal(normalizedV1.schema_version, '2');
assert.equal(normalizedV1.visual_language.primary_style, 'cozy_claymation');
assert.ok(normalizedV1.mode_routing.hook);

console.log('  ✅ Contract & normalization tests passed.');

// 3. System Presets Mapping Verification
console.log('  3. Testing System Presets Mapping (All 6 Presets)...');
const systemList = listSystemVisualIdentities();
assert.equal(systemList.length, 6);

// Verify distinct styles (Not all editorial!)
const primaryStylesSet = new Set(systemList.map(p => p.config.visual_language.primary_style));
assert.ok(primaryStylesSet.size >= 4, 'System presets must have diverse primary styles!');
assert.ok(!systemList.every(p => p.config.visual_language.primary_style === 'editorial_graphic_novel'));

// Check each preset specifically:
const waySiyasi = getSystemVisualIdentity('way_siyasi_editorial_system');
assert.equal(waySiyasi.config.visual_language.primary_style, 'editorial_graphic_novel');
assert.equal(waySiyasi.config.style.preset_key, 'editorial_graphic_novel');

const sageKitchen = getSystemVisualIdentity('hands_only_muslimah_sage_kitchen');
assert.equal(sageKitchen.config.visual_language.primary_style, 'culinary_cinematic');
assert.equal(sageKitchen.config.style.preset_key, 'culinary_cinematic');

const maleCasual = getSystemVisualIdentity('hands_only_southeast_asian_male');
assert.equal(maleCasual.config.visual_language.primary_style, 'commercial_product_cinematic');
assert.equal(maleCasual.config.style.preset_key, 'commercial_product_cinematic');

const maleCaramel = getSystemVisualIdentity('hands_only_caucasian_male_caramel');
assert.equal(maleCaramel.config.visual_language.primary_style, 'commercial_product_cinematic');
assert.equal(maleCaramel.config.style.preset_key, 'commercial_product_cinematic');

const female3d = getSystemVisualIdentity('stylized_3d_muslimah_emerald');
assert.equal(female3d.config.visual_language.primary_style, 'stylized_3d_character');
assert.equal(female3d.config.style.preset_key, 'stylized_3d_character');

const gingerGuardian = getSystemVisualIdentity('mascot_herbal_ginger_guardian');
assert.equal(gingerGuardian.config.visual_language.primary_style, 'cozy_claymation');
assert.equal(gingerGuardian.config.style.preset_key, 'cozy_claymation');

console.log('  ✅ All 6 System presets mappings verified.');

// 4. Resolver Prompt Isolation Tests
console.log('  4. Testing Resolver Prompt Segregation & Layer Resolution...');

async function runResolverTests() {
  // Wa'y Siyasi retains editorial narrative routing
  const hookResolved = await resolveVisualIdentity({
    presetRef: 'way_siyasi_editorial_system',
    itemContext: { narrativeFunction: 'hook' }
  });
  assert.equal(hookResolved.resolved.active_visual_mode, 'symbolic_surrealism');
  assert.ok(hookResolved.resolved.style_prompt.includes('symbolic conceptual surrealism'));

  // Kitchen preset does NOT contain political graphic novel prompt
  const kitchenResolved = await resolveVisualIdentity({
    presetRef: 'hands_only_muslimah_sage_kitchen'
  });
  assert.equal(kitchenResolved.resolved.active_visual_mode, 'culinary_cinematic');
  assert.ok(kitchenResolved.resolved.style_prompt.includes('culinary cinematography'));
  assert.ok(!kitchenResolved.resolved.style_prompt.includes('political illustration'));

  // 3D preset prompt contains stylized 3D render
  const threeDResolved = await resolveVisualIdentity({
    presetRef: 'stylized_3d_muslimah_emerald'
  });
  assert.equal(threeDResolved.resolved.active_visual_mode, 'stylized_3d_character');
  assert.ok(threeDResolved.resolved.style_prompt.includes('stylized 3D cartoon render'));

  // Ginger Guardian contains claymation prompt
  const clayResolved = await resolveVisualIdentity({
    presetRef: 'mascot_herbal_ginger_guardian'
  });
  assert.equal(clayResolved.resolved.active_visual_mode, 'cozy_claymation');
  assert.ok(clayResolved.resolved.style_prompt.includes('clay animation'));

  console.log('  ✅ Resolver prompt segregation tests passed.');
}

// 5. Repository & Tenant Isolation Tests
console.log('  5. Testing Repository and Tenant Isolation...');

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
          visual_language: { primary_style: 'culinary_cinematic', supporting_styles: [] }
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

async function runAll() {
  try {
    await runResolverTests();
    await runRepoTests();
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
