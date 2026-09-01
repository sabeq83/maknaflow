import crypto from 'crypto';
import { normalizePublishingPolicy } from './agent-automation-contract.js';

export const CONTENT_RUN_ERROR_CODES = {
  CATALOG_AMBIGUOUS: 'CATALOG_AMBIGUOUS',
  BRAND_NOT_FOUND: 'BRAND_NOT_FOUND',
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  PRESET_NOT_FOUND: 'PRESET_NOT_FOUND',
  PRESET_CAMPAIGN_KIND_MISMATCH: 'PRESET_CAMPAIGN_KIND_MISMATCH',
  VIDEO_COUNT_INVALID: 'VIDEO_COUNT_INVALID',
  RUN_ONCE_DISABLED: 'RUN_ONCE_DISABLED',
  IDEMPOTENCY_KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  RUN_ENQUEUE_FAILED: 'RUN_ENQUEUE_FAILED',
  RUN_NOT_FOUND: 'RUN_NOT_FOUND',
  HERMES_RESEARCH_UNAVAILABLE: 'HERMES_RESEARCH_UNAVAILABLE',
  MANUAL_REVIEW_REQUIRED: 'MANUAL_REVIEW_REQUIRED'
};

export const ALLOWED_PRODUCT_CAMPAIGN_COUNTS = [6, 12, 18, 24, 30];

export class ContentRunError extends Error {
  constructor(message, code = 'CONTENT_RUN_VALIDATION', status = 400) {
    super(message);
    this.name = 'ContentRunError';
    this.code = code;
    this.status = status;
  }
}

export function assertHermesRunOnceEnabled(env = process.env) {
  if (env?.ENABLE_HERMES_RUN_ONCE !== 'true') {
    throw new ContentRunError('Hermes run-once sementara dinonaktifkan.', CONTENT_RUN_ERROR_CODES.RUN_ONCE_DISABLED, 503);
  }
}

export function normalizeContentRunRequest(input = {}) {
  if (!input || typeof input !== 'object') {
    throw new ContentRunError('Request body harus berupa objek JSON.', 'INVALID_CONTENT_RUN_REQUEST', 400);
  }

  const mode = input.mode || 'run_once';
  if (mode !== 'run_once') {
    throw new ContentRunError('Mode hanya mendukung "run_once".', 'INVALID_CONTENT_RUN_MODE', 400);
  }

  const brandProfileId = String(input.brand_profile_id || input.brand_id || '').trim();
  if (!brandProfileId) {
    throw new ContentRunError('brand_profile_id wajib diisi.', CONTENT_RUN_ERROR_CODES.BRAND_NOT_FOUND, 400);
  }

  const productId = String(input.product_id || '').trim();
  if (!productId) {
    throw new ContentRunError('product_id wajib diisi.', CONTENT_RUN_ERROR_CODES.PRODUCT_NOT_FOUND, 400);
  }

  const presetKey = String(input.preset_key || input.preset || '').trim();
  if (!presetKey) {
    throw new ContentRunError('preset_key wajib diisi.', CONTENT_RUN_ERROR_CODES.PRESET_NOT_FOUND, 400);
  }

  const videoCount = Number(input.video_count || input.production_count || 6);
  if (!ALLOWED_PRODUCT_CAMPAIGN_COUNTS.includes(videoCount)) {
    throw new ContentRunError(
      `Jumlah video (${videoCount}) tidak valid. Product Campaign mendukung siklus: ${ALLOWED_PRODUCT_CAMPAIGN_COUNTS.join(', ')}.`,
      CONTENT_RUN_ERROR_CODES.VIDEO_COUNT_INVALID,
      400
    );
  }

  const name = String(input.name || '').trim() || `Campaign One Time — ${productId}`;
  const platform = String(input.platform || 'tiktok').toLowerCase().trim();
  const allowedPlatforms = ['tiktok', 'facebook', 'instagram', 'youtube', 'threads', 'linkedin'];
  if (!allowedPlatforms.includes(platform)) {
    throw new ContentRunError(`Platform "${platform}" tidak didukung.`, 'PLATFORM_NOT_SUPPORTED', 400);
  }

  const reviewMode = String(input.review_mode || 'start_frames').toLowerCase().trim();
  if (!['start_frames', 'creative', 'none'].includes(reviewMode)) {
    throw new ContentRunError('review_mode hanya boleh start_frames, creative, atau none.', 'INVALID_REVIEW_MODE', 400);
  }

  let research = null;
  if (input.research && typeof input.research === 'object') {
    const query = String(input.research.query || '').trim();
    if (!query) {
      throw new ContentRunError('Query riset wajib diisi jika research diaktifkan.', 'RESEARCH_QUERY_REQUIRED', 400);
    }
    research = {
      query,
      locale: String(input.research.locale || 'id-ID').trim(),
      max_research_age_hours: Math.min(168, Math.max(1, Number(input.research.max_research_age_hours || 24))),
      production_count: videoCount,
      source_policy: String(input.research.source_policy || 'primary_and_reputable').trim(),
      prohibited_topics: Array.isArray(input.research.prohibited_topics)
        ? input.research.prohibited_topics.map(t => String(t).trim()).filter(Boolean)
        : []
    };
  }

  const publishingPolicy = normalizePublishingPolicy(
    input.publishing_policy || input.publishing || { mode: 'draft_only' }
  );

  return {
    mode: 'run_once',
    name,
    brand_profile_id: brandProfileId,
    product_id: productId,
    preset_key: presetKey,
    video_count: videoCount,
    platform,
    review_mode: reviewMode,
    research,
    publishing_policy: publishingPolicy
  };
}

export function hashContentRunRequest(request) {
  const canonical = {
    mode: request.mode || 'run_once',
    name: request.name || '',
    brand_profile_id: request.brand_profile_id || '',
    product_id: request.product_id || '',
    preset_key: request.preset_key || '',
    video_count: Number(request.video_count || 6),
    platform: request.platform || 'tiktok',
    review_mode: request.review_mode || 'start_frames',
    research: request.research ? {
      query: request.research.query,
      locale: request.research.locale,
      max_research_age_hours: request.research.max_research_age_hours,
      production_count: request.research.production_count,
      source_policy: request.research.source_policy,
      prohibited_topics: request.research.prohibited_topics || []
    } : null,
    publishing_policy: {
      mode: request.publishing_policy?.mode || 'draft_only',
      account_ids: request.publishing_policy?.account_ids || [],
      publish_time: request.publishing_policy?.publish_time || null,
      timezone: request.publishing_policy?.timezone || null
    }
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonical))
    .digest('hex');
}
