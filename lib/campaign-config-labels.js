const DEMOGRAPHIC_LABELS = {
  genz_casual: 'Gen-Z & Milenial Muda (Santai / Gaul)',
  ibu_rumah_tangga: 'Ibu Rumah Tangga & Keluarga (Ramah / Mengayomi)',
  professional_executive: 'Profesional & Worker (Lugas / Efisien)',
  hijab_syari_family: 'Keluarga Hijrah & Syari (Santun / Islami)',
  fitness_health_enthusiast: 'Penggiat Olahraga & Kesehatan (Motivatif)',
  millennial_professional: 'Millennial (Profesional / Formal)',
  parent_warm: 'Orang Tua (Hangat / Mengayomi)'
};

const SUBJECT_LABELS = {
  syari_classic: "Wanita Gamis Syar'i",
  casual_hijabi: 'Wanita Hijab Kasual',
  modern_mom: 'Ibu Modern',
  young_professional: 'Profesional Muda'
};

const CHARACTER_LABELS = {
  faceless: 'Faceless',
  pov: 'POV',
  silhouette: 'Silhouette'
};

const LIGHTING_LABELS = {
  window_daylight: 'Cahaya Alami dari Jendela',
  warm_cozy: 'Hangat dan Nyaman',
  studio_bright: 'Studio Terang'
};

export function getDemographicLabel(value, custom) {
  if (value === 'custom') return custom || 'Custom';
  return DEMOGRAPHIC_LABELS[value] || value || 'Belum Ditentukan';
}

export function getVisualOverrideLabel(type, value) {
  const maps = { subject: SUBJECT_LABELS, character: CHARACTER_LABELS, lighting: LIGHTING_LABELS };
  return maps[type]?.[value] || value || 'Belum Ditentukan';
}

export function parseVisualOverrides(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); }
  catch (_) { return {}; }
}
