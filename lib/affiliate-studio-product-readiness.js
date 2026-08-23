import path from 'path';

export function resolveBrandProductAssociation(row) {
  if (row.brand_product_id) {
    const isActive = row.is_active === true || row.is_active === 1;
    return {
      state: isActive ? 'active' : 'inactive',
      isLinked: true,
      isActive
    };
  }
  return {
    state: 'candidate',
    isLinked: false,
    isActive: false
  };
}

export function resolveSafeProductImage(row) {
  const activeField = row.active_photo;
  const activeValue = activeField && row[activeField] ? row[activeField] : null;

  const candidates = [
    activeValue,
    row.cleaned_photo_url,
    row.clean_photo_url,
    row.generated_photo_url,
    row.raw_photo_url,
    row.photo_url
  ];

  const rawPath = candidates.find(val => typeof val === 'string' && val.trim() !== '');
  if (!rawPath) return null;

  const trimmed = rawPath.trim();
  
  // If HTTP(S), return as is
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // If already wrapped or relative web path, return as is
  if (trimmed.startsWith('/api/') || trimmed.startsWith('/uploads/')) {
    return trimmed;
  }

  // Check for absolute local filesystem paths
  if (trimmed.includes('/Users/') || trimmed.includes('/home/') || /^[a-zA-Z]:\\/i.test(trimmed) || path.isAbsolute(trimmed)) {
    return null;
  }

  // Otherwise, wrap in `/api/v2/products/image?path=`
  return `/api/v2/products/image?path=${encodeURIComponent(trimmed)}`;
}

export function evaluateAffiliateProductReadiness({ product = {}, association = {}, affiliate = {} }) {
  const reasons = [];

  // 1. Product Truth
  let productTruth = 'ready';
  if (!product.product_name || !product.product_name.trim()) {
    productTruth = 'incomplete';
    reasons.push('MISSING_PRODUCT_NAME');
  }
  if (!product.product_description || !product.product_description.trim()) {
    productTruth = 'incomplete';
    reasons.push('MISSING_PRODUCT_DESCRIPTION');
  }
  if (!product.unique_selling_point || !product.unique_selling_point.trim()) {
    productTruth = 'incomplete';
    reasons.push('MISSING_USP');
  }
  if (!product.target_audience || !product.target_audience.trim()) {
    productTruth = 'incomplete';
    reasons.push('MISSING_TARGET_AUDIENCE');
  }

  // 2. Image
  const hasImage = resolveSafeProductImage(product);
  const image = hasImage ? 'ready' : 'incomplete';
  if (!hasImage) {
    reasons.push('MISSING_IMAGE');
  }

  // 3. Affiliate Link
  let affiliateLink = 'incomplete';
  if (affiliate.link && affiliate.link.trim() !== '') {
    if (affiliate.source === 'brand_product') {
      affiliateLink = 'ready';
    } else if (affiliate.source === 'legacy_product') {
      affiliateLink = 'needs_review';
      reasons.push('LEGACY_LINK_FALLBACK');
    }
  } else {
    reasons.push('MISSING_AFFILIATE_LINK');
  }

  // 4. Association
  let associationState = 'incomplete';
  if (association.state === 'active') {
    associationState = 'ready';
  } else if (association.state === 'inactive') {
    associationState = 'needs_review';
    reasons.push('INACTIVE_ASSOCIATION');
  } else {
    reasons.push('NO_BRAND_ASSOCIATION');
  }

  // 5. Overall
  let overall = 'ready';
  if (productTruth === 'incomplete' || image === 'incomplete' || affiliateLink === 'incomplete' || associationState === 'incomplete') {
    overall = 'incomplete';
  } else if (affiliateLink === 'needs_review' || associationState === 'needs_review') {
    overall = 'needs_review';
  }

  return {
    overall,
    productTruth,
    image,
    affiliateLink,
    association: associationState,
    reasons
  };
}

export function normalizeAffiliateProductFilters(input = {}) {
  const q = typeof input.q === 'string' ? input.q.trim() : '';
  
  let association = 'all';
  if (['candidate', 'active', 'inactive'].includes(input.association)) {
    association = input.association;
  }

  let readiness = 'all';
  if (['ready', 'needs_review', 'incomplete'].includes(input.readiness)) {
    readiness = input.readiness;
  }

  const category = typeof input.category === 'string' ? input.category.trim() : '';
  const cursor = typeof input.cursor === 'string' && input.cursor.trim() !== '' ? input.cursor.trim() : null;

  let limit = 24;
  if (input.limit) {
    const parsed = parseInt(input.limit, 10);
    if (!isNaN(parsed) && parsed > 0) {
      limit = Math.min(parsed, 100);
    }
  }

  return {
    q,
    association,
    readiness,
    category,
    cursor,
    limit
  };
}
