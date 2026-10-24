/**
 * Centralized Demographics & Audience Tone Hub
 * Single Source of Truth (SSOT) untuk opsi demografi antarmuka dan prompt directive AI
 * Mendukung Bahasa Indonesia (id-ID) dan English US (en-US).
 */

export const CENTRALIZED_DEMOGRAPHICS = {
  'id-ID': [
    { id: 'genz_casual', label: 'Gen-Z & Milenial Muda (Santai, Gaul, Akrab "Kamu/Lo")' },
    { id: 'ibu_rumah_tangga', label: 'Ibu Rumah Tangga & Keluarga (Ramah, Mengayomi "Bunda/Moms")' },
    { id: 'professional_executive', label: 'Profesional & Worker (Lugas, Refined, Efisien "Anda/Kamu")' },
    { id: 'hijab_syari_family', label: 'Keluarga Hijrah & Syari (Santun, Islami Alami "Bunda/Ukhti")' },
    { id: 'fitness_health_enthusiast', label: 'Penggiat Olahraga & Kesehatan (Motivatif, Energik, Informatif)' },
    { id: 'custom', label: 'Custom Input Bebas...' }
  ],
  'en-US': [
    { id: 'genz_casual', label: 'Gen-Z & Young Millennials (Conversational, authentic, snappy "You")' },
    { id: 'ibu_rumah_tangga', label: 'Busy Parents & Families (Warm, encouraging, practical time-savers)' },
    { id: 'professional_executive', label: 'Professionals & Busy Executives (Polished, concise, high-value)' },
    { id: 'hijab_syari_family', label: 'Modest Living & Wholesome Families (Respectful, gracious, calming)' },
    { id: 'fitness_health_enthusiast', label: 'Health & Fitness Enthusiasts (High-energy, motivating, macro-focused)' },
    { id: 'custom', label: 'Custom Audience Input...' }
  ]
};

export const DEMOGRAPHIC_INSTRUCTIONS = {
  'id-ID': {
    genz_casual: "Target Audiens: Gen-Z & Milenial Muda. Gunakan nada bicara santai, gaul, akrab (relatable), dengan sapaan 'kamu' atau 'lo'. Gunakan diksi modern yang kasual tanpa berlebihan, hindari bahasa baku kaku.",
    ibu_rumah_tangga: "Target Audiens: Ibu Rumah Tangga & Keluarga. Gunakan nada bicara hangat, ramah, mengayomi, solutif, dengan sapaan 'Bunda', 'Moms', atau 'Kamu'. Utamakan penjelasan efisiensi waktu, kemudahan penggunaan, dan kepraktisan keluarga.",
    professional_executive: "Target Audiens: Profesional & Pekerja Kantoran. Gunakan nada bicara lugas, berbobot, cerdas, refined, dengan sapaan 'Anda' atau 'Kamu'. Fokus pada kualitas, efisiensi kerja, dan nilai hasil konkret.",
    hijab_syari_family: "Target Audiens: Komunitas Syari & Keluarga Hijrah. Gunakan nada bicara santun, ramah, hangat, islami alami (seperti 'Bunda', 'Ukhti', 'Sahabat'), dengan pembawaan yang menenangkan dan bermanfaat.",
    fitness_health_enthusiast: "Target Audiens: Penggiat Olahraga & Kesehatan. Gunakan nada bicara motivatif, energik, informatif, menyertakan fakta nutrisi/kesehatan secara logis dan practical."
  },
  'en-US': {
    genz_casual: "Target Audience: Gen-Z & Young Millennials. Use a conversational, authentic, snappy US English tone, addressing the viewer directly as 'you'. Modern everyday phrasing, upbeat pacing, zero corporate fluff.",
    ibu_rumah_tangga: "Target Audience: Busy Parents & Families. Warm, encouraging, nurturing tone. Focus on effortless kitchen prep, time-saving family routines, and accessible wellness.",
    professional_executive: "Target Audience: Busy Professionals & Executives. Polished, concise, intelligent delivery. High-value takeaways, zero fluff, sharp execution.",
    hijab_syari_family: "Target Audience: Modest Living & Wholesome Families. Gracious, respectful, calming, and inspiring tone.",
    fitness_health_enthusiast: "Target Audience: Fitness & Health Enthusiasts. High-energy, motivating, instructional tone with practical nutrition, macro breakdown, and clean ingredient insights."
  }
};

/**
 * Mendapatkan daftar opsi demografi untuk elemen <select>
 * @param {string} language - 'id-ID' | 'en-US'
 * @returns {Array<{id: string, label: string}>}
 */
export function getDemographicOptions(language = 'id-ID') {
  const isEn = String(language || '').toLowerCase().startsWith('en');
  return CENTRALIZED_DEMOGRAPHICS[isEn ? 'en-US' : 'id-ID'];
}

/**
 * Menghasilkan blok instruksi prompt untuk Gemini AI
 * @param {string} key - e.g. 'genz_casual', 'custom'
 * @param {string} customVal - teks kustom bila key === 'custom'
 * @param {string} language - 'id-ID' | 'en-US'
 * @returns {string}
 */
export function getDemographicInstruction(key, customVal = '', language = 'id-ID') {
  if (!key) return '';
  const isEn = String(language || '').toLowerCase().startsWith('en');
  const langKey = isEn ? 'en-US' : 'id-ID';

  if (key === 'custom') {
    return isEn 
      ? `Target Audience: Specific Custom Audience (${customVal || 'Custom'}). Tailor diction, tone, and pacing specifically for this demographic.`
      : `Target Audiens Spesifik: ${customVal || 'Bebas'}. Adaptasikan diksi, gaya bahasa, dan nada bicara secara presisi agar sangat relevan dengan audiens ini.`;
  }

  const instructions = DEMOGRAPHIC_INSTRUCTIONS[langKey];
  return instructions[key] || (isEn ? `Target Audience: ${key}` : `Target Audiens: ${key}`);
}

/**
 * Mendapatkan label tampilan untuk kartu kampanye atau detail view
 * @param {string} key - e.g. 'genz_casual'
 * @param {string} customVal - teks kustom
 * @param {string} language - 'id-ID' | 'en-US'
 * @returns {string}
 */
export function getDemographicLabel(key, customVal = '', language = 'id-ID') {
  if (!key) return 'Belum Ditentukan';
  if (key === 'custom') return customVal || (language.startsWith('en') ? 'Custom' : 'Bebas');
  const options = getDemographicOptions(language);
  const found = options.find(o => o.id === key);
  return found ? found.label : key;
}
