import {
  VISUAL_STYLE_KEYS,
  NARRATIVE_FUNCTIONS,
  VISUAL_LANGUAGE_CATALOG,
  isValidVisualStyle,
  getDefaultNarrativeRouting
} from './visual-language-catalog.js';

export const VISUAL_IDENTITY_SCHEMA_VERSION = '2';

export const SUBJECT_KINDS = ['human', 'blank_face_3d', 'animal', 'mascot_object'];
export const HUMAN_FACELESS_MODES = [
  'hands_only',
  'crop_below_neck',
  'back_view',
  'silhouette',
  'first_person_pov',
  'blank_face_3d',
  'featureless_editorial'
];
export const ALL_FACELESS_MODES = [...HUMAN_FACELESS_MODES, 'not_applicable'];
export const POPULATION_MODES = ['single', 'group', 'crowd', 'single_group_or_crowd'];

export const WARDROBE_MODES = ['fixed', 'sequential', 'stable_random', 'custom'];
export const SLEEVE_POLICIES = ['wrists_covered', 'forearms_exposed', 'not_applicable'];

export const BACKGROUND_DENSITIES = ['minimal', 'balanced', 'dense'];
export const LIGHTING_CONTRASTS = ['soft', 'medium', 'high_contrast'];
export const LIGHTING_TEMPERATURES = ['warm', 'cool', 'neutral', 'warm_neutral', 'cool_neutral'];

export const CAMERA_FRAMINGS = [
  'hands_closeup',
  'forearms_and_hands',
  'crop_below_neck',
  'back_view',
  'full_body_blank_face',
  'object_or_animal',
  'editorial_wide',
  'environmental_wide',
  'isometric',
  'top_down_system',
  'silhouette_profile',
  'over_shoulder_faceless',
  'extreme_scale_metaphor'
];
export const CAMERA_PERSPECTIVES = ['first_person', 'third_person'];
export const CAMERA_LENS_LOOKS = ['natural_50mm', 'wide_angle_24mm', 'telephoto_85mm', 'macro_closeup'];
export const CAMERA_DEPTHS = ['shallow', 'deep', 'medium'];
export const CAMERA_MOVEMENTS = ['still', 'subtle_handheld', 'slow_pan', 'zoom_in'];

export const RENDERING_GEOMETRIES = ['simplified_semi_realistic', 'geometric_stylized', 'handcrafted_matte', 'minimal_flat'];
export const RENDERING_FINISHES = ['matte_editorial', 'soft_matte', 'printed_ink', 'tactile_clay'];
export const SHADOW_STYLES = ['strong_geometric', 'soft_ambient', 'dramatic_noir', 'minimal'];
export const NEGATIVE_SPACE_OPTIONS = ['required', 'moderate', 'flexible'];
export const SAFE_ZONE_OPTIONS = ['vertical_social_ui', 'standard_frame', 'center_focused'];

function normalizeVisualLanguage(inputVl, legacyStyle) {
  let primary = inputVl?.primary_style;
  if (!isValidVisualStyle(primary)) {
    // Check legacy style mapping
    if (legacyStyle?.preset_key === '3d_claymation_cozy') {
      primary = 'clay_political_theater';
    } else {
      primary = 'editorial_graphic_novel';
    }
  }

  let supporting = Array.isArray(inputVl?.supporting_styles)
    ? inputVl.supporting_styles.filter(k => isValidVisualStyle(k) && k !== primary)
    : [];
  supporting = [...new Set(supporting)];

  let disabled = Array.isArray(inputVl?.disabled_styles)
    ? inputVl.disabled_styles.filter(k => isValidVisualStyle(k) && k !== primary && !supporting.includes(k))
    : VISUAL_STYLE_KEYS.filter(k => k !== primary && !supporting.includes(k));
  disabled = [...new Set(disabled)];

  return {
    primary_style: primary,
    supporting_styles: supporting,
    disabled_styles: disabled
  };
}

