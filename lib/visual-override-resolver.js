import crypto from 'crypto';
import { WARDROBE_PRESETS } from './prompts.js';

const GROUPS = {
  syari_classic: ['amber_terracotta', 'mocca_caramel', 'warm_grey', 'sage_muted', 'lavender_lilac', 'butter_yellow', 'teal_navy', 'olive_modern', 'mahogany_maroon', 'cloud_dancer'],
  caucasian_male: ['male_terracotta', 'male_caramel', 'male_khaki_tan', 'male_navy_blue', 'male_forest_green', 'male_charcoal', 'male_burgundy', 'male_sage_muted', 'male_steel_blue', 'male_cloud_dancer'],
  stylized_3d_muslimah: ['3d_fem_emerald', '3d_fem_pastel_pink', '3d_fem_jetblack', '3d_fem_mocca'],
  stylized_3d_male: ['3d_male_tan_knit', '3d_male_sage_jacket', '3d_male_charcoal_tshirt', '3d_male_terracotta_flannel'],
  stylized_3d_duo: ['3d_duo_earth', '3d_duo_contrast', '3d_duo_monochrome', '3d_duo_pastel', '3d_duo_cool']
};

export function getCompatibleWardrobes(subjectDemographic) {
  const configured = GROUPS[subjectDemographic] || GROUPS.syari_classic;
  const available = configured.filter(key => WARDROBE_PRESETS[key]);
  return available.length ? available : Object.keys(WARDROBE_PRESETS || {});
}

function stableIndex(seed, length) {
  const digest = crypto.createHash('sha256').update(String(seed)).digest();
  return digest.readUInt32BE(0) % length;
}

export function resolveWardrobe({ mode, subjectDemographic, itemIndex = 0, stableSeed = '', rowOverride = '' }) {
  if (rowOverride?.trim()) {
    const normalized = rowOverride.toLowerCase().replace(/[\s_-]+/g, '');
    const matched = Object.keys(WARDROBE_PRESETS || {}).find(key => key.toLowerCase().replace(/[\s_-]+/g, '') === normalized);
    return { key: matched || 'custom', description: matched ? WARDROBE_PRESETS[matched] : `dressed in ${rowOverride} color, modest clothing` };
  }
  const catalog = getCompatibleWardrobes(subjectDemographic);
  if (!catalog.length) return { key: 'custom', description: 'modest clothing' };
  if (mode === 'sequential') {
    const key = catalog[Math.max(0, Number(itemIndex) || 0) % catalog.length];
    return { key, description: WARDROBE_PRESETS[key] };
  }
  if (mode === 'random') {
    const key = catalog[stableIndex(stableSeed, catalog.length)];
    return { key, description: WARDROBE_PRESETS[key] };
  }
  return { key: mode, description: WARDROBE_PRESETS[mode] || 'modest clothing' };
}

export function resolveVisualOverrides({ visualOverrides = {}, itemIndex, stableSeed, rowOverride }) {
  const wardrobe = resolveWardrobe({
    mode: visualOverrides.wardrobe_style,
    subjectDemographic: visualOverrides.subject_demographic,
    itemIndex,
    stableSeed,
    rowOverride
  });
  return {
    ...visualOverrides,
    wardrobe_mode: visualOverrides.wardrobe_style,
    wardrobe_resolved_key: wardrobe.key,
    wardrobe_style: 'custom',
    wardrobe_style_custom: wardrobe.description
  };
}
