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

export function validateProductionPlan(plan, { profile, episodeDuration }) {
  if (!plan) throw new Error('Rencana produksi kosong');
  if (plan.generation_profile_key !== profile.key) {
    throw new Error('Mismatched generation profile key');
  }
  if (!Array.isArray(plan.scenes) || plan.scenes.length === 0) {
    throw new Error('Scenes must not be empty');
  }

  let totalDuration = 0;
  plan.scenes.forEach((scene, scIdx) => {
    if (!scene.voiceover) throw new Error(`Narration VO empty at scene ${scIdx}`);
    if (!Array.isArray(scene.shots) || scene.shots.length === 0) {
      throw new Error(`Scene ${scIdx} must have at least one shot`);
    }
    
    let sceneShotDuration = 0;
    scene.shots.forEach((shot) => {
      validateGeneratedShotDuration(shot, profile);
      sceneShotDuration += shot.generation_duration_seconds || 0;
    });

    if (Math.abs(sceneShotDuration - scene.narrative_duration_seconds) > 2) {
      throw new Error(`Scene ${scIdx} shot durations sum (${sceneShotDuration}s) does not match narrative duration (${scene.narrative_duration_seconds}s)`);
    }
    totalDuration += scene.narrative_duration_seconds;
  });

  return plan;
}

export function assertProductionTransition(from, to) {
  const allowed = {
    'draft': ['approved'],
    'approved': ['generating'],
    'generating': ['preview_ready', 'failed'],
    'preview_ready': ['final_rendering', 'generating'],
    'final_rendering': ['completed', 'failed']
  };
  if (!allowed[from] || !allowed[from].includes(to)) {
    throw new Error(`Invalid status transition from ${from} to ${to}`);
  }
}

export function classifyProductionFailure(error) {
  const message = String(error.message || '').toLowerCase();
  if (message.includes('quota') || message.includes('timeout') || message.includes('network')) {
    return 'retryable';
  }
  return 'fatal';
}

// ── Hybrid Production Contract (Fase 3.5B) ──

export const GENERATION_MODES = ['t2i_i2v', 't2v', 'static_asset', 'broll'];

export function validateHybridShot(shot, profile) {
  if (!shot.generation_mode) {
    throw new Error('Shot generation_mode is required');
  }
  if (!GENERATION_MODES.includes(shot.generation_mode)) {
    throw new Error(`Invalid generation mode: "${shot.generation_mode}". Valid: ${GENERATION_MODES.join(', ')}`);
  }

  if (shot.generation_mode === 't2i_i2v') {
    if (!shot.t2i_prompt || !shot.t2i_prompt.trim()) {
      throw new Error('t2i_prompt is required for t2i_i2v mode');
    }
    if (!shot.i2v_prompt || !shot.i2v_prompt.trim()) {
      throw new Error('i2v_prompt is required for t2i_i2v mode');
    }
  } else if (shot.generation_mode === 't2v') {
    if (!shot.t2v_prompt || !shot.t2v_prompt.trim()) {
      throw new Error('t2v_prompt is required for t2v mode');
    }
  } else if (shot.generation_mode === 'static_asset') {
    if (!shot.prompt || !shot.prompt.trim()) {
      throw new Error('prompt is required for static_asset mode');
    }
  } else if (shot.generation_mode === 'broll') {
    if (!shot.prompt || !shot.prompt.trim()) {
      throw new Error('prompt query is required for broll mode');
    }
  }
  return true;
}

export function assertHybridBatchTransition(from, to) {
  const allowed = {
    'draft': ['approved', 'archived'],
    'approved': ['processing', 'archived'],
    'processing': ['reviewing', 'failed'],
    'reviewing': ['approved', 'draft', 'archived'],
    'completed': ['archived'],
    'failed': ['draft', 'archived']
  };
  if (!allowed[from] || !allowed[from].includes(to)) {
    throw new Error(`Invalid batch transition from "${from}" to "${to}"`);
  }
}

export const PRODUCTION_MODES = ['legacy_t2v', 'hybrid'];

export function validateProductionPlanByMode(plan, { profile, episode, productionMode }) {
  if (!plan) throw new Error('Rencana produksi kosong');
  if (!PRODUCTION_MODES.includes(productionMode)) {
    throw new Error(`Invalid production mode: "${productionMode}"`);
  }
  if (plan.generation_profile_key !== profile.key) {
    throw new Error('Mismatched generation profile key');
  }
  if (!Array.isArray(plan.scenes) || plan.scenes.length === 0) {
    throw new Error('Scenes must not be empty');
  }

  let totalDuration = 0;
  plan.scenes.forEach((scene, scIdx) => {
    if (scene.scene_index !== scIdx + 1) {
      throw new Error(`Scene index must be sequential. Expected ${scIdx + 1}, got ${scene.scene_index}`);
    }
    if (!scene.voiceover) throw new Error(`Narration VO empty at scene ${scIdx}`);
    if (!Array.isArray(scene.shots) || scene.shots.length === 0) {
      throw new Error(`Scene ${scIdx} must have at least one shot`);
    }

    let sceneShotDuration = 0;
    scene.shots.forEach((shot, shIdx) => {
      if (productionMode === 'hybrid') {
        validateHybridShot(shot, profile);
      } else {
        if (shot.asset_type === 'generated_visual') {
          if (!shot.prompt || !shot.prompt.trim()) {
            throw new Error(`Prompt is required for visual shot ${shIdx + 1} in scene ${scIdx + 1}`);
          }
        }
      }

      const isAiGenerated = (productionMode === 'hybrid')
        ? (shot.generation_mode === 't2i_i2v' || shot.generation_mode === 't2v')
        : (shot.asset_type === 'generated_visual');

      if (isAiGenerated) {
        const allowed = profile.generatedShotDurations || [];
        if (!allowed.includes(shot.generation_duration_seconds)) {
          throw new Error(`Invalid generated shot duration: ${shot.generation_duration_seconds}s is not supported by profile ${profile.label}`);
        }
      }

      sceneShotDuration += shot.generation_duration_seconds || 0;
    });

    if (Math.abs(sceneShotDuration - scene.narrative_duration_seconds) > 2) {
      throw new Error(`Scene ${scIdx} shot durations sum (${sceneShotDuration}s) does not match narrative duration (${scene.narrative_duration_seconds}s)`);
    }
    totalDuration += scene.narrative_duration_seconds;
  });

  const targetDuration = episode.target_duration_seconds;
  if (targetDuration && Math.abs(totalDuration - targetDuration) > (targetDuration * 0.35)) {
    throw new Error(`Total production plan duration (${totalDuration}s) deviates too far from target (${targetDuration}s)`);
  }

  return plan;
}


