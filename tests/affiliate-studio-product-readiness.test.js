import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveBrandProductAssociation,
  resolveSafeProductImage,
  evaluateAffiliateProductReadiness,
  normalizeAffiliateProductFilters
} from '../lib/affiliate-studio-product-readiness.js';

test('resolveBrandProductAssociation resolution states', () => {
  // active association
  const activeRes = resolveBrandProductAssociation({ brand_product_id: 'bp_1', is_active: 1 });
  assert.deepEqual(activeRes, { state: 'active', isLinked: true, isActive: true });

  const activeResBool = resolveBrandProductAssociation({ brand_product_id: 'bp_1', is_active: true });
  assert.deepEqual(activeResBool, { state: 'active', isLinked: true, isActive: true });

  // inactive association
  const inactiveRes = resolveBrandProductAssociation({ brand_product_id: 'bp_1', is_active: 0 });
  assert.deepEqual(inactiveRes, { state: 'inactive', isLinked: true, isActive: false });

  const inactiveResBool = resolveBrandProductAssociation({ brand_product_id: 'bp_1', is_active: false });
  assert.deepEqual(inactiveResBool, { state: 'inactive', isLinked: true, isActive: false });

  // candidate/unlinked
  const candidateRes = resolveBrandProductAssociation({ brand_product_id: null });
  assert.deepEqual(candidateRes, { state: 'candidate', isLinked: false, isActive: false });
});

test('resolveSafeProductImage image path candidates and wrapping', () => {
  // precedence: active_photo field
  const row1 = {
    active_photo: 'cleaned_photo_url',
    cleaned_photo_url: 'uploads/cleaned.png',
    photo_url: 'uploads/photo.png'
  };
  assert.equal(resolveSafeProductImage(row1), '/api/v2/products/image?path=uploads%2Fcleaned.png');

  // fallback clean_photo_url
  const row2 = {
    clean_photo_url: 'uploads/clean.png',
    photo_url: 'uploads/photo.png'
  };
  assert.equal(resolveSafeProductImage(row2), '/api/v2/products/image?path=uploads%2Fclean.png');

  // external http url preserves as-is
  const row3 = {
    photo_url: 'https://images.com/prod.jpg'
  };
  assert.equal(resolveSafeProductImage(row3), 'https://images.com/prod.jpg');

  // local relative path already prefixed is preserved
  const row4 = {
    photo_url: '/api/v2/products/image?path=raw.png'
  };
  assert.equal(resolveSafeProductImage(row4), '/api/v2/products/image?path=raw.png');
});

test('resolveSafeProductImage absolute filesystem image paths are never exposed', () => {
  const rowAbsolute1 = {
    photo_url: '/Users/sabeqmmursyid/project/public/uploads/prod.jpg'
  };
  assert.equal(resolveSafeProductImage(rowAbsolute1), null);

  const rowAbsolute2 = {
    photo_url: '/home/ubuntu/project/public/uploads/prod.jpg'
  };
  assert.equal(resolveSafeProductImage(rowAbsolute2), null);

  const rowAbsolute3 = {
    photo_url: 'C:\\Users\\Administrator\\prod.jpg'
  };
  assert.equal(resolveSafeProductImage(rowAbsolute3), null);
});

test('evaluateAffiliateProductReadiness ready state', () => {
  const product = {
    product_name: 'Super Tea',
    product_description: 'Healthy organic tea',
    unique_selling_point: 'Boosts energy',
    target_audience: 'Everyone',
    photo_url: 'uploads/tea.png'
  };
  const association = { state: 'active' };
  const affiliate = { link: 'https://aff.link/1', source: 'brand_product' };

  const res = evaluateAffiliateProductReadiness({ product, association, affiliate });
  assert.equal(res.overall, 'ready');
  assert.equal(res.productTruth, 'ready');
  assert.equal(res.image, 'ready');
  assert.equal(res.affiliateLink, 'ready');
  assert.equal(res.association, 'ready');
  assert.equal(res.reasons.length, 0);
});

test('evaluateAffiliateProductReadiness legacy affiliate fallback is needs_review', () => {
  const product = {
    product_name: 'Super Tea',
    product_description: 'Healthy organic tea',
    unique_selling_point: 'Boosts energy',
    target_audience: 'Everyone',
    photo_url: 'uploads/tea.png'
  };
  const association = { state: 'active' };
  const affiliate = { link: 'https://aff.link/legacy', source: 'legacy_product' };

  const res = evaluateAffiliateProductReadiness({ product, association, affiliate });
  assert.equal(res.overall, 'needs_review');
  assert.equal(res.affiliateLink, 'needs_review');
  assert(res.reasons.includes('LEGACY_LINK_FALLBACK'));
});

test('evaluateAffiliateProductReadiness candidate association is incomplete', () => {
  const product = {
    product_name: 'Super Tea',
    product_description: 'Healthy organic tea',
    unique_selling_point: 'Boosts energy',
    target_audience: 'Everyone',
    photo_url: 'uploads/tea.png'
  };
  const association = { state: 'candidate' };
  const affiliate = { link: '', source: 'missing' };

  const res = evaluateAffiliateProductReadiness({ product, association, affiliate });
  assert.equal(res.overall, 'incomplete');
  assert.equal(res.association, 'incomplete');
  assert.equal(res.affiliateLink, 'incomplete');
  assert(res.reasons.includes('NO_BRAND_ASSOCIATION'));
});

test('evaluateAffiliateProductReadiness missing image or truth is incomplete', () => {
  const product = {
    product_name: 'Super Tea',
    product_description: '', // missing
    unique_selling_point: 'Boosts energy',
    target_audience: 'Everyone'
  };
  const association = { state: 'active' };
  const affiliate = { link: 'https://aff.link/1', source: 'brand_product' };

  const res = evaluateAffiliateProductReadiness({ product, association, affiliate });
  assert.equal(res.overall, 'incomplete');
  assert.equal(res.productTruth, 'incomplete');
  assert.equal(res.image, 'incomplete');
  assert(res.reasons.includes('MISSING_PRODUCT_DESCRIPTION'));
  assert(res.reasons.includes('MISSING_IMAGE'));
});