function normalizeModeRouting(inputRouting, vl) {
  const activeStyles = [vl.primary_style, ...(vl.supporting_styles || [])];
  const defaultRouting = getDefaultNarrativeRouting(vl.primary_style);

  const result = {};
  for (const fn of NARRATIVE_FUNCTIONS) {
    const target = inputRouting?.[fn];
    if (isValidVisualStyle(target) && activeStyles.includes(target)) {
      result[fn] = target;
    } else {
      result[fn] = defaultRouting[fn] || vl.primary_style;
    }
  }
  return result;
}

function normalizeRendering(inputRendering) {
  return {
    geometry: String(inputRendering?.geometry || 'simplified_semi_realistic'),
    textures: Array.isArray(inputRendering?.textures) && inputRendering.textures.length > 0
      ? inputRendering.textures.map(t => String(t).trim()).filter(Boolean)
      : ['printed_paper_grain', 'editorial_ink'],
    shadow_style: String(inputRendering?.shadow_style || 'strong_geometric'),
    finish: String(inputRendering?.finish || 'matte_editorial')
  };
}

function normalizeComposition(inputComp) {
  return {
    primary_idea_count: Math.max(1, parseInt(inputComp?.primary_idea_count || '1', 10)),
    primary_subject_count: Math.max(1, parseInt(inputComp?.primary_subject_count || '1', 10)),
    negative_space: String(inputComp?.negative_space || 'required'),
    safe_zone: String(inputComp?.safe_zone || 'vertical_social_ui')
  };
}

function normalizeMetaphorEngine(inputMetaphor) {
  return {
    enabled: typeof inputMetaphor?.enabled === 'boolean' ? inputMetaphor.enabled : true,
    pattern: String(inputMetaphor?.pattern || 'concept_to_object_to_action')
  };
}

