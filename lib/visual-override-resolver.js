import crypto from 'crypto';
import { getVisualIdentity } from './visual-identity-repository.js';
import { validateAndNormalizeVisualIdentity, normalizeLegacyVisualOverrides } from './visual-identity-contract.js';
import { WARDROBE_PRESETS, DEMOGRAPHIC_PRESETS, LIGHTING_PRESETS, MASCOT_UNIVERSES } from './prompts.js';

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
  if (mode === 'random' || mode === 'stable_random') {
    const key = catalog[stableIndex(stableSeed, catalog.length)];
    return { key, description: WARDROBE_PRESETS[key] };
  }
  return { key: mode, description: WARDROBE_PRESETS[mode] || 'modest clothing' };
}

// Vocabulary for Environment Presets
const ENVIRONMENT_VOCAB = {
  nordic_kitchen: 'in a modern bright Nordic style kitchen, featuring clean white marble countertops and light oak wood cabinets',
  cozy_bakery: 'in a warm cozy bakery kitchen with soft flour dust in the air and a warm wooden table backdrop',
  modern_laboratory: 'in a clean clinical laboratory workspace with stainless steel surfaces and professional instruments',
  general_workspace: 'in a clean minimalist workspace'
};

// Authoritative Visual Identity Resolver
export async function resolveVisualIdentity({ presetRef, inlineConfig, legacyOverrides, itemContext = {} }) {
  let sourcePreset = null;
  let config = null;

  if (presetRef) {
    sourcePreset = await getVisualIdentity(presetRef);
  }

  if (sourcePreset) {
    config = sourcePreset.config;
  } else if (inlineConfig) {
    config = validateAndNormalizeVisualIdentity(inlineConfig);
  } else if (legacyOverrides) {
    config = normalizeLegacyVisualOverrides(legacyOverrides);
  } else {
    // Safe default: Muslimah Sage Kitchen
    const def = await getVisualIdentity('hands_only_muslimah_sage_kitchen');
    config = def ? def.config : validateAndNormalizeVisualIdentity({});
  }

  // Build identity reference object
  const identityRef = sourcePreset ? {
    id: sourcePreset.id,
    key: sourcePreset.preset_key,
    version: sourcePreset.version,
    source: sourcePreset.source
  } : {
    id: 'inline',
    key: 'inline',
    version: 1,
    source: 'inline'
  };

  const snapshot = {
    schema_version: 'visual_identity_snapshot_v1',
    identity_ref: identityRef,
    structured: config,
    resolved: {},
    legacy: {}
  };

  return resolveVisualIdentitySnapshot(snapshot, itemContext);
}

