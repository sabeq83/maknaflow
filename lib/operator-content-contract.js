import crypto from 'crypto';
import { normalizePillars, validatePlannerDraft } from './content-planner-contract.js';

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
  const approvalMode = input.approval_mode || 'storyboard';
  if (!['storyboard', 'none'].includes(approvalMode)) {
    throw new OperatorContractError('production.approval_mode hanya boleh storyboard atau none.');
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
    status: 'running',
    scheduler_pause_at: approvalMode === 'storyboard' ? 'tts' : null
  };
}

export function normalizeOperatorContentRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new OperatorContractError('Request body wajib berupa object JSON.');
  }
  return {
    planner: normalizePlanner(input.planner || {}),
    selection: normalizeSelection(input.selection || {}),
    production: normalizeProduction(input.production || {})
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
  return { mode, item_ids: itemIds };
}
