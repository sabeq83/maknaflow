import { getActiveTenantId } from './tenant-context.js';

const CUSTOM_PRESET_CACHE=globalThis.__operatorPresetCache||{};
globalThis.__operatorPresetCache=CUSTOM_PRESET_CACHE;

const PRESETS = {
  nutribake_editorial_v1: {
    schema_version: '2',
    label: 'Nutribake Editorial',
    campaign_kinds: ['brand_editorial'],
    planner_defaults: { target_audience: 'Ibu rumah tangga dan keluarga muda usia 25–45 tahun.', content_goal: 'Authority, engagement, saves, dan shares.' },
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
  },
  product_campaign_v1: {
    schema_version: '2',
    label: 'Product Campaign — OPC',
    campaign_kinds: ['product_campaign'],
    planner_defaults: { target_audience: '', content_goal: 'Conversion, product education, dan qualified engagement.' },
    basic_strategy: {
      narrative_mode: 'auto', voice_provider: 'minimax', target_language: 'id-ID',
      target_demographic: 'custom', enable_audio_segment: false,
      sfx_setting: 'without_sfx', enable_vo_audit: 1, nextcloud_parent_folder: '/MAKNA_Assets',
      ai_directive: 'Gunakan hanya fakta, USP, dan klaim yang tersedia pada snapshot produk.',
      mandatory_outro_line: ''
    },
    visual_engine: {
      visual_style: 'UGC', visual_mode: 'hybrid_lock', video_model: 'veo_31_lite',
      clip_duration: 8, face_visibility: 'POV', target_clips_count: 4,
      words_per_clip: '17-19 kata', aspect_ratio: '9:16'
    },
    product_bridging: { is_bridging_active: true, bridging_mode: 'select_existing' },
    visual_swap: { is_vso_active: false },
    workflow: {
      approval_mode: 'start_frames', enable_tts: true, enable_glabs: true, enable_ffmpeg: true,
      enable_social_post: false, upload_markdown: true, upload_spreadsheet: false,
      auto_sync_contentflow: true
    }
  },
  product_education_v1: {
    schema_version: '2', label: 'Product Education — OPC', campaign_kinds: ['product_campaign'],
    planner_defaults: { target_audience: '', content_goal: 'Product education, trust, saves, dan consideration.' },
    basic_strategy: { narrative_mode: 'Educational Review', voice_provider: 'minimax', target_language: 'id-ID', target_demographic: 'custom', target_demographic_custom: '', enable_audio_segment: false, sfx_setting: 'without_sfx', enable_vo_audit: 1, nextcloud_parent_folder: '/MAKNA_Assets', ai_directive: 'Jelaskan manfaat dan penggunaan hanya dari fakta pada snapshot produk.', mandatory_outro_line: '' },
    visual_engine: { visual_style: 'Cinematic', visual_mode: 'hybrid_lock', video_model: 'veo_31_lite', clip_duration: 8, face_visibility: 'POV', target_clips_count: 4, words_per_clip: '20-22 kata', aspect_ratio: '9:16' },
    product_bridging: { is_bridging_active: true, bridging_mode: 'select_existing' }, visual_swap: { is_vso_active: false },
    workflow: { approval_mode: 'start_frames', enable_tts: true, enable_glabs: true, enable_ffmpeg: true, enable_social_post: false, upload_markdown: true, upload_spreadsheet: false, auto_sync_contentflow: true }
  },
  product_problem_solution_v1: {
    schema_version: '2', label: 'Product Problem–Solution Demo — OPC', campaign_kinds: ['product_campaign'],
    planner_defaults: { target_audience: '', content_goal: 'Problem awareness, product demonstration, dan conversion.' },
    basic_strategy: { narrative_mode: 'Storytelling', voice_provider: 'minimax', target_language: 'id-ID', target_demographic: 'custom', target_demographic_custom: '', enable_audio_segment: false, sfx_setting: 'without_sfx', enable_vo_audit: 1, nextcloud_parent_folder: '/MAKNA_Assets', ai_directive: 'Bangun alur masalah–solusi tanpa klaim di luar snapshot produk.', mandatory_outro_line: '' },
    visual_engine: { visual_style: 'UGC', visual_mode: 'hybrid_lock', video_model: 'veo_31_lite', clip_duration: 8, face_visibility: 'POV', target_clips_count: 4, words_per_clip: '17-19 kata', aspect_ratio: '9:16' },
    product_bridging: { is_bridging_active: true, bridging_mode: 'select_existing' }, visual_swap: { is_vso_active: false },
    workflow: { approval_mode: 'start_frames', enable_tts: true, enable_glabs: true, enable_ffmpeg: true, enable_social_post: false, upload_markdown: true, upload_spreadsheet: false, auto_sync_contentflow: true }
  },
  dapurbotani_kampanye_produk_4_klip: {
    schema_version: '2',
    label: 'Dapur Botani 4 Klip Product Campaign',
    campaign_kinds: ['product_campaign'],
    planner_defaults: { target_audience: 'Dewasa muda dan keluarga sehat.', content_goal: 'Edukasi nutrisi, resep sehat, dan konversi produk.' },
    basic_strategy: {
      narrative_mode: 'Educational Review', voice_provider: 'minimax', target_language: 'id-ID',
      target_demographic: 'custom', enable_audio_segment: false, sfx_setting: 'without_sfx',
      enable_vo_audit: 1, nextcloud_parent_folder: '/MAKNA_Assets/DapurBotani',
      ai_directive: 'Fokus pada manfaat oat gandum utuh, kepraktisan penyajian, dan hidup sehat alami.',
      mandatory_outro_line: ''
    },
    visual_engine: {
      visual_style: 'UGC', visual_mode: 'hybrid_lock', video_model: 'veo_31_lite',
      clip_duration: 8, face_visibility: 'POV', target_clips_count: 4,
      words_per_clip: '17-19 kata', aspect_ratio: '9:16'
    },
    product_bridging: { is_bridging_active: true, bridging_mode: 'select_existing' },
    visual_swap: { is_vso_active: false },
    workflow: {
      approval_mode: 'start_frames', enable_tts: true, enable_glabs: true, enable_ffmpeg: true,
      enable_social_post: false, upload_markdown: true, upload_spreadsheet: false,
      auto_sync_contentflow: true
    }
  }
};

