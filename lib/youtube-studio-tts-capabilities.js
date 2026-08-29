export function getTtsCapabilities(provider) {
  const minimax = {
    provider: 'minimax',
    supportedLocales: ['id-ID', 'en-US'],
    personas: {
      'id-ID': ['db_male1', 'db_female1', 'db_male2', 'db_female2'],
      'en-US': ['Male-1', 'Female-1', 'Male-2', 'Female-2']
    },
    hasWhisper: false, // Minimax does not have dedicated whisper parameter
    speedRange: { min: 0.5, max: 2.0 }
  };

  const googleTts = {
    provider: 'google_tts',
    supportedLocales: ['id-ID', 'en-US'],
    personas: {
      'id-ID': ['id-ID-Wavenet-B', 'id-ID-Wavenet-C', 'id-ID-Wavenet-A', 'id-ID-Wavenet-D'],
      'en-US': ['en-US-Journey-F', 'en-US-Journey-D', 'en-US-Wavenet-B', 'en-US-Wavenet-C']
    },
    hasWhisper: false, // Google TTS does not support whisper natively
    speedRange: { min: 0.5, max: 2.0 }
  };

  const glabsGoogleFlow = {
    provider: 'glabs_google_flow',
    supportedLocales: ['id-ID', 'en-US'],
    personas: {},
    hasWhisper: true, // Google Flow can do whisper via prompt-guidance / flow instructions
    speedRange: { min: 1.0, max: 1.0 }
  };

  if (provider === 'minimax') return minimax;
  if (provider === 'google_tts') return googleTts;
  if (provider === 'glabs_google_flow') return glabsGoogleFlow;

  return null;
}

export function validatePersonaForProvider({ provider, persona, locale }) {
  const caps = getTtsCapabilities(provider);
  if (!caps) return false;

  const localePersonas = caps.personas[locale];
  if (!localePersonas) return false;

  return localePersonas.includes(persona);
}

export function getNativeAudioCapabilities(profile, glabsCapabilities = {}) {
  // Current Tailscale G-Labs capability integration on Windows Worker:
  // Since webhook-client.js shows prompt-guided text generation via /api/video/generate,
  // we do not have a deterministic API parameter for voice references, only prompt-based control.
  // Therefore, capability is descriptive_prompt.
  return {
    provider: 'glabs_google_flow',
    model_key: profile?.key || 'veo_31_lite',
    native_voice_capability: 'descriptive_prompt',
    hasWhisper: true,
    hasSoundEvent: true
  };
}
