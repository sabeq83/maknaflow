import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listOperatorPresets,
  resolveOperatorPreset,
  getOperatorPresetConfig,
  isOperatorPresetCompatible,
  isSystemOperatorPreset,
  hydrateOperatorPresetCache
} from '../lib/operator-presets.js';

test('Preset System Integrity: Exactly 2 Master Built-in Presets exist with all 5 sections', () => {
  const presets = listOperatorPresets('clean_isolated_tenant');
  assert.equal(presets.length, 2, 'Must have exactly 2 master built-in presets');

  const keys = presets.map(p => p.key);
  assert.ok(keys.includes('brand_editorial_campaign'), 'Must include brand_editorial_campaign');
  assert.ok(keys.includes('product_campaign'), 'Must include product_campaign');

  for (const preset of presets) {
    const config = preset.config;
    assert.ok(config, `Preset ${preset.key} must have config`);
    assert.equal(config.schema_version, '2', `Preset ${preset.key} must use schema_version 2`);
    assert.ok(Array.isArray(config.campaign_kinds) && config.campaign_kinds.length > 0, `Preset ${preset.key} must declare campaign_kinds`);
    assert.equal(preset.is_system, true, `Master preset ${preset.key} must be system`);

    // 1. basic_strategy
    assert.ok(config.basic_strategy, `Preset ${preset.key} missing basic_strategy`);
    assert.ok(config.basic_strategy.narrative_mode, `Preset ${preset.key} missing narrative_mode`);
    assert.ok(config.basic_strategy.voice_provider, `Preset ${preset.key} missing voice_provider`);
    assert.ok(config.basic_strategy.voice_persona, `Preset ${preset.key} missing voice_persona`);
    assert.equal(typeof config.basic_strategy.voice_speed, 'number', `Preset ${preset.key} voice_speed must be number`);
    assert.equal(typeof config.basic_strategy.voice_volume, 'number', `Preset ${preset.key} voice_volume must be number`);
    assert.ok(config.basic_strategy.target_language, `Preset ${preset.key} missing target_language`);
    assert.ok(config.basic_strategy.target_demographic, `Preset ${preset.key} missing target_demographic`);

    // 2. visual_engine
    assert.ok(config.visual_engine, `Preset ${preset.key} missing visual_engine`);
    assert.ok(config.visual_engine.visual_style, `Preset ${preset.key} missing visual_style`);
    assert.ok(config.visual_engine.visual_mode, `Preset ${preset.key} missing visual_mode`);
    assert.ok(config.visual_engine.video_model, `Preset ${preset.key} missing video_model`);
    assert.ok(config.visual_engine.aspect_ratio, `Preset ${preset.key} missing aspect_ratio`);
    assert.equal(typeof config.visual_engine.target_clips_count, 'number', `Preset ${preset.key} target_clips_count must be number`);
    assert.ok(config.visual_engine.words_per_clip, `Preset ${preset.key} missing words_per_clip`);

    // 3. product_bridging
    assert.ok(config.product_bridging, `Preset ${preset.key} missing product_bridging`);
    assert.equal(typeof config.product_bridging.is_bridging_active, 'boolean', `Preset ${preset.key} is_bridging_active must be boolean`);
    if (config.product_bridging.is_bridging_active) {
      assert.ok(config.product_bridging.bridging_mode, `Preset ${preset.key} bridging_mode must exist when active`);
      assert.equal(typeof config.product_bridging.bridge_at_clip, 'number', `Preset ${preset.key} bridge_at_clip must be number`);
      assert.equal(typeof config.product_bridging.bridge_duration_clips, 'number', `Preset ${preset.key} bridge_duration_clips must be number`);
    }

    // 4. visual_swap
    assert.ok(config.visual_swap, `Preset ${preset.key} missing visual_swap`);
    assert.equal(typeof config.visual_swap.is_vso_active, 'boolean', `Preset ${preset.key} is_vso_active must be boolean`);

    // 5. workflow
    assert.ok(config.workflow, `Preset ${preset.key} missing workflow`);
    assert.ok(config.workflow.approval_mode, `Preset ${preset.key} missing approval_mode`);
    assert.equal(typeof config.workflow.enable_tts, 'boolean', `Preset ${preset.key} enable_tts must be boolean`);
    assert.equal(typeof config.workflow.enable_glabs, 'boolean', `Preset ${preset.key} enable_glabs must be boolean`);
    assert.equal(typeof config.workflow.enable_ffmpeg, 'boolean', `Preset ${preset.key} enable_ffmpeg must be boolean`);
    assert.equal(typeof config.workflow.auto_sync_contentflow, 'boolean', `Preset ${preset.key} auto_sync_contentflow must be boolean`);
  }
});

