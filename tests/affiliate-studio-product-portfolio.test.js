import { mock } from 'node:test';
mock.module('server-only', { default: {} });

import test from 'node:test';
import assert from 'node:assert/strict';
import { pgQuery } from '../lib/db-pg.js';
import { resolveAffiliateLink } from '../lib/affiliate-resolver.js';

test('portfolio is tenant and assigned-brand isolated', async () => {
  const { listAffiliateBrandProductPortfolio } = await import('../lib/affiliate-studio-brand-product-read-adapter.js');

  const suffix = Date.now();
  const testTenant = `tenant_pf_1_${suffix}`;
  const otherTenant = `tenant_pf_1_oth_${suffix}`;
  const bp1 = `bp_pf_1_${suffix}`;
  const bp2 = `bp_pf_2_${suffix}`;
  const bp3 = `bp_pf_3_${suffix}`;
  const p1Id = `p_pf_1_${suffix}`;
  const p2Id = `p_pf_2_${suffix}`;
  const assoc1 = `bp_assoc_1_${suffix}`;

  // Pre-cleanup in case of dirty database
  await pgQuery(`DELETE FROM brand_products WHERE tenant_id IN ($1, $2)`, [testTenant, otherTenant]);
  await pgQuery(`DELETE FROM product_extractions WHERE tenant_id IN ($1, $2)`, [testTenant, otherTenant]);
  await pgQuery(`DELETE FROM brand_profiles WHERE tenant_id IN ($1, $2)`, [testTenant, otherTenant]);
  await pgQuery(`DELETE FROM tenants WHERE id IN ($1, $2)`, [testTenant, otherTenant]);

  // 1. Seed tenants
  await pgQuery(
    `INSERT INTO tenants (id, name) VALUES ($1, $2), ($3, $4)`,
    [testTenant, 'PF Tenant A', otherTenant, 'PF Tenant B']
  );

  // 2. Seed brand profiles
  await pgQuery(
    `INSERT INTO brand_profiles (id, tenant_id, brand_name) VALUES
     ($1, $2, $3),
     ($4, $5, $6),
     ($7, $8, $9)`,
    [
      bp1, testTenant, 'Tenant Brand 1',
      bp2, testTenant, 'Tenant Brand 2',
      bp3, otherTenant, 'Other Tenant Brand'
    ]
  );

  // 3. Seed product extractions
  await pgQuery(
    `INSERT INTO product_extractions (id, tenant_id, product_name, product_description, unique_selling_point, target_audience, category) VALUES
     ($1, $2, $3, $4, $5, $6, $7),
     ($8, $9, $10, $11, $12, $13, $14)`,
    [
      p1Id, testTenant, 'Product 1', 'Desc 1', 'USP 1', 'Audience 1', 'Foods',
      p2Id, testTenant, 'Product 2', 'Desc 2', 'USP 2', 'Audience 2', 'Cosmetics'
    ]
  );

  // 4. Seed brand products association
  await pgQuery(
    `INSERT INTO brand_products (id, tenant_id, brand_profile_id, product_id, affiliate_link, is_active) VALUES
     ($1, $2, $3, $4, $5, $6)`,
    [
      assoc1, testTenant, bp1, p1Id, 'https://aff.link/bp1', true
    ]
  );

  try {
    const adminUser = {
      id: 'usr_admin',
      role: 'admin',
      tenantId: testTenant
    };

    const regularUser = {
      id: 'usr_user',
      role: 'user',
      tenantId: testTenant,
      assignedBrandIds: [bp2]
    };

    // Admin should see both products (one linked, one candidate) in bp1
    const adminRes = await listAffiliateBrandProductPortfolio({
      user: adminUser,
      brandId: bp1,
      filters: {}
    });
    assert.ok(adminRes);
    assert.equal(adminRes.items.length, 2);
    
    const p1 = adminRes.items.find(i => i.productId === p1Id);
    assert.equal(p1.association.state, 'active');
    assert.equal(p1.affiliate.link, 'https://aff.link/bp1');
    assert.equal(p1.affiliate.source, 'brand_product');

    const p2 = adminRes.items.find(i => i.productId === p2Id);
    assert.equal(p2.association.state, 'candidate');

    // Regular user is not assigned to bp1, so access returns null
    const userResNull = await listAffiliateBrandProductPortfolio({
      user: regularUser,
      brandId: bp1,
      filters: {}
    });
    assert.equal(userResNull, null);

    // Regular user is assigned to bp2, so they should see products there (both as candidate since no association seeded for bp2)
    const userRes = await listAffiliateBrandProductPortfolio({
      user: regularUser,
      brandId: bp2,
      filters: {}
    });
    assert.ok(userRes);
    assert.equal(userRes.items.length, 2);
    assert(userRes.items.every(i => i.association.state === 'candidate'));

    // Cross-tenant access check
    const crossRes = await listAffiliateBrandProductPortfolio({
      user: adminUser,
      brandId: bp3,
      filters: {}
    });
    assert.equal(crossRes, null);

  } finally {
    // Reverse dependency cleanup
    await pgQuery(`DELETE FROM brand_products WHERE tenant_id IN ($1, $2)`, [testTenant, otherTenant]);
    await pgQuery(`DELETE FROM product_extractions WHERE tenant_id IN ($1, $2)`, [testTenant, otherTenant]);
    await pgQuery(`DELETE FROM brand_profiles WHERE tenant_id IN ($1, $2)`, [testTenant, otherTenant]);
    await pgQuery(`DELETE FROM tenants WHERE id IN ($1, $2)`, [testTenant, otherTenant]);
  }
});

