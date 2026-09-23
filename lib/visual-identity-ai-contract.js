import {
  SUBJECT_KINDS,
  HUMAN_FACELESS_MODES,
  ALL_FACELESS_MODES,
  POPULATION_MODES,
  validateAndNormalizeVisualIdentity
} from './visual-identity-contract.js';
import {
  VISUAL_STYLE_KEYS,
  NARRATIVE_FUNCTIONS,
  isValidVisualStyle
} from './visual-language-catalog.js';

export const AI_VISUAL_IDENTITY_PROMPT_VERSION = 'ai_visual_identity_v2';

export class AiVisualIdentityValidationError extends Error {
  constructor(message, code = 'INVALID_AI_VISUAL_BRIEF') {
    super(message);
    this.name = 'AiVisualIdentityValidationError';
    this.code = code;
  }
}

export function validateAiVisualIdentityBrief(input) {
  if (!input || typeof input !== 'object') {
    throw new AiVisualIdentityValidationError('Creative brief must be an object');
  }

  const seed = String(input.seed || '').trim();
  if (seed.length < 3 || seed.length > 3000) {
    throw new AiVisualIdentityValidationError('Natural-language seed must be between 3 and 3000 characters');
  }

  const subject_kind = String(input.subject_kind || 'human').trim();
  if (!SUBJECT_KINDS.includes(subject_kind)) {
    throw new AiVisualIdentityValidationError(`Invalid subject_kind: "${subject_kind}". Must be one of: ${SUBJECT_KINDS.join(', ')}`);
  }

  let faceless_mode = String(input.faceless_mode || '').trim();
  if (subject_kind === 'human' || subject_kind === 'blank_face_3d') {
    if (faceless_mode === 'not_applicable') {
      throw new AiVisualIdentityValidationError('faceless_mode cannot be not_applicable for human or blank_face_3d subjects');
    }
    if (!faceless_mode) {
      faceless_mode = subject_kind === 'blank_face_3d' ? 'blank_face_3d' : 'featureless_editorial';
    }
    if (!HUMAN_FACELESS_MODES.includes(faceless_mode)) {
      throw new AiVisualIdentityValidationError(`Invalid faceless_mode for human subject: "${faceless_mode}". Must be one of: ${HUMAN_FACELESS_MODES.join(', ')}`);
    }
  } else {
    // default for non-human
    if (!faceless_mode || faceless_mode === '') {
      faceless_mode = 'not_applicable';
    } else if (faceless_mode !== 'not_applicable') {
      throw new AiVisualIdentityValidationError('faceless_mode must be not_applicable for non-human subjects');
    }
  }

  const population_mode = POPULATION_MODES.includes(input.population_mode)
    ? input.population_mode
    : 'single';

  const aspect_ratio = String(input.aspect_ratio || '9:16').trim();
  if (!['9:16', '16:9', '1:1'].includes(aspect_ratio)) {
    throw new AiVisualIdentityValidationError(`Invalid aspect_ratio: "${aspect_ratio}". Allowed: 9:16, 16:9, 1:1`);
  }

  const variation_level = String(input.variation_level || 'balanced').trim();
  if (!['conservative', 'balanced', 'adventurous'].includes(variation_level)) {
    throw new AiVisualIdentityValidationError(`Invalid variation_level: "${variation_level}". Allowed: conservative, balanced, adventurous`);
  }

  const primary_style = isValidVisualStyle(input.primary_style)
    ? input.primary_style
    : 'editorial_graphic_novel';

  const supporting_styles = Array.isArray(input.supporting_styles)
    ? input.supporting_styles.filter(s => isValidVisualStyle(s) && s !== primary_style)
    : [];

  const mode_routing = (input.mode_routing && typeof input.mode_routing === 'object')
    ? input.mode_routing
    : {};

  // Length limit helpers
  const limitStr = (val, max, name) => {
    const s = String(val || '').trim();
    if (s.length > max) {
      throw new AiVisualIdentityValidationError(`${name} length cannot exceed ${max} characters`);
    }
    return s;
  };

  return {
    seed,
    subject_kind,
    faceless_mode,
    population_mode,
    primary_style,
    supporting_styles: [...new Set(supporting_styles)],
    mode_routing,
    aspect_ratio,
    variation_level,
    purpose: limitStr(input.purpose, 500, 'purpose'),
    audience: limitStr(input.audience, 500, 'audience'),
    mood: limitStr(input.mood, 500, 'mood'),
    texture_direction: limitStr(input.texture_direction, 1000, 'texture_direction'),
    composition_direction: limitStr(input.composition_direction, 1000, 'composition_direction'),
    metaphor_direction: limitStr(input.metaphor_direction, 1000, 'metaphor_direction'),
    wardrobe_direction: limitStr(input.wardrobe_direction, 1000, 'wardrobe_direction'),
    color_direction: limitStr(input.color_direction, 1000, 'color_direction'),
    environment_direction: limitStr(input.environment_direction, 1000, 'environment_direction'),
    lighting_direction: limitStr(input.lighting_direction, 1000, 'lighting_direction'),
    camera_direction: limitStr(input.camera_direction, 1000, 'camera_direction'),
    style_direction: limitStr(input.style_direction, 1000, 'style_direction'),
    special_constraints: limitStr(input.special_constraints, 1000, 'special_constraints'),
  };
}

