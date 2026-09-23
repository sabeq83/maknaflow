import crypto from 'crypto';
import { getVisualIdentity } from './visual-identity-repository.js';
import { validateAndNormalizeVisualIdentity, normalizeLegacyVisualOverrides } from './visual-identity-contract.js';
import {
  VISUAL_LANGUAGE_CATALOG,
  NARRATIVE_FUNCTIONS,
  getVisualStyleDefinition,
  isValidVisualStyle,
  isValidNarrativeFunction
} from './visual-language-catalog.js';
import { WARDROBE_PRESETS, DEMOGRAPHIC_PRESETS, LIGHTING_PRESETS, MASCOT_UNIVERSES } from './prompts.js';

const GROUPS = {
  syari_classic: ['amber_terracotta', 'mocca_caramel', 'warm_grey', 'sage_muted', 'lavender_lilac', 'butter_yellow', 'teal_navy', 'olive_modern', 'mahogany_maroon', 'cloud_dancer'],
  southeast_asian_male: ['male_terracotta', 'male_caramel', 'male_khaki_tan', 'male_navy_blue', 'male_forest_green', 'male_charcoal', 'male_burgundy', 'male_sage_muted', 'male_steel_blue', 'male_cloud_dancer'],
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

function buildRenderingPrompt(rendering) {
  if (!rendering) return '';
  const parts = [];
  if (rendering.geometry) parts.push(`geometry is ${rendering.geometry.replace(/_/g, ' ')}`);
  if (Array.isArray(rendering.textures) && rendering.textures.length > 0) {
    parts.push(`textures featuring ${rendering.textures.map(t => t.replace(/_/g, ' ')).join(', ')}`);
  }
  if (rendering.shadow_style) parts.push(`shadows rendered as ${rendering.shadow_style.replace(/_/g, ' ')}`);
  if (rendering.finish) parts.push(`finish is ${rendering.finish.replace(/_/g, ' ')}`);
  return parts.join(', ');
}

function buildCompositionPrompt(composition) {
  if (!composition) return '';
  const parts = [];
  if (composition.primary_idea_count) parts.push(`strictly ${composition.primary_idea_count} primary idea`);
  if (composition.primary_subject_count) parts.push(`${composition.primary_subject_count} focal subject`);
  if (composition.negative_space && composition.negative_space !== 'flexible') {
    parts.push('ample negative space for typography and breathing room');
  }
  if (composition.safe_zone) {
    parts.push(`aligned within ${composition.safe_zone.replace(/_/g, ' ')} safety boundaries`);
  }
  return parts.join(', ');
}

function buildMetaphorPrompt(metaphorEngine, itemContext) {
  if (!metaphorEngine?.enabled) return '';
  const { concept, primaryObject, visualAction } = itemContext || {};
  if (concept || primaryObject || visualAction) {
    const details = [
      concept ? `concept: "${concept}"` : null,
      primaryObject ? `represented by physical object: "${primaryObject}"` : null,
      visualAction ? `visual action: "${visualAction}"` : null
    ].filter(Boolean).join(' -> ');
    return `metaphor translation [${details}]`;
  }
  return 'translate abstract ideas into tangible physical metaphor objects and actions';
}

function deduplicatePrompts(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const trimmed = String(item || '').trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(trimmed);
    }
  }
  return result;
}

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

  let referenceAssets = [];
  if (sourcePreset && sourcePreset.id) {
    try {
      const { getApprovedReferenceAssets } = await import('./reference-asset-repository.js');
      const { buildReferenceAssetSnapshot } = await import('./reference-asset-contract.js');
      const roles = ['wardrobe', 'visual_style', 'palette_sheet', 'character_sheet'];
      const assets = await getApprovedReferenceAssets('visual_identity', sourcePreset.id, roles);
      referenceAssets = (assets || []).map(buildReferenceAssetSnapshot);
    } catch (e) {
      console.warn('[resolveVisualIdentity] Failed to fetch approved reference assets:', e.message);
    }
  }

  const snapshot = {
    schema_version: 'visual_identity_snapshot_v1',
    identity_ref: identityRef,
    structured: config,
    reference_assets: referenceAssets,
    resolved: {},
    legacy: {}
  };

  return resolveVisualIdentitySnapshot(snapshot, itemContext);
}