test('Alias Resolution: Legacy preset keys resolve transparently to master templates', () => {
  const resolvedProduct = resolveOperatorPreset('product_campaign');
  assert.equal(resolvedProduct.product_bridging.is_bridging_active, true);
  assert.equal(resolvedProduct.workflow.approval_mode, 'start_frames');

  // Test aliases
  const resolvedDapur = resolveOperatorPreset('dapurbotani_kampanye_produk_4_klip');
  assert.equal(resolvedDapur.product_bridging.is_bridging_active, true);
  assert.equal(resolvedDapur.workflow.approval_mode, 'start_frames');

  const resolvedNutri = resolveOperatorPreset('nutribake_editorial_v1');
  assert.equal(resolvedNutri.product_bridging.is_bridging_active, false);
  assert.equal(resolvedNutri.workflow.approval_mode, 'storyboard');
});

test('Preset Compatibility: Product campaigns match product presets and reject editorial presets', () => {
  assert.equal(isOperatorPresetCompatible('product_campaign', 'product_campaign'), true);
  assert.equal(isOperatorPresetCompatible('product_campaign', 'brand_editorial'), false);
  assert.equal(isOperatorPresetCompatible('brand_editorial_campaign', 'brand_editorial'), true);
  assert.equal(isOperatorPresetCompatible('brand_editorial_campaign', 'product_campaign'), false);
  assert.equal(isOperatorPresetCompatible('dapurbotani_kampanye_produk_4_klip', 'product_campaign'), true);
  assert.equal(isOperatorPresetCompatible('nutribake_editorial_v1', 'brand_editorial'), true);
  assert.equal(isOperatorPresetCompatible('nutribake_editorial_v1', 'product_campaign'), false);
});

test('Multi-Tenant Isolation: Tenant A custom presets are strictly isolated from Tenant B', () => {
  const tenantA = 'tenant_alpha_test';
  const tenantB = 'tenant_beta_test';

  hydrateOperatorPresetCache(tenantA, {
    alpha_exclusive_preset: {
      schema_version: '2',
      label: 'Alpha Exclusive Preset',
      campaign_kinds: ['brand_editorial'],
      basic_strategy: { narrative_mode: 'Storytelling' },
      visual_engine: { visual_style: 'Cinematic' },
      product_bridging: { is_bridging_active: false },
      visual_swap: { is_vso_active: false },
      workflow: { approval_mode: 'storyboard' }
    }
  });

  hydrateOperatorPresetCache(tenantB, {
    beta_exclusive_preset: {
      schema_version: '2',
      label: 'Beta Exclusive Preset',
      campaign_kinds: ['product_campaign'],
      basic_strategy: { narrative_mode: 'auto' },
      visual_engine: { visual_style: 'UGC' },
      product_bridging: { is_bridging_active: true },
      visual_swap: { is_vso_active: false },
      workflow: { approval_mode: 'start_frames' }
    }
  });

  const listA = listOperatorPresets(tenantA);
  const listB = listOperatorPresets(tenantB);

  // Tenant A must have 2 masters + alpha_exclusive_preset = 3
  assert.equal(listA.length, 3);
  assert.ok(listA.some(p => p.key === 'alpha_exclusive_preset'));
  assert.ok(!listA.some(p => p.key === 'beta_exclusive_preset'), 'Tenant A must NOT see Tenant B preset');

  // Tenant B must have 2 masters + beta_exclusive_preset = 3
  assert.equal(listB.length, 3);
  assert.ok(listB.some(p => p.key === 'beta_exclusive_preset'));
  assert.ok(!listB.some(p => p.key === 'alpha_exclusive_preset'), 'Tenant B must NOT see Tenant A preset');
});
