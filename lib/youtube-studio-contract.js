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

export const NARRATIVE_MODES = [
  'narration_only',
  'dialogue_driven',
  'hybrid_narration_dialogue'
];

export const TTS_SYNTHESIS_STRATEGIES = [
  'segmented_turns',
  'native_two_speaker'
];

export function normalizeNarrativeConfig(input) {
  const cfg = input || {};
  return {
    mode: NARRATIVE_MODES.includes(cfg.mode) ? cfg.mode : 'narration_only',
    dialogue_ratio_target: typeof cfg.dialogue_ratio_target === 'number' ? cfg.dialogue_ratio_target : 0.35,
    dialogue_ratio_min: typeof cfg.dialogue_ratio_min === 'number' ? cfg.dialogue_ratio_min : 0.20,
    dialogue_ratio_max: typeof cfg.dialogue_ratio_max === 'number' ? cfg.dialogue_ratio_max : 0.50,
    max_speakers_per_scene: typeof cfg.max_speakers_per_scene === 'number' ? cfg.max_speakers_per_scene : 2,
    narrator_usage: cfg.narrator_usage || 'chapter_open_close',
    point_of_view: cfg.point_of_view || 'third_person_omniscient',
    dialogue_guardrails: Array.isArray(cfg.dialogue_guardrails) ? cfg.dialogue_guardrails : [],
    special_direction: cfg.special_direction || ''
  };
}

export function validateSpeakerManifest(manifest) {
  if (!Array.isArray(manifest)) throw new Error('Speaker manifest must be an array');
  manifest.forEach((sp, idx) => {
    if (!sp.speaker_id) throw new Error(`Speaker at index ${idx} missing speaker_id`);
    if (!sp.display_name) throw new Error(`Speaker ${sp.speaker_id} missing display_name`);
    if (!sp.speaker_type) throw new Error(`Speaker ${sp.speaker_id} missing speaker_type (narrator/character)`);
  });
  return manifest;
}

export function normalizeScriptToV2(script, snapshot) {
  if (!script) return null;
  if (script.schema_version === 2) return script;

  const scenes = (script.scenes || []).map(s => {
    if (s.audio_blocks && s.audio_blocks.length > 0) return s;

    const block = {
      block_id: `sc${String(s.scene_index).padStart(2, '0')}_ab01`,
      order: 1,
      type: 'narration',
      speaker_id: 'narrator',
      text: s.voiceover || '',
      emotion: 'neutral',
      delivery: 'standard',
      pause_before_ms: 0,
      pause_after_ms: 500,
      estimated_duration_seconds: s.estimated_duration_seconds || 5,
      subtitle_cue: s.voiceover || '',
      visual_beat_id: `sc${String(s.scene_index).padStart(2, '0')}_vb01`
    };

    return {
      ...s,
      audio_blocks: [block]
    };
  });

  return {
    schema_version: 2,
    narrative_mode: snapshot?.resolved_mode || 'narration_only',
    estimated_total_duration_seconds: script.estimated_total_duration_seconds || 600,
    speaker_manifest: script.speaker_manifest || [
      { speaker_id: 'narrator', display_name: 'Narrator', speaker_type: 'narrator', voice_casting_key: 'voice_narrator_primary' }
    ],
    scenes
  };
}