export function validateAiVisualIdentityDraftEnvelope(input) {
  if (!input || typeof input !== 'object') {
    throw new AiVisualIdentityValidationError('Gemini output must be a valid JSON object', 'INVALID_AI_VISUAL_OUTPUT');
  }

  const label = String(input.label || '').trim();
  if (label.length < 3 || label.length > 100) {
    throw new AiVisualIdentityValidationError('Identity label must be between 3 and 100 characters', 'INVALID_AI_VISUAL_OUTPUT');
  }

  const description = String(input.description || '').trim();
  if (description.length > 500) {
    throw new AiVisualIdentityValidationError('Identity description cannot exceed 500 characters', 'INVALID_AI_VISUAL_OUTPUT');
  }

  const creative_rationale = String(input.creative_rationale || '').trim();
  if (creative_rationale.length > 1000) {
    throw new AiVisualIdentityValidationError('creative_rationale cannot exceed 1000 characters', 'INVALID_AI_VISUAL_OUTPUT');
  }

  if (!input.config || typeof input.config !== 'object') {
    throw new AiVisualIdentityValidationError('config block is required in AI output', 'INVALID_AI_VISUAL_OUTPUT');
  }

  // Slugify key
  const suggested_preset_key = String(input.suggested_preset_key || label)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .substring(0, 50);

  return {
    label,
    description,
    suggested_preset_key,
    creative_rationale,
    config: input.config
  };
}

