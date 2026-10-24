/**
 * Katalog Suara Sentral untuk MiniMax dan Gemini TTS (Universal Voice Registry)
 * File: lib/voice-constants.js
 */

export const MINIMAX_VOICES = [
  { id: 'Indonesian_casual_reporter_vv2', name: 'Casual Reporter', avatar: '🎙️', desc: 'Laki-laki (Casual Reporter - Vv2)' },
  { id: 'Indonesian_compelling_storyteller_vv2', name: 'Compelling Storyteller', avatar: '📖', desc: 'Laki-laki (Compelling Storyteller - Vv2)' },
  { id: 'Indonesian_expressive_podcaster_vv2', name: 'Expressive Podcaster', avatar: '🎧', desc: 'Laki-laki (Expressive Podcaster - Vv2)' },
  { id: 'Indonesian_energetic_streamer_vv2', name: 'Energetic Streamer', avatar: '⚡', desc: 'Laki-laki (Energetic Streamer - Vv2)' },
  { id: 'Indonesian_intellectual_commentator_vv2', name: 'Intellectual Commentator', avatar: '🧐', desc: 'Laki-laki (Intellectual Commentator - Vv2)' },
  { id: 'Indonesian_professional_anchor_vv2', name: 'Professional Anchor', avatar: '👔', desc: 'Perempuan (Professional Anchor - Vv2)' },
  { id: 'Indonesian_crisp_reporter_vv2', name: 'Crisp Reporter', avatar: '👩', desc: 'Perempuan (Crisp Reporter - Vv2)' }
];

