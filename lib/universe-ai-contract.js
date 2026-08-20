export const UNIVERSE_BUILDER_PROMPT_VERSION = 'universe_builder_v1';
export const UNIVERSE_TYPES = ['animal', 'mascot_object', 'human'];
export const FACELESS_MODES = ['faceless', 'back_view', 'silhouette', 'environment_only'];
export const KNOWLEDGE_DOMAINS = [
  'general', 'pet_supplies', 'food_culinary', 'history',
  'islamic_history', 'kitchen', 'home_improvement', 'herbal'
];

export class UniverseAiValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'UniverseAiValidationError';
    this.details = details;
  }
}

export function slugify(str) {
  if (!str) return '';
  return str
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function keyify(str) {
  if (!str) return '';
  return str
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function validateUniverseBrief(input) {
  if (!input || typeof input !== 'object') {
    throw new UniverseAiValidationError('Brief input harus berupa object.');
  }

  const errors = [];

  // Allowed brief fields check
  const allowedFields = [
    'name', 'purpose', 'knowledge_domain', 'universe_type',
    'target_audience', 'premise_seed', 'tone', 'visual_direction',
    'character_count', 'location_count', 'content_pillars',
    'special_constraints', 'historical_period', 'freeform_brief'
  ];

  const payload = {};
  for (const k of allowedFields) {
    payload[k] = input[k];
  }

  // Validate name
  if (!payload.name || typeof payload.name !== 'string' || payload.name.trim().length < 3 || payload.name.trim().length > 100) {
    errors.push('Name wajib berupa string dengan panjang 3 sampai 100 karakter.');
  }

  // Validate universe_type
  if (!UNIVERSE_TYPES.includes(payload.universe_type)) {
    errors.push(`universe_type harus salah satu dari: ${UNIVERSE_TYPES.join(', ')}.`);
  }

  // Validate knowledge_domain
  if (!KNOWLEDGE_DOMAINS.includes(payload.knowledge_domain)) {
    errors.push(`knowledge_domain harus salah satu dari: ${KNOWLEDGE_DOMAINS.join(', ')}.`);
  }

  // Validate counts
  const charCount = Number(payload.character_count);
  if (isNaN(charCount) || charCount < 1 || charCount > 5) {
    errors.push('character_count harus berupa angka antara 1 dan 5.');
  } else {
    payload.character_count = charCount;
  }

  const locCount = Number(payload.location_count);
  if (isNaN(locCount) || locCount < 1 || locCount > 5) {
    errors.push('location_count harus berupa angka antara 1 dan 5.');
  } else {
    payload.location_count = locCount;
  }

  // Validate content_pillars
  if (payload.content_pillars !== undefined && payload.content_pillars !== null) {
    if (!Array.isArray(payload.content_pillars)) {
      errors.push('content_pillars harus berupa array.');
    } else if (payload.content_pillars.length > 8) {
      errors.push('Jumlah content_pillars maksimal adalah 8.');
    }
  } else {
    payload.content_pillars = [];
  }

  // Validate freeform_brief length
  if (payload.freeform_brief && typeof payload.freeform_brief === 'string' && payload.freeform_brief.length > 3000) {
    errors.push('freeform_brief maksimal 3000 karakter.');
  }

  if (errors.length > 0) {
    throw new UniverseAiValidationError('Brief validation failed', errors);
  }

  return payload;
}

export function validateAndNormalizeUniverseDraft(input, options = {}) {
  if (!input || typeof input !== 'object') {
    throw new UniverseAiValidationError('Draft input harus berupa object JSON.');
  }

  const errors = [];

  const profile = input.profile;
  const characters = input.characters;
  const locations = input.locations;

  if (!profile || typeof profile !== 'object') {
    errors.push('Draft profile tidak ditemukan atau bukan object.');
  }
  if (!Array.isArray(characters)) {
    errors.push('Draft characters tidak ditemukan atau bukan array.');
  }
  if (!Array.isArray(locations)) {
    errors.push('Draft locations tidak ditemukan atau bukan array.');
  }

  if (errors.length > 0) {
    throw new UniverseAiValidationError('Draft structure invalid', errors);
  }

  // Validate and normalize profile
  const validatedProfile = {
    name: (profile.name || '').trim(),
    slug: slugify(profile.name || ''),
    premise: profile.premise || '',
    tone: profile.tone || '',
    knowledge_domain: profile.knowledge_domain || 'general',
    universe_type: profile.universe_type || 'animal',
    human_presence: profile.human_presence || 'none',
    depiction_policy: profile.depiction_policy || null,
    historical_period: profile.historical_period || null,
    default_visual_style: profile.default_visual_style || 'cinematic_3d_clay',
    default_aspect_ratio: profile.default_aspect_ratio || '9:16',
    default_scene_count: Number(profile.default_scene_count || 7),
    default_scene_duration: Number(profile.default_scene_duration || 8),
    default_story_template: profile.default_story_template || 'problem_solution_7beat',
    cta_personality: profile.cta_personality || '',
    default_pillars_json: Array.isArray(profile.default_pillars_json)
      ? profile.default_pillars_json
      : (Array.isArray(profile.default_pillars) ? profile.default_pillars : []),
    rules_json: typeof profile.rules_json === 'object' && profile.rules_json !== null && !Array.isArray(profile.rules_json)
      ? profile.rules_json
      : (typeof profile.rules === 'object' && profile.rules !== null ? profile.rules : {}),
    negative_prompts_json: Array.isArray(profile.negative_prompts_json)
      ? profile.negative_prompts_json
      : (Array.isArray(profile.negative_prompts) ? profile.negative_prompts : []),
  };

  if (!validatedProfile.name) {
    errors.push('Profile name tidak boleh kosong.');
  }
  if (!validatedProfile.slug) {
    errors.push('Slug profile tidak boleh kosong.');
  }
  if (!UNIVERSE_TYPES.includes(validatedProfile.universe_type)) {
    errors.push(`Profile universe_type tidak valid: ${validatedProfile.universe_type}.`);
  }
  if (!KNOWLEDGE_DOMAINS.includes(validatedProfile.knowledge_domain)) {
    errors.push(`Profile knowledge_domain tidak valid: ${validatedProfile.knowledge_domain}.`);
  }

  // Force counts if expected
  if (options.expectedCharacterCount !== undefined && characters.length !== options.expectedCharacterCount) {
    errors.push(`Jumlah karakter (${characters.length}) tidak sesuai dengan brief (${options.expectedCharacterCount}).`);
  }
  if (options.expectedLocationCount !== undefined && locations.length !== options.expectedLocationCount) {
    errors.push(`Jumlah lokasi (${locations.length}) tidak sesuai dengan brief (${options.expectedLocationCount}).`);
  }

  // Enforce faceless policies on profile if human
  if (validatedProfile.universe_type === 'human') {
    validatedProfile.human_presence = 'allowed';
    if (!validatedProfile.depiction_policy || validatedProfile.depiction_policy.trim().length === 0) {
      errors.push('depiction_policy wajib diisi untuk human universe.');
    }

    // negative prompts check for human face
    const mandateNegativePrompts = [
      'visible face',
      'facial features',
      'reflection showing face',
      'identity drift'
    ];
    for (const prompt of mandateNegativePrompts) {
      const exists = validatedProfile.negative_prompts_json.some(p => p.toLowerCase().includes(prompt));
      if (!exists) {
        validatedProfile.negative_prompts_json.push(`no ${prompt}`);
      }
    }

    if (validatedProfile.knowledge_domain === 'history' || validatedProfile.knowledge_domain === 'islamic_history') {
      validatedProfile.rules_json.anti_anachronism = 'wajib menghindari anakronisme visual dan verbal, pakaian dan teknologi harus sesuai periode historis';
    }
  }

  // Validate and normalize characters
  const validatedCharacters = [];
  const characterKeys = new Set();

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];
    if (!char || typeof char !== 'object') {
      errors.push(`Karakter pada index ${i} bukan object.`);
      continue;
    }

    const cName = (char.name || '').trim();
    const cKey = keyify(char.character_key || cName);

    if (!cName) {
      errors.push(`Nama karakter pada index ${i} tidak boleh kosong.`);
    }
    if (!cKey) {
      errors.push(`Key karakter pada index ${i} tidak boleh kosong.`);
    }
    if (characterKeys.has(cKey)) {
      errors.push(`Duplicate character key: '${cKey}' pada index ${i}.`);
    } else {
      characterKeys.add(cKey);
    }

    const validatedChar = {
      name: cName,
      character_key: cKey,
      species: char.species || null,
      breed: char.breed || null,
      body_shape: char.body_shape || null,
      fur_color: char.fur_color || null,
      eye_color: char.eye_color || null,
      wardrobe: char.wardrobe || null,
      personality: char.personality || null,
      movement_style: char.movement_style || null,
      relative_size: char.relative_size || 'medium',
      role: char.role || 'supporting',
      depiction_mode: char.depiction_mode || 'normal',
      reference_type: char.reference_type || 'identity',
      historical_period: char.historical_period || null,
      canonical_prompt: char.canonical_prompt || '',
      forbidden_changes_json: Array.isArray(char.forbidden_changes_json)
        ? char.forbidden_changes_json
        : (Array.isArray(char.forbidden_changes) ? char.forbidden_changes : []),
    };

    if (!validatedChar.canonical_prompt) {
      errors.push(`Karakter '${cName}' wajib memiliki canonical_prompt.`);
    }

    // Faceless logic for human character
    if (validatedProfile.universe_type === 'human') {
      if (validatedChar.depiction_mode === 'normal') {
        errors.push(`Karakter '${cName}' di human universe dilarang menggunakan depiction_mode normal.`);
      } else if (!FACELESS_MODES.includes(validatedChar.depiction_mode)) {
        errors.push(`Karakter '${cName}' di human universe menggunakan depiction_mode tidak valid: ${validatedChar.depiction_mode}.`);
      }

      // canonical_prompt check for faceless mode
      const containsFacelessTerm = ['faceless', 'back view', 'silhouette', 'environment only'].some(term =>
        validatedChar.canonical_prompt.toLowerCase().includes(term)
      );
      if (!containsFacelessTerm) {
        validatedChar.canonical_prompt += ` (depicted as ${validatedChar.depiction_mode.replace('_', ' ')})`;
      }
    }

    validatedCharacters.push(validatedChar);
  }

  // Validate and normalize locations
  const validatedLocations = [];
  const locationKeys = new Set();

  for (let i = 0; i < locations.length; i++) {
    const loc = locations[i];
    if (!loc || typeof loc !== 'object') {
      errors.push(`Lokasi pada index ${i} bukan object.`);
      continue;
    }

    const lName = (loc.name || '').trim();
    const lKey = keyify(loc.location_key || lName);

    if (!lName) {
      errors.push(`Nama lokasi pada index ${i} tidak boleh kosong.`);
    }
    if (!lKey) {
      errors.push(`Key lokasi pada index ${i} tidak boleh kosong.`);
    }
    if (locationKeys.has(lKey)) {
      errors.push(`Duplicate location key: '${lKey}' pada index ${i}.`);
    } else {
      locationKeys.add(lKey);
    }

    const validatedLoc = {
      name: lName,
      location_key: lKey,
      visual_description: loc.visual_description || '',
      lighting_default: loc.lighting_default || null,
      props: loc.props || null,
      historical_period: loc.historical_period || null,
      reference_type: loc.reference_type || 'location'
    };

    if (!validatedLoc.visual_description) {
      errors.push(`Lokasi '${lName}' wajib memiliki visual_description.`);
    }

    validatedLocations.push(validatedLoc);
  }

  if (errors.length > 0) {
    throw new UniverseAiValidationError('Draft validation failed', errors);
  }

  return {
    profile: validatedProfile,
    characters: validatedCharacters,
    locations: validatedLocations
  };
}

