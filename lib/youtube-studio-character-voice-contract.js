export function validateChannelAudioConfig(input, capabilities = {}) {
  if (!input) throw new Error('Audio config is empty');
  
  const mode = input.audio_production_mode;
  if (!['standalone_tts', 'native_scene_audio'].includes(mode)) {
    throw new Error(`Invalid audio production mode: ${mode}`);
  }

  const experience = input.audio_experience || 'narrative_dialogue';
  if (!['narrative_dialogue', 'spoken_asmr', 'no_talking_asmr', 'mixed_asmr'].includes(experience)) {
    throw new Error(`Invalid audio experience: ${experience}`);
  }

  const provider = input.provider;
  if (!['minimax', 'google_tts', 'glabs_google_flow'].includes(provider)) {
    throw new Error(`Invalid provider: ${provider}`);
  }

  // 1. Mode/Provider compatibility rules
  if (mode === 'standalone_tts' && !['minimax', 'google_tts'].includes(provider)) {
    throw new Error(`standalone_tts mode does not support provider ${provider}`);
  }
  if (mode === 'native_scene_audio' && provider !== 'glabs_google_flow') {
    throw new Error(`native_scene_audio mode must use glabs_google_flow provider`);
  }

  // 2. Experience/Mode compatibility matrix
  if (experience === 'no_talking_asmr' && mode !== 'native_scene_audio') {
    throw new Error('no_talking_asmr is only supported in native_scene_audio mode');
  }
  if (experience === 'mixed_asmr' && mode !== 'native_scene_audio') {
    throw new Error('mixed_asmr is only supported in native_scene_audio mode');
  }
  if (experience === 'spoken_asmr' && mode === 'standalone_tts') {
    // Only allowed if provider has whisper capability
    if (capabilities.hasWhisper === false) {
      throw new Error('spoken_asmr in standalone_tts mode requires a whisper-capable TTS provider/persona');
    }
  }

  return {
    audio_production_mode: mode,
    audio_experience: experience,
    provider,
    model_key: input.model_key || null,
    synthesis_strategy: input.synthesis_strategy || 'segmented_turns',
    native_voice_capability: input.native_voice_capability || 'unavailable',
    sonic_identity_json: input.sonic_identity_json || {}
  };
}

export function validateSpeakerInput(input) {
  if (!input) throw new Error('Speaker input is empty');
  
  const speakerId = input.speaker_id;
  if (!speakerId || !/^[a-z0-9_]{2,30}$/.test(speakerId)) {
    throw new Error(`Invalid speaker ID format: "${speakerId}". Must be alphanumeric and underscores, 2-30 chars.`);
  }

  const displayName = input.display_name;
  if (!displayName || typeof displayName !== 'string' || !displayName.trim()) {
    throw new Error('Display name is required and must be non-empty');
  }

  const speakerType = input.speaker_type;
  if (!['narrator', 'character'].includes(speakerType)) {
    throw new Error(`Invalid speaker type: ${speakerType}`);
  }

  return {
    speaker_id: speakerId.trim(),
    display_name: displayName.trim(),
    speaker_type: speakerType,
    universe_character_id: input.universe_character_id || null,
    description: input.description || null,
    voice_identity_json: input.voice_identity_json || {}
  };
}

export function validateVoiceCasting(input, audioConfig) {
  if (!input) throw new Error('Voice casting binding is empty');
  
  const kind = input.binding_kind;
  if (!['tts', 'flow_native'].includes(kind)) {
    throw new Error(`Invalid binding kind: ${kind}`);
  }

  const provider = input.provider;
  if (!['minimax', 'google_tts', 'glabs_google_flow'].includes(provider)) {
    throw new Error(`Invalid provider: ${provider}`);
  }

  if (kind === 'tts') {
    if (!input.persona_key || typeof input.persona_key !== 'string' || !input.persona_key.trim()) {
      throw new Error('persona_key is required for tts binding');
    }
  }

  if (kind === 'flow_native') {
    if (provider !== 'glabs_google_flow') {
      throw new Error('flow_native binding kind requires glabs_google_flow provider');
    }
    // descriptive_voice_prompt or voice_reference_id must be provided
    const hasRef = input.voice_reference_id && String(input.voice_reference_id).trim();
    const hasPrompt = input.descriptive_voice_prompt && String(input.descriptive_voice_prompt).trim();
    if (!hasRef && !hasPrompt) {
      throw new Error('Either voice_reference_id or descriptive_voice_prompt is required for flow_native binding');
    }
  }

  return {
    binding_kind: kind,
    provider,
    persona_key: input.persona_key || null,
    voice_reference_id: input.voice_reference_id || null,
    descriptive_voice_prompt: input.descriptive_voice_prompt || null,
    speed: typeof input.speed === 'number' ? input.speed : 1.0,
    delivery_json: input.delivery_json || {},
    pronunciation_json: input.pronunciation_json || {}
  };
}

