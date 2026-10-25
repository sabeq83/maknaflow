import { getDemographicLabel as getCentralizedDemographicLabel } from './demographic-constants.js';

export function getDemographicLabel(value, custom, language = 'id-ID') {
  return getCentralizedDemographicLabel(value, custom, language);
}


export const SUBJECT_LABELS = {
  syari_classic: "Wanita Gamis Syar'i",
  casual_hijabi: 'Wanita Hijab Kasual',
  modern_mom: 'Ibu Modern',
  young_professional: 'Profesional Muda'
};

export const CHARACTER_LABELS = {
  faceless: 'Faceless',
  pov: 'POV',
  silhouette: 'Silhouette'
};

export const LIGHTING_LABELS = {
  window_daylight: 'Cahaya Alami dari Jendela',
  warm_cozy: 'Hangat dan Nyaman',
  studio_bright: 'Studio Terang'
};

export function getVisualOverrideLabel(type, value) {
  const maps = { subject: SUBJECT_LABELS, character: CHARACTER_LABELS, lighting: LIGHTING_LABELS };
  return (maps[type] && maps[type][value]) || value || 'Belum Ditentukan';
}

export function parseVisualOverrides(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); }
  catch (_) { return {}; }
}
