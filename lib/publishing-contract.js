/**
 * Publishing Scheduler Contract & Constants Module
 * Standardizes lifecycle statuses, platform definitions, input validation, and provider error classification.
 */

export const PUBLISHING_PLATFORMS = [
  'facebook', 'instagram', 'threads', 'tiktok', 'linkedin', 'youtube'
];

export const PUBLISHING_MODES = ['draft', 'live'];

export const PUBLISHING_STATUSES = [
  'validating',
  'scheduled',
  'processing',
  'creating_container',
  'uploading_media',
  'waiting_media',
  'publishing',
  'verifying',
  'retry_wait',
  'draft_created',
  'published',
  'failed',
  'needs_review',
  'cancelled'
];

export const APPROVAL_STATUSES = [
  'not_required',
  'pending_approval',
  'approved',
  'rejected'
];

export const MEDIA_TYPES = [
  'text_only',
  'image',
  'video',
  'reels'
];

export const FACEBOOK_REELS_STAGES = [
  'creating_container',
  'uploading_media',
  'waiting_media',
  'publishing',
  'verifying'
];

export function validatePlatformMediaContract({ platform, mediaType, publishMode }) {
  if (!['facebook', 'instagram'].includes(platform)) {
    throw new Error(`Platform Meta harus salah satu dari: facebook, instagram`);
  }
  if (!MEDIA_TYPES.includes(mediaType)) {
    throw new Error(`media_type harus salah satu dari: ${MEDIA_TYPES.join(', ')}`);
  }
  if (!PUBLISHING_MODES.includes(publishMode)) {
    throw new Error(`publish_mode harus salah satu dari: ${PUBLISHING_MODES.join(', ')}`);
  }
  if (platform === 'instagram' && publishMode === 'draft') {
    throw new Error('Instagram draft belum didukung. Pilih mode live agar tidak terjadi publikasi diam-diam.');
  }
  if (platform === 'instagram' && mediaType === 'text_only') {
    throw new Error('Instagram membutuhkan media image, video, atau reels.');
  }
  return { platform, mediaType, publishMode };
}

export function validateProviderMediaContract({ provider, platform, mediaType, publishMode }) {
  if (provider === 'repliz') {
    if (!PUBLISHING_PLATFORMS.includes(platform)) {
      throw new Error(`Platform Repliz harus salah satu dari: ${PUBLISHING_PLATFORMS.join(', ')}`);
    }
    if (!MEDIA_TYPES.includes(mediaType)) {
      throw new Error(`media_type harus salah satu dari: ${MEDIA_TYPES.join(', ')}`);
    }
    if (!PUBLISHING_MODES.includes(publishMode)) {
      throw new Error(`publish_mode harus salah satu dari: ${PUBLISHING_MODES.join(', ')}`);
    }
    if (mediaType === 'text_only') {
      throw new Error('Repliz membutuhkan media image, video, atau reels.');
    }
    return { platform, mediaType, publishMode };
  }
  return validatePlatformMediaContract({ platform, mediaType, publishMode });
}

/**
 * Sanitasi pesan error agar tidak membocorkan access token, secret, atau raw private URL.
 * @param {string|Error} err 
 * @returns {string}
 */