export function validateSceneScript(script, blueprint, targetDuration) {
  if (!script) throw new Error('Script is empty');
  const actualScript = script.schema_version === 2 ? script : normalizeScriptToV2(script);
  if (!Array.isArray(actualScript.scenes) || actualScript.scenes.length === 0) throw new Error('Scenes array cannot be empty');
  
  const allowedTypes = ['generated_visual', 'broll', 'diagram', 'map', 'text_overlay', 'archive_style'];
  let currentIdx = 1;
  let totalDuration = 0;
  
  actualScript.scenes.forEach(s => {
    if (s.scene_index !== currentIdx) throw new Error(`Scene index must be sequential. Expected ${currentIdx}, got ${s.scene_index}`);
    if (!allowedTypes.includes(s.scene_type)) throw new Error(`Invalid scene type: ${s.scene_type}`);
    if (s.estimated_duration_seconds <= 0) throw new Error(`Scene ${currentIdx} duration must be positive`);
    
    if (actualScript.schema_version === 2) {
      if (!Array.isArray(s.audio_blocks) || s.audio_blocks.length === 0) {
        throw new Error(`Scene ${currentIdx} audio blocks cannot be empty in Script v2`);
      }
      s.audio_blocks.forEach((ab, abIdx) => {
        if (!ab.block_id) throw new Error(`Scene ${currentIdx} block ${abIdx + 1} missing block_id`);
        if (!ab.speaker_id) throw new Error(`Scene ${currentIdx} block ${ab.block_id} missing speaker_id`);
        if (!ab.text || !ab.text.trim()) throw new Error(`Scene ${currentIdx} block ${ab.block_id} text is empty`);
      });
    } else {
      if (!s.voiceover) throw new Error(`Scene ${currentIdx} voiceover cannot be empty`);
    }
    
    if (!s.visual_direction) throw new Error(`Scene ${currentIdx} visual direction cannot be empty`);
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
export const PRODUCTION_MODES = ['legacy_t2v', 'hybrid'];

export function assertProductionMode(planJson, expectedMode) {
  const actualMode = planJson?.production_mode || 'legacy_t2v';
  if (actualMode !== expectedMode) {
    throw new Error(`Invalid package production mode. Expected: "${expectedMode}", got: "${actualMode}"`);
  }
}

export function validateHybridShot(shot, profile) {
  if (!shot.generation_mode) {
    throw new Error('Shot generation_mode is required');
  }
  if (!GENERATION_MODES.includes(shot.generation_mode)) {
    throw new Error(`Invalid generation mode: "${shot.generation_mode}". Valid: ${GENERATION_MODES.join(', ')}`);
  }

  const allowedAssetTypes = ['generated_visual', 'broll', 'diagram', 'map', 'text_overlay', 'archive_style'];
  if (!allowedAssetTypes.includes(shot.asset_type)) {
    throw new Error(`Invalid asset_type for hybrid shot: "${shot.asset_type}"`);
  }

  if ((shot.generation_mode === 't2i_i2v' || shot.generation_mode === 't2v') && shot.asset_type !== 'generated_visual') {
    throw new Error(`${shot.generation_mode} mode requires asset_type "generated_visual"`);
  }
  if (shot.generation_mode === 'broll' && shot.asset_type !== 'broll') {
    throw new Error('broll mode requires asset_type "broll"');
  }
  if (shot.generation_mode === 'static_asset' && !['diagram', 'map', 'text_overlay', 'archive_style'].includes(shot.asset_type)) {
    throw new Error('static_asset mode requires a static asset_type');
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

import { getNarrationProfile } from './youtube-studio-narration-profiles.js';

export function analyzeNarrationDuration({ script, targetSeconds, profileKey }) {
  const p = getNarrationProfile(profileKey);
  let totalWords = 0;
  const sceneAnalysis = [];

  const scenes = script.scenes || [];
  scenes.forEach(s => {
    let text = '';
    if (script.schema_version === 2 && Array.isArray(s.audio_blocks)) {
      text = s.audio_blocks.map(ab => ab.text || '').join(' ');
    } else {
      text = s.voiceover || '';
    }
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    totalWords += words;

    const sceneDuration = s.estimated_duration_seconds || 5;
    const predictedDuration = (words / p.targetWpm) * 60;
    const coverage = predictedDuration / sceneDuration;

    sceneAnalysis.push({
      scene_index: s.scene_index,
      word_count: words,
      predicted_seconds: Number(predictedDuration.toFixed(1)),
      planned_seconds: sceneDuration,
      coverage_ratio: Number(coverage.toFixed(3)),
      status: coverage < 0.65 ? 'underfilled' : coverage > 1.15 ? 'overfilled' : 'ready'
    });
  });

  const predictedNarrationSeconds = (totalWords / p.targetWpm) * 60;
  const coverageRatio = predictedNarrationSeconds / targetSeconds;
  
  let status = 'ready';
  if (coverageRatio < 0.70 || coverageRatio > 1.20) {
    status = 'revision_required';
  } else if (coverageRatio < 0.85 || coverageRatio > 1.10) {
    status = 'draft_warning';
  }

  return {
    profile_key: profileKey,
    target_timeline_seconds: targetSeconds,
    target_wpm: p.targetWpm,
    pause_ratio: p.pauseRatio,
    total_words: totalWords,
    predicted_narration_seconds: Number(predictedNarrationSeconds.toFixed(1)),
    coverage_ratio: Number(coverageRatio.toFixed(3)),
    scene_analysis: sceneAnalysis,
    status
  };
}

export function assertNarrationApprovable(analysis, { allowOverride = false } = {}) {
  if (analysis.status === 'revision_required' && !allowOverride) {
    throw new Error(`Severe duration underfill/overfill detected (${Math.round(analysis.coverage_ratio * 100)}% coverage). Please adjust script or request duration override.`);
  }
}

