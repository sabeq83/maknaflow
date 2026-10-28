import { getSetting } from './db.js';
import { LEGACY_MINIMAX_ENGLISH_VOICE_ALIASES } from './voice-constants.js';
import fs from 'fs';
import path from 'path';

const GEMINI_TO_MINIMAX_MAP = {
  'id-ID': {
    'Aoede': 'Indonesian_crisp_reporter_vv2',
    'Orus': 'Indonesian_casual_reporter_vv2',
    'Despina': 'Indonesian_professional_anchor_vv2',
    'Algenib': 'Indonesian_energetic_streamer_vv2',
    'Erinome': 'Indonesian_intellectual_commentator_vv2',
    'Charon': 'Indonesian_compelling_storyteller_vv2',
    'Callirrhoe': 'Indonesian_intellectual_commentator_vv2',
    'Iapetus': 'Indonesian_expressive_podcaster_vv2',
    'Kore': 'Indonesian_professional_anchor_vv2'
  },
  'en-US': {
    'Aoede': 'English_radiant_girl',
    'Orus': 'English_causual_narrator_vv1',
    'Despina': 'English_captivating_female1',
    'Algenib': 'English_expressive_host__vv1',
    'Erinome': 'English_CalmWoman',
    'Charon': 'English_causual_podcast_vv1',
    'Callirrhoe': 'English_instructive_professor_vv1',
    'Iapetus': 'English_Resonant_Man',
    'Kore': 'English_CalmWoman'
  }
};

export const FRIENDLY_TO_MINIMAX_MAP = {
  'casual reporter': 'Indonesian_casual_reporter_vv2',
  'compelling storyteller': 'Indonesian_compelling_storyteller_vv2',
  'expressive podcaster': 'Indonesian_expressive_podcaster_vv2',
  'energetic streamer': 'Indonesian_energetic_streamer_vv2',
  'intellectual commentator': 'Indonesian_intellectual_commentator_vv2',
  'professional anchor': 'Indonesian_professional_anchor_vv2',
  'crisp reporter': 'Indonesian_crisp_reporter_vv2',

  'resonant man': 'English_Resonant_Man',
  'trustworthy man': 'English_Trustworth_Man',
  'casual narrator': 'English_causual_narrator_vv1',
  'casual podcast': 'English_causual_podcast_vv1',
  'expressive host': 'English_expressive_host__vv1',
  'instructive professor': 'English_instructive_professor_vv1',
  'nursery teacher': 'English_nursery_teacher_vv2',
  'captivating female': 'English_captivating_female1',
  'radiant girl': 'English_radiant_girl',
  'calm woman': 'English_CalmWoman',

  // 19 Female Voices
  'compelling lady': 'English_compelling_lady1',
  'upbeat woman': 'English_Upbeat_Woman',
  'whispering girl': 'English_Whispering_girl',
  'graceful lady': 'English_Graceful_Lady',
  'playful girl': 'English_PlayfulGirl',
  'mature partner': 'English_MaturePartner',
  'bossy lady': 'English_MatureBoss',
  'lovely girl': 'English_LovelyGirl',
  'wise lady': 'English_Wiselady',
  'sentimental lady': 'English_SentimentalLady',
  'imposing queen': 'English_ImposingManner',
  'soft-spoken girl': 'English_Soft-spokenGirl',
  'serene woman': 'English_SereneWoman',
  'confident woman': 'English_ConfidentWoman',
  'bossy leader': 'English_BossyLeader',
  'upset girl': 'English_UpsetGirl',

  // 19 Male Voices
  'expressive narrator': 'English_expressive_narrator',
  'magnetic-voiced male': 'English_magnetic_voiced_man',
  'magnetic voiced man': 'English_magnetic_voiced_man',
  'gentle-voiced man': 'English_Gentle-voiced_man',
  'gentle voiced man': 'English_Gentle-voiced_man',
  'aussie bloke': 'English_Aussie_Bloke',
  'diligent man': 'English_Diligent_Man',
  'reserved young man': 'English_ReservedYoungMan',
  'man with deep voice': 'English_ManWithDeepVoice',
  'friendly guy': 'English_FriendlyPerson',
  'friendly person': 'English_FriendlyPerson',
  'male debater': 'English_Debator',
  'debator': 'English_Debator',
  'reliable mentor': 'English_Steadymentor',
  'steady mentor': 'English_Steadymentor',
  'deep-voiced gentleman': 'English_Deep-VoicedGentleman',
  'deep voiced gentleman': 'English_Deep-VoicedGentleman',
  'captivating storyteller': 'English_CaptivatingStoryteller',
  'decent young man': 'English_DecentYoungMan',
  'passionate warrior': 'English_PassionateWarrior',
  'wise scholar': 'English_WiseScholar',
  'patient man': 'English_PatientMan',
  'comedian': 'English_Comedian',
  'teen boy': 'English_SadTeen',
};