export function mapUniverseAiError(error) {
  console.error('[Universe AI API Error]', error);

  const headers = { 'content-type': 'application/json' };

  if (error.name === 'UniverseAiValidationError') {
    const isFacelessViolation = Array.isArray(error.details) && error.details.some(d => d.toLowerCase().includes('faceless') || d.toLowerCase().includes('depiction') || d.toLowerCase().includes('normal'));
    const code = isFacelessViolation ? 'FACELESS_POLICY_VIOLATION' : 'INVALID_BRIEF';
    return new Response(JSON.stringify({
      success: false,
      code,
      error: error.message,
      details: error.details
    }), { status: isFacelessViolation ? 422 : 400, headers });
  }

  if (error.name === 'SlugConflictError') {
    return new Response(JSON.stringify({
      success: false,
      code: 'SLUG_CONFLICT',
      error: error.message
    }), { status: 409, headers });
  }

  const msg = error.message || '';
  if (msg.includes('503') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('temporarily unavailable') || msg.toLowerCase().includes('limit')) {
    return new Response(JSON.stringify({
      success: false,
      code: 'AI_TEMPORARILY_UNAVAILABLE',
      error: 'Gemini AI service is temporarily unavailable or quota limit exceeded. Please try again.'
    }), { status: 503, headers });
  }

  if (msg.toLowerCase().includes('gagal parse') || msg.toLowerCase().includes('json') || msg.toLowerCase().includes('schema')) {
    return new Response(JSON.stringify({
      success: false,
      code: 'INVALID_AI_OUTPUT',
      error: 'Gemini generated an invalid structure. Please try regenerating.'
    }), { status: 422, headers });
  }

  return new Response(JSON.stringify({
    success: false,
    code: 'INTERNAL_ERROR',
    error: 'Internal server error occurred.'
  }), { status: 500, headers });
}

