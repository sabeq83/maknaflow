export const pillarSections = ['Planner, Preset & Strategi','Aesthetics & Visual Settings','Product Bridging Settings','Visual Identity','Workflow & Audio Settings'];
export function validatePillarDraft(payload) {
  if (!payload || typeof payload !== 'object') throw Error('Konfigurasi Pillar wajib.');
  if (!payload.campaign_name?.trim()) throw Error('Nama campaign Pillar wajib.');
  return { ...payload };
}
