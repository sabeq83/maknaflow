import { getActiveTenantId } from './tenant-context.js';

const CUSTOM_PRESET_CACHE=globalThis.__operatorPresetCache||{};
globalThis.__operatorPresetCache=CUSTOM_PRESET_CACHE;

const PRESETS = {
  nutribake_editorial_v1: {
    schema_version: '2',
    label: 'Nutribake Editorial',
    basic_strategy: {
      narrative_mode: 'auto', voice_provider: 'minimax', target_language: 'id-ID',
      target_demographic: 'ibu_rumah_tangga', enable_audio_segment: false,
      sfx_setting: 'without_sfx', enable_vo_audit: 1, nextcloud_parent_folder: '/MAKNA_Assets',
      ai_directive: 'Konten edukasi brand; jangan mengarang atau membahas produk tertentu.',
      mandatory_outro_line: ''
    },
    visual_engine: {
      visual_style: 'Cinematic', visual_mode: 'hybrid_lock', video_model: 'veo_31_lite',
      clip_duration: 8, face_visibility: 'Faceless', target_clips_count: 4,
      words_per_clip: '20-22 kata', aspect_ratio: '9:16'
    },
    product_bridging: { is_bridging_active: false },
    visual_swap: {
      is_vso_active: true, character_concept: 'faceless', subject_demographic: 'syari_classic',
      wardrobe_style: 'sequential', lighting_style: 'window_daylight', visual_style_preset: '3d_claymation_cozy'
    },
    workflow: {
      approval_mode: 'storyboard', enable_tts: true, enable_glabs: true, enable_ffmpeg: true,
      enable_social_post: false, upload_markdown: true, upload_spreadsheet: false
    }
  }
};

function merge(...values) {
  return values.reduce((result, value) => {
    for (const [key, next] of Object.entries(value || {})) {
      result[key] = next && typeof next === 'object' && !Array.isArray(next)
        ? merge(result[key] || {}, next)
        : next;
    }
    return result;
  }, {});
}

export function listOperatorPresets() {
  const custom = readCustomPresets();
  return [
    ...Object.entries(PRESETS).map(([key, value]) => ({ key, label: value.label, schema_version: value.schema_version, is_system: true, revision: 1, config: value })),
    ...Object.entries(custom).map(([key, value]) => ({ key, label: value.label, schema_version: value.schema_version || '2', is_system: false, revision: value.revision || 1, config: value }))
  ];
}

export function resolveOperatorPreset(presetKey, overrides = {}) {
  if (!presetKey) return merge({}, overrides);
  const preset = PRESETS[presetKey] || readCustomPresets()[presetKey];
  if (!preset) {
    const error = new Error(`Preset OPC tidak ditemukan: ${presetKey}`);
    error.code = 'OPERATOR_PRESET_NOT_FOUND';
    error.status = 400;
    throw error;
  }
  return merge({}, preset, overrides);
}

function readCustomPresets() {
  return CUSTOM_PRESET_CACHE[getActiveTenantId()]||{};
}

export function getCustomOperatorPresets() { return readCustomPresets(); }
export function isSystemOperatorPreset(key) { return Boolean(PRESETS[key]); }
export function getOperatorPresetConfig(key) { return PRESETS[key] || readCustomPresets()[key] || null; }
export function hydrateOperatorPresetCache(tenantId,value) { try{const parsed=typeof value==='string'?JSON.parse(value||'{}'):value;CUSTOM_PRESET_CACHE[tenantId]=parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{};}catch(_){CUSTOM_PRESET_CACHE[tenantId]={};}return CUSTOM_PRESET_CACHE[tenantId]; }