export function resolveVisualIdentitySnapshot(snapshot, itemContext = {}) {
  let activeSnapshot = snapshot;
  if (activeSnapshot && activeSnapshot.schema_version === 'visual_identity_snapshot_v1' && activeSnapshot.resolved && activeSnapshot.resolved.subject_prompt && !activeSnapshot.structured) {
    return activeSnapshot;
  }
  if (!activeSnapshot || !activeSnapshot.structured) {
    const normalized = normalizeLegacyVisualOverrides(activeSnapshot || {});
    activeSnapshot = {
      schema_version: 'visual_identity_snapshot_v1',
      identity_ref: { id: 'legacy', key: 'legacy', version: 1, source: 'legacy' },
      structured: normalized
    };
  } else if (activeSnapshot.schema_version !== 'visual_identity_snapshot_v1') {
    activeSnapshot = {
      ...activeSnapshot,
      schema_version: 'visual_identity_snapshot_v1'
    };
  }
  const config = activeSnapshot.structured;
  const { itemIndex = 0, stableSeed = '', rowOverride = '', narrativeFunction } = itemContext;

  // 1. Resolve Active Visual Mode based on Narrative Routing
  let activeStyleKey = config.visual_language?.primary_style || config.style?.preset_key || 'editorial_graphic_novel';
  if (narrativeFunction && isValidNarrativeFunction(narrativeFunction) && config.mode_routing?.[narrativeFunction]) {
    activeStyleKey = config.mode_routing[narrativeFunction];
  }
  const styleDefinition = getVisualStyleDefinition(activeStyleKey);

  // 2. Resolve Subject Prompt
  let subjectPrompt = 'a character';
  if (config.subject.kind === 'human' || config.subject.kind === 'blank_face_3d') {
    const presetDesc = DEMOGRAPHIC_PRESETS[config.subject.demographic_key];
    if (presetDesc) {
      subjectPrompt = presetDesc;
      if (config.subject.custom_description) {
        subjectPrompt = `${subjectPrompt}, ${config.subject.custom_description}`;
      }
    } else if (config.subject.custom_description) {
      const customSub = config.subject.custom_description.trim();
      if (config.subject.faceless_mode === 'hands_only' && !customSub.toLowerCase().includes('faceless') && !customSub.toLowerCase().includes('cropped')) {
        subjectPrompt = `${customSub}, strictly faceless framing, camera focused entirely on the forearms and hands, cropped from the elbow down to show only the forearms and hands, strictly omitting the face, head, neck, chest, and shoulders`;
      } else {
        subjectPrompt = customSub;
      }
    } else {
      subjectPrompt = 'a person featuring clean hands, strictly faceless framing, camera focused on the forearms and hands, cropped from the elbow down to show only the forearms and hands';
    }

    if (config.subject.population_mode === 'group' || config.subject.population_mode === 'crowd' || config.subject.population_mode === 'single_group_or_crowd') {
      subjectPrompt = `${subjectPrompt}, intentional faceless group or crowd composition allowed, all human figures strictly without visible facial features or identifiable faces`;
    }
  } else {
    // Mascot or Animal lookup
    const demoKey = config.subject.demographic_key;
    let foundMascot = null;
    if (demoKey && demoKey !== 'custom' && demoKey !== 'not_applicable') {
      for (const univ of Object.values(MASCOT_UNIVERSES || {})) {
        if (univ.mascots && univ.mascots[demoKey]) {
          foundMascot = univ.mascots[demoKey];
          break;
        }
      }
    }
    if (foundMascot) {
      subjectPrompt = foundMascot;
      if (config.subject.custom_description) {
        subjectPrompt = `${subjectPrompt}, ${config.subject.custom_description}`;
      }
    } else if (config.subject.custom_description && config.subject.custom_description.trim()) {
      subjectPrompt = config.subject.custom_description.trim();
    } else if (demoKey && demoKey !== 'custom' && demoKey !== 'not_applicable') {
      subjectPrompt = demoKey.replace(/_/g, ' ');
    } else {
      subjectPrompt = 'a cute stylized character';
    }
  }

  // 3. Resolve Wardrobe Prompt
  let wardrobePrompt = 'wearing clean attire';
  if (config.wardrobe?.mode === 'custom' || config.wardrobe?.preset_key === 'custom') {
    wardrobePrompt = config.wardrobe.custom_description || 'wearing clean attire';
  } else if (config.wardrobe) {
    const resolvedW = resolveWardrobe({
      mode: config.wardrobe.mode === 'fixed' ? config.wardrobe.preset_key : config.wardrobe.mode,
      subjectDemographic: config.subject.demographic_key,
      itemIndex,
      stableSeed,
      rowOverride
    });
    wardrobePrompt = resolvedW.description || (config.wardrobe.custom_description || 'wearing clean attire');
  }
  if (config.wardrobe?.primary_color && !wardrobePrompt.includes(config.wardrobe.primary_color)) {
    wardrobePrompt = `${wardrobePrompt}, primary color ${config.wardrobe.primary_color}`;
  }
  if (config.wardrobe?.secondary_color && !wardrobePrompt.includes(config.wardrobe.secondary_color)) {
    wardrobePrompt = `${wardrobePrompt}, secondary color ${config.wardrobe.secondary_color}`;
  }

  // 4. Resolve Environment Prompt
  let environmentPrompt = '';
  if (config.environment?.preset_key === 'custom' || !ENVIRONMENT_VOCAB[config.environment?.preset_key]) {
    environmentPrompt = config.environment?.custom_description || ENVIRONMENT_VOCAB.general_workspace;
  } else {
    const envDesc = ENVIRONMENT_VOCAB[config.environment.preset_key];
    environmentPrompt = envDesc;
    if (config.environment.custom_description) {
      environmentPrompt = `${environmentPrompt}, ${config.environment.custom_description}`;
    }
  }
  if (Array.isArray(config.environment?.material_palette) && config.environment.material_palette.length > 0) {
    environmentPrompt = `${environmentPrompt}, palette featuring ${config.environment.material_palette.join(' and ')}`;
  }
  if (Array.isArray(config.environment?.props) && config.environment.props.length > 0) {
    environmentPrompt = `${environmentPrompt}, decorated with ${config.environment.props.join(', ')}`;
  }

  // 5. Resolve Lighting Prompt
  let lightingPrompt = (config.lighting?.preset_key && LIGHTING_PRESETS[config.lighting.preset_key]) || 'soft natural light';
  if (config.lighting?.custom_description) {
    lightingPrompt = `${lightingPrompt}, ${config.lighting.custom_description}`;
  }

  // 6. Resolve Camera Prompt
  let cameraPrompt = `camera framing is ${config.camera?.framing || 'forearms_and_hands'}, perspective is ${config.camera?.perspective || 'third_person'}`;
  if (config.camera?.lens_look) {
    cameraPrompt = `${cameraPrompt}, shot with a ${config.camera.lens_look} lens`;
  }
  if (config.camera?.depth_of_field) {
    cameraPrompt = `${cameraPrompt}, depth of field is ${config.camera.depth_of_field}`;
  }
  if (config.camera?.movement) {
    cameraPrompt = `${cameraPrompt}, with ${config.camera.movement} camera movement`;
  }

  // 7. Resolve Style & Prompt Layers
  const renderingPrompt = buildRenderingPrompt(config.rendering);
  const compositionPrompt = buildCompositionPrompt(config.composition);
  const metaphorPrompt = buildMetaphorPrompt(config.metaphor_engine, itemContext);

  const styleParts = [
    styleDefinition.prompt,
    renderingPrompt,
    compositionPrompt,
    config.style?.custom_description
  ].filter(Boolean);
  const stylePrompt = styleParts.join(', ');

  const isMascot = config.subject.kind === 'animal' || config.subject.kind === 'mascot_object';

  // 8. Resolve Negative Prompt
  const defaultNegatives = isMascot
    ? ['ugly', 'deformed', 'poor quality', 'lowres', 'bad anatomy', 'distorted']
    : ['visible human face', 'eyes', 'nose', 'mouth', 'human portrait', 'unintended people'];

  const allNegatives = deduplicatePrompts([
    ...defaultNegatives,
    ...(styleDefinition.negative_prompts || []),
    ...(config.guardrails?.required_negative_prompts || [])
  ]);

  const negativePrompt = allNegatives.join(', ');

  const resolved = {
    subject_prompt: subjectPrompt,
    wardrobe_prompt: wardrobePrompt,
    environment_prompt: environmentPrompt,
    lighting_prompt: lightingPrompt,
    camera_prompt: cameraPrompt,
    style_prompt: stylePrompt,
    active_visual_mode: activeStyleKey,
    narrative_function: narrativeFunction || 'default',
    visual_language_prompt: stylePrompt,
    mode_prompt: styleDefinition.prompt,
    rendering_prompt: renderingPrompt,
    composition_prompt: compositionPrompt,
    metaphor_prompt: metaphorPrompt,
    negative_prompt: negativePrompt
  };

  // Build legacy flat representation
  const legacy = {
    character_concept: isMascot ? 'mascot' : 'faceless',
    subject_demographic: isMascot ? (config.subject.demographic_key || 'custom') : 'custom',
    subject_demographic_custom: subjectPrompt,
    wardrobe_style: 'custom',
    wardrobe_style_custom: wardrobePrompt,
    lighting_style: 'custom',
    lighting_style_custom: lightingPrompt,
    visual_style_preset: activeStyleKey
  };

  return {
    ...snapshot,
    resolved,
    legacy,
    // Add legacy direct-access keys at root level for backward compatibility
    ...legacy,
    wardrobe_mode: config.wardrobe?.mode,
    wardrobe_resolved_key: config.wardrobe?.preset_key
  };
}