export function validateAllowedSpeakers(speakerId, allowedSpeakerIds) {
  if (!allowedSpeakerIds || !Array.isArray(allowedSpeakerIds)) {
    throw new Error('Allowed speaker IDs list is missing or invalid');
  }
  if (!allowedSpeakerIds.includes(speakerId)) {
    const err = new Error(`Speaker "${speakerId}" is not registered in the active casting roster.`);
    err.code = 'YT_UNKNOWN_SPEAKER';
    throw err;
  }
}

export function validateAudioExperience(script, experience, capabilities = {}) {
  const scenes = script.scenes || [];
  let hasSpoken = false;
  let hasWhisper = false;
  let hasSoundEvent = false;

  scenes.forEach((s) => {
    const blocks = s.audio_blocks || [];
    blocks.forEach((ab) => {
      if (['narration', 'dialogue', 'whisper'].includes(ab.type)) {
        hasSpoken = true;
      }
      if (ab.type === 'whisper') {
        hasWhisper = true;
      }
      if (ab.type === 'sound_event') {
        hasSoundEvent = true;
      }

      // If experience is no_talking_asmr, block spoken audio types
      if (experience === 'no_talking_asmr') {
        if (['narration', 'dialogue', 'whisper'].includes(ab.type)) {
          throw new Error('no_talking_asmr experience strictly forbids narration, dialogue, or whisper blocks.');
        }
      }
    });
  });

  if (experience === 'no_talking_asmr') {
    // Assert speaker manifest doesn't require a narrator
    const hasNarrator = script.speaker_manifest?.some(sp => sp.speaker_type === 'narrator');
    if (hasNarrator) {
      throw new Error('no_talking_asmr experience does not allow a narrator in the speaker manifest.');
    }
  }

  if (experience === 'spoken_asmr') {
    // Spoken ASMR requires whisper blocks
    if (!hasWhisper) {
      throw new Error('spoken_asmr experience requires at least one whisper audio block.');
    }
  }

  if (experience === 'mixed_asmr') {
    if (!hasSpoken) {
      throw new Error('mixed_asmr experience requires at least one spoken (narration/dialogue/whisper) block.');
    }
    if (!hasSoundEvent) {
      throw new Error('mixed_asmr experience requires at least one sound_event block.');
    }
  }
}

export function validateSonicIdentity(input) {
  if (!input) throw new Error('Sonic identity configuration is empty');
  
  const perspectives = ['extreme_close_binaural', 'close_mono', 'stereo_room', 'standard_studio'];
  if (input.microphone_perspective && !perspectives.includes(input.microphone_perspective)) {
    throw new Error(`Invalid microphone perspective: ${input.microphone_perspective}`);
  }

  if (input.mastering) {
    const targetLoudness = input.mastering.target_loudness_lufs;
    if (typeof targetLoudness === 'number' && (targetLoudness < -40 || targetLoudness > -5)) {
      throw new Error(`Mastering target loudness out of safe bounds (-40 to -5 LUFS): ${targetLoudness}`);
    }

    const peakLimit = input.mastering.peak_limit_db;
    if (typeof peakLimit === 'number' && (peakLimit < -20 || peakLimit > 0)) {
      throw new Error(`Mastering peak limit out of safe bounds (-20 to 0 dB): ${peakLimit}`);
    }
  }

  return {
    schema_version: 1,
    microphone_perspective: input.microphone_perspective || 'standard_studio',
    spatial_behavior: input.spatial_behavior || 'static',
    noise_floor: input.noise_floor || 'quiet_treated_studio',
    dynamic_range: input.dynamic_range || 'balanced',
    pacing: input.pacing || 'normal',
    preferred_triggers: Array.isArray(input.preferred_triggers) ? input.preferred_triggers : [],
    forbidden_sounds: Array.isArray(input.forbidden_sounds) ? input.forbidden_sounds : [],
    mastering: {
      target_loudness_lufs: input.mastering?.target_loudness_lufs || -14,
      peak_limit_db: input.mastering?.peak_limit_db || -1,
      preserve_micro_dynamics: !!input.mastering?.preserve_micro_dynamics
    }
  };
}
