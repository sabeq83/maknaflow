/**
 * Universe Manifests - Hybrid loader with DB-backed cache and static fallback.
 * Tahap 3: Reads universe profiles, characters, and locations from PostgreSQL.
 * Falls back to static PawVille manifest if DB is not ready.
 *
 * All 7 consumers (cartoon-reference-resolver, pillar-campaign-ingest,
 * scheduler-processors, manifest API, regenerate routes, test script)
 * retain the same function signatures.
 */

// ═══════════════════════════════════════════════════════════
// Static Fallback Data (preserved for boot-time compatibility)
// ═══════════════════════════════════════════════════════════

const STATIC_CHARACTER_NAME_MAP = {
  'mochi': 'mochi',
  'dr. paw': 'dr_paw',
  'dr paw': 'dr_paw',
  'coco': 'coco',
  'boba': 'boba',
  'tofu': 'tofu'
};

const PAWVILLE_STATIC_FALLBACK = {
  universe_profile: "pawville",
  version: 1,
  style_reference_path: "/universe-assets/pawville/style/visual-style-reference.png",
  characters: {
    mochi: {
      character_id: "pawville_mochi_v1",
      display_name: "Mochi",
      version: 1,
      identity_reference_path: "/universe-assets/pawville/characters/mochi/v1/identity-anchor.png",
      canonical_description: "Grey British Shorthair cat, round compact body, short legs, thick soft grey fur, large amber eyes, small pink nose, forest-green scarf",
      forbidden_changes: [
        "no fur color change",
        "no fur pattern",
        "no eye color change",
        "no missing green scarf",
        "no body proportion change"
      ]
    },
    dr_paw: {
      character_id: "pawville_dr_paw_v1",
      display_name: "Dr. Paw",
      version: 1,
      identity_reference_path: "/universe-assets/pawville/characters/dr-paw/v1/identity-anchor.png",
      canonical_description: "Tan Shiba Inu, compact body, wearing a small white coat and carrying a small brown medical bag",
      forbidden_changes: [
        "no species change",
        "no fur color change",
        "no missing white coat",
        "no medical bag redesign",
        "no body proportion change"
      ]
    },
    coco: {
      character_id: "pawville_coco_v1",
      display_name: "Coco",
      version: 1,
      identity_reference_path: "/universe-assets/pawville/characters/coco/v1/identity-anchor.png",
      canonical_description: "Brown-and-white Corgi dog, small compact body, tiny brown sling bag, happy smile",
      forbidden_changes: [
        "no species change",
        "no fur color change",
        "no missing sling bag",
        "no body proportion change"
      ]
    }
  }
};

// ═══════════════════════════════════════════════════════════
// In-Memory Cache
// ═══════════════════════════════════════════════════════════

let _manifestCache = null;       // { pawville: {...}, kitchentails: {...} }
let _characterNameMap = null;    // { 'mochi': 'mochi', 'dr. paw': 'dr_paw', ... }
let _cacheReady = false;
let _cacheLoadPromise = null;

/**
 * Build manifest shape from DB rows (same shape as PAWVILLE_STATIC_FALLBACK)
 */
function buildManifestFromDb(profile, characters, locations) {
  const manifest = {
    universe_profile: profile.slug,
    version: profile.version || 1,
    style_reference_path: profile.style_reference_path || null,
    universe_type: profile.universe_type || 'animal',
    depiction_policy: profile.depiction_policy || null,
    historical_period: profile.historical_period || null,
    human_presence: profile.human_presence || 'none',
    characters: {},
    locations: []
  };

  for (const char of characters) {
    manifest.characters[char.character_key] = {
      character_id: `${profile.slug}_${char.character_key}_v${char.version || 1}`,
      display_name: char.name,
      version: char.version || 1,
      identity_reference_path: char.reference_image_path || `/universe-assets/${profile.slug}/characters/${char.character_key}/v${char.version || 1}/identity-anchor.png`,
      canonical_description: char.canonical_prompt,
      forbidden_changes: (() => {
        try {
          const json = typeof char.forbidden_changes_json === 'string'
            ? JSON.parse(char.forbidden_changes_json) : char.forbidden_changes_json;
          return Array.isArray(json) ? json : [];
        } catch { return []; }
      })(),
      species: char.species,
      breed: char.breed,
      role: char.role,
      relative_size: char.relative_size,
      depiction_mode: char.depiction_mode || 'normal',
      reference_type: char.reference_type || 'identity',
      historical_period: char.historical_period || null
    };
  }

  for (const loc of locations) {
    manifest.locations.push({
      location_key: loc.location_key,
      name: loc.name,
      visual_description: loc.visual_description,
      lighting_default: loc.lighting_default,
      props: loc.props,
      reference_image_path: loc.reference_image_path,
      historical_period: loc.historical_period || null,
      reference_type: loc.reference_type || 'location'
    });
  }

  return manifest;
}

/**
 * Build character name map from all DB characters across all universes
 */
function buildCharacterNameMap(allCharacters) {
  const map = { ...STATIC_CHARACTER_NAME_MAP };

  for (const char of allCharacters) {
    const key = char.character_key;
    map[char.name.toLowerCase()] = key;
    map[key] = key;
    if (key.includes('_')) {
      map[key.replace(/_/g, ' ')] = key;
      map[key.replace(/_/g, '. ')] = key;
    }
  }

  return map;
}

