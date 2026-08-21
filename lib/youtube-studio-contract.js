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
    default_target_duration_seconds: input.default_target_duration_seconds ? normalizeTargetDuration(input.default_target_duration_seconds) : 600
  };
}

export function validateStrategyDraft(input) {
  if (!input.positioning) throw new Error('Positioning is required');
  if (!input.audience_persona || !input.audience_persona.who) throw new Error('Audience persona who is required');
  if (!Array.isArray(input.content_pillars) || input.content_pillars.length === 0) throw new Error('Content pillars are required');
  if (!input.editorial_tone) throw new Error('Editorial tone is required');
  if (!input.video_format) throw new Error('Video format is required');
  
  if (!input.video_format.default_target_duration_seconds && input.video_format.target_duration_seconds) {
    input.video_format.default_target_duration_seconds = input.video_format.target_duration_seconds;
  }
  if (!input.video_format.default_target_duration_seconds) {
    throw new Error('Video format target duration is required');
  }
  input.video_format.default_target_duration_seconds = normalizeTargetDuration(input.video_format.default_target_duration_seconds);
  return input;
}

export const ALLOWED_LOCALES = ['id-ID', 'en-US'];

export const EPISODE_STATES = {
  IDEA: 'Idea',
  PLANNED: 'Planned',
  RESEARCHING: 'Researching',
  BLUEPRINT_DRAFT: 'Blueprint Draft',
  BLUEPRINT_APPROVED: 'Blueprint Approved',
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
    [EPISODE_STATES.PLANNED]: [EPISODE_STATES.RESEARCHING, EPISODE_STATES.ARCHIVED],
    [EPISODE_STATES.RESEARCHING]: [EPISODE_STATES.BLUEPRINT_DRAFT, EPISODE_STATES.PLANNED, EPISODE_STATES.ARCHIVED],
    [EPISODE_STATES.BLUEPRINT_DRAFT]: [EPISODE_STATES.BLUEPRINT_APPROVED, EPISODE_STATES.RESEARCHING, EPISODE_STATES.ARCHIVED],
    [EPISODE_STATES.BLUEPRINT_APPROVED]: [EPISODE_STATES.SCRIPT_DRAFT, EPISODE_STATES.BLUEPRINT_DRAFT, EPISODE_STATES.ARCHIVED],
    [EPISODE_STATES.SCRIPT_DRAFT]: [EPISODE_STATES.SCRIPT_APPROVED, EPISODE_STATES.BLUEPRINT_APPROVED, EPISODE_STATES.ARCHIVED],
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

export function validateResearchBrief(brief) {
  if (!brief) throw new Error('Research brief is empty');
  if (!brief.episode_angle) throw new Error('Episode angle is required');
  if (!brief.audience_intent) throw new Error('Audience intent is required');
  if (!Array.isArray(brief.viewer_questions)) throw new Error('Viewer questions array is required');
  if (!Array.isArray(brief.key_claims)) throw new Error('Key claims array is required');
  return brief;
}

export function validateBlueprint(bp, targetDuration) {
  if (!bp) throw new Error('Blueprint is empty');
  if (!bp.content_promise) throw new Error('Content promise is required');
  if (!bp.hook || !bp.hook.text) throw new Error('Hook text is required');
  if (!Array.isArray(bp.chapters) || bp.chapters.length === 0) throw new Error('Chapters array cannot be empty');
  
  let totalDuration = (bp.hook.target_duration_seconds || 0);
  bp.chapters.forEach((ch, idx) => {
    if (!ch.title) throw new Error(`Chapter ${idx+1} title is required`);
    if (!ch.target_duration_seconds || ch.target_duration_seconds <= 0) {
      throw new Error(`Chapter ${idx+1} duration must be positive`);
    }
    totalDuration += ch.target_duration_seconds;
  });
  if (targetDuration && Math.abs(totalDuration - targetDuration) > (targetDuration * 0.35)) {
    throw new Error(`Blueprint total duration (${totalDuration}s) deviates too far from target (${targetDuration}s)`);
  }
  return bp;
}

export function validateSceneScript(script, blueprint, targetDuration) {
  if (!script) throw new Error('Script is empty');
  if (!Array.isArray(script.scenes) || script.scenes.length === 0) throw new Error('Scenes array cannot be empty');
  const allowedTypes = ['generated_visual', 'broll', 'diagram', 'map', 'text_overlay', 'archive_style'];
  
  let currentIdx = 1;
  let totalDuration = 0;
  script.scenes.forEach(s => {
    if (s.scene_index !== currentIdx) throw new Error(`Scene index must be sequential. Expected ${currentIdx}, got ${s.scene_index}`);
    if (!allowedTypes.includes(s.scene_type)) throw new Error(`Invalid scene type: ${s.scene_type}`);
    if (!s.voiceover) throw new Error(`Scene ${currentIdx} voiceover cannot be empty`);
    if (!s.visual_direction) throw new Error(`Scene ${currentIdx} visual direction cannot be empty`);
    if (s.estimated_duration_seconds <= 0) throw new Error(`Scene ${currentIdx} duration must be positive`);
    totalDuration += s.estimated_duration_seconds;
    currentIdx++;
  });
  return script;
}

export function validateSeriesConcept(concept) {
  if (!concept) throw new Error('Konsep series kosong');
  if (!concept.name) throw new Error('Nama konsep series wajib diisi');
  if (!concept.pillar) throw new Error('Mapping pillar konsep series wajib diisi');
  if (!concept.description) throw new Error('Deskripsi konsep series wajib diisi');
  return concept;
}

export function normalizeTargetDuration(input) {
  const parsed = parseInt(input, 10);
  if (isNaN(parsed)) return 600;
  return Math.min(3600, Math.max(60, parsed));
}

export function resolveEpisodeDuration({ channelStrategy, series, episodeOverride }) {
  if (episodeOverride) {
    return {
      target_duration_seconds: normalizeTargetDuration(episodeOverride),
      duration_source: 'episode'
    };
  }
  
  if (series && series.config_json) {
    const sConf = series.config_json;
    if (sConf.duration_mode === 'override' && sConf.target_duration_seconds) {
      return {
        target_duration_seconds: normalizeTargetDuration(sConf.target_duration_seconds),
        duration_source: 'series'
      };
    }
  }

  if (channelStrategy && channelStrategy.config_json) {
    const cConf = channelStrategy.config_json;
    if (cConf.video_format && cConf.video_format.default_target_duration_seconds) {
      return {
        target_duration_seconds: normalizeTargetDuration(cConf.video_format.default_target_duration_seconds),
        duration_source: 'channel'
      };
    }
  }

  return {
    target_duration_seconds: 600,
    duration_source: 'channel'
  };
}

export function validateGeneratedShotDuration(shot, profile) {
  if (shot.asset_type === 'generated_visual') {
    if (!profile) throw new Error('Generation profile is required for generated visual shots');
    const allowed = profile.generatedShotDurations || [];
    if (!allowed.includes(shot.generation_duration_seconds)) {
      throw new Error(`Invalid generated shot duration: ${shot.generation_duration_seconds}s is not supported by profile ${profile.label}`);
    }
  }
  return true;
}

export function validateProductionShotPlan(scene, profile) {
  const targetSceneDuration = scene.narrative_duration_seconds;
  if (!Array.isArray(scene.shots) || scene.shots.length === 0) {
    throw new Error('Scene must have at least one shot in the plan');
  }
  
  let totalShotDuration = 0;
  scene.shots.forEach((shot) => {
    validateGeneratedShotDuration(shot, profile);
    totalShotDuration += shot.generation_duration_seconds || 0;
  });

  if (Math.abs(totalShotDuration - targetSceneDuration) > 2) {
    throw new Error(`Total shot duration (${totalShotDuration}s) does not match narrative scene duration (${targetSceneDuration}s)`);
  }
  return true;
}
