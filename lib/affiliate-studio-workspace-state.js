export function resolveActiveAffiliateBrand({ brands = [], requestedBrandId }) {
  if (brands.length === 0) {
    return { activeBrand: null, reason: 'no_brands' };
  }
  if (!requestedBrandId) {
    return { activeBrand: brands[0], reason: 'default' };
  }
  const match = brands.find(b => b.id === requestedBrandId);
  if (match) {
    return { activeBrand: match, reason: 'exact_match' };
  }
  return { activeBrand: brands[0], reason: 'stale_or_invalid' };
}

export const AFFILIATE_STUDIO_VIEWS = Object.freeze([
  'overview',
  'products',
  'campaigns',
  'planner',
  'production',
  'publishing',
  'performance'
]);

export function resolveAffiliateStudioView(value) {
  return AFFILIATE_STUDIO_VIEWS.includes(value) ? value : 'overview';
}

export function buildAffiliateStudioUrl(brandId, options = {}) {
  if (!brandId) return '/affiliate-studio';
  const params = new URLSearchParams();
  params.set('brand', brandId);

  if (options.view && options.view !== 'overview') {
    params.set('view', options.view);
  }

  if (options.view === 'products') {
    if (options.q) params.set('q', options.q);
    if (options.association && options.association !== 'all') params.set('association', options.association);
    if (options.readiness && options.readiness !== 'all') params.set('readiness', options.readiness);
    if (options.category) params.set('category', options.category);
    if (options.cursor) params.set('cursor', options.cursor);
  }

  if (options.view === 'campaigns') {
    if (options.program) params.set('program', options.program);
  }

  return `/affiliate-studio?${params.toString()}`;
}

export function parseAffiliateProductFilters(searchParams) {
  const get = (key) => {
    if (!searchParams) return undefined;
    if (typeof searchParams.get === 'function') {
      return searchParams.get(key);
    }
    return searchParams[key];
  };

  const q = get('q') || '';
  const association = get('association') || 'all';
  const readiness = get('readiness') || 'all';
  const category = get('category') || '';
  const cursor = get('cursor') || null;

  return { q, association, readiness, category, cursor };
}

export function buildAffiliateLegacyLinks(brand) {
  const brandName = brand?.name || '';
  return {
    brandProfiles: '/settings/brand-profiles',
    products: '/products',
    contentPlanner: '/content-planner',
    reCampaigns: '/re-campaigns',
    pillarCampaigns: '/pillar-campaigns',
    recipeLabs: '/recipe-labs',
    contentFlow: brandName ? `/content-flow?account=${encodeURIComponent(brandName)}` : '/content-flow'
  };
}