/**
 * Resolves any friendly name, legacy alias, or Gemini voice to a valid MiniMax voice ID.
 * @param {string} voicePersona - Input persona string or alias
 * @param {string} language - Target language ('id-ID' or 'en-US')
 * @returns {string} Official MiniMax Voice ID
 */
export function resolveMinimaxVoice(voicePersona, language = 'id-ID') {
  let voiceId = voicePersona || (language === 'en-US' ? 'English_radiant_girl' : 'Indonesian_casual_reporter_vv2');
  
  // Resolve legacy alias first if present
  if (LEGACY_MINIMAX_ENGLISH_VOICE_ALIASES && LEGACY_MINIMAX_ENGLISH_VOICE_ALIASES[voiceId]) {
    voiceId = LEGACY_MINIMAX_ENGLISH_VOICE_ALIASES[voiceId];
  }

  const normalizedKey = voiceId.trim().toLowerCase();
  if (FRIENDLY_TO_MINIMAX_MAP[normalizedKey]) {
    voiceId = FRIENDLY_TO_MINIMAX_MAP[normalizedKey];
  } else if (FRIENDLY_TO_MINIMAX_MAP[voiceId]) {
    voiceId = FRIENDLY_TO_MINIMAX_MAP[voiceId];
  }

  const lang = language === 'en-US' ? 'en-US' : 'id-ID';
  if (GEMINI_TO_MINIMAX_MAP[lang] && GEMINI_TO_MINIMAX_MAP[lang][voiceId]) {
    voiceId = GEMINI_TO_MINIMAX_MAP[lang][voiceId];
  }

  return voiceId;
}

export const MINIMAX_GATEWAY_POOL = [
  'https://api.minimax.io/v1/t2a_v2',       // Gateway Utama Global (Aktif & Cepat)
  'https://api.minimaxi.chat/v1/t2a_v2',    // Gateway Alternatif 1 (Aktif)
  'https://api.minimax.chat/v1/t2a_v2',     // Gateway Alternatif 2 (Aktif)
  'https://api-uw.minimax.io/v1/t2a_v2'     // Gateway US-West (Fallback)
];

/**
 * Generate Voiceover using MiniMax AI TTS API (t2a_v2).
 * @param {string} text - Naskah pembacaan
 * @param {string} voicePersona - Voice ID/Persona pilihan (e.g. Indonesian_SweetGirl)
 * @param {string} outputPath - Absolute local path untuk menyimpan file MP3
 * @param {object} config - Pilihan speed, volume, pitch
 */
