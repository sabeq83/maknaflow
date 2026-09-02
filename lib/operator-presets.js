import { getActiveTenantId } from './tenant-context.js';

const CUSTOM_PRESET_CACHE = globalThis.__operatorPresetCache || {};
globalThis.__operatorPresetCache = CUSTOM_PRESET_CACHE;

const PRESETS = {
  brand_editorial_campaign: {
    schema_version: '2',
    label: 'Brand Editorial Campaign',
    campaign_kinds: ['brand_editorial'],
    planner_defaults: {
      target_audience: '',
      content_goal: 'Authority, brand awareness, saves, dan engagement.'
    },
    basic_strategy: {
      narrative_mode: 'Storytelling',
      voice_provider: 'minimax',
      voice_persona: 'Indonesian_professional_anchor_vv2',
      voice_speed: 1.0,
      voice_volume: 1.0,
      tts_model_quality: 'speech-2.8-turbo',
      target_language: 'id-ID',
      target_demographic: 'ibu_rumah_tangga',
      target_demographic_custom: '',
      promotion_style: 'Softselling',
      enable_audio_segment: false,
      sfx_setting: 'without_sfx',
      enable_vo_audit: 1,
      nextcloud_parent_folder: '/MAKNA_Assets',
      ai_directive: 'Konten edukasi dan narasi brand berkualitas; fokus pada storytelling dan nilai tanpa klaim berlebihan.',
      mandatory_outro_line: ''
    },
    visual_engine: {
      visual_style: 'Cinematic',
      visual_mode: 'hybrid_lock',
      video_model: 'veo_31_lite',
      clip_duration: 8,
      face_visibility: 'Faceless',
      target_clips_count: 4,
      words_per_clip: '17-19 kata',
      aspect_ratio: '9:16'
    },
    product_bridging: {
      is_bridging_active: false,
      bridging_mode: 'select_existing',
      bridge_at_clip: 3,
      bridge_duration_clips: 1
    },
    visual_swap: {
      is_vso_active: true,
      character_concept: 'faceless',
      subject_demographic: 'syari_classic',
      wardrobe_style: 'sequential',
      wardrobe_style_custom: '',
      lighting_style: 'window_daylight',
      lighting_style_custom: '',
      visual_style_preset: '3d_claymation_cozy',
      visual_identity_preset_id: 'hands_only_muslimah_sage_kitchen',
      visual_identity_inline_config: null,
      visual_overrides_json: null
    },
    workflow: {
      approval_mode: 'storyboard',
      enable_tts: true,
      enable_glabs: true,
      enable_ffmpeg: true,
      ffmpeg_sync_option: 'smart_sync',
      ffmpeg_video_scale: 1.0,
      ffmpeg_sfx_volume: 0.0,
      ffmpeg_bgm_volume: 0.0,
      enable_social_post: false,
      upload_markdown: true,
      upload_spreadsheet: false,
      auto_sync_contentflow: true
    }
  },
  product_campaign: {
    schema_version: '2',
    label: 'Product Campaign',
    campaign_kinds: ['product_campaign'],
    planner_defaults: {
      target_audience: '',
      content_goal: 'Conversion, product education, dan qualified engagement.'
    },
    basic_strategy: {
      narrative_mode: 'auto',
      voice_provider: 'minimax',
      voice_persona: 'Indonesian_casual_reporter_vv2',
      voice_speed: 1.0,
      voice_volume: 1.0,
      tts_model_quality: 'speech-2.8-turbo',
      target_language: 'id-ID',
      target_demographic: 'custom',
      target_demographic_custom: '',
      promotion_style: 'Softselling',
      enable_audio_segment: false,
      sfx_setting: 'without_sfx',
      enable_vo_audit: 1,
      nextcloud_parent_folder: '/MAKNA_Assets',
      ai_directive: 'Gunakan hanya fakta, USP, dan klaim yang tersedia pada snapshot produk.',
      mandatory_outro_line: ''
    },
    visual_engine: {
      visual_style: 'UGC',
      visual_mode: 'hybrid_lock',
      video_model: 'veo_31_lite',
      clip_duration: 8,
      face_visibility: 'POV',
      target_clips_count: 4,
      words_per_clip: '17-19 kata',
      aspect_ratio: '9:16'
    },
    product_bridging: {
      is_bridging_active: true,
      bridging_mode: 'select_existing',
      bridge_at_clip: 3,
      bridge_duration_clips: 1
    },
    visual_swap: {
      is_vso_active: false,
      character_concept: 'faceless',
      subject_demographic: 'syari_classic',
      wardrobe_style: 'amber_terracotta',
      wardrobe_style_custom: '',
      lighting_style: 'window_daylight',
      lighting_style_custom: '',
      visual_style_preset: '3d_claymation_cozy',
      visual_identity_preset_id: null,
      visual_identity_inline_config: null,
      visual_overrides_json: null
    },
    workflow: {
      approval_mode: 'start_frames',
      enable_tts: true,
      enable_glabs: true,
      enable_ffmpeg: true,
      ffmpeg_sync_option: 'smart_sync',
      ffmpeg_video_scale: 1.0,
      ffmpeg_sfx_volume: 0.0,
      ffmpeg_bgm_volume: 0.0,
      enable_social_post: false,
      upload_markdown: true,
      upload_spreadsheet: false,
      auto_sync_contentflow: true
    }
  }
};

