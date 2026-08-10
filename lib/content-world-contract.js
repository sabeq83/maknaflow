/**
 * Content World Contract — Centralized validator/normalizer for cartoon universe fields
 */

// Allowlist constants
export const CONTENT_WORLDS = ['real_world', 'real_animal', 'cartoon_universe'];
export const KNOWLEDGE_DOMAINS = ['general', 'pet_supplies', 'food_culinary'];
export const UNIVERSE_PROFILES = ['pawville'];
export const STORY_TEMPLATES = ['pet_problem_solution_7beat'];
export const HUMAN_PRESENCE_OPTIONS = ['allowed', 'faceless_only', 'none'];
export const PRODUCT_ROLES = ['none', 'incidental', 'supporting_solution', 'primary_solution'];
export const PRODUCT_REVEAL_BEATS = ['none', 'beat_4', 'beat_5'];

export function validateContentWorld(value) {
  const world = value || 'real_world';
  if (!CONTENT_WORLDS.includes(world)) {
    const error = new Error(`Content world tidak valid: ${world}. Gunakan: ${CONTENT_WORLDS.join(', ')}`);
    error.code = 'CONTENT_WORLD_VALIDATION';
    throw error;
  }
  return world;
}

export function validateKnowledgeDomain(value) {
  const domain = value || 'general';
  if (!KNOWLEDGE_DOMAINS.includes(domain)) {
    const error = new Error(`Knowledge domain tidak valid: ${domain}. Gunakan: ${KNOWLEDGE_DOMAINS.join(', ')}`);
    error.code = 'CONTENT_WORLD_VALIDATION';
    throw error;
  }
  return domain;
}

export function validateUniverseProfile(value) {
  if (!value) return null;
  const profile = value.toLowerCase();
  if (!UNIVERSE_PROFILES.includes(profile)) {
    const error = new Error(`Universe profile tidak dikenal: ${profile}. Tersedia: ${UNIVERSE_PROFILES.join(', ')}`);
    error.code = 'CONTENT_WORLD_VALIDATION';
    throw error;
  }
  return profile;
}

export function validateProductRole(value) {
  if (!value) return 'none';
  return PRODUCT_ROLES.includes(value) ? value : 'none';
}

export function validateProductRevealBeat(value) {
  if (!value) return 'none';
  return PRODUCT_REVEAL_BEATS.includes(value) ? value : 'none';
}

/**
 * Get default configuration for a universe profile.
 * PawVille is the first and only preset.
 */
export function getUniverseDefaults(profileId) {
  if (profileId === 'pawville') {
    return {
      content_world: 'cartoon_universe',
      knowledge_domain: 'pet_supplies',
      story_template: 'pet_problem_solution_7beat',
      human_presence: 'none',
      visual_style: 'cinematic_3d_clay',
      scene_count: 7,
      scene_duration: 8,
      aspect_ratio: '9:16',
      default_pillars: [
        'Pet Hydration & Feeding',
        'Pet Grooming & Hygiene',
        'Pet Enrichment & Play',
        'Pet Comfort & Wellness',
        'Pet Travel & Safety'
      ]
    };
  }
  return null;
}

/**
 * Build universe_config_json snapshot for storage.
 * This snapshot is saved with the planner so output doesn't change when profile is updated.
 */
export function buildUniverseConfigJson(profileId) {
  const defaults = getUniverseDefaults(profileId);
  if (!defaults) return null;
  return JSON.stringify(defaults);
}

/**
 * Normalize all content world fields from request params.
 */
export function normalizeContentWorldParams(params) {
  const content_world = validateContentWorld(params.content_world);
  const knowledge_domain = validateKnowledgeDomain(params.knowledge_domain);
  const universe_profile = content_world === 'cartoon_universe'
    ? validateUniverseProfile(params.universe_profile || 'pawville')
    : null;
  const universe_config_json = universe_profile
    ? (params.universe_config_json || buildUniverseConfigJson(universe_profile))
    : null;

  return { content_world, knowledge_domain, universe_profile, universe_config_json };
}