export async function generateMinimaxVO(text, voicePersona, outputPath, config = {}) {
  const apiKey = getSetting('minimax_api_key');
  if (!apiKey) {
    throw new Error('MiniMax API Key belum dikonfigurasi di Settings.');
  }

  const speed = config.speed !== undefined ? Number(config.speed) : 1.0;
  const volume = config.volume !== undefined ? Number(config.volume) : 1.0;
  const pitch = config.pitch !== undefined ? Number(config.pitch) : 0;
  const targetModel = config.model || 'speech-2.8-turbo';

  const isEn = String(config.language || '').toLowerCase().startsWith('en');
  const targetLanguage = isEn ? 'en-US' : 'id-ID';

  let voiceId = resolveMinimaxVoice(voicePersona, targetLanguage);
  
  const payload = {
    model: targetModel,
    text: text,
    stream: false,
    voice_setting: {
      voice_id: voiceId,
      speed: speed,
      vol: volume,
      pitch: pitch
    },
    audio_setting: {
      sample_rate: 32000,
      bitrate: 128000,
      format: 'mp3',
      channel: 1
    },
    language_boost: isEn ? 'English' : 'Indonesian',
    output_format: 'hex'
  };

  const gateways = config.gatewayPool || MINIMAX_GATEWAY_POOL;
  let lastError = null;
  let response = null;

  for (let idx = 0; idx < gateways.length; idx++) {
    const currentUrl = gateways[idx];
    try {
      response = await fetch(currentUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status >= 500 && idx < gateways.length - 1) {
          console.warn(`[MiniMax TTS Warning] Gateway ${currentUrl} returned HTTP ${response.status}. Switching to next gateway...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (idx + 1)));
          continue;
        }
        throw new Error(`MiniMax API HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      break;
    } catch (netErr) {
      lastError = netErr;
      if (idx < gateways.length - 1) {
        console.warn(`[MiniMax TTS Warning] Connection to ${currentUrl} failed: ${netErr.message}. Switching to next gateway...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (idx + 1)));
        continue;
      }
      throw lastError;
    }
  }

  if (!response || !response.ok) {
    throw lastError || new Error('Seluruh gateway MiniMax TTS tidak dapat dihubungi.');
  }

  const result = await response.json();
  if (result.base_resp && result.base_resp.status_code !== 0) {
    throw new Error(`MiniMax API error: ${result.base_resp.status_msg} (code: ${result.base_resp.status_code})`);
  }

  if (!result.data || !result.data.audio) {
    throw new Error('MiniMax API returned no audio data');
  }

  // Convert hex response to binary buffer
  const audioBuffer = Buffer.from(result.data.audio, 'hex');
  
  // Make sure target directory exists
  const targetDir = path.dirname(outputPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, audioBuffer);
  return outputPath;
}

const CHARACTER_VOICE_PRESETS = {
  'id-ID': {
    'ginger': 'Indonesian_energetic_streamer_vv2',
    'jahe': 'Indonesian_energetic_streamer_vv2',
    'mint': 'Indonesian_crisp_reporter_vv2',
    'kunyit': 'Indonesian_intellectual_commentator_vv2',
    'temulawak': 'Indonesian_crisp_reporter_vv2',
    'wajan': 'Indonesian_energetic_streamer_vv2',
    'blender': 'Indonesian_crisp_reporter_vv2',
    'kucing': 'Indonesian_casual_reporter_vv2',
    'anjing': 'Indonesian_energetic_streamer_vv2',
    'host': 'Indonesian_professional_anchor_vv2',
    'narrator': 'Indonesian_casual_reporter_vv2'
  },
  'en-US': {
    'ginger': 'English_expressive_host__vv1',
    'jahe': 'English_expressive_host__vv1',
    'mint': 'English_radiant_girl',
    'kunyit': 'English_instructive_professor_vv1',
    'temulawak': 'English_radiant_girl',
    'wajan': 'English_Resonant_Man',
    'blender': 'English_causual_narrator_vv1',
    'kucing': 'English_causual_podcast_vv1',
    'anjing': 'English_Trustworth_Man',
    'host': 'English_captivating_female1',
    'narrator': 'English_CalmWoman'
  }
};

export const AVAILABLE_MINIMAX_VOICES_ID = [
  'Indonesian_energetic_streamer_vv2',
  'Indonesian_crisp_reporter_vv2',
  'Indonesian_professional_anchor_vv2',
  'Indonesian_casual_reporter_vv2',
  'Indonesian_intellectual_commentator_vv2',
  'Indonesian_compelling_storyteller_vv2',
  'Indonesian_expressive_podcaster_vv2'
];

export const AVAILABLE_MINIMAX_VOICES_EN = [
  // 19 Female Voices
  'English_radiant_girl',
  'English_compelling_lady1',
  'English_captivating_female1',
  'English_Upbeat_Woman',
  'English_CalmWoman',
  'English_Whispering_girl',
  'English_Graceful_Lady',
  'English_PlayfulGirl',
  'English_MaturePartner',
  'English_MatureBoss',
  'English_LovelyGirl',
  'English_Wiselady',
  'English_SentimentalLady',
  'English_ImposingManner',
  'English_Soft-spokenGirl',
  'English_SereneWoman',
  'English_ConfidentWoman',
  'English_BossyLeader',
  'English_UpsetGirl',

  // 19 Male Voices
  'English_expressive_narrator',
  'English_magnetic_voiced_man',
  'English_Trustworth_Man',
  'English_Gentle-voiced_man',
  'English_Aussie_Bloke',
  'English_Diligent_Man',
  'English_ReservedYoungMan',
  'English_ManWithDeepVoice',
  'English_FriendlyPerson',
  'English_Debator',
  'English_Steadymentor',
  'English_Deep-VoicedGentleman',
  'English_CaptivatingStoryteller',
  'English_DecentYoungMan',
  'English_PassionateWarrior',
  'English_WiseScholar',
  'English_PatientMan',
  'English_Comedian',
  'English_SadTeen',

  // Legacy Fallback
  'English_Resonant_Man',
  'English_causual_narrator_vv1',
  'English_causual_podcast_vv1',
  'English_expressive_host__vv1',
  'English_instructive_professor_vv1',
  'English_nursery_teacher_vv2'
];

const AVAILABLE_GEMINI_VOICES = [
  'Kore', 'Orus', 'Despina', 'Aoede', 'Charon',
  'Callirrhoe', 'Iapetus', 'Leda', 'Zephyr', 'Fenrir',
  'Puck', 'Autonoe', 'Enceladus', 'Umbriel'
];

/**
 * Automatically maps a character ID to a suitable Minimax/Gemini voice, updating the voice cast.
 * @param {string} existingVoiceCastJson - JSON string or object
 * @param {Array} voiceoverArray - Storyboard voiceover list containing voice_segments
 * @param {string} language - Target language (e.g. 'id-ID')
 * @param {string} voiceProvider - Target voice provider (e.g. 'gemini' or 'minimax')
 * @returns {string} New voice_cast_json string if updated, null if no changes
 */
export function registerJitVoiceCast(existingVoiceCastJson, voiceoverArray, language = 'id-ID', voiceProvider = 'minimax') {
  let voiceCast = { characters: [] };
  if (existingVoiceCastJson) {
    try {
      const parsed = typeof existingVoiceCastJson === 'string'
        ? JSON.parse(existingVoiceCastJson)
        : existingVoiceCastJson;
      if (parsed && Array.isArray(parsed.characters)) {
        voiceCast = parsed;
      }
    } catch (e) {
      console.warn('[JIT Voice Cast] Failed to parse existing voice cast:', e.message);
    }
  }

  const lang = language === 'en-US' ? 'en-US' : 'id-ID';
  const voiceList = voiceProvider === 'gemini'
    ? AVAILABLE_GEMINI_VOICES
    : (lang === 'en-US' ? AVAILABLE_MINIMAX_VOICES_EN : AVAILABLE_MINIMAX_VOICES_ID);
  const presets = CHARACTER_VOICE_PRESETS[lang] || {};

  let updated = false;
  
  // Find all unique character_ids in voiceoverArray
  const uniqueCharIds = new Set();
  if (Array.isArray(voiceoverArray)) {
    voiceoverArray.forEach(v => {
      if (Array.isArray(v.voice_segments)) {
        v.voice_segments.forEach(seg => {
          if (seg.character_id) {
            uniqueCharIds.add(seg.character_id.trim().toLowerCase());
          }
        });
      }
    });
  }

  uniqueCharIds.forEach(charId => {
    // Check if character already registered
    const exists = voiceCast.characters.some(ch => ch.id.toLowerCase() === charId);
    if (!exists) {
      // Find voice ID
      let minimaxVoiceId = presets[charId];
      if (!minimaxVoiceId) {
        // Dynamic cycle through available voices
        const registeredCount = voiceCast.characters.length;
        minimaxVoiceId = voiceList[registeredCount % voiceList.length];
      }

      // Format name nicely
      const charName = charId.charAt(0).toUpperCase() + charId.slice(1);
      
      voiceCast.characters.push({
        id: charId,
        name: charName,
        gemini_voice_id: minimaxVoiceId,
        minimax_voice_id: minimaxVoiceId
      });
      updated = true;
    }
  });

  return updated ? JSON.stringify(voiceCast) : null;
}
