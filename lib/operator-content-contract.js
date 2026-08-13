import crypto from 'crypto';
import { normalizePillars, validatePlannerDraft } from './content-planner-contract.js';
import { resolveOperatorPreset } from './operator-presets.js';

export class OperatorContractError extends Error {
  constructor(message, code = 'OPERATOR_VALIDATION', status = 400) {
    super(message);
    this.name = 'OperatorContractError';
    this.code = code;
    this.status = status;
  }
}

function normalizeBoolean(value, fallback) {
  return value === undefined ? fallback : Boolean(value);
}

function normalizePlanner(input = {}) {
  const plannerCount = Number.parseInt(input.planner_count ?? 12, 10);
  if (!Number.isInteger(plannerCount) || plannerCount < 1 || plannerCount > 30) {
    throw new OperatorContractError('planner_count wajib berupa angka 1 sampai 30.');
  }

  const planner = {
    ...input,
    planner_focus: input.planner_focus || 'product_campaign',
    planner_count: plannerCount,
    pillars: normalizePillars(input.pillars),
    platform: String(input.platform || 'tiktok').trim().toLowerCase()
  };
  try {
    validatePlannerDraft(planner);
  } catch (error) {
    if (error.code === 'CONTENT_PLANNER_VALIDATION') {
      throw new OperatorContractError(error.message, error.code, 400);
    }
    throw error;
  }
  return planner;
}

function normalizeSelection(input = {}) {
  const mode = input.mode || 'all';
  if (!['all', 'row_ids'].includes(mode)) {
    throw new OperatorContractError('selection.mode hanya boleh all atau row_ids.');
  }
  const rowIds = Array.isArray(input.row_ids)
    ? [...new Set(input.row_ids.map(value => String(value).trim()).filter(Boolean))]
    : [];
  if (mode === 'row_ids' && rowIds.length === 0) {
    throw new OperatorContractError('selection.row_ids wajib diisi saat mode row_ids.');
  }
  return { mode, row_ids: mode === 'row_ids' ? rowIds : [] };
}

function normalizeProduction(input = {}) {
  const rawApprovalMode = input.approval_mode || 'creative';
  const approvalMode = rawApprovalMode === 'storyboard' ? 'creative' : rawApprovalMode;
  if (!['creative', 'start_frames', 'none'].includes(approvalMode)) {
    throw new OperatorContractError('production.approval_mode hanya boleh creative, start_frames, atau none.');
  }
  if (input.enable_social_post === true) {
    throw new OperatorContractError(
      'Operator API v1 belum mengizinkan social posting.',
      'OPERATOR_SOCIAL_POST_DISABLED'
    );
  }
  const clips = Number.parseInt(input.target_clips_count ?? 4, 10);
  if (!Number.isInteger(clips) || clips < 1 || clips > 12) {
    throw new OperatorContractError('target_clips_count wajib berupa angka 1 sampai 12.');
  }
  return {
    ...input,
    approval_mode: approvalMode,
    target_clips_count: clips,
    enable_tts: normalizeBoolean(input.enable_tts, true),
    enable_glabs: normalizeBoolean(input.enable_glabs, true),
    enable_ffmpeg: normalizeBoolean(input.enable_ffmpeg, true),
    enable_social_post: false,
    upload_markdown: normalizeBoolean(input.upload_markdown, true),
    upload_spreadsheet: normalizeBoolean(input.upload_spreadsheet, false),
    is_bridging_active: normalizeBoolean(input.is_bridging_active, false),
    auto_sync_contentflow: normalizeBoolean(input.auto_sync_contentflow, false),
    status: 'running',
    preproduction_checkpoint: approvalMode === 'start_frames' ? 'start_frames' : 'creative',
    scheduler_pause_at: approvalMode === 'none' ? null : 'tts'
  };
}

