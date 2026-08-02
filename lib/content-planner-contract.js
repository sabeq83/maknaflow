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
  let input = value;
  if (typeof input === 'string') {
    try { input = JSON.parse(input); } catch (_) { input = input.split('\n'); }
  }
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  return input.map(item => String(item || '').trim()).filter(item => {
    const key = item.toLowerCase();
    if (!item || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 20);
}

function validationError(message) {
  const error = new Error(message);
  error.code = 'CONTENT_PLANNER_VALIDATION';
  return error;
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
    if (normalizePillars(params.pillars).length === 0) throw validationError('Minimal satu pilar konten wajib diisi untuk Brand Editorial.');
  }
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
