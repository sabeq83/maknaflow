import { getSetting } from './db.js';
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

const FRIENDLY_TO_MINIMAX_MAP = {
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
  'calm woman': 'English_CalmWoman'
};

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

  const url = 'https://api-uw.minimax.io/v1/t2a_v2';
  
  let voiceId = voicePersona || 'Indonesian_casual_reporter_vv2';
  
  // Normalize friendly name if exists
  const normalizedKey = voiceId.trim().toLowerCase();
  if (FRIENDLY_TO_MINIMAX_MAP[normalizedKey]) {
    voiceId = FRIENDLY_TO_MINIMAX_MAP[normalizedKey];
  }

  const lang = config.language === 'en-US' ? 'en-US' : 'id-ID';
  if (GEMINI_TO_MINIMAX_MAP[lang] && GEMINI_TO_MINIMAX_MAP[lang][voiceId]) {
    console.log(`[Minimax TTS] Mapping Gemini voice "${voiceId}" to Minimax voice "${GEMINI_TO_MINIMAX_MAP[lang][voiceId]}" for language ${lang}`);
    voiceId = GEMINI_TO_MINIMAX_MAP[lang][voiceId];
  }
  
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
    language_boost: lang === 'en-US' ? 'English' : 'Indonesian',
    output_format: 'hex'
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MiniMax API HTTP error! status: ${response.status}, body: ${errorText}`);
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

const AVAILABLE_MINIMAX_VOICES_ID = [
  'Indonesian_energetic_streamer_vv2',
  'Indonesian_crisp_reporter_vv2',
  'Indonesian_professional_anchor_vv2',
  'Indonesian_casual_reporter_vv2',
  'Indonesian_intellectual_commentator_vv2',
  'Indonesian_compelling_storyteller_vv2',
  'Indonesian_expressive_podcaster_vv2'
];

const AVAILABLE_MINIMAX_VOICES_EN = [
  'English_Resonant_Man',
  'English_Trustworth_Man',
  'English_causual_narrator_vv1',
  'English_causual_podcast_vv1',
  'English_expressive_host__vv1',
  'English_instructive_professor_vv1',
  'English_nursery_teacher_vv2',
  'English_captivating_female1',
  'English_radiant_girl',
  'English_CalmWoman'
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