export function sanitizeErrorMessage(err) {
  if (!err) return 'Unknown error';
  let message = typeof err === 'string' ? err : (err.message || String(err));

  // Mask tokens
  message = message.replace(/(access_token|token|key|secret|password)=([^\s&"'`]+)/gi, '$1=***REDACTED***');
  message = message.replace(/EAA[A-Za-z0-9]+/g, '***TOKEN_REDACTED***');
  message = message.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer ***TOKEN_REDACTED***');

  // Shorten excessively long error messages
  if (message.length > 500) {
    message = message.substring(0, 497) + '...';
  }

  return message;
}

/**
 * Validasi payload penjadwalan publikasi.
 * @param {Object} input 
 * @returns {Object} Normalized input or throws error
 */
export function validateScheduleRequest(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Payload jadwal tidak valid.');
  }

  const {
    content_id,
    account_ids, // array or single
    platform,    // optional if account provides it, or explicit
    publish_mode = 'draft',
    media_type = 'text_only',
    caption = '',
    media_url = '',
    scheduled_at,
    timezone = 'Asia/Jakarta'
  } = input;

  if (!content_id || typeof content_id !== 'string') {
    throw new Error('content_id wajib diisi.');
  }

  const accounts = Array.isArray(account_ids) ? account_ids : (input.account_id ? [input.account_id] : []);
  if (accounts.length === 0) {
    throw new Error('Minimal satu account_id wajib dipilih.');
  }

  if (!PUBLISHING_MODES.includes(publish_mode)) {
    throw new Error(`publish_mode harus salah satu dari: ${PUBLISHING_MODES.join(', ')}`);
  }

  if (!MEDIA_TYPES.includes(media_type)) {
    throw new Error(`media_type harus salah satu dari: ${MEDIA_TYPES.join(', ')}`);
  }

  if ((media_type === 'image' || media_type === 'video' || media_type === 'reels') && !media_url) {
    throw new Error(`media_url wajib diisi untuk media type '${media_type}'.`);
  }

  if (!scheduled_at) {
    throw new Error('scheduled_at wajib diisi.');
  }

  const scheduledDate = new Date(scheduled_at);
  if (isNaN(scheduledDate.getTime())) {
    throw new Error('Format scheduled_at tidak valid (gunakan format ISO 8601 UTC).');
  }

  return {
    content_id: content_id.trim(),
    account_ids: accounts.map(a => String(a).trim()),
    platform: platform ? String(platform).trim().toLowerCase() : null,
    publish_mode,
    media_type,
    caption: String(caption || '').trim(),
    media_url: String(media_url || '').trim(),
    scheduled_at: scheduledDate.toISOString(),
    timezone: timezone || 'Asia/Jakarta'
  };
}

/**
 * Klasifikasi kegagalan dari Meta Graph API / Provider:
 * - 'transient': error sementara (429, timeout sebelum respon, network connection reset) -> boleh retry backoff
 * - 'permanent': error permanen (401 invalid token, 403 permission denied, 400 bad request / invalid media format) -> status 'failed'
 * - 'unknown_outcome': request publish mungkin sudah terkirim tapi timeout di response -> status 'verifying'
 * - 'needs_review': butuh perhatian operator (misal token expired atau container rejected)
 */
export function classifyProviderFailure(error, httpStatus = 0, stage = 'publishing') {
  const message = (error?.message || String(error || '')).toLowerCase();
  const code = error?.code || error?.error_code || error?.error?.code || null;
  const subcode = error?.error_subcode || error?.error?.error_subcode || null;

  // Unknown outcome: network timeout during the critical publishing step
  if (stage === 'publishing' && (
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('esockettimedout') ||
    message.includes('network error') ||
    message.includes('aborted')
  )) {
    return {
      type: 'unknown_outcome',
      shouldRetryImmediately: false,
      targetStatus: 'verifying',
      reason: 'Network timeout saat proses publikasi. Menunggu verifikasi status eksternal.'
    };
  }

  // Transient / Rate limit / Provider 5xx
  if (
    httpStatus === 429 ||
    httpStatus >= 500 ||
    code === 4 ||
    code === 17 ||
    code === 32 ||
    code === 613 || // Rate limit Graph API
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('temporarily unavailable') ||
    message.includes('please reduce the amount of data')
  ) {
    return {
      type: 'transient',
      shouldRetryImmediately: false,
      targetStatus: 'retry_wait',
      reason: 'Gangguan sementara provider atau limit kuota.'
    };
  }

  // Token / Permission issues -> needs_review / operator action
  if (
    code === 190 || // Invalid OAuth access token
    code === 10 ||  // Permission denied
    subcode === 463 || // Expired token
    subcode === 467 ||
    message.includes('session has expired') ||
    message.includes('access token') ||
    message.includes('permission')
  ) {
    return {
      type: 'needs_review',
      shouldRetryImmediately: false,
      targetStatus: 'needs_review',
      reason: 'Token akses atau izin Meta kedaluwarsa/tidak sah. Perlu perbaikan akun.'
    };
  }

  // Permanent failure
  return {
    type: 'permanent',
    shouldRetryImmediately: false,
    targetStatus: 'failed',
    reason: 'Gagal permanen pada validasi Meta Graph API.'
  };
}

/**
 * Hitung delay exponential backoff untuk retry dengan jitter.
 * @param {number} attemptCount (1-indexed)
 * @returns {number} Delay in milliseconds
 */
export function calculateRetryDelay(attemptCount) {
  // Base intervals: 1 min, 5 min, 15 min
  const baseDelays = [60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000];
  const baseMs = baseDelays[Math.min(attemptCount - 1, baseDelays.length - 1)] || 15 * 60 * 1000;
  
  // Tambahkan jitter +/- 20%
  const jitterFactor = 0.8 + Math.random() * 0.4;
  return Math.round(baseMs * jitterFactor);
}