const ENUMS = {
  narrative_mode: ['auto', 'Storytelling', 'Promo Hard Sell', 'Educational Review'],
  visual_style: ['Cinematic', 'UGC', 'Macrophotography'],
  visual_mode: ['hybrid_lock', 'pure_t2v'],
  video_model: ['veo_31_lite', 'veo_31_fast', 'veo_31_quality', 'veo_31_lite_relaxed', 'omni_flash'],
  face_visibility: ['Faceless', 'POV', 'Silhouette', 'cartoon_face'],
  words_per_clip: ['20-22 kata', '17-19 kata', '15-16 kata'],
  aspect_ratio: ['9:16', '16:9', '1:1'],
  target_demographic: ['genz_casual', 'ibu_rumah_tangga', 'professional_executive', 'hijab_syari_family', 'fitness_health_enthusiast', 'custom'],
  wardrobe_style: ['random', 'sequential', 'amber_terracotta', 'mocca_caramel', 'warm_grey', 'sage_muted', 'lavender_lilac', 'butter_yellow', 'teal_navy', 'olive_modern', 'mahogany_maroon', 'cloud_dancer', 'custom']
};

function assertEnum(name, value) {
  if (value !== undefined && ENUMS[name] && !ENUMS[name].includes(value)) {
    throw new OperatorContractError(`${name} tidak valid: ${value}`);
  }
}

function normalizeOpc(input = {}) {
  let resolved;
  try { resolved = resolveOperatorPreset(input.preset, input); }
  catch (error) {
    if (error.code === 'OPERATOR_PRESET_NOT_FOUND' && input.schema_version === '2' && input.basic_strategy && input.visual_engine && input.workflow) resolved = { ...input };
    else throw error;
  }
  const basic = resolved.basic_strategy || {};
  const visual = resolved.visual_engine || {};
  const bridging = resolved.product_bridging || {};
  const swap = resolved.visual_swap || {};
  const workflow = resolved.workflow || {};
  ['narrative_mode', 'target_demographic'].forEach(key => assertEnum(key, basic[key]));
  ['visual_style', 'visual_mode', 'video_model', 'face_visibility', 'words_per_clip', 'aspect_ratio'].forEach(key => assertEnum(key, visual[key]));
  assertEnum('wardrobe_style', swap.wardrobe_style);
  if (Number(visual.clip_duration) === 10 && visual.video_model !== 'omni_flash') {
    throw new OperatorContractError('clip_duration 10 detik hanya tersedia untuk omni_flash.');
  }
  const visualOverrides = swap.is_vso_active === false ? null : JSON.stringify({ ...swap, is_vso_active: true });
  const flattened = {
    ...basic, ...visual, ...bridging, ...workflow,
    visual_overrides_json: visualOverrides,
    enable_social_post: false
  };
  return { config: { ...resolved, preset: input.preset || null }, production: normalizeProduction(flattened) };
}

export function normalizeOperatorContentRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new OperatorContractError('Request body wajib berupa object JSON.');
  }
  const normalizedOpc = input.opc ? normalizeOpc(input.opc) : null;
  return {
    contract_version: normalizedOpc ? '2' : '1',
    planner: normalizePlanner(input.planner || {}),
    selection: normalizeSelection(input.selection || {}),
    ...(normalizedOpc ? { opc: normalizedOpc.config } : {}),
    production: normalizedOpc?.production || normalizeProduction(input.production || {})
  };
}

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = sortDeep(value[key]);
    return result;
  }, {});
}

export function hashOperatorRequest(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(sortDeep(payload))).digest('hex');
}

export function normalizeOperatorApproval(input = {}) {
  const mode = input.mode || 'approve_unchanged';
  if (mode !== 'approve_unchanged') {
    throw new OperatorContractError('Mode approval v1 hanya approve_unchanged.');
  }
  const itemIds = Array.isArray(input.item_ids)
    ? [...new Set(input.item_ids.map(Number).filter(Number.isInteger))]
    : [];
  return {
    mode,
    item_ids: itemIds,
    review_revision: input.review_revision ? String(input.review_revision) : null,
    review_sha256: input.review_sha256 ? String(input.review_sha256) : null
  };
}

export function normalizeOperatorApprovalMode(value) {
  const mode = value === 'storyboard' ? 'creative' : (value || 'creative');
  if (!['creative', 'start_frames', 'none'].includes(mode)) {
    throw new OperatorContractError('approval_mode tidak valid.');
  }
  return mode;
}
