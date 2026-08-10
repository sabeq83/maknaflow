/**
 * KB Routing Registry — Tahap 3.6
 * Centralized source of truth for Knowledge Base routing per domain.
 * ALL components should import from here instead of doing inline routing.
 */

// Domain KB mapping — isolated per domain, no cross-loading
export const DOMAIN_KB_MAP = {
  'pet_supplies':     ['PET_CONTENT_KB'],
  'food_culinary':    ['Food Styling & Photography KB'],
  'herbal':           ['HERBAL_CONTENT_KB'],
  'kitchen':          ['KITCHEN_CONTENT_KB'],
  'home_improvement': ['HOME_IMPROVEMENT_KB'],
  'history':          ['HISTORY_CONTENT_KB'],
  'islamic_history':  ['HISTORY_CONTENT_KB', 'ISLAMIC_HISTORY_CONTENT_KB'],
  'general':          [],
};

// Shared KBs loaded for ALL cartoon_universe content worlds
export const CARTOON_SHARED_KBS = [
  'CARTOON_UNIVERSE_STORY_ENGINE',
  'CARTOON_VISUAL_CONTINUITY_KB',
];

/**
 * Get domain-specific KB names for a given knowledge domain.
 * Returns empty array for unknown domains.
 */
export function getDomainKBs(knowledgeDomain) {
  return DOMAIN_KB_MAP[knowledgeDomain] || [];
}

/**
 * Build universe profile KB filename (without .md extension).
 * Returns null if universeSlug is falsy.
 * NO fallback to PawVille — if universe profile KB doesn't exist, returns null.
 */
export function getUniverseProfileKBName(universeSlug) {
  if (!universeSlug) return null;
  const normalized = universeSlug.toUpperCase().replace(/-/g, '_');
  return `universes/${normalized}_UNIVERSE_PROFILE`;
}

/**
 * Build complete KB list for a cartoon universe.
 * Order: shared cartoon KBs → domain-specific KB → universe profile KB
 */
export function buildCartoonKBList(knowledgeDomain, universeSlug) {
  const domainKBs = getDomainKBs(knowledgeDomain || 'general');
  const profileKB = getUniverseProfileKBName(universeSlug);
  return [
    ...CARTOON_SHARED_KBS,
    ...domainKBs,
    ...(profileKB ? [profileKB] : []),
  ];
}

/**
 * Check if a KB name is an allowed domain KB (not cross-domain contamination).
 */
export function isDomainKBAllowed(kbName, knowledgeDomain) {
  const allowed = getDomainKBs(knowledgeDomain);
  return allowed.some(k => kbName.includes(k));
}
