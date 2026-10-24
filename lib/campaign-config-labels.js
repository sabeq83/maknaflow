import { getDemographicLabel as getCentralizedDemographicLabel } from './demographic-constants.js';

export function getDemographicLabel(value, custom, language = 'id-ID') {
  return getCentralizedDemographicLabel(value, custom, language);
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
