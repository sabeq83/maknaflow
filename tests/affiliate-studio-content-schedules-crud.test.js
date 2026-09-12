import { mock } from 'node:test';
try {
  mock.module('server-only', { default: {} });
} catch (_) {}

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listAffiliateSchedules,
  createAffiliatePlanSchedules,
  updateAffiliateSchedule,
  deleteAffiliateSchedule
} from '../lib/affiliate-content-schedules-repository.js';
import { getPgPool } from '../lib/db-pg.js';

test('Affiliate Content Schedules: CRUD lifecycle and brand_profile_id isolation', async () => {
  const testTenantId = 'test_tenant_calendar_crud_' + Date.now();
  const testBrandProfileId = 'brand_prof_' + Date.now();
  const testBrandName = 'Test Brand Sourcing ' + Date.now();

  // 1. Create schedules
  const created = await createAffiliatePlanSchedules({
    tenantId: testTenantId,
    brandProfileId: testBrandProfileId,
    planType: 'product_campaign',
    brandName: testBrandName,
    productId: null,
    productName: 'Test Serum Glow',
    promotionContext: 'Diskon 20% Ramadhan',
    targetPlatforms: ['instagram', 'tiktok', 'facebook'],
    targetAccountIds: ['acc_123', 'acc_456'],
    items: [
      {
        cep_code: 'Problem-Solution Based',
        pillar_name: null,
        scheduled_at: new Date(Date.now() + 86400000).toISOString()
      },
      {
        cep_code: 'Routine Based',
        pillar_name: null,
        scheduled_at: new Date(Date.now() + 172800000).toISOString()
      }
    ],
    createdBy: 'user_tester'
  });

  assert.equal(created.length, 2, 'Should create 2 schedules');
  assert.equal(created[0].brand_profile_id, testBrandProfileId, 'Should store brand_profile_id');
  assert.equal(created[0].brand_name, testBrandName, 'Should store brand_name');

  // 2. List schedules by brand_profile_id (Ensures no "column p.price does not exist" SQL crash)
  const listedByProfile = await listAffiliateSchedules({
    tenantId: testTenantId,
    brandProfileId: testBrandProfileId
  });

  assert.equal(listedByProfile.length, 2, 'Should retrieve 2 schedules by brand_profile_id');
  assert.equal(listedByProfile[0].product_name, 'Test Serum Glow');

  // 3. List schedules by case-insensitive brandName
  const listedByName = await listAffiliateSchedules({
    tenantId: testTenantId,
    brandName: testBrandName.toLowerCase()
  });

  assert.equal(listedByName.length, 2, 'Should retrieve 2 schedules by lowercase brand_name');

  // 4. Update schedule
  const scheduleToUpdate = created[0];
  const updated = await updateAffiliateSchedule(testTenantId, scheduleToUpdate.id, {
    status: 'in_production',
    promotion_context: 'Diskon 25% Updated'
  });

  assert.ok(updated, 'Update should return updated record');
  assert.equal(updated.status, 'in_production');
  assert.equal(updated.promotion_context, 'Diskon 25% Updated');

  // 5. Cleanup
  for (const s of created) {
    const deleted = await deleteAffiliateSchedule(testTenantId, s.id);
    assert.equal(deleted, true, 'Schedule should be deleted');
  }

  const remaining = await listAffiliateSchedules({
    tenantId: testTenantId,
    brandProfileId: testBrandProfileId
  });
  assert.equal(remaining.length, 0, 'Should have 0 schedules remaining after deletion');
  process.exit(0);
});
