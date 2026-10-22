export const recipeStaticSections = ['Sumber & Kategori','Layout & Komposisi','Brand & Demografi'];
export const recipeVideoSections = ['Basic Creative Strategy','Aesthetics & Visual Settings','Product Bridging Settings','Visual Identity','Workflow & Audio Settings'];
export function validateRecipeDraft(payload) {
  const p = { ...payload };
  const count = Number(p.target_recipe_count ?? 1);
  if (!Number.isInteger(count) || count < 1 || count > 20) throw Error('Jumlah Recipe Labs harus 1–20 sesuai API asal.');
  if (!p.category?.trim()) throw Error('Kategori Recipe wajib diisi.');
  if (p.category === 'Custom Input' && !p.custom_category?.trim()) throw Error('Isi kategori custom Recipe.');
  if (p.campaign_type === 'video') {
    const cfg = typeof p.config_json === 'string' ? JSON.parse(p.config_json) : p.config_json;
    if (!cfg?.campaign_name?.trim() || count !== 1) throw Error('Recipe Storyboard memerlukan nama campaign dan satu hasil.');
  } else if (!p.nextcloud_parent_folder?.trim()) throw Error('Parent Folder Recipe wajib.');
  return p;
}
