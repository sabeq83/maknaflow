import { mock } from 'node:test';
mock.module('server-only', { default: {} });

import test from 'node:test';
import assert from 'node:assert/strict';
import { pgQuery } from '../lib/db-pg.js';

test('assigned-brand and tenant isolation for listing', async () => {
  const { listAuthorizedAffiliateBrands, getAffiliateBrandOverview } = await import('../lib/affiliate-studio-brand-read-adapter.js');
  const testTenant = `tenant_test_${Date.now()}`;
  const otherTenant = `tenant_other_${Date.now()}`;

  // Seed test tenants first
  await pgQuery(
    `INSERT INTO tenants (id, name) VALUES ($1, $2), ($3, $4)`,
    [testTenant, 'Test Tenant A', otherTenant, 'Test Tenant B']
  );

  // Seed brand profiles
  await pgQuery(
    `INSERT INTO brand_profiles (id, tenant_id, brand_name) VALUES
     ($1, $2, $3),
     ($4, $5, $6),
     ($7, $8, $9)`,
    [
      'bp_test_1', testTenant, 'Tenant brand 1',
      'bp_test_2', testTenant, 'Tenant brand 2',
      'bp_test_3', otherTenant, 'Other tenant brand'
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
      assignedBrandIds: ['bp_test_2']
    };

    // Admin list authorized brands (should see all tenant brands, but not other tenant)
    const adminBrands = await listAuthorizedAffiliateBrands(adminUser);
    assert.equal(adminBrands.length, 2);
    assert(adminBrands.some(b => b.id === 'bp_test_1'));
    assert(adminBrands.some(b => b.id === 'bp_test_2'));
    assert(!adminBrands.some(b => b.id === 'bp_test_3'));

    // Regular user list authorized brands (should see only assigned brands)
    const userBrands = await listAuthorizedAffiliateBrands(regularUser);
    assert.equal(userBrands.length, 1);
    assert.equal(userBrands[0].id, 'bp_test_2');

    // Access overview of other tenant brand should return null (unauthorized)
    const overviewCrossTenant = await getAffiliateBrandOverview({ user: adminUser, brandId: 'bp_test_3' });
    assert.equal(overviewCrossTenant, null);

    // Access overview of unassigned brand for user should return null (unauthorized)
    const overviewUnassigned = await getAffiliateBrandOverview({ user: regularUser, brandId: 'bp_test_1' });
    assert.equal(overviewUnassigned, null);

  } finally {
    // Cleanup seeded data
    await pgQuery(`DELETE FROM brand_profiles WHERE tenant_id IN ($1, $2)`, [testTenant, otherTenant]);
    await pgQuery(`DELETE FROM tenants WHERE id IN ($1, $2)`, [testTenant, otherTenant]);
  }
});
