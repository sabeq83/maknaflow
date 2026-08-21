export function normalizeLocale(value) {
  try {
    return Intl.getCanonicalLocales(String(value || '').replace('_', '-'))[0];
  } catch (e) {
    return 'id-ID';
  }
}

export function normalizeStrategyBrief(input) {
  if (!input.niche) throw new Error('Niche is required');
  if (!input.audience) throw new Error('Target audience is required');
  if (!input.geography) throw new Error('Geography is required');
  if (!input.objective) throw new Error('Objective is required');
  return {
    niche: String(input.niche).trim(),
    audience: String(input.audience).trim(),
    geography: String(input.geography).trim(),
    objective: String(input.objective).trim(),
    universe_id: input.universe_id || null,
    visual_identity_preset_id: input.visual_identity_preset_id || null,
    brand_constraints: input.brand_constraints || null,
    forbidden_claims: input.forbidden_claims || null,
  };
}

export function validateStrategyDraft(input) {
  if (!input.positioning) throw new Error('Positioning is required');
  if (!input.audience_persona || !input.audience_persona.who) throw new Error('Audience persona who is required');
  if (!Array.isArray(input.content_pillars) || input.content_pillars.length === 0) throw new Error('Content pillars are required');
  if (!input.editorial_tone) throw new Error('Editorial tone is required');
  if (!input.video_format || !input.video_format.target_duration_seconds) throw new Error('Video format target duration is required');
  return input;
}

export const ALLOWED_LOCALES = ['id-ID', 'en-US'];

export const EPISODE_STATES = {
  IDEA: 'Idea',
  PLANNED: 'Planned',
  SCRIPT_DRAFT: 'Script Draft',
  SCRIPT_APPROVED: 'Script Approved',
  IN_PRODUCTION: 'In Production',
  RENDERING: 'Rendering',
  READY_TO_PUBLISH: 'Ready to Publish',
  UPLOADED: 'Uploaded',
  ARCHIVED: 'Archived'
};

export const SCRIPT_STATES = {
  DRAFT: 'draft',
  IN_REVIEW: 'in_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUPERSEDED: 'superseded'
};

export const RENDER_STATES = {
  QUEUED: 'queued',
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  RETRYABLE_FAILED: 'retryable_failed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

export const PUBLISHING_STATES = {
  DRAFT: 'draft',
  APPROVED: 'approved',
  UPLOADING: 'uploading',
  UPLOADED: 'uploaded',
  FAILED: 'failed'
};

export function assertEpisodeTransition(from, to) {
  const transitions = {
    [EPISODE_STATES.IDEA]: [EPISODE_STATES.PLANNED, EPISODE_STATES.ARCHIVED],
    [EPISODE_STATES.PLANNED]: [EPISODE_STATES.SCRIPT_DRAFT, EPISODE_STATES.ARCHIVED],
    [EPISODE_STATES.SCRIPT_DRAFT]: [EPISODE_STATES.SCRIPT_APPROVED, EPISODE_STATES.PLANNED, EPISODE_STATES.ARCHIVED],
    [EPISODE_STATES.SCRIPT_APPROVED]: [EPISODE_STATES.IN_PRODUCTION, EPISODE_STATES.SCRIPT_DRAFT, EPISODE_STATES.ARCHIVED],
    [EPISODE_STATES.IN_PRODUCTION]: [EPISODE_STATES.RENDERING, EPISODE_STATES.SCRIPT_APPROVED, EPISODE_STATES.ARCHIVED],
    [EPISODE_STATES.RENDERING]: [EPISODE_STATES.READY_TO_PUBLISH, EPISODE_STATES.SCRIPT_APPROVED, EPISODE_STATES.ARCHIVED],
    [EPISODE_STATES.READY_TO_PUBLISH]: [EPISODE_STATES.UPLOADED, EPISODE_STATES.SCRIPT_APPROVED, EPISODE_STATES.ARCHIVED],
    [EPISODE_STATES.UPLOADED]: [EPISODE_STATES.ARCHIVED],
    [EPISODE_STATES.ARCHIVED]: [EPISODE_STATES.IDEA]
  };
  
  if (!transitions[from] || !transitions[from].includes(to)) {
    throw new Error(`State transition illegal: cannot jump from '${from}' to '${to}'`);
  }
}
