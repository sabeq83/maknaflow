import { normalizeNarrativeConfig } from './youtube-studio-contract.js';

export function resolveNarrativeConfiguration({ channelStrategy, series, episode }) {
  const channelDefaults = channelStrategy?.config_json?.narrative_defaults || {};
  const seriesFormat = series?.config_json?.narrative_format || {};
  const episodeOverride = episode?.narrative_config_json?.narrative_override || {};

  const resolvedMode = (episodeOverride.mode && episodeOverride.mode !== 'inherit')
    ? episodeOverride.mode
    : (seriesFormat.mode && seriesFormat.mode !== 'inherit')
      ? seriesFormat.mode
      : (channelDefaults.mode || 'narration_only');

  const resolvedNarratorUsage = (episodeOverride.narrator_usage && episodeOverride.narrator_usage !== 'inherit')
    ? episodeOverride.narrator_usage
    : (seriesFormat.narrator_usage && seriesFormat.narrator_usage !== 'inherit')
      ? seriesFormat.narrator_usage
      : (channelDefaults.narrator_usage || 'chapter_open_close');

  const resolvedPOV = (episodeOverride.point_of_view && episodeOverride.point_of_view !== 'inherit')
    ? episodeOverride.point_of_view
    : (seriesFormat.point_of_view && seriesFormat.point_of_view !== 'inherit')
      ? seriesFormat.point_of_view
      : (channelDefaults.point_of_view || 'third_person_omniscient');

  const maxSpeakers = episodeOverride.max_speakers_per_scene || seriesFormat.max_speakers_per_scene || channelDefaults.max_speakers_per_scene || 2;

  // Merge cast: Episode Cast overrides Series Recurring Cast
  const seriesCast = series?.config_json?.recurring_cast || [];
  const episodeCast = episode?.narrative_config_json?.episode_cast || [];

  const mergedSpeakers = [...episodeCast];
  seriesCast.forEach(sc => {
    if (!mergedSpeakers.some(es => es.speaker_id === sc.speaker_id)) {
      mergedSpeakers.push({
        ...sc,
        source: 'series'
      });
    }
  });

  // Ensure default narrator is present
  if (!mergedSpeakers.some(s => s.speaker_id === 'narrator')) {
    mergedSpeakers.unshift({
      speaker_id: 'narrator',
      display_name: 'Narrator',
      speaker_role: 'narrator',
      speaker_type: 'narrator',
      universe_character_key: null,
      voice_casting_key: 'voice_narrator_primary',
      required: true,
      source: 'system'
    });
  }

  return {
    schema_version: 1,
    resolved_mode: resolvedMode,
    source: {
      channel_strategy_id: channelStrategy?.id || null,
      series_id: series?.id || null,
      episode_id: episode?.id || null
    },
    dialogue_ratio: {
      target: episodeOverride.dialogue_ratio_target || seriesFormat.dialogue_ratio_target || channelDefaults.dialogue_ratio_target || 0.35,
      min: episodeOverride.dialogue_ratio_min || seriesFormat.dialogue_ratio_min || channelDefaults.dialogue_ratio_min || 0.20,
      max: episodeOverride.dialogue_ratio_max || seriesFormat.dialogue_ratio_max || channelDefaults.dialogue_ratio_max || 0.50
    },
    narrator_usage: resolvedNarratorUsage,
    point_of_view: resolvedPOV,
    max_speakers_per_scene: maxSpeakers,
    speakers: mergedSpeakers,
    guardrails: channelDefaults.dialogue_guardrails || [],
    provenance: {
      resolved_at: new Date().toISOString()
    }
  };
}

export function getSpeakerVoice(speakerId, resolvedNarrative, episode) {
  const speaker = resolvedNarrative?.speakers?.find(s => s.speaker_id === speakerId);
  
  if (speaker) {
    if (resolvedNarrative.audio_production_mode === 'standalone_tts' && speaker.tts_binding) {
      return {
        provider: speaker.tts_binding.provider,
        persona: speaker.tts_binding.persona_key,
        speed: speaker.speed !== undefined ? Number(speaker.speed) : 1.0
      };
    }
    if (resolvedNarrative.audio_production_mode === 'native_scene_audio' && speaker.flow_binding) {
      return {
        provider: 'glabs_google_flow',
        persona: speaker.flow_binding.voice_reference_id || speaker.flow_binding.descriptive_voice_prompt,
        voice_reference_id: speaker.flow_binding.voice_reference_id,
        descriptive_voice_prompt: speaker.flow_binding.descriptive_voice_prompt,
        speed: 1.0
      };
    }
  }

  if (speakerId === 'narrator') {
    return {
      provider: episode.voice_provider || 'google_tts',
      persona: episode.voice_persona || 'Orus',
      speed: episode.voice_speed !== undefined ? Number(episode.voice_speed) : 1.0
    };
  }

  const customMapping = episode.narrative_config_json?.voice_mappings?.[speakerId];
  if (customMapping?.provider && customMapping?.persona) {
    return {
      provider: customMapping.provider,
      persona: customMapping.persona,
      speed: customMapping.speed !== undefined ? Number(customMapping.speed) : 1.0
    };
  }

  const isEnglish = (episode.locale || '').startsWith('en');
  const provider = episode.voice_provider || 'google_tts';

  let availablePersonas = [];
  if (provider === 'minimax') {
    availablePersonas = isEnglish 
      ? ['Male-1', 'Female-1', 'Male-2', 'Female-2'] 
      : ['db_male1', 'db_female1', 'db_male2', 'db_female2'];
  } else {
    availablePersonas = isEnglish
      ? ['en-US-Journey-F', 'en-US-Journey-D', 'en-US-Wavenet-B', 'en-US-Wavenet-C']
      : ['id-ID-Wavenet-B', 'id-ID-Wavenet-C', 'id-ID-Wavenet-A', 'id-ID-Wavenet-D'];
  }

  const filtered = availablePersonas.filter(v => v !== episode.voice_persona);
  const pool = filtered.length > 0 ? filtered : availablePersonas;

  let hash = 0;
  for (let i = 0; i < speakerId.length; i++) {
    hash = speakerId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % pool.length;
  
  return {
    provider,
    persona: pool[idx],
    speed: 1.0
  };
}
