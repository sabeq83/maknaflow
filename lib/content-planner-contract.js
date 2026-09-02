import { BRAND_CONTEXT_MAX_LENGTH, CONTENT_GOAL_MAX_LENGTH, normalizeEditorialPillars } from './brand-editorial-defaults.js';

export const PRODUCT_PLANNER_COUNTS = [6, 12, 18, 24, 30];
export const MAX_PLANNER_COUNT = 30;
export const DEFAULT_PRODUCT_PLANNER_COUNT = 12;
export const DEFAULT_EDITORIAL_ROWS_PER_PILLAR = 2;

export function normalizePlannerFocus(value) {
  const focus = value || 'product_campaign';
  if (!['product_campaign', 'brand_editorial'].includes(focus)) {
    const error = new Error('Fokus planner tidak valid.');
    error.code = 'CONTENT_PLANNER_VALIDATION';
    throw error;
  }
  return focus;
}

export function normalizePillars(value) {
  return normalizeEditorialPillars(value);
}

function validationError(message) {
  const error = new Error(message);
  error.code = 'CONTENT_PLANNER_VALIDATION';
  return error;
}

export function getBrandEditorialCountOptions(pillarCount) {
  const normalizedCount = Number.parseInt(pillarCount, 10);
  if (!Number.isInteger(normalizedCount) || normalizedCount < 1) return [];
  return Array.from({ length: Math.floor(MAX_PLANNER_COUNT / normalizedCount) }, (_, index) => {
    const rowsPerPillar = index + 1;
    const value = normalizedCount * rowsPerPillar;
    return { value, rowsPerPillar, label: `${value} Baris — ${rowsPerPillar} ide per pilar` };
  });
}

export function validatePlannerCount(focusValue, plannerCount, pillarsValue = []) {
  const focus = normalizePlannerFocus(focusValue);
  const count = Number.parseInt(plannerCount, 10);
  if (focus === 'product_campaign') {
    if (!PRODUCT_PLANNER_COUNTS.includes(count)) {
      throw validationError('Jumlah baris Product Campaign harus mengikuti siklus CEP: 6, 12, 18, 24, atau 30.');
    }
    return { count, rowsPerPillar: null };
  }

  const pillarCount = normalizePillars(pillarsValue).length;
  if (pillarCount < 1 || !Number.isInteger(count) || count < pillarCount || count > MAX_PLANNER_COUNT || count % pillarCount !== 0) {
    throw validationError('Jumlah baris Brand Editorial harus merupakan kelipatan jumlah pilar dan maksimal 30.');
  }
  return { count, rowsPerPillar: count / pillarCount };
}

export function validatePlannerDraft(params) {
  const focus = normalizePlannerFocus(params.planner_focus);
  if (focus === 'product_campaign') {
    if (!String(params.product_name || '').trim() || !String(params.product_description || '').trim()) {
      throw validationError('Nama produk dan deskripsi produk wajib diisi untuk Product Campaign.');
    }
  } else {
    if (!String(params.account_name || '').trim() && !params.brand_id) throw validationError('Nama akun atau Brand Profile wajib diisi untuk Brand Editorial.');
    if (!String(params.brand_context || '').trim()) throw validationError('Konteks brand wajib diisi untuk Brand Editorial.');
    if (String(params.brand_context || '').trim().length > BRAND_CONTEXT_MAX_LENGTH) throw validationError(`Konteks brand maksimal ${BRAND_CONTEXT_MAX_LENGTH} karakter.`);
    if (String(params.content_goal || '').trim().length > CONTENT_GOAL_MAX_LENGTH) throw validationError(`Tujuan konten maksimal ${CONTENT_GOAL_MAX_LENGTH} karakter.`);
    if (normalizePillars(params.pillars).length === 0) throw validationError('Minimal satu pilar konten wajib diisi untuk Brand Editorial.');
  }
  validatePlannerCount(focus, params.planner_count, params.pillars);
  return focus;
}

