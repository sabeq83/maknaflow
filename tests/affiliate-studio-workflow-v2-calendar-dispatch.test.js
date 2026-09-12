import { mock } from 'node:test';
try {
  mock.module('server-only', { default: {} });
} catch (_) {}

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'path';

test('Workflow V2 Calendar Dispatch: Service file exists and exports required methods', async () => {
  const servicePath = path.resolve(process.cwd(), 'lib/affiliate-studio-calendar-dispatch-service.js');
  assert.ok(fs.existsSync(servicePath), 'Service file must exist');

  const content = fs.readFileSync(servicePath, 'utf8');
  assert.ok(content.includes('export async function dispatchCalendarSchedulesToPlanner'), 'Must export dispatchCalendarSchedulesToPlanner');
  assert.ok(content.includes('export async function getDispatchDetails'), 'Must export getDispatchDetails');
});

test('Workflow V2 Calendar Dispatch: API route files exist and export expected methods', () => {
  const dispatchRoutePath = path.resolve(process.cwd(), 'app/api/v2/affiliate-studio/brands/[id]/calendar/dispatch/route.js');
  const detailsRoutePath = path.resolve(process.cwd(), 'app/api/v2/affiliate-studio/brands/[id]/calendar/dispatches/[dispatchId]/route.js');

  assert.ok(fs.existsSync(dispatchRoutePath), 'Dispatch route must exist');
  assert.ok(fs.existsSync(detailsRoutePath), 'Dispatch details route must exist');

  const dispatchContent = fs.readFileSync(dispatchRoutePath, 'utf8');
  assert.ok(dispatchContent.includes('export const POST'), 'Dispatch route must export POST');

  const detailsContent = fs.readFileSync(detailsRoutePath, 'utf8');
  assert.ok(detailsContent.includes('export const GET'), 'Dispatch details route must export GET');
});

test('Workflow V2 Calendar Component: AffiliateContentCalendar.js contains Dual-View and Inline Dispatch without floating bar', () => {
  const calendarCompPath = path.resolve(process.cwd(), 'app/affiliate-studio/components/AffiliateContentCalendar.js');
  assert.ok(fs.existsSync(calendarCompPath), 'AffiliateContentCalendar.js must exist');

  const content = fs.readFileSync(calendarCompPath, 'utf8');

  // Assert Dual-View
  assert.ok(content.includes('btnViewCalendar'), 'Must have btnViewCalendar');
  assert.ok(content.includes('btnViewList'), 'Must have btnViewList');
  assert.ok(content.includes('viewMode'), 'Must manage viewMode state');

  // Assert Inline Toolbar Dispatch
  assert.ok(content.includes('btnDispatchPlanner'), 'Must have btnDispatchPlanner');
  assert.ok(content.includes('handleDispatchToPlanner'), 'Must have handleDispatchToPlanner');

  // Assert NO bottom floating bar
  assert.ok(!content.includes('className="batch-bar"'), 'Must not have batch-bar floating element');
  assert.ok(!content.includes('floating-bar'), 'Must not have floating bar class');

  // Assert existing modal is preserved
  assert.ok(content.includes('showPlanModal'), 'Existing showPlanModal state must be preserved');
  assert.ok(content.includes('planType'), 'Plan type selection must be preserved');
});

test('Workflow V2 Calendar Dispatch: Live database dispatch execution', async () => {
  const { createAffiliatePlanSchedules, deleteAffiliateSchedule } = await import('../lib/affiliate-content-schedules-repository.js');
  const { dispatchCalendarSchedulesToPlanner } = await import('../lib/affiliate-studio-calendar-dispatch-service.js');
  const { pgQuery } = await import('../lib/db-pg.js');

  const testTenantId = 'default_tenant';
  const testBrandId = 'brand_disp_' + Date.now();
  const testBrandName = 'Test Brand Dispatch';

  // Seed brand profile in pg
  await pgQuery(
    `INSERT INTO brand_profiles (id, tenant_id, brand_name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [testBrandId, testTenantId, testBrandName]
  );

  const schedules = await createAffiliatePlanSchedules({
    tenantId: testTenantId,
    brandProfileId: testBrandId,
    planType: 'product_campaign',
    brandName: testBrandName,
    productId: 'prod_123',
    productName: 'Nutty Spread',
    promotionContext: 'Flash Sale 30%',
    targetPlatforms: ['instagram', 'tiktok', 'facebook'],
    items: [
      { cep_code: 'Problem-Solution Based', scheduled_at: new Date(Date.now() + 86400000).toISOString() },
      { cep_code: 'Routine Based', scheduled_at: new Date(Date.now() + 172800000).toISOString() }
    ]
  });

  const result = await dispatchCalendarSchedulesToPlanner({
    user: { id: 'usr_test', role: 'admin', tenantId: testTenantId },
    brandId: testBrandId,
    scheduleIds: schedules.map(s => s.id)
  });

  assert.ok(result.plannerId, 'Must create plannerId');
  assert.equal(result.rowsCreated, 2, 'Must create 2 planner rows');

  // Verify content_planners in database
  const plannerRes = await pgQuery(
    `SELECT * FROM content_planners WHERE id = $1 AND tenant_id = $2`,
    [result.plannerId, testTenantId]
  );
  assert.equal(plannerRes.rows.length, 1, 'Planner must exist in database');

  // Verify content_planner_rows in database
  const rowsRes = await pgQuery(
    `SELECT * FROM content_planner_rows WHERE planner_id = $1`,
    [result.plannerId]
  );
  assert.equal(rowsRes.rows.length, 2, 'Planner rows must exist in database');

  // Cleanup
  for (const s of schedules) {
    await deleteAffiliateSchedule(testTenantId, s.id);
  }
  await pgQuery(`DELETE FROM affiliate_content_lineage WHERE brand_profile_id = $1`, [testBrandId]);
  await pgQuery(`DELETE FROM content_planner_rows WHERE planner_id = $1`, [result.plannerId]);
  await pgQuery(`DELETE FROM content_planners WHERE id = $1`, [result.plannerId]);
  await pgQuery(`DELETE FROM brand_profiles WHERE id = $1`, [testBrandId]);
  process.exit(0);
});
