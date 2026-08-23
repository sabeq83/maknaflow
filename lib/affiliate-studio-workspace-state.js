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

export function buildAffiliateStudioUrl(brandId) {
  if (!brandId) return '/affiliate-studio';
  return `/affiliate-studio?brand=${encodeURIComponent(brandId)}`;
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