export function validateAndNormalizeVisualIdentity(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Invalid input config: must be an object');
  }

  const sourceVersion = String(input.schema_version || '1');

  const vl = normalizeVisualLanguage(input.visual_language, input.style);
  const routing = normalizeModeRouting(input.mode_routing, vl);
  const rendering = normalizeRendering(input.rendering);
  const composition = normalizeComposition(input.composition);
  const metaphor = normalizeMetaphorEngine(input.metaphor_engine);

  const popMode = POPULATION_MODES.includes(input.subject?.population_mode)
    ? input.subject.population_mode
    : 'single';

  const result = {
    schema_version: VISUAL_IDENTITY_SCHEMA_VERSION,
    label: String(input.label || 'Unnamed Visual Identity').trim(),
    description: String(input.description || '').trim(),
    subject: {
      kind: 'human',
      faceless_mode: 'hands_only',
      demographic_key: 'syari_classic',
      custom_description: '',
      character_count: 1,
      population_mode: popMode,
      ...(input.subject || {})
    },
    visual_language: vl,
    mode_routing: routing,
    rendering,
    composition,
    metaphor_engine: metaphor,
    wardrobe: {
      mode: 'fixed',
      preset_key: 'sage_muted',
      custom_description: '',
      primary_color: '',
      secondary_color: '',
      material: '',
      sleeve_policy: 'wrists_covered',
      accessories: [],
      ...(input.wardrobe || {})
    },
    environment: {
      preset_key: 'nordic_kitchen',
      custom_description: '',
      material_palette: [],
      props: [],
      background_density: 'balanced',
      ...(input.environment || {})
    },
    lighting: {
      preset_key: 'window_daylight',
      custom_description: '',
      color_temperature: 'warm_neutral',
      contrast: 'soft',
      ...(input.lighting || {})
    },
    camera: {
      framing: 'forearms_and_hands',
      perspective: 'third_person',
      lens_look: 'natural_50mm',
      depth_of_field: 'shallow',
      movement: 'subtle_handheld',
      ...(input.camera || {})
    },
    style: {
      preset_key: vl.primary_style || 'cinematic_realistic',
      custom_description: '',
      aspect_ratio: '9:16',
      ...(input.style || {})
    },
    guardrails: {
      face_visibility: 'prohibited',
      reflection_face: 'prohibited',
      unintended_people: 'prohibited',
      extra_people: 'prohibited',
      intentional_crowd: input.guardrails?.intentional_crowd === 'allowed_faceless' ? 'allowed_faceless' : 'allowed_faceless',
      identity_drift: 'prohibited',
      wardrobe_drift: 'prohibited',
      required_negative_prompts: [],
      ...(input.guardrails || {})
    }
  };

  // 1. Validate Subject
  if (!SUBJECT_KINDS.includes(result.subject.kind)) {
    throw new Error(`Invalid subject.kind: ${result.subject.kind}. Allowed values: ${SUBJECT_KINDS.join(', ')}`);
  }

  if (result.subject.kind === 'human' || result.subject.kind === 'blank_face_3d') {
    if (result.subject.faceless_mode === 'not_applicable') {
      throw new Error('faceless_mode cannot be not_applicable for human or blank_face_3d subject kinds');
    }
    if (!HUMAN_FACELESS_MODES.includes(result.subject.faceless_mode)) {
      throw new Error(`Invalid faceless_mode for human: ${result.subject.faceless_mode}`);
    }
  } else {
    // For animals/mascots, default to not_applicable if not specified
    if (!result.subject.faceless_mode) {
      result.subject.faceless_mode = 'not_applicable';
    }
  }

  if (!ALL_FACELESS_MODES.includes(result.subject.faceless_mode)) {
    throw new Error(`Invalid faceless_mode: ${result.subject.faceless_mode}`);
  }

  if (!POPULATION_MODES.includes(result.subject.population_mode)) {
    result.subject.population_mode = 'single';
  }

  result.subject.character_count = Math.max(1, parseInt(result.subject.character_count || '1', 10));

  // 2. Validate Wardrobe
  if (!WARDROBE_MODES.includes(result.wardrobe.mode)) {
    throw new Error(`Invalid wardrobe.mode: ${result.wardrobe.mode}`);
  }
  if (!SLEEVE_POLICIES.includes(result.wardrobe.sleeve_policy)) {
    result.wardrobe.sleeve_policy = 'wrists_covered';
  }
  if (!Array.isArray(result.wardrobe.accessories)) {
    result.wardrobe.accessories = [];
  }

  // 3. Validate Environment
  if (!BACKGROUND_DENSITIES.includes(result.environment.background_density)) {
    result.environment.background_density = 'balanced';
  }
  if (!Array.isArray(result.environment.material_palette)) {
    result.environment.material_palette = [];
  }
  if (!Array.isArray(result.environment.props)) {
    result.environment.props = [];
  }

  // 4. Validate Lighting
  if (!LIGHTING_TEMPERATURES.includes(result.lighting.color_temperature)) {
    result.lighting.color_temperature = 'warm_neutral';
  }
  if (!LIGHTING_CONTRASTS.includes(result.lighting.contrast)) {
    result.lighting.contrast = 'soft';
  }

  // 5. Validate Camera
  if (!CAMERA_FRAMINGS.includes(result.camera.framing)) {
    result.camera.framing = 'forearms_and_hands';
  }
  if (!CAMERA_PERSPECTIVES.includes(result.camera.perspective)) {
    result.camera.perspective = 'third_person';
  }
  if (!CAMERA_LENS_LOOKS.includes(result.camera.lens_look)) {
    result.camera.lens_look = 'natural_50mm';
  }
  if (!CAMERA_DEPTHS.includes(result.camera.depth_of_field)) {
    result.camera.depth_of_field = 'shallow';
  }
  if (!CAMERA_MOVEMENTS.includes(result.camera.movement)) {
    result.camera.movement = 'subtle_handheld';
  }

  // 6. Cross-field mode/framing validation for human kinds
  if (result.subject.kind === 'human' || result.subject.kind === 'blank_face_3d') {
    if (result.subject.faceless_mode === 'hands_only' && 
        result.camera.framing !== 'hands_closeup' && 
        result.camera.framing !== 'forearms_and_hands') {
      result.camera.framing = 'forearms_and_hands';
    }
    if (result.subject.faceless_mode === 'crop_below_neck' && result.camera.framing !== 'crop_below_neck') {
      result.camera.framing = 'crop_below_neck';
    }
    if (result.subject.faceless_mode === 'back_view' && result.camera.framing !== 'back_view') {
      result.camera.framing = 'back_view';
    }
  }

  // 7. Deterministically Lock Guardrails (Cannot be weakened by payload)
  result.guardrails.face_visibility = 'prohibited';
  result.guardrails.reflection_face = 'prohibited';
  result.guardrails.unintended_people = 'prohibited';
  result.guardrails.extra_people = 'prohibited'; // backward compatibility alias
  result.guardrails.intentional_crowd = 'allowed_faceless';
  result.guardrails.identity_drift = 'prohibited';
  result.guardrails.wardrobe_drift = 'prohibited';

  if (!Array.isArray(result.guardrails.required_negative_prompts)) {
    result.guardrails.required_negative_prompts = [];
  }

  return result;
}