export function resolveVisualIdentitySnapshot(snapshot, itemContext = {}) {
  let activeSnapshot = snapshot;
  if (activeSnapshot && activeSnapshot.schema_version === 'visual_identity_snapshot_v1' && activeSnapshot.resolved && activeSnapshot.resolved.subject_prompt) {
    return activeSnapshot;
  }
  if (!activeSnapshot || activeSnapshot.schema_version !== 'visual_identity_snapshot_v1') {
    const normalized = normalizeLegacyVisualOverrides(activeSnapshot || {});
    activeSnapshot = {
      schema_version: 'visual_identity_snapshot_v1',
      identity_ref: { id: 'legacy', key: 'legacy', version: 1, source: 'legacy' },
      structured: normalized
    };
  }
  const config = activeSnapshot.structured;
  const { itemIndex = 0, stableSeed = '', rowOverride = '' } = itemContext;

  // 1. Resolve Subject Prompt
  let subjectPrompt = 'a graceful character';
  if (config.subject.kind === 'human' || config.subject.kind === 'blank_face_3d') {
    subjectPrompt = DEMOGRAPHIC_PRESETS[config.subject.demographic_key] || 'a graceful Muslimah';
  } else {
    // Mascot or Animal lookup
    const demoKey = config.subject.demographic_key;
    let foundMascot = null;
    for (const univ of Object.values(MASCOT_UNIVERSES || {})) {
      if (univ.mascots && univ.mascots[demoKey]) {
        foundMascot = univ.mascots[demoKey];
        break;
      }
    }
    subjectPrompt = foundMascot || demoKey || 'a cute character';
  }
  if (config.subject.custom_description) {
    subjectPrompt = `${subjectPrompt}, ${config.subject.custom_description}`;
  }

  // 2. Resolve Wardrobe Prompt
  let wardrobePrompt = 'wearing modest clothing';
  if (config.wardrobe.mode === 'custom') {
    wardrobePrompt = config.wardrobe.custom_description || 'wearing modest clothing';
  } else {
    const resolvedW = resolveWardrobe({
      mode: config.wardrobe.mode === 'fixed' ? config.wardrobe.preset_key : config.wardrobe.mode,
      subjectDemographic: config.subject.demographic_key,
      itemIndex,
      stableSeed,
      rowOverride
    });
    wardrobePrompt = resolvedW.description || 'wearing modest clothing';
  }
  if (config.wardrobe.primary_color) {
    wardrobePrompt = `${wardrobePrompt}, primary color ${config.wardrobe.primary_color}`;
  }
  if (config.wardrobe.secondary_color) {
    wardrobePrompt = `${wardrobePrompt}, secondary color ${config.wardrobe.secondary_color}`;
  }

  // 3. Resolve Environment Prompt
  const envDesc = ENVIRONMENT_VOCAB[config.environment.preset_key] || ENVIRONMENT_VOCAB.general_workspace;
  let environmentPrompt = envDesc;
  if (config.environment.custom_description) {
    environmentPrompt = `${environmentPrompt}, ${config.environment.custom_description}`;
  }
  if (Array.isArray(config.environment.material_palette) && config.environment.material_palette.length > 0) {
    environmentPrompt = `${environmentPrompt}, palette featuring ${config.environment.material_palette.join(' and ')}`;
  }
  if (Array.isArray(config.environment.props) && config.environment.props.length > 0) {
    environmentPrompt = `${environmentPrompt}, decorated with ${config.environment.props.join(', ')}`;
  }

  // 4. Resolve Lighting Prompt
  let lightingPrompt = LIGHTING_PRESETS[config.lighting.preset_key] || 'soft natural light';
  if (config.lighting.custom_description) {
    lightingPrompt = `${lightingPrompt}, ${config.lighting.custom_description}`;
  }

  // 5. Resolve Camera Prompt
  let cameraPrompt = `camera framing is ${config.camera.framing}, perspective is ${config.camera.perspective}`;
  if (config.camera.lens_look) {
    cameraPrompt = `${cameraPrompt}, shot with a ${config.camera.lens_look} lens`;
  }
  if (config.camera.depth_of_field) {
    cameraPrompt = `${cameraPrompt}, depth of field is ${config.camera.depth_of_field}`;
  }
  if (config.camera.movement) {
    cameraPrompt = `${cameraPrompt}, with ${config.camera.movement} camera movement`;
  }

  // 6. Resolve Style Prompt
  let stylePrompt = 'cinematic style, realistic details';
  if (config.style.preset_key === 'cinematic_realistic') {
    stylePrompt = 'cinematic realistic style, highly detailed render';
  } else if (config.style.preset_key === '3d_claymation_cozy') {
    stylePrompt = 'cozy 3D claymation style, soft textures, cute render';
  }
  if (config.style.custom_description) {
    stylePrompt = `${stylePrompt}, ${config.style.custom_description}`;
  }

  // 7. Resolve Negative Prompt
  const negativePrompt = [
    'visible human face',
    'eyes',
    'nose',
    'mouth',
    'human portrait',
    ...(config.guardrails.required_negative_prompts || [])
  ].join(', ');

  const resolved = {
    subject_prompt: subjectPrompt,
    wardrobe_prompt: wardrobePrompt,
    environment_prompt: environmentPrompt,
    lighting_prompt: lightingPrompt,
    camera_prompt: cameraPrompt,
    style_prompt: stylePrompt,
    negative_prompt: negativePrompt
  };

  const isMascot = config.subject.kind === 'animal' || config.subject.kind === 'mascot_object';

  // Build legacy flat representation
  const legacy = {
    character_concept: 'faceless',
    subject_demographic: isMascot ? config.subject.demographic_key : 'custom',
    subject_demographic_custom: isMascot ? undefined : subjectPrompt,
    wardrobe_style: 'custom',
    wardrobe_style_custom: wardrobePrompt,
    lighting_style: 'custom',
    lighting_style_custom: lightingPrompt,
    visual_style_preset: config.style.preset_key
  };

  return {
    ...snapshot,
    resolved,
    legacy,
    // Add legacy direct-access keys at root level for backward compatibility
    ...legacy,
    wardrobe_mode: config.wardrobe.mode,
    wardrobe_resolved_key: config.wardrobe.preset_key
  };
}

// Backward-compatible wrapper during migration
export function resolveVisualOverrides({ visualOverrides = {}, itemIndex, stableSeed, rowOverride }) {
  let resolved;
  if (visualOverrides && visualOverrides.schema_version === 'visual_identity_snapshot_v1') {
    resolved = resolveVisualIdentitySnapshot(visualOverrides, { itemIndex, stableSeed, rowOverride });
  } else {
    const normalized = normalizeLegacyVisualOverrides(visualOverrides);
    resolved = resolveVisualIdentitySnapshot({
      schema_version: 'visual_identity_snapshot_v1',
      identity_ref: { id: 'legacy', key: 'legacy', version: 1, source: 'legacy' },
      structured: normalized
    }, { itemIndex, stableSeed, rowOverride });
  }

  return {
    ...resolved,
    ...visualOverrides,
    schema_version: resolved.schema_version,
    identity_ref: resolved.identity_ref,
    structured: resolved.structured,
    resolved: resolved.resolved,
    legacy: resolved.legacy,
    wardrobe_mode: resolved.wardrobe_mode,
    wardrobe_resolved_key: resolved.wardrobe_resolved_key,
    wardrobe_style: 'custom',
    wardrobe_style_custom: resolved.wardrobe_style_custom,
    lighting_style: resolved.lighting_style,
    lighting_style_custom: resolved.lighting_style_custom,
    visual_style_preset: resolved.visual_style_preset
  };
}

export async function resolveVisualIdentitySubmission({ preset_id, inline_config, legacy_overrides_json }) {
  // Resolve using the central resolver
  const snapshot = await resolveVisualIdentity({
    presetRef: preset_id !== 'inline' && preset_id !== 'custom' ? preset_id : null,
    inlineConfig: preset_id === 'inline' ? inline_config : null,
    legacyOverrides: preset_id === 'custom' ? legacy_overrides_json : null
  });

  return {
    ref: snapshot.identity_ref,
    snapshot
  };
}