test('linked and unlinked products are not duplicated, inactive shows up when requested', async () => {
  const { listAffiliateBrandProductPortfolio } = await import('../lib/affiliate-studio-brand-product-read-adapter.js');

  const suffix = Date.now();
  const testTenant = `tenant_dup_${suffix}`;
  const bpId = `bp_dup_1_${suffix}`;
  const p1Id = `p_dup_1_${suffix}`;
  const p2Id = `p_dup_2_${suffix}`;
  const assocId = `bp_assoc_dup_1_${suffix}`;

  // Pre-cleanup in case of dirty database
  await pgQuery(`DELETE FROM brand_products WHERE tenant_id = $1`, [testTenant]);
  await pgQuery(`DELETE FROM product_extractions WHERE tenant_id = $1`, [testTenant]);
  await pgQuery(`DELETE FROM brand_profiles WHERE tenant_id = $1`, [testTenant]);
  await pgQuery(`DELETE FROM tenants WHERE id = $1`, [testTenant]);

  await pgQuery(`INSERT INTO tenants (id, name) VALUES ($1, $2)`, [testTenant, 'PF Duplicate Tenant']);

  await pgQuery(
    `INSERT INTO brand_profiles (id, tenant_id, brand_name) VALUES ($1, $2, $3)`,
    [bpId, testTenant, 'Duplicate Brand']
  );

  await pgQuery(
    `INSERT INTO product_extractions (id, tenant_id, product_name, category) VALUES
     ($1, $2, $3, $4),
     ($5, $6, $7, $8)`,
    [
      p1Id, testTenant, 'Product 1', 'Category A',
      p2Id, testTenant, 'Product 2', 'Category B'
    ]
  );

  // bpId has an inactive association with p1Id
  await pgQuery(
    `INSERT INTO brand_products (id, tenant_id, brand_profile_id, product_id, affiliate_link, is_active) VALUES
     ($1, $2, $3, $4, $5, $6)`,
    [
      assocId, testTenant, bpId, p1Id, 'https://aff.link/dup1', false
    ]
  );

  try {
    const user = { id: 'usr_admin', role: 'admin', tenantId: testTenant };

    // With filters.association = 'all', both products should show up once. p1Id is inactive.
    const resAll = await listAffiliateBrandProductPortfolio({
      user,
      brandId: bpId,
      filters: { association: 'all' }
    });
    assert.equal(resAll.items.length, 2);
    
    const p1 = resAll.items.find(i => i.productId === p1Id);
    assert.equal(p1.association.state, 'inactive');

    // With filters.association = 'active', only active associations should return (which is 0)
    const resActive = await listAffiliateBrandProductPortfolio({
      user,
      brandId: bpId,
      filters: { association: 'active' }
    });
    assert.equal(resActive.items.length, 0);

    // With filters.association = 'candidate', only candidates should return (which is p2Id)
    const resCandidate = await listAffiliateBrandProductPortfolio({
      user,
      brandId: bpId,
      filters: { association: 'candidate' }
    });
    assert.equal(resCandidate.items.length, 1);
    assert.equal(resCandidate.items[0].productId, p2Id);

  } finally {
    await pgQuery(`DELETE FROM brand_products WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM product_extractions WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM brand_profiles WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM tenants WHERE id = $1`, [testTenant]);
  }
});

