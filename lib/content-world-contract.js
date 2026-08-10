/**
 * Content World Contract — Centralized validator/normalizer for cartoon universe fields.
 * Tahap 3: Now supports dynamic universe profiles from database.
 */

// Allowlist constants
export const CONTENT_WORLDS = ['real_world', 'real_animal', 'cartoon_universe'];
export const KNOWLEDGE_DOMAINS = ['general', 'pet_supplies', 'food_culinary'];
export const STORY_TEMPLATES = ['pet_problem_solution_7beat'];
export const HUMAN_PRESENCE_OPTIONS = ['allowed', 'faceless_only', 'none'];
export const PRODUCT_ROLES = ['none', 'incidental', 'supporting_solution', 'primary_solution'];
export const PRODUCT_REVEAL_BEATS = ['none', 'beat_4', 'beat_5'];

// Static fallback profiles — kept for backward compat and boot-time validation
const STATIC_UNIVERSE_PROFILES = ['pawville'];

// Dynamic profile slugs cache (populated from DB)
let _dynamicProfileSlugs = null;

/**
 * Refresh dynamic profile slugs from DB.
 * Called by universe-manifests.js after cache refresh.
 */
export async function refreshDynamicProfiles() {
  try {
    const { getAvailableUniverseSlugs } = await import('./universe-manifests.js');
    _dynamicProfileSlugs = getAvailableUniverseSlugs();
  } catch {
    _dynamicProfileSlugs = null;
  }
}

/**
 * Get all known universe profile slugs (static + dynamic)
 */
function getAllKnownProfiles() {
  if (_dynamicProfileSlugs && _dynamicProfileSlugs.length > 0) {
    return [...new Set([...STATIC_UNIVERSE_PROFILES, ..._dynamicProfileSlugs])];
  }
  return STATIC_UNIVERSE_PROFILES;
}

/**
 * Exported for backward compatibility
 */
export const UNIVERSE_PROFILES = new Proxy(STATIC_UNIVERSE_PROFILES, {
  get(target, prop) {
    const all = getAllKnownProfiles();
    if (prop === 'includes') return (v) => all.includes(v);
    if (prop === 'join') return (sep) => all.join(sep);
    if (prop === 'length') return all.length;
    if (typeof prop === 'string' && !isNaN(prop)) return all[Number(prop)];
    return Reflect.get(all, prop);
  }
});

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

  // Accept any profile known statically or dynamically
  const allProfiles = getAllKnownProfiles();
  if (allProfiles.includes(profile)) {
    return profile;
  }

  // If dynamic cache not ready, accept any slug-like value (don't block)
  if (!_dynamicProfileSlugs) {
    console.warn(`[ContentWorldContract] Dynamic profiles not loaded, accepting profile: ${profile}`);
    return profile;
  }

  const error = new Error(`Universe profile tidak dikenal: ${profile}. Tersedia: ${allProfiles.join(', ')}`);
  error.code = 'CONTENT_WORLD_VALIDATION';
  throw error;
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
 * Static defaults for known profiles. For DB profiles, use getUniverseDefaultsAsync.
 */
const STATIC_PROFILE_DEFAULTS = {
  pawville: {
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
  }
};

/**
 * Get default configuration for a universe profile.
 * Synchronous — tries static first, then DB cache.
 */
export function getUniverseDefaults(profileId) {
  if (!profileId) return null;
  const clean = profileId.toLowerCase();

  // Static defaults
  if (STATIC_PROFILE_DEFAULTS[clean]) {
    return { ...STATIC_PROFILE_DEFAULTS[clean] };
  }

  // Try to build defaults from DB-cached manifest
  try {
    // Dynamic import is async, but we have the manifest cache accessible synchronously
    // via the Proxy in universe-manifests.js
    const { getUniverseManifest } = require('./universe-manifests.js');
    const manifest = getUniverseManifest(clean);
    if (manifest) {
      return mapManifestToDefaults(manifest, clean);
    }
  } catch {
    // Module not ready yet
  }

  return null;
}

/**
 * Async version — can query DB directly if cache miss.
 */
export async function getUniverseDefaultsAsync(profileId) {
  if (!profileId) return null;
  const clean = profileId.toLowerCase();

  // Static defaults first
  if (STATIC_PROFILE_DEFAULTS[clean]) {
    return { ...STATIC_PROFILE_DEFAULTS[clean] };
  }

  // Try DB
  try {
    const { getUniverseProfileBySlug } = await import('./db.js');
    const dbProfile = await getUniverseProfileBySlug(clean);
    if (dbProfile) {
      return mapDbProfileToDefaults(dbProfile);
    }
  } catch (err) {
    console.warn('[ContentWorldContract] DB lookup failed:', err.message);
  }

  return null;
}

/**
 * Map a DB profile row to defaults shape
 */
function mapDbProfileToDefaults(profile) {
  let pillars = [];
  try {
    pillars = typeof profile.default_pillars_json === 'string'
      ? JSON.parse(profile.default_pillars_json) : (profile.default_pillars_json || []);
  } catch { pillars = []; }

  return {
    content_world: 'cartoon_universe',
    knowledge_domain: profile.knowledge_domain || 'general',
    story_template: profile.default_story_template || 'pet_problem_solution_7beat',
    human_presence: profile.human_presence || 'none',
    visual_style: profile.default_visual_style || 'cinematic_3d_clay',
    scene_count: profile.default_scene_count || 7,
    scene_duration: profile.default_scene_duration || 8,
    aspect_ratio: profile.default_aspect_ratio || '9:16',
    default_pillars: pillars
  };
}

/**
 * Map manifest (from universe-manifests.js cache) to defaults shape
 */
function mapManifestToDefaults(manifest, slug) {
  return {
    content_world: 'cartoon_universe',
    knowledge_domain: 'general',
    story_template: 'pet_problem_solution_7beat',
    human_presence: 'none',
    visual_style: 'cinematic_3d_clay',
    scene_count: 7,
    scene_duration: 8,
    aspect_ratio: '9:16',
    default_pillars: []
  };
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
 * Async version for contexts where we can await DB
 */
export async function buildUniverseConfigJsonAsync(profileId) {
  const defaults = await getUniverseDefaultsAsync(profileId);
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