export function buildVisualIdentityComplianceReport(rawConfig, normalizedConfig) {
  const checks = [];
  const corrections = [];
  const warnings = [];

  // Face visibility guardrail validation
  const rawFace = rawConfig.guardrails?.face_visibility || 'prohibited';
  if (rawFace !== 'prohibited') {
    corrections.push({
      path: 'guardrails.face_visibility',
      from: rawFace,
      to: 'prohibited',
      message: 'Face visibility was set to allow human faces, but has been locked to prohibited.'
    });
    checks.push({ key: 'face_visibility', status: 'corrected', message: 'Face visibility locked to prohibited.' });
  } else {
    checks.push({ key: 'face_visibility', status: 'pass', message: 'Human face prohibited.' });
  }

  // Scanning text fields in raw config for prompt injection/bypass intents of face visibility
  const searchText = JSON.stringify(rawConfig).toLowerCase();
  const faceKeywords = [
    'show face', 'visible face', 'reveal face', 'uncovered face', 'show head',
    'wajah terlihat', 'menampilkan wajah', 'wajah penuh', 'full face',
    'clear face', 'wajah jelas', 'facial expressions'
  ];
  const hasFaceRequest = faceKeywords.some(kw => searchText.includes(kw));
  if (hasFaceRequest) {
    warnings.push({
      key: 'face_bypass_attempt',
      message: 'Detected description indicating intent to display human faces. The final generated prompt strictly enforces faceless composition rules.'
    });
  }

  // Visual Language validation & repair checks
  const rawPrimary = rawConfig.visual_language?.primary_style;
  const normPrimary = normalizedConfig.visual_language?.primary_style;
  if (rawPrimary && !isValidVisualStyle(rawPrimary)) {
    corrections.push({
      path: 'visual_language.primary_style',
      from: rawPrimary,
      to: normPrimary,
      message: `Primary style "${rawPrimary}" was invalid and normalized to "${normPrimary}".`
    });
    checks.push({ key: 'primary_style', status: 'corrected', message: `Primary style normalized to ${normPrimary}.` });
  } else {
    checks.push({ key: 'primary_style', status: 'pass', message: 'Primary visual style is valid.' });
  }

  // Mode routing validation
  const rawRouting = rawConfig.mode_routing || {};
  let routingCorrected = false;
  for (const fn of NARRATIVE_FUNCTIONS) {
    const rawTarget = rawRouting[fn];
    const normTarget = normalizedConfig.mode_routing?.[fn];
    if (rawTarget && rawTarget !== normTarget) {
      corrections.push({
        path: `mode_routing.${fn}`,
        from: rawTarget,
        to: normTarget,
        message: `Route "${fn}" target "${rawTarget}" is inactive/invalid; fallback to "${normTarget}".`
      });
      routingCorrected = true;
    }
  }
  if (routingCorrected) {
    checks.push({ key: 'mode_routing', status: 'corrected', message: 'Mode routing repaired to active styles.' });
  } else {
    checks.push({ key: 'mode_routing', status: 'pass', message: 'Narrative mode routing is valid.' });
  }

  // Human / blank_face_3d faceless mode validation
  const subjectKind = normalizedConfig.subject?.kind;
  if (subjectKind === 'human' || subjectKind === 'blank_face_3d') {
    const rawFraming = rawConfig.camera?.framing || 'forearms_and_hands';
    const normFraming = normalizedConfig.camera?.framing;
    if (rawFraming !== normFraming) {
      corrections.push({
        path: 'camera.framing',
        from: rawFraming,
        to: normFraming,
        message: `Camera framing was modified to "${normFraming}" to remain compatible with subject faceless mode "${normalizedConfig.subject.faceless_mode}".`
      });
      checks.push({ key: 'camera_framing', status: 'corrected', message: `Framing changed to ${normFraming}.` });
    } else {
      checks.push({ key: 'camera_framing', status: 'pass', message: 'Camera framing is compatible with faceless mode.' });
    }
  } else {
    checks.push({ key: 'camera_framing', status: 'pass', message: 'Subject does not require faceless framing validation.' });
  }

  // Status computation
  let status = 'compliant';
  if (corrections.length > 0) {
    status = 'compliant_with_corrections';
  }

  // Score calculation
  let score = 100;
  if (corrections.length > 0) {
    score -= corrections.length * 15;
  }
  if (warnings.length > 0) {
    score -= warnings.length * 5;
  }
  score = Math.max(30, score);

  return {
    status,
    score,
    checks,
    corrections,
    warnings
  };
}

export function normalizeAiVisualIdentityResult(raw, options = {}) {
  const envelope = validateAiVisualIdentityDraftEnvelope(raw);
  
  // Guard against visible face intent policy violation
  const hasVisibleFaceRequest = detectExplicitFaceViolation(envelope);
  if (hasVisibleFaceRequest) {
    throw new AiVisualIdentityValidationError(
      'Faktor identitas visual yang diajukan melanggar kebijakan Faceless Invariant. Silakan ganti deskripsi visual Anda ke dalam mode Faceless (misal: hands_only, silhouette, back_view, featureless_editorial, dll.) atau ganti subjek ke kategori animal/mascot.',
      'FACELESS_POLICY_VIOLATION'
    );
  }

  const normalizedConfig = validateAndNormalizeVisualIdentity(envelope.config);
  const compliance = buildVisualIdentityComplianceReport(envelope.config, normalizedConfig);

  return {
    label: envelope.label,
    description: envelope.description,
    suggested_preset_key: envelope.suggested_preset_key,
    creative_rationale: envelope.creative_rationale,
    config: normalizedConfig,
    compliance
  };
}

function detectExplicitFaceViolation(envelope) {
  // Check if seed/rationale/labels explicitly ask for facial features showing on humans
  const textToCheck = [
    envelope.label,
    envelope.description,
    envelope.creative_rationale,
    JSON.stringify(envelope.config?.subject || {})
  ].join(' ').toLowerCase();

  const violationKeywords = [
    'show face', 'showing face', 'visible face', 'reveal face', 'uncovered face', 'face visible', 'wajah terlihat',
    'wajah nampak', 'wajah terbuka', 'showing face details', 'facial expressions',
    'ekspresi wajah', 'senyum manis', 'smiling face'
  ];

  const kind = envelope.config?.subject?.kind || 'human';
  if (kind === 'human') {
    return violationKeywords.some(kw => textToCheck.includes(kw));
  }
  return false;
}