test('filters and stable pagination do not duplicate or skip', async () => {
  const { listAffiliateBrandProductPortfolio } = await import('../lib/affiliate-studio-brand-product-read-adapter.js');

  const suffix = Date.now();
  const testTenant = `tenant_pag_${suffix}`;
  const bpId = `bp_pag_1_${suffix}`;
  const p1 = `p_pag_1_${suffix}`;
  const p2 = `p_pag_2_${suffix}`;
  const p3 = `p_pag_3_${suffix}`;
  const p4 = `p_pag_4_${suffix}`;
  const p5 = `p_pag_5_${suffix}`;

  // Pre-cleanup in case of dirty database
  await pgQuery(`DELETE FROM product_extractions WHERE tenant_id = $1`, [testTenant]);
  await pgQuery(`DELETE FROM brand_profiles WHERE tenant_id = $1`, [testTenant]);
  await pgQuery(`DELETE FROM tenants WHERE id = $1`, [testTenant]);

  await pgQuery(`INSERT INTO tenants (id, name) VALUES ($1, $2)`, [testTenant, 'PF Pagination Tenant']);

  await pgQuery(
    `INSERT INTO brand_profiles (id, tenant_id, brand_name) VALUES ($1, $2, $3)`,
    [bpId, testTenant, 'Pagination Brand']
  );

  // Seed 5 products
  await pgQuery(
    `INSERT INTO product_extractions (id, tenant_id, product_name, category) VALUES
     ($1, $2, $3, $4),
     ($5, $6, $7, $8),
     ($9, $10, $11, $12),
     ($13, $14, $15, $16),
     ($17, $18, $19, $20)`,
    [
      p1, testTenant, 'Apple Phone', 'Gadgets',
      p2, testTenant, 'Banana Juice', 'Drinks',
      p3, testTenant, 'Cherry Jam', 'Foods',
      p4, testTenant, 'Dragon Fruit', 'Foods',
      p5, testTenant, 'Elderberry Syrup', 'Drinks'
    ]
  );

  try {
    const user = { id: 'usr_admin', role: 'admin', tenantId: testTenant };

    // Query Category Foods facet should show foods count = 2
    const resAll = await listAffiliateBrandProductPortfolio({
      user,
      brandId: bpId,
      filters: {}
    });
    const foodsFacet = resAll.facets.categories.find(c => c.name === 'Foods');
    assert.equal(foodsFacet.count, 2);

    // Filter by Foods, limit 1
    const page1 = await listAffiliateBrandProductPortfolio({
      user,
      brandId: bpId,
      filters: { category: 'Foods', limit: 1 }
    });
    assert.equal(page1.items.length, 1);
    assert.equal(page1.items[0].productId, p3);
    assert.ok(page1.pagination.hasMore);
    assert.equal(page1.pagination.nextCursor, p3);

    // Load page 2 using cursor
    const page2 = await listAffiliateBrandProductPortfolio({
      user,
      brandId: bpId,
      filters: { category: 'Foods', limit: 1, cursor: page1.pagination.nextCursor }
    });
    assert.equal(page2.items.length, 1);
    assert.equal(page2.items[0].productId, p4);
    assert.equal(page2.pagination.hasMore, false);

  } finally {
    await pgQuery(`DELETE FROM product_extractions WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM brand_profiles WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM tenants WHERE id = $1`, [testTenant]);
  }
});
