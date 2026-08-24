import { mock } from 'node:test';
mock.module('server-only', { default: {} });

import test from 'node:test';
import assert from 'node:assert';
import { pgQuery } from '../lib/db-pg.js';

test('Brand-level Dashboards & Tabs unit & integration tests', async (t) => {
  const { createCampaignProgram } = await import('../lib/affiliate-studio-campaign-program-adapter.js');
  const { linkPlannerToProgram, updatePlannerRowLink, getBrandCalendarEvents } = await import('../lib/affiliate-studio-planner-adapter.js');
  const { createContentRun, listBrandContentRuns, reconcileBrandRuns } = await import('../lib/affiliate-studio-production-adapter.js');
  const { importPerformanceSnapshots, getBrandPerformanceSummary } = await import('../lib/affiliate-studio-performance-adapter.js');

  const suffix = Date.now();
  const testTenant = `tn_brand_${suffix}`;
  const bp1 = `bp_brand_${suffix}`;
  const planner1 = `pl_brand_${suffix}`;
  const row1 = `row_brand_${suffix}`;
  const prod1 = `prod_brand_${suffix}`;

  // 1. Setup seed structures
  await pgQuery(`INSERT INTO tenants (id, name, status) VALUES ($1, $2, 'active')`, [testTenant, `Tenant Brand ${suffix}`]);
  await pgQuery(
    `INSERT INTO brand_profiles (id, tenant_id, brand_name) VALUES ($1, $2, $3)`,
    [bp1, testTenant, 'Brand Tabs Brand']
  );
  await pgQuery(
    `INSERT INTO content_planners (id, tenant_id, brand_id, title, status) VALUES ($1, $2, $3, $4, $5)`,
    [planner1, testTenant, bp1, 'Brand Tabs Planner', 'active']
  );
  await pgQuery(
    `INSERT INTO content_planner_rows (id, planner_id, sequence, pillar, category_cep, ws_matrix, context, vfo, strategic_angle, hook, visual_action, product) VALUES
     ($1, $2, 1, 'Pilar Brand', 'recipe', 'Matrix A', 'Context A', 'VFO A', 'Angle A', 'Hook A', 'Action A', 'Product A')`,
    [row1, planner1]
  );

  try {
    const adminUser = { id: 'usr_admin', role: 'admin', tenantId: testTenant };

    // 2. Create program
    const programId = await createCampaignProgram(adminUser, bp1, {
      name: 'Brand Tabs Program',
      funnelMix: { tofu: 40, mofu: 40, bofu: 20 },
      platforms: ['tiktok'],
      productionTarget: 5
    });
    assert.ok(programId);

    // Link product
    await pgQuery(
      `INSERT INTO affiliate_program_products (id, tenant_id, affiliate_program_id, product_id, brand_product_id, product_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        prod1, testTenant, programId, 'bp_prod_brand', 'bp_prod_brand', 
        JSON.stringify({ productId: 'bp_prod_brand', name: 'Brand Product', affiliate: { link: 'http://aff.link' } })
      ]
    );

    // Link planner & associate row link
    await linkPlannerToProgram(adminUser, bp1, programId, planner1);
    await updatePlannerRowLink(adminUser, bp1, programId, planner1, row1, prod1, 'TOFU', { scheduled_date: '2026-08-25' });

    // 3. Test getBrandCalendarEvents
    const calendarEvents = await getBrandCalendarEvents(adminUser, bp1);
    assert.equal(calendarEvents.length, 1);
    assert.equal(calendarEvents[0].funnelStage, 'TOFU');
    assert.equal(calendarEvents[0].date, '2026-08-25');

    // 4. Test content run creation and listBrandContentRuns
    const engineCampaignId = `camp_${suffix}`;
    const runId = await createContentRun(adminUser, bp1, programId, planner1, row1, 're', engineCampaignId, null, { foo: 'bar' });
    assert.ok(runId);

    // Mock the engine campaign record for reconcile
    await pgQuery(
      `INSERT INTO re_campaigns (id, tenant_id, campaign_name, status, brand_profile_id) VALUES ($1, $2, $3, $4, $5)`,
      [engineCampaignId, testTenant, 'Mock Campaign', 'completed', bp1]
    );

    const brandRuns = await listBrandContentRuns(adminUser, bp1);
    assert.equal(brandRuns.length, 1);
    assert.equal(brandRuns[0].id, runId);
    assert.equal(brandRuns[0].normalizedStatus, 'Planned'); // initial status

    // 5. Test reconcileBrandRuns
    const reconcileSuccess = await reconcileBrandRuns(adminUser, bp1);
    assert.ok(reconcileSuccess);

    const brandRunsAfterReconcile = await listBrandContentRuns(adminUser, bp1);
    assert.equal(brandRunsAfterReconcile[0].normalizedStatus, 'Ready'); // projected from 'completed'

    // 6. Test performance
    await importPerformanceSnapshots(adminUser, bp1, programId, [
      { runId, platform: 'tiktok', views: 100, likes: 10, clicks: 5, conversions: 2, revenue: 150000.00 }
    ]);

    const performanceSummary = await getBrandPerformanceSummary(adminUser, bp1);
    assert.ok(performanceSummary);
    assert.equal(performanceSummary.total_views, 100);
    assert.equal(performanceSummary.total_likes, 10);
    assert.equal(performanceSummary.total_clicks, 5);
    assert.equal(performanceSummary.total_conversions, 2);
    assert.equal(Number(performanceSummary.total_revenue), 150000.00);

  } finally {
    // Clean up
    await pgQuery(`DELETE FROM affiliate_performance_snapshots WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM affiliate_content_runs WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM affiliate_planner_row_links WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM affiliate_program_planners WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM affiliate_program_products WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM affiliate_programs WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM re_campaigns WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM content_planner_rows WHERE planner_id = $1`, [planner1]);
    await pgQuery(`DELETE FROM content_planners WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM brand_profiles WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM tenants WHERE id = $1`, [testTenant]);
  }
});