export const OFFICIAL_MINIMAX_ENGLISH_VOICES = [
  // ── FEMALE VOICES (19 Suara Resmi) ──
  { id: 'English_radiant_girl', name: 'Radiant Girl', gender: 'Female', avatar: '👩', desc: 'Female (Radiant & Energetic - Lifestyle/Food)', category: 'Lifestyle' },
  { id: 'English_compelling_lady1', name: 'Compelling Lady', gender: 'Female', avatar: '👩', desc: 'Female (Persuasive & Elegant - Affiliate/Sales)', category: 'Commercial' },
  { id: 'English_captivating_female1', name: 'Captivating Female', gender: 'Female', avatar: '👩', desc: 'Female (Captivating & Dynamic - Storytelling)', category: 'Storytelling' },
  { id: 'English_Upbeat_Woman', name: 'Upbeat Woman', gender: 'Female', avatar: '👩', desc: 'Female (Upbeat & Optimistic)', category: 'General' },
  { id: 'English_CalmWoman', name: 'Calm Woman', gender: 'Female', avatar: '👩', desc: 'Female (Calm & Soothing - Educational)', category: 'Educational' },
  { id: 'English_Whispering_girl', name: 'Whispering Girl', gender: 'Female', avatar: '👩', desc: 'Female (Soft Whispering - ASMR/Aesthetic)', category: 'ASMR' },
  { id: 'English_Graceful_Lady', name: 'Graceful Lady', gender: 'Female', avatar: '👩', desc: 'Female (Graceful & Classy - Luxury)', category: 'Commercial' },
  { id: 'English_PlayfulGirl', name: 'Playful Girl', gender: 'Female', avatar: '👩', desc: 'Female (Playful & Casual - Gen-Z)', category: 'Lifestyle' },
  { id: 'English_MaturePartner', name: 'Mature Partner', gender: 'Female', avatar: '👩', desc: 'Female (Mature & Supportive)', category: 'General' },
  { id: 'English_MatureBoss', name: 'Bossy Lady', gender: 'Female', avatar: '👩', desc: 'Female (Authoritative & Executive)', category: 'Professional' },
  { id: 'English_LovelyGirl', name: 'Lovely Girl', gender: 'Female', avatar: '👩', desc: 'Female (Sweet & Friendly)', category: 'Lifestyle' },
  { id: 'English_Wiselady', name: 'Wise Lady', gender: 'Female', avatar: '👩', desc: 'Female (Wise & Mature)', category: 'Educational' },
  { id: 'English_SentimentalLady', name: 'Sentimental Lady', gender: 'Female', avatar: '👩', desc: 'Female (Warm & Emotional)', category: 'Storytelling' },
  { id: 'English_ImposingManner', name: 'Imposing Queen', gender: 'Female', avatar: '👩', desc: 'Female (Dominant & Royal)', category: 'Dramatic' },
  { id: 'English_Soft-spokenGirl', name: 'Soft-Spoken Girl', gender: 'Female', avatar: '👩', desc: 'Female (Soft & Gentle)', category: 'ASMR' },
  { id: 'English_SereneWoman', name: 'Serene Woman', gender: 'Female', avatar: '👩', desc: 'Female (Serene & Peaceful)', category: 'Relaxing' },
  { id: 'English_ConfidentWoman', name: 'Confident Woman', gender: 'Female', avatar: '👩', desc: 'Female (Confident & Modern)', category: 'Commercial' },
  { id: 'English_BossyLeader', name: 'Bossy Leader', gender: 'Female', avatar: '👩', desc: 'Female (Strong Leader & Directive)', category: 'Professional' },
  { id: 'English_UpsetGirl', name: 'Upset Girl', gender: 'Female', avatar: '👩', desc: 'Female (Dramatic & Emotional)', category: 'Dramatic' },

  // ── MALE VOICES (19 Suara Resmi) ──
  { id: 'English_expressive_narrator', name: 'Expressive Narrator', gender: 'Male', avatar: '👨', desc: 'Male (Expressive Storyteller - Hook/Story)', category: 'Storytelling' },
  { id: 'English_magnetic_voiced_man', name: 'Magnetic-Voiced Male', gender: 'Male', avatar: '👨', desc: 'Male (Deep Charismatic - Commercial/Promo)', category: 'Commercial' },
  { id: 'English_Trustworth_Man', name: 'Trustworthy Man', gender: 'Male', avatar: '👨', desc: 'Male (Credible & Warm - Review/Facts)', category: 'Review' },
  { id: 'English_Gentle-voiced_man', name: 'Gentle-Voiced Man', gender: 'Male', avatar: '👨', desc: 'Male (Gentle & Warm)', category: 'Lifestyle' },
  { id: 'English_Aussie_Bloke', name: 'Aussie Bloke', gender: 'Male', avatar: '👨', desc: 'Male (Australian Accent - Casual/Upbeat)', category: 'Specialty' },
  { id: 'English_Diligent_Man', name: 'Diligent Man', gender: 'Male', avatar: '👨', desc: 'Male (Diligent & Straightforward)', category: 'Professional' },
  { id: 'English_ReservedYoungMan', name: 'Reserved Young Man', gender: 'Male', avatar: '👨', desc: 'Male (Polite & Articulate)', category: 'General' },
  { id: 'English_ManWithDeepVoice', name: 'Man With Deep Voice', gender: 'Male', avatar: '👨', desc: 'Male (Deep Bass & Authoritative)', category: 'Dramatic' },
  { id: 'English_FriendlyPerson', name: 'Friendly Guy', gender: 'Male', avatar: '👨', desc: 'Male (Friendly & Conversational)', category: 'Lifestyle' },
  { id: 'English_Debator', name: 'Male Debater', gender: 'Male', avatar: '👨', desc: 'Male (Sharp & Argumentative)', category: 'Professional' },
  { id: 'English_Steadymentor', name: 'Reliable Mentor', gender: 'Male', avatar: '👨', desc: 'Male (Wise Mentor & Steady)', category: 'Educational' },
  { id: 'English_Deep-VoicedGentleman', name: 'Deep-Voiced Gentleman', gender: 'Male', avatar: '👨', desc: 'Male (Sophisticated & Classic)', category: 'Luxury' },
  { id: 'English_CaptivatingStoryteller', name: 'Captivating Storyteller', gender: 'Male', avatar: '👨', desc: 'Male (Dynamic Storyteller)', category: 'Storytelling' },
  { id: 'English_DecentYoungMan', name: 'Decent Young Man', gender: 'Male', avatar: '👨', desc: 'Male (Natural & Pleasant)', category: 'General' },
  { id: 'English_PassionateWarrior', name: 'Passionate Warrior', gender: 'Male', avatar: '👨', desc: 'Male (High Energy & Passionate)', category: 'Dramatic' },
  { id: 'English_WiseScholar', name: 'Wise Scholar', gender: 'Male', avatar: '👨', desc: 'Male (Scholarly & Academic)', category: 'Educational' },
  { id: 'English_PatientMan', name: 'Patient Man', gender: 'Male', avatar: '👨', desc: 'Male (Patient & Instructional)', category: 'Educational' },
  { id: 'English_Comedian', name: 'Comedian', gender: 'Male', avatar: '👨', desc: 'Male (Humorous & Lively)', category: 'Entertainment' },
  { id: 'English_SadTeen', name: 'Teen Boy', gender: 'Male', avatar: '👨', desc: 'Male (Youthful & Melancholic)', category: 'Dramatic' }
];