/**
 * Load all universe manifests from database into cache.
 * Uses lazy dynamic import to avoid circular dependency with db.js
 */
async function loadManifestsFromDb() {
  try {
    const { getAllUniverseProfiles, getUniverseCharacters, getUniverseLocations } = await import('./db.js');

    const profiles = await getAllUniverseProfiles('active');
    if (!profiles || profiles.length === 0) {
      console.log('[UniverseManifests] No DB profiles found, using static fallback.');
      return false;
    }

    const manifests = {};
    const allCharacters = [];

    for (const profile of profiles) {
      const characters = await getUniverseCharacters(profile.id);
      const locations = await getUniverseLocations(profile.id);
      manifests[profile.slug] = buildManifestFromDb(profile, characters || [], locations || []);
      allCharacters.push(...(characters || []));
    }

    _manifestCache = manifests;
    _characterNameMap = buildCharacterNameMap(allCharacters);
    _cacheReady = true;

    console.log(`[UniverseManifests] Loaded ${Object.keys(manifests).length} universe(s) from DB: ${Object.keys(manifests).join(', ')}`);
    return true;
  } catch (err) {
    console.warn('[UniverseManifests] DB load failed, using static fallback:', err.message);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// Public API (same signatures as before)
// ═══════════════════════════════════════════════════════════

/**
 * Exported for backward compatibility — consumers that import CHARACTER_NAME_MAP directly.
 * This now returns a merged map including DB characters.
 */
export const CHARACTER_NAME_MAP = new Proxy(STATIC_CHARACTER_NAME_MAP, {
  get(target, prop) {
    if (_characterNameMap && prop in _characterNameMap) {
      return _characterNameMap[prop];
    }
    return target[prop];
  },
  has(target, prop) {
    if (_characterNameMap && prop in _characterNameMap) return true;
    return prop in target;
  }
});

/**
 * Exported for backward compatibility — the static manifests object.
 * Proxy delegates to cache when available.
 */
export const UNIVERSE_MANIFESTS = new Proxy({ pawville: PAWVILLE_STATIC_FALLBACK }, {
  get(target, prop) {
    if (_manifestCache && prop in _manifestCache) {
      return _manifestCache[prop];
    }
    return target[prop];
  },
  has(target, prop) {
    if (_manifestCache && prop in _manifestCache) return true;
    return prop in target;
  },
  ownKeys() {
    if (_manifestCache) return Object.keys(_manifestCache);
    return ['pawville'];
  },
  getOwnPropertyDescriptor(target, prop) {
    if (_manifestCache && prop in _manifestCache) {
      return { value: _manifestCache[prop], writable: true, enumerable: true, configurable: true };
    }
    if (prop in target) {
      return Object.getOwnPropertyDescriptor(target, prop);
    }
    return undefined;
  }
});

/**
 * Normalizes character names to standard keys (mochi, dr_paw, coco, boba, tofu, ...)
 * @param {string} rawName - Raw character name from storyboard or AI output
 * @returns {string|null} - Normalized character key or null if not in map
 */
export function normalizeCharacterId(rawName) {
  if (!rawName) return null;
  const clean = rawName.trim().toLowerCase();
  if (_characterNameMap && clean in _characterNameMap) {
    return _characterNameMap[clean];
  }
  return STATIC_CHARACTER_NAME_MAP[clean] || null;
}

/**
 * Retrieves the manifest for a specific universe profile
 * @param {string} universeProfile - Profile key / slug (e.g., 'pawville')
 * @returns {Object|null} - Manifest object or null
 */
export function getUniverseManifest(universeProfile) {
  if (!universeProfile) return null;
  const cleanProfile = universeProfile.trim().toLowerCase();

  // Try DB cache first
  if (_manifestCache && cleanProfile in _manifestCache) {
    return _manifestCache[cleanProfile];
  }

  // Fallback to static
  if (cleanProfile === 'pawville') {
    return PAWVILLE_STATIC_FALLBACK;
  }

  return null;
}

/**
 * Refresh the manifest cache from the database.
 * Called after CRUD operations on universe data, and at server boot.
 */
export async function refreshManifestCache() {
  _cacheLoadPromise = loadManifestsFromDb();
  await _cacheLoadPromise;
}

/**
 * Ensure manifests are loaded. Non-blocking — returns immediately if already loaded.
 * First call triggers DB load; subsequent calls return the same promise.
 */
export async function ensureManifestsLoaded() {
  if (_cacheReady) return;
  if (!_cacheLoadPromise) {
    _cacheLoadPromise = loadManifestsFromDb();
  }
  await _cacheLoadPromise;
}

/**
 * Get all available universe slugs (from cache or static fallback)
 */
export function getAvailableUniverseSlugs() {
  if (_manifestCache) return Object.keys(_manifestCache);
  return ['pawville'];
}

// Auto-load on first import (non-blocking)
setTimeout(() => {
  ensureManifestsLoaded().catch(() => {});
}, 2000);
