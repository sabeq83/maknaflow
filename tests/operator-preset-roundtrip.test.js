import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listOperatorPresets,
  resolveOperatorPreset,
  getOperatorPresetConfig,
  isOperatorPresetCompatible
} from '../lib/operator-presets.js';

test('Preset System Integrity: All 5 sections and required constants exist across all built-in presets', () => {
  const presets = listOperatorPresets();
  assert.ok(presets.length >= 5, 'Must have at least 5 presets');

  for (const preset of presets) {
    const config = preset.config;
    assert.ok(config, `Preset ${preset.key} must have config`);
    assert.equal(config.schema_version, '2', `Preset ${preset.key} must use schema_version 2`);
    assert.ok(Array.isArray(config.campaign_kinds) && config.campaign_kinds.length > 0, `Preset ${preset.key} must declare campaign_kinds`);

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

test('Preset dapurbotani_kampanye_produk_4_klip sets bridge_at_clip to 3 and approval_mode to start_frames', () => {
  const resolved = resolveOperatorPreset('dapurbotani_kampanye_produk_4_klip');
  assert.equal(resolved.product_bridging.is_bridging_active, true);
  assert.equal(resolved.product_bridging.bridging_mode, 'select_existing');
  assert.equal(resolved.product_bridging.bridge_at_clip, 3);
  assert.equal(resolved.product_bridging.bridge_duration_clips, 1);
  assert.equal(resolved.workflow.approval_mode, 'start_frames');
  assert.equal(resolved.workflow.auto_sync_contentflow, true);
  assert.equal(resolved.visual_engine.target_clips_count, 4);
  assert.equal(resolved.visual_engine.words_per_clip, '17-19 kata');
});

test('Preset Compatibility: Product campaigns correctly match product presets and reject editorial presets', () => {
  assert.equal(isOperatorPresetCompatible('dapurbotani_kampanye_produk_4_klip', 'product_campaign'), true);
  assert.equal(isOperatorPresetCompatible('product_campaign_v1', 'product_campaign'), true);
  assert.equal(isOperatorPresetCompatible('nutribake_editorial_v1', 'product_campaign'), false);
  assert.equal(isOperatorPresetCompatible('nutribake_editorial_v1', 'brand_editorial'), true);
});
