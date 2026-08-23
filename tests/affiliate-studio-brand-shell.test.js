import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveActiveAffiliateBrand,
  buildAffiliateStudioUrl,
  buildAffiliateLegacyLinks
} from '../lib/affiliate-studio-workspace-state.js';

test('requested authorized brand wins', () => {
  const brands = [
    { id: 'b1', name: 'Brand A' },
    { id: 'b2', name: 'Brand B' }
  ];
  
  const res = resolveActiveAffiliateBrand({ brands, requestedBrandId: 'b2' });
  assert.equal(res.activeBrand.id, 'b2');
  assert.equal(res.reason, 'exact_match');
});

test('missing or stale brand resolves deterministically', () => {
  const brands = [
    { id: 'b1', name: 'Brand A' },
    { id: 'b2', name: 'Brand B' }
  ];

  // Missing
  const res1 = resolveActiveAffiliateBrand({ brands, requestedBrandId: null });
  assert.equal(res1.activeBrand.id, 'b1');
  assert.equal(res1.reason, 'default');

  // Stale/Invalid
  const res2 = resolveActiveAffiliateBrand({ brands, requestedBrandId: 'non-existent' });
  assert.equal(res2.activeBrand.id, 'b1');
  assert.equal(res2.reason, 'stale_or_invalid');

  // No brands
  const res3 = resolveActiveAffiliateBrand({ brands: [], requestedBrandId: 'b1' });
  assert.equal(res3.activeBrand, null);
  assert.equal(res3.reason, 'no_brands');
});

test('legacy links mapping and URL formats', () => {
  const brand = { id: 'b1', name: 'Siasat Sehat' };
  const links = buildAffiliateLegacyLinks(brand);
  
  assert.equal(links.brandProfiles, '/settings/brand-profiles');
  assert.equal(links.products, '/products');
  assert.equal(links.contentPlanner, '/content-planner');
  assert.equal(links.contentFlow, '/content-flow?account=Siasat%20Sehat');

  const emptyLinks = buildAffiliateLegacyLinks(null);
  assert.equal(emptyLinks.contentFlow, '/content-flow');
});

test('URL builder helper', () => {
  assert.equal(buildAffiliateStudioUrl('b1'), '/affiliate-studio?brand=b1');
  assert.equal(buildAffiliateStudioUrl(null), '/affiliate-studio');
});