export function normalizeLegacyVisualOverrides(input) {
  if (!input) return null;
  const legacy = typeof input === 'string' ? JSON.parse(input) : input;

  const subjectDemographic = legacy.subject_demographic || 'syari_classic';
  let kind = 'human';
  let facelessMode = 'hands_only';
  let cameraFraming = 'forearms_and_hands';

  if (subjectDemographic.startsWith('stylized_3d_')) {
    kind = 'blank_face_3d';
    facelessMode = 'blank_face_3d';
    cameraFraming = 'crop_below_neck';
  } else if (subjectDemographic.startsWith('mascot_universe_')) {
    kind = 'animal';
    facelessMode = 'not_applicable';
    cameraFraming = 'object_or_animal';
  }

  let wardrobeMode = 'fixed';
  let wardrobePresetKey = legacy.wardrobe_style || 'sage_muted';
  let wardrobeCustom = legacy.wardrobe_style_custom || '';

  if (wardrobePresetKey === 'sequential') {
    wardrobeMode = 'sequential';
  } else if (wardrobePresetKey === 'random') {
    wardrobeMode = 'stable_random';
  } else if (wardrobePresetKey === 'custom') {
    wardrobeMode = 'custom';
  }

  const structured = {
    schema_version: VISUAL_IDENTITY_SCHEMA_VERSION,
    label: `Legacy ${subjectDemographic}`,
    description: 'Auto-converted legacy visual overrides',
    subject: {
      kind,
      faceless_mode: facelessMode,
      demographic_key: subjectDemographic,
      custom_description: '',
      character_count: subjectDemographic === 'stylized_3d_duo' ? 2 : 1,
      population_mode: 'single'
    },
    visual_language: {
      primary_style: legacy.visual_style_preset === '3d_claymation_cozy' ? 'clay_political_theater' : 'editorial_graphic_novel',
      supporting_styles: [],
      disabled_styles: []
    },
    wardrobe: {
      mode: wardrobeMode,
      preset_key: wardrobePresetKey,
      custom_description: wardrobeCustom,
      primary_color: '',
      secondary_color: '',
      material: '',
      sleeve_policy: 'wrists_covered',
      accessories: []
    },
    environment: {
      preset_key: 'nordic_kitchen',
      custom_description: '',
      material_palette: [],
      props: [],
      background_density: 'balanced'
    },
    lighting: {
      preset_key: legacy.lighting_style || 'window_daylight',
      custom_description: legacy.lighting_style_custom || '',
      color_temperature: 'warm_neutral',
      contrast: 'soft'
    },
    camera: {
      framing: cameraFraming,
      perspective: 'third_person',
      lens_look: 'natural_50mm',
      depth_of_field: 'shallow',
      movement: 'subtle_handheld'
    },
    style: {
      preset_key: legacy.visual_style_preset || 'cinematic_realistic',
      custom_description: '',
      aspect_ratio: '9:16'
    },
    guardrails: {
      face_visibility: 'prohibited',
      reflection_face: 'prohibited',
      unintended_people: 'prohibited',
      extra_people: 'prohibited',
      intentional_crowd: 'allowed_faceless',
      identity_drift: 'prohibited',
      wardrobe_drift: 'prohibited',
      required_negative_prompts: []
    }
  };

  return validateAndNormalizeVisualIdentity(structured);
}