export const LEGACY_MINIMAX_ENGLISH_VOICE_ALIASES = {
  'English_Resonant_Man': 'English_ManWithDeepVoice',
  'English_causual_narrator_vv1': 'English_expressive_narrator',
  'English_causual_podcast_vv1': 'English_magnetic_voiced_man',
  'English_expressive_host__vv1': 'English_expressive_narrator',
  'English_instructive_professor_vv1': 'English_Wiselady',
  'English_nursery_teacher_vv2': 'English_radiant_girl'
};

const LEGACY_FALLBACK_VOICE_ENTRIES = [
  { id: 'English_Resonant_Man', name: 'Resonant Man (Legacy)', gender: 'Male', avatar: '👨', desc: 'English Resonant Man', category: 'Legacy' },
  { id: 'English_causual_narrator_vv1', name: 'Casual Narrator (Legacy)', gender: 'Male', avatar: '👨', desc: 'English Casual Narrator', category: 'Legacy' },
  { id: 'English_causual_podcast_vv1', name: 'Casual Podcast (Legacy)', gender: 'Male', avatar: '👨', desc: 'English Casual Podcast', category: 'Legacy' },
  { id: 'English_expressive_host__vv1', name: 'Expressive Host (Legacy)', gender: 'Male', avatar: '👨', desc: 'English Expressive Host', category: 'Legacy' },
  { id: 'English_instructive_professor_vv1', name: 'Instructive Professor (Legacy)', gender: 'Female', avatar: '👩', desc: 'English Instructive Professor', category: 'Legacy' },
  { id: 'English_nursery_teacher_vv2', name: 'Nursery Teacher (Legacy)', gender: 'Female', avatar: '👩', desc: 'English Nursery Teacher', category: 'Legacy' }
];

export const MINIMAX_ENGLISH_VOICES = [
  ...OFFICIAL_MINIMAX_ENGLISH_VOICES,
  ...LEGACY_FALLBACK_VOICE_ENTRIES
];

export const GEMINI_VOICES = [
  { id: 'Kore', name: 'Kore', avatar: '👩', desc: 'Perempuan (Tenang & Lembut)' },
  { id: 'Orus', name: 'Orus', avatar: '👨', desc: 'Laki-laki (Tegas & Jelas)' },
  { id: 'Despina', name: 'Despina', avatar: '👩', desc: 'Perempuan (Ceria & Ramah)' },
  { id: 'Aoede', name: 'Aoede', avatar: '👩', desc: 'Perempuan (Ekspresif & Hangat)' },
  { id: 'Charon', name: 'Charon', avatar: '👨', desc: 'Laki-laki (Dalam & Berwibawa)' },
  { id: 'Callirrhoe', name: 'Callirrhoe', avatar: '👩', desc: 'Perempuan (Cerdas & Ringan)' },
  { id: 'Iapetus', name: 'Iapetus', avatar: '👨', desc: 'Laki-laki (Santai & Kasual)' },
  { id: 'Leda', name: 'Leda', avatar: '👩', desc: 'Perempuan (Serius & Lugas)' },
  { id: 'Zephyr', name: 'Zephyr', avatar: '👨', desc: 'Laki-laki (Cepat & Berenergi)' },
  { id: 'Fenrir', name: 'Fenrir', avatar: '👨', desc: 'Laki-laki (Berat & Dramatis)' },
  { id: 'Puck', name: 'Puck', avatar: '🎭', desc: 'Playful & Muda' },
  { id: 'Autonoe', name: 'Autonoe', avatar: '👩', desc: 'Perempuan (Artikulatif)' },
  { id: 'Enceladus', name: 'Enceladus', avatar: '👨', desc: 'Laki-laki (Narasi Sinematik)' },
  { id: 'Umbriel', name: 'Umbriel', avatar: '👨', desc: 'Laki-laki (Misterius & Teduh)' }
];

/**
 * Mengambil daftar suara berdasarkan provider dan bahasa target
 * @param {string|object} providerOrOptions
 * @param {string} [language]
 */
export function getAvailableVoices(providerOrOptions = 'minimax', language = 'id-ID') {
  let provider = providerOrOptions;
  let targetLang = language;

  if (typeof providerOrOptions === 'object' && providerOrOptions !== null) {
    provider = providerOrOptions.provider || 'minimax';
    targetLang = providerOrOptions.language || 'id-ID';
  }

  if (provider === 'gemini') {
    return GEMINI_VOICES;
  }
  const isEn = String(targetLang || '').toLowerCase().startsWith('en');
  return isEn ? MINIMAX_ENGLISH_VOICES : MINIMAX_VOICES;
}