// Backward-compatible wrapper during migration
export function resolveVisualOverrides({ visualOverrides = {}, itemIndex, stableSeed, rowOverride, narrativeFunction }) {
  let resolved;
  if (visualOverrides && visualOverrides.schema_version === 'visual_identity_snapshot_v1') {
    resolved = resolveVisualIdentitySnapshot(visualOverrides, { itemIndex, stableSeed, rowOverride, narrativeFunction });
  } else {
    const normalized = normalizeLegacyVisualOverrides(visualOverrides);
    resolved = resolveVisualIdentitySnapshot({
      schema_version: 'visual_identity_snapshot_v1',
      identity_ref: { id: 'legacy', key: 'legacy', version: 1, source: 'legacy' },
      structured: normalized
    }, { itemIndex, stableSeed, rowOverride, narrativeFunction });
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

export async function resolveVisualIdentitySubmission({ preset_id, inline_config, legacy_overrides_json, narrative_function }) {
  const parsedLegacy = legacy_overrides_json
    ? (typeof legacy_overrides_json === 'string' ? JSON.parse(legacy_overrides_json) : legacy_overrides_json)
    : null;

  // Resolve using the central resolver
  const snapshot = await resolveVisualIdentity({
    presetRef: preset_id && preset_id !== 'inline' && preset_id !== 'custom' ? preset_id : null,
    inlineConfig: preset_id === 'inline' ? inline_config : null,
    legacyOverrides: (preset_id === 'custom' || !preset_id) ? parsedLegacy : null,
    itemContext: { narrativeFunction: narrative_function }
  });

  return {
    ref: snapshot.identity_ref,
    snapshot
  };
}
