export const BRAND_CONTEXT_MAX_LENGTH = 4000;
export const CONTENT_GOAL_MAX_LENGTH = 2000;
export const EDITORIAL_PILLAR_MAX_LENGTH = 120;
export const EDITORIAL_PILLAR_MAX_ITEMS = 12;

function validationError(message) {
  const error = new Error(message);
  error.code = 'BRAND_EDITORIAL_VALIDATION';
  return error;
}

export function normalizeEditorialPillars(value) {
  let input = value;
  if (typeof input === 'string') {
    try { input = JSON.parse(input); } catch { input = input.split('\n'); }
  }
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const result = [];
  for (const item of input) {
    const normalized = String(item || '').trim();
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized.slice(0, EDITORIAL_PILLAR_MAX_LENGTH));
    if (result.length === EDITORIAL_PILLAR_MAX_ITEMS) break;
  }
  return result;
}

export function normalizeBrandEditorialDefaults(input = {}) {
  const rawPillars = input.editorial_content_pillars ?? input.editorial_content_pillars_json;
  return {
    editorial_brand_context: String(input.editorial_brand_context || '').trim(),
    editorial_content_goal: String(input.editorial_content_goal || '').trim(),
    editorial_content_pillars_json: JSON.stringify(normalizeEditorialPillars(rawPillars))
  };
}

export function getBrandEditorialDefaults(input = {}) {
  const normalized = normalizeBrandEditorialDefaults(input);
  return {
    brandContext: normalized.editorial_brand_context,
    contentGoal: normalized.editorial_content_goal,
    pillars: normalizeEditorialPillars(normalized.editorial_content_pillars_json)
  };
}

export function shouldHydrateBrandEditorial({ dirty, brandContext, contentGoal, pillars } = {}) {
  return !dirty || (!String(brandContext || '').trim() && !String(contentGoal || '').trim() && (!Array.isArray(pillars) || pillars.length === 0));
}

export function validateBrandEditorialDefaults(input = {}) {
  const normalized = normalizeBrandEditorialDefaults(input);
  const pillars = normalizeEditorialPillars(normalized.editorial_content_pillars_json);
  if (!normalized.editorial_brand_context) throw validationError('Konteks Brand wajib diisi.');
  if (normalized.editorial_brand_context.length > BRAND_CONTEXT_MAX_LENGTH) throw validationError(`Konteks Brand maksimal ${BRAND_CONTEXT_MAX_LENGTH} karakter.`);
  if (normalized.editorial_content_goal.length > CONTENT_GOAL_MAX_LENGTH) throw validationError(`Tujuan Konten maksimal ${CONTENT_GOAL_MAX_LENGTH} karakter.`);
  if (pillars.length === 0) throw validationError('Minimal satu Pilar Konten wajib diisi.');
  return normalized;
}
