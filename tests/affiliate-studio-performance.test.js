import { mock } from 'node:test';
mock.module('server-only', { default: {} });

import test from 'node:test';
import assert from 'node:assert';
import { pgQuery } from '../lib/db-pg.js';

test('Fase 10 — Performance Foundation unit & integration tests', async (t) => {
  const { createCampaignProgram } = await import('../lib/affiliate-studio-campaign-program-adapter.js');
  const { linkPlannerToProgram, updatePlannerRowLink } = await import('../lib/affiliate-studio-planner-adapter.js');
  const { importPerformanceSnapshots, getProgramPerformanceSummary } = await import('../lib/affiliate-studio-performance-adapter.js');

  const suffix = Date.now();
  const testTenant = `tn_perf_${suffix}`;
  const bp1 = `bp_perf_${suffix}`;
  const planner1 = `pl_perf_${suffix}`;
  const row1 = `row_perf_${suffix}`;
  const prod1 = `prod_perf_${suffix}`;
  const run1 = `run_perf_${suffix}`;

  // Setup seed structures
  await pgQuery(`INSERT INTO tenants (id, name, status) VALUES ($1, $2, 'active')`, [testTenant, `Tenant Perf ${suffix}`]);
  await pgQuery(
    `INSERT INTO brand_profiles (id, tenant_id, brand_name) VALUES ($1, $2, $3)`,
    [bp1, testTenant, 'Nutriblend Brand']
  );
  await pgQuery(
    `INSERT INTO content_planners (id, tenant_id, brand_id, title, status) VALUES ($1, $2, $3, $4, $5)`,
    [planner1, testTenant, bp1, 'Nutriblend Planner', 'active']
  );
  await pgQuery(
    `INSERT INTO content_planner_rows (id, planner_id, sequence, pillar, category_cep, ws_matrix, context, vfo, strategic_angle, hook, visual_action, product) VALUES
     ($1, $2, 1, 'Pilar Performance', 'recipe', 'Matrix A', 'Context A', 'VFO A', 'Angle A', 'Hook A', 'Action A', 'Product A')`,
    [row1, planner1]
  );

  try {
    const adminUser = { id: 'usr_admin', role: 'admin', tenantId: testTenant };

    // Create program
    const programId = await createCampaignProgram(adminUser, bp1, {
      name: 'Nutri Performance Program',
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
        prod1, testTenant, programId, 'bp_prod_perf', 'bp_prod_perf', 
        JSON.stringify({ productId: 'bp_prod_perf', name: 'Nutriblend Oil', affiliate: { link: 'http://aff.link' } })
      ]
    );

    // Link planners & associate row
    await linkPlannerToProgram(adminUser, bp1, programId, planner1);
    await updatePlannerRowLink(adminUser, bp1, programId, planner1, row1, prod1, 'BOFU');

    // Create a run in 'Launched' status
    const engineCampaignId = `camp_aff_perf_${suffix}`;
    const engineItemId = `item_aff_perf_${suffix}`;
    await pgQuery(
      `INSERT INTO affiliate_content_runs (
         id, tenant_id, brand_profile_id, affiliate_program_id, content_planner_id, planner_row_id,
         engine_type, engine_campaign_id, engine_item_id, normalized_status, product_snapshot_json
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        run1, testTenant, bp1, programId, planner1, row1, 
        're', engineCampaignId, engineItemId, 'Published',
        JSON.stringify({ productId: 'bp_prod_perf', name: 'Nutriblend Oil', affiliate: { link: 'http://aff.link' } })
      ]
    );

    // 1. Check initial summary is zero
    const summary1 = await getProgramPerformanceSummary(adminUser, bp1, programId);
    assert.deepStrictEqual(summary1, {
      total_views: 0,
      total_likes: 0,
      total_shares: 0,
      total_clicks: 0,
      total_conversions: 0,
      total_revenue: '0.00'
    });

    // 2. Import snapshots
    const snapshots = [
      {
        runId: run1,
        platform: 'tiktok',
        externalPostId: 'tiktok_post_123',
        views: 12000,
        likes: 540,
        shares: 45,
        clicks: 120,
        conversions: 6,
        revenue: 250000.00,
        currency: 'IDR',
        status: 'measured'
      }
    ];

    const importedIds = await importPerformanceSnapshots(adminUser, bp1, programId, snapshots);
    assert.equal(importedIds.length, 1);

    // 3. Check status is updated to 'Measured' on runs
    const runRes = await pgQuery(`SELECT normalized_status FROM affiliate_content_runs WHERE id = $1`, [run1]);
    assert.equal(runRes.rows[0].normalized_status, 'Measured');

    // 4. Check summary is populated correctly
    const summary2 = await getProgramPerformanceSummary(adminUser, bp1, programId);
    assert.deepStrictEqual(summary2, {
      total_views: 12000,
      total_likes: 540,
      total_shares: 45,
      total_clicks: 120,
      total_conversions: 6,
      total_revenue: '250000.00'
    });

  } finally {
    // Cleanup
    await pgQuery(`DELETE FROM affiliate_performance_snapshots WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM affiliate_content_runs WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM content_planner_rows WHERE planner_id = $1`, [planner1]);
    await pgQuery(`DELETE FROM content_planners WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM affiliate_programs WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM brand_profiles WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM tenants WHERE id = $1`, [testTenant]);
  }
});