const CAMPAIGN_KINDS = ['brand_editorial', 'product_campaign'];
export function normalizePresetCampaignKinds(value, { legacyDefault = ['brand_editorial'] } = {}) {
  const kinds = Array.isArray(value) ? [...new Set(value.map(String))] : legacyDefault;
  if (!kinds.length || kinds.some(kind => !CAMPAIGN_KINDS.includes(kind))) {
    const error = new Error('campaign_kinds preset tidak valid.'); error.status = 400; throw error;
  }
  return kinds;
}
export function resolvePresetCampaignKinds(preset) {
  const config = preset?.config || preset || {};
  if (Array.isArray(config.campaign_kinds)) return { kinds: normalizePresetCampaignKinds(config.campaign_kinds), source: preset?.is_system ? 'system' : 'explicit' };
  if (config.product_bridging?.is_bridging_active === true) return { kinds: ['product_campaign'], source: 'inferred', reason: 'product_bridging_active' };
  const identity = `${preset?.key || ''} ${preset?.label || config.label || ''}`.toLowerCase();
  if (/product[ _-]?campaign/.test(identity)) return { kinds: ['product_campaign'], source: 'inferred', reason: 'product_campaign_identity' };
  return { kinds: ['brand_editorial'], source: 'inferred', reason: 'legacy_default' };
}
export function isOperatorPresetCompatible(preset, campaignKind) {
  return resolvePresetCampaignKinds(preset).kinds.includes(campaignKind);
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

export function listOperatorPresets() {
  const custom = readCustomPresets();
  return [
    ...Object.entries(PRESETS).map(([key, value]) => ({ key, label: value.label, schema_version: value.schema_version, is_system: true, revision: 1, config: value })),
    ...Object.entries(custom).map(([key, value]) => ({ key, label: value.label, schema_version: value.schema_version || '2', is_system: false, revision: value.revision || 1, config: value }))
  ].map(preset => { const resolved=resolvePresetCampaignKinds(preset); return {...preset,campaign_kinds:resolved.kinds,campaign_kinds_source:resolved.source,campaign_kinds_reason:resolved.reason||null,config:{...preset.config,campaign_kinds:resolved.kinds}}; });
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
