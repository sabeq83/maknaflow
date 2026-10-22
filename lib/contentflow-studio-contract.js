import crypto from 'crypto';

export const STUDIO_BATCH_STATUSES = ['draft', 'active', 'paused', 'completed', 'archived'];

export const STUDIO_SLOT_STAGES = [
  'draft',
  'pending',
  'in_progress',
  'needs_review',
  'ready',
  'failed',
  'cancelled'
];

export const STUDIO_TARGET_STATUSES = [
  'awaiting_approval',
  'scheduling',
  'scheduled',
  'verifying',
  'retry_wait',
  'published',
  'failed',
  'manual_published',
  'cancelled'
];

export const SOURCE_KINDS = [
  'planner_pillar',
  'planner_recipe',
  're_campaign',
  'multiplier_lab',
  'recipe_labs'
];

export const ALLOWED_BATCH_ACTIONS = [
  'generate_planner',
  'consume_batch',
  'activate_slots',
  'pause_batch',
  'resume_batch',
  'archive_batch'
];

export const ALLOWED_SLOT_ACTIONS = [
  'retry_production',
  'retry_sync',
  'cancel_slot',
  'review_domain',
  'manual_publish'
];

/**
 * Validates scheduling inputs for Studio slots.
 */
export function validateStudioSchedule({
  scheduledProductionAt,
  scheduledPublishAt,
  timezone = 'Asia/Jakarta',
  targets = []
}) {
  const errors = [];

  if (!scheduledProductionAt) {
    errors.push('Waktu produksi (scheduled_production_at) wajib diisi.');
  }
  if (!scheduledPublishAt) {
    errors.push('Target waktu tayang (scheduled_publish_at) wajib diisi.');
  }

  const prodDate = new Date(scheduledProductionAt);
  const pubDate = new Date(scheduledPublishAt);

  if (isNaN(prodDate.getTime())) {
    errors.push('Format waktu produksi tidak valid.');
  }
  if (isNaN(pubDate.getTime())) {
    errors.push('Format waktu tayang tidak valid.');
  }

  if (!isNaN(prodDate.getTime()) && !isNaN(pubDate.getTime())) {
    if (prodDate.getTime() > pubDate.getTime()) {
      errors.push('Waktu produksi harus mendahului atau sama dengan target waktu tayang.');
    }
  }

  if (!Array.isArray(targets) || targets.length === 0) {
    errors.push('Minimal satu akun tujuan publikasi harus dipilih.');
  } else {
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (!t.accountId && !t.account_id) {
        errors.push(`Target #${i + 1}: account_id wajib diisi.`);
      }
      if (!t.platform) {
        errors.push(`Target #${i + 1}: platform wajib diisi.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Computes canonical SHA-256 revision hash for media, caption, targets, and schedule.
 */
export function computeApprovalRevisionHash({
  mediaUrl,
  caption,
  accountIds = [],
  scheduledPublishAt
}) {
  const canonicalData = {
    mediaUrl: (mediaUrl || '').trim(),
    caption: (caption || '').trim(),
    accounts: [...new Set(accountIds.map(String))].sort(),
    scheduledPublishAt: scheduledPublishAt ? new Date(scheduledPublishAt).toISOString() : ''
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalData))
    .digest('hex');
}

/**
 * Maps a domain engine item status to Studio slot stage status.
 */
export function projectStudioSlotStatus({
  currentStage,
  sourceItem,
  hasFinalMedia = false
}) {
  if (currentStage === 'cancelled') return 'cancelled';
  if (currentStage === 'failed') return 'failed';

  if (!sourceItem) {
    return currentStage || 'draft';
  }

  // If final media is present and synced, mark ready
  if (hasFinalMedia && (sourceItem.contentflow_item_id || sourceItem.drive_link || sourceItem.ffmpeg_output_path)) {
    return 'ready';
  }

  if (sourceItem.workflow_status === 'ready_for_review') {
    return 'needs_review';
  }

  if (sourceItem.status === 'failed' || sourceItem.generation_status === 'failed' || sourceItem.ffmpeg_status === 'failed') {
    return 'failed';
  }

  if (['running', 'in_progress', 'processing'].includes(sourceItem.status) || sourceItem.generation_status === 'in_progress') {
    return 'in_progress';
  }

  return currentStage || 'pending';
}
