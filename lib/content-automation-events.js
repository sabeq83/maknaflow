export const CONTENT_AUTOMATION_EVENTS = Object.freeze({
  FEATURE_FLAGS_UPDATED: 'product_campaign_feature_flags_updated',
  START_FRAMES_QUEUED: 'start_frames_queued',
  START_FRAMES_READY: 'start_frames_ready',
  REVIEW_AWAITING: 'awaiting_approval',
  REVIEW_APPROVED: 'review_approved',
  REVIEW_HELD: 'review_held',
  REVIEW_RESUMED: 'review_resumed',
  REVIEW_REJECTED: 'review_rejected',
  STAGE_RETRYING: 'stage_retrying',
  CONTENTFLOW_COMPLETED: 'contentflow_completed',
  RUN_COMPLETED: 'completed',
  RUN_FAILED: 'failed'
});

export function automationEventKey({ tenantId, runId = '-', itemId = '-', event, revision = '-' }) {
  return `${tenantId}:${runId}:${itemId}:${event}:${revision}`;
}