export const PRESET_ALIASES = {
  brand_editorial_v1: 'brand_editorial_campaign',
  nutribake_editorial_v1: 'brand_editorial_campaign',
  product_campaign_v1: 'product_campaign',
  product_education_v1: 'product_campaign',
  product_problem_solution_v1: 'product_campaign',
  dapurbotani_kampanye_produk_4_klip: 'product_campaign'
};

const CAMPAIGN_KINDS = ['brand_editorial', 'product_campaign'];

export function normalizePresetCampaignKinds(value, { legacyDefault = ['brand_editorial'] } = {}) {
  const kinds = Array.isArray(value) ? [...new Set(value.map(String))] : legacyDefault;
  if (!kinds.length || kinds.some(kind => !CAMPAIGN_KINDS.includes(kind))) {
    const error = new Error('campaign_kinds preset tidak valid.');
    error.status = 400;
    throw error;
  }
  return kinds;
}

export function resolvePresetCampaignKinds(preset) {
  const config = preset?.config || preset || {};
  if (Array.isArray(config.campaign_kinds)) {
    return { kinds: normalizePresetCampaignKinds(config.campaign_kinds), source: preset?.is_system ? 'system' : 'explicit' };
  }
  if (config.product_bridging?.is_bridging_active === true) {
    return { kinds: ['product_campaign'], source: 'inferred', reason: 'product_bridging_active' };
  }
  const identity = `${preset?.key || ''} ${preset?.label || config.label || ''}`.toLowerCase();
  if (/product[ _-]?campaign/.test(identity)) {
    return { kinds: ['product_campaign'], source: 'inferred', reason: 'product_campaign_identity' };
  }
  return { kinds: ['brand_editorial'], source: 'inferred', reason: 'legacy_default' };
}

export function isOperatorPresetCompatible(preset, campaignKind, tenantId = getActiveTenantId()) {
  const target = typeof preset === 'string' ? (getOperatorPresetConfig(preset, tenantId) || { key: preset }) : preset;
  return resolvePresetCampaignKinds(target).kinds.includes(campaignKind);
}

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

function readCustomPresets(tenantId = getActiveTenantId()) {
  const effectiveTenantId = tenantId || getActiveTenantId() || 'default_tenant';
  return CUSTOM_PRESET_CACHE[effectiveTenantId] || {};
}

export function getCustomOperatorPresets(tenantId = getActiveTenantId()) {
  return readCustomPresets(tenantId);
}

export function isSystemOperatorPreset(key) {
  return Boolean(PRESETS[key]);
}

export function getOperatorPresetConfig(key, tenantId = getActiveTenantId()) {
  if (!key) return null;
  const custom = readCustomPresets(tenantId);
  if (custom[key]) return custom[key];
  if (PRESETS[key]) return PRESETS[key];
  const alias = PRESET_ALIASES[key];
  if (alias) {
    if (custom[alias]) return custom[alias];
    if (PRESETS[alias]) return PRESETS[alias];
  }
  return null;
}

export function listOperatorPresets(tenantId = getActiveTenantId()) {
  const custom = readCustomPresets(tenantId);
  return [
    ...Object.entries(PRESETS).map(([key, value]) => ({
      key,
      label: value.label,
      schema_version: value.schema_version,
      is_system: true,
      revision: 1,
      config: value
    })),
    ...Object.entries(custom).map(([key, value]) => ({
      key,
      label: value.label,
      schema_version: value.schema_version || '2',
      is_system: false,
      revision: value.revision || 1,
      config: value
    }))
  ].map(preset => {
    const resolved = resolvePresetCampaignKinds(preset);
    return {
      ...preset,
      campaign_kinds: resolved.kinds,
      campaign_kinds_source: resolved.source,
      campaign_kinds_reason: resolved.reason || null,
      config: { ...preset.config, campaign_kinds: resolved.kinds }
    };
  });
}

export function resolveOperatorPreset(presetKey, overrides = {}, tenantId = getActiveTenantId()) {
  if (!presetKey) return merge({}, overrides);
  const custom = readCustomPresets(tenantId);
  const aliasKey = PRESET_ALIASES[presetKey] || presetKey;
  const preset = custom[presetKey] || PRESETS[presetKey] || custom[aliasKey] || PRESETS[aliasKey];

  if (!preset) {
    const error = new Error(`Preset OPC tidak ditemukan: ${presetKey}`);
    error.code = 'OPERATOR_PRESET_NOT_FOUND';
    error.status = 400;
    throw error;
  }
  return merge({}, preset, overrides);
}

export function hydrateOperatorPresetCache(tenantId, value) {
  const effectiveTenantId = tenantId || 'default_tenant';
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value || '{}') : value;
    CUSTOM_PRESET_CACHE[effectiveTenantId] = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    CUSTOM_PRESET_CACHE[effectiveTenantId] = {};
  }
  return CUSTOM_PRESET_CACHE[effectiveTenantId];
}
