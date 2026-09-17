export const RECIPE_CATEGORIES = ['masakan', 'minuman', 'dessert', 'kue'];
export const DEFAULT_RECIPE_COUNT = 5;
export const MIN_RECIPE_COUNT = 1;
export const MAX_RECIPE_COUNT = 20;

export const TARGET_AUDIENCE_OPTIONS = [
  'genz_casual',
  'ibu_rumah_tangga',
  'professional_executive',
  'hijab_syari_family',
  'fitness_health_enthusiast',
  'custom'
];

function validationError(message) {
  const error = new Error(message);
  error.code = 'CONTENT_PLANNER_VALIDATION';
  return error;
}

export function validateRecipePlannerDraft(params = {}) {
  const category = (params.category || params.recipe_category || '').toLowerCase().trim();
  if (!RECIPE_CATEGORIES.includes(category)) {
    throw validationError(`Kategori resep '${category}' tidak valid. Pilihan: ${RECIPE_CATEGORIES.join(', ')}.`);
  }

  const count = Number.parseInt(params.planner_count ?? params.count, 10);
  if (!Number.isInteger(count) || count < MIN_RECIPE_COUNT || count > MAX_RECIPE_COUNT) {
    throw validationError(`Jumlah baris Recipe Campaign harus berupa integer antara ${MIN_RECIPE_COUNT} dan ${MAX_RECIPE_COUNT}.`);
  }

  const productIds = Array.isArray(params.product_ids)
    ? params.product_ids
    : (Array.isArray(params.productIds) ? params.productIds : []);
  
  if (productIds.length === 0 && !params.product_id) {
    throw validationError('Minimal satu produk katalog tenant harus dipilih untuk Recipe Campaign.');
  }

  return {
    category,
    count,
    productIds: productIds.length > 0 ? productIds : [params.product_id],
    strategyMode: params.strategy_mode || params.strategyMode || 'synergy',
    targetAudience: params.target_audience || 'genz_casual',
    customTargetAudience: params.custom_target_audience || '',
    promotionContext: params.promotion_context || '',
    customInstructions: params.custom_instructions || '',
    platform: params.platform || 'tiktok'
  };
}

export function validateCanonicalRecipe(recipe) {
  if (!recipe || typeof recipe !== 'object') {
    throw new Error('Data canonical recipe tidak valid.');
  }
  if (!recipe.title || typeof recipe.title !== 'string') {
    throw new Error('Judul resep wajib ada.');
  }
  if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
    throw new Error('Daftar bahan resep (ingredients) minimal 1 item.');
  }
  for (const ing of recipe.ingredients) {
    if (!ing.name || !String(ing.name).trim()) {
      throw new Error('Nama bahan tidak boleh kosong.');
    }
  }
  if (!Array.isArray(recipe.steps) || recipe.steps.length === 0) {
    throw new Error('Langkah-langkah memasak (steps) minimal 1 langkah.');
  }
  for (const step of recipe.steps) {
    if (!step.instruction || !String(step.instruction).trim()) {
      throw new Error('Instruksi langkah memasak tidak boleh kosong.');
    }
  }
  return true;
}

export function validateRecipeProductionPackage(pkg) {
  if (!pkg || typeof pkg !== 'object') {
    throw new Error('Paket produksi resep tidak valid.');
  }
  validateCanonicalRecipe(pkg.recipe);
  if (!Array.isArray(pkg.scenes) || pkg.scenes.length === 0) {
    throw new Error('Paket produksi resep wajib memuat array scenes.');
  }
  if (!pkg.social_media_package || !pkg.social_media_package.caption_with_recipe) {
    throw new Error('Paket sosial media wajib memuat caption_with_recipe.');
  }
  return true;
}
