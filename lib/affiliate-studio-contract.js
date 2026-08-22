export const AFFILIATE_STUDIO_PERMISSION = 'affiliate_studio';

export const AFFILIATE_ENGINE_TYPES = Object.freeze([
  're', 'pillar', 'recipe', 'multiplier',
  'instant', 'product_bridge', 'deconstruct'
]);

export const AFFILIATE_NORMALIZED_STATUSES = Object.freeze([
  'planned', 'queued', 'generating', 'awaiting_review',
  'producing', 'rendering', 'ready', 'scheduled',
  'published', 'measured', 'failed', 'cancelled'
]);

export const AFFILIATE_ACCESS_MODES = Object.freeze(['read', 'write', 'admin']);

export function assertAffiliateEngineType(value) {
  if (!AFFILIATE_ENGINE_TYPES.includes(value)) {
    const err = new Error(`Unknown engine type: ${value}`);
    err.code = 'INVALID_ENGINE_TYPE';
    err.status = 400;
    throw err;
  }
}

export function assertAffiliateAccessMode(value) {
  if (!AFFILIATE_ACCESS_MODES.includes(value)) {
    const err = new Error(`Unknown access mode: ${value}`);
    err.code = 'INVALID_ACCESS_MODE';
    err.status = 400;
    throw err;
  }
}

export function buildAffiliateStudioCapabilities(connectors = []) {
  return {
    module: 'affiliate_studio',
    phase: 0,
    enabled: true,
    engineTypes: [...AFFILIATE_ENGINE_TYPES],
    normalizedStatuses: [...AFFILIATE_NORMALIZED_STATUSES],
    connectors
  };
}