export function buildDistributionPlan(plannerCount, pillarsList, offsetIndex = 0, seedString = '') {
  let seed = 0;
  for (let i = 0; i < seedString.length; i++) {
    seed = (seed << 5) - seed + seedString.charCodeAt(i);
    seed |= 0;
  }
  seed = Math.abs(seed);
  const shiftArray = (arr, shift) => {
    if (arr.length === 0) return arr;
    const position = shift % arr.length;
    return [...arr.slice(position), ...arr.slice(0, position)];
  };
  const defaultPillars = pillarsList?.length ? pillarsList : ['Edukasi & Problem Solving', 'Routine & Habit Building', 'Review & Honest Comparison', 'Behind the Scene & Lifestyle'];
  const cepTypes = ['Problem-Solution Based', 'Routine Based', 'Emotional Based', 'Aspirational Based', 'Commitment Based', 'Opportunistic Based'];
  const vfoTypes = ['Concrete (Fakta & Produk Langsung)', 'Instinctive (Emosi & Sensorik Visual)', 'Uncharted (Sudut Pandang Unik / Mind-Blowing)', 'Aspirational (Gaya Hidup & Transformasi)'];
  const rotatedPillars = shiftArray(defaultPillars, seed);
  const rotatedCEPs = shiftArray(cepTypes, seed + 1);
  const rotatedVFOs = shiftArray(vfoTypes, seed + 2);
  return Array.from({ length: plannerCount }, (_, i) => {
    const index = i + offsetIndex;
    return { sequence: i + 1, pillar: rotatedPillars[index % rotatedPillars.length], category_cep: rotatedCEPs[index % rotatedCEPs.length], vfo: rotatedVFOs[index % rotatedVFOs.length] };
  });
}

export function normalizeGeneratedPlannerRows(result, lockedRows, expectedCount) {
  const generated = Array.isArray(result) ? result : (result?.planner_rows || result?.rows || []);
  return Array.from({ length: expectedCount }, (_, index) => {
    const locked = lockedRows[index] || {};
    const creative = generated[index] || {};
    return {
      ...creative,
      sequence: index + 1,
      pillar: locked.pillar || creative.pillar || 'Edukasi & Problem Solving',
      category_cep: locked.category_cep || creative.category_cep || 'Problem-Solution Based',
      vfo: locked.vfo || creative.vfo || 'Concrete (Fakta & Produk Langsung)',
      product_reference: locked.product_reference !== undefined ? locked.product_reference : (locked.product || creative.product_reference || null),
      product: locked.product !== undefined ? locked.product : (creative.product || null),
      main_character: locked.main_character || creative.main_character || null,
      supporting_characters: locked.supporting_characters || creative.supporting_characters || null,
      story_premise: locked.story_premise || creative.story_premise || null,
      pet_problem: locked.pet_problem || creative.pet_problem || null,
      product_role: locked.product_role || creative.product_role || null,
      product_reveal_beat: locked.product_reveal_beat || creative.product_reveal_beat || null,
      universe_profile: locked.universe_profile || creative.universe_profile || null
    };
  });
}

export function validateLockedPlannerStructure(rows, lockedDistribution) {
  if (!Array.isArray(rows)) {
    throw validationError('Planner rows wajib berupa array.');
  }
  if (!Array.isArray(lockedDistribution)) {
    throw validationError('Locked distribution wajib berupa array.');
  }
  if (rows.length !== lockedDistribution.length) {
    throw validationError(`Jumlah baris (${rows.length}) tidak sesuai dengan locked distribution (${lockedDistribution.length}).`);
  }

  for (let i = 0; i < lockedDistribution.length; i++) {
    const expected = lockedDistribution[i];
    const actual = rows[i];
    if (!actual) throw validationError(`Baris pada indeks ${i} hilang.`);
    if (actual.sequence !== expected.sequence) {
      throw validationError(`Sequence baris ke-${i + 1} (${actual.sequence}) tidak sesuai (${expected.sequence}).`);
    }
    if (expected.pillar && actual.pillar !== expected.pillar) {
      throw validationError(`Pilar baris ke-${i + 1} ("${actual.pillar}") tidak sesuai dengan locked structure ("${expected.pillar}").`);
    }
    if (expected.category_cep && actual.category_cep !== expected.category_cep) {
      throw validationError(`Category CEP baris ke-${i + 1} ("${actual.category_cep}") tidak sesuai dengan locked structure ("${expected.category_cep}").`);
    }
    if (expected.vfo && actual.vfo !== expected.vfo) {
      throw validationError(`VFO baris ke-${i + 1} ("${actual.vfo}") tidak sesuai dengan locked structure ("${expected.vfo}").`);
    }
  }

  return true;
}

