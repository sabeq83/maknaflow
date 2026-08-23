import { mock } from 'node:test';
mock.module('server-only', { default: {} });

import test from 'node:test';
import assert from 'node:assert';
import { pgQuery } from '../lib/db-pg.js';

test('Fase 11 — Insight & Learning Loop unit & integration tests', async (t) => {
  const { createCampaignProgram } = await import('../lib/affiliate-studio-campaign-program-adapter.js');
  const { linkPlannerToProgram, updatePlannerRowLink } = await import('../lib/affiliate-studio-planner-adapter.js');
  const { importPerformanceSnapshots } = await import('../lib/affiliate-studio-performance-adapter.js');
  const { getProgramCreativeInsights } = await import('../lib/affiliate-studio-insight-adapter.js');

  const suffix = Date.now();
  const testTenant = `tn_ins_${suffix}`;
  const bp1 = `bp_ins_${suffix}`;
  const planner1 = `pl_ins_${suffix}`;
  const row1 = `row_ins_1_${suffix}`;
  const row2 = `row_ins_2_${suffix}`;
  const prod1 = `prod_ins_${suffix}`;
  const run1 = `run_ins_1_${suffix}`;
  const run2 = `run_ins_2_${suffix}`;

  // Setup seed structures
  await pgQuery(`INSERT INTO tenants (id, name, status) VALUES ($1, $2, 'active')`, [testTenant, `Tenant Insights ${suffix}`]);
  await pgQuery(`INSERT INTO brand_profiles (id, tenant_id, brand_name) VALUES ($1, $2, $3)`, [bp1, testTenant, 'Nutriblend Brand']);
  await pgQuery(
    `INSERT INTO content_planners (id, tenant_id, brand_id, title, status) VALUES ($1, $2, $3, $4, 'active')`,
    [planner1, testTenant, bp1, 'Nutriblend Planner']
  );
  await pgQuery(
    `INSERT INTO content_planner_rows (id, planner_id, sequence, pillar, category_cep, ws_matrix, context, vfo, strategic_angle, hook, visual_action, product) VALUES
     ($1, $2, 1, 'Pilar A', 'recipe', 'Matrix A', 'Context A', 'VFO A', 'Angle A', 'Hook Top', 'Action A', 'Product A'),
     ($3, $4, 2, 'Pilar B', 'recipe', 'Matrix B', 'Context B', 'VFO B', 'Angle B', 'Hook Low', 'Action B', 'Product B')`,
    [row1, planner1, row2, planner1]
  );

  try {
    const adminUser = { id: 'usr_admin', role: 'admin', tenantId: testTenant };

    // Create program
    const programId = await createCampaignProgram(adminUser, bp1, {
      name: 'Nutri Insights Program',
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
        prod1, testTenant, programId, 'bp_prod_ins', 'bp_prod_ins', 
        JSON.stringify({ productId: 'bp_prod_ins', name: 'Nutriblend Sauce', affiliate: { link: 'http://aff.link' } })
      ]
    );

    // Link planners & associate rows
    await linkPlannerToProgram(adminUser, bp1, programId, planner1);
    await updatePlannerRowLink(adminUser, bp1, programId, planner1, row1, prod1, 'TOFU');
    await updatePlannerRowLink(adminUser, bp1, programId, planner1, row2, prod1, 'BOFU');

    // Create content runs
    const engineCampaignId = `camp_aff_ins_${suffix}`;
    const engineItemId1 = `item_aff_ins_1_${suffix}`;
    const engineItemId2 = `item_aff_ins_2_${suffix}`;

    await pgQuery(
      `INSERT INTO affiliate_content_runs (
         id, tenant_id, brand_profile_id, affiliate_program_id, content_planner_id, planner_row_id,
         engine_type, engine_campaign_id, engine_item_id, normalized_status, product_snapshot_json
       ) VALUES 
       ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Published', $10),
       ($11, $2, $3, $4, $5, $12, $7, $8, $13, 'Published', $10)`,
      [
        run1, testTenant, bp1, programId, planner1, row1, 
        're', engineCampaignId, engineItemId1, 
        JSON.stringify({ productId: 'bp_prod_ins', name: 'Nutriblend Sauce', affiliate: { link: 'http://aff.link' } }),
        run2, row2, engineItemId2
      ]
    );

    // Import snapshots with different performance levels
    const snapshots = [
      {
        runId: run1,
        platform: 'tiktok',
        externalPostId: 'tiktok_post_1',
        views: 20000,
        likes: 1000,
        shares: 100,
        clicks: 500,
        conversions: 20,
        revenue: 1000000.00,
        currency: 'IDR',
        status: 'measured'
      },
      {
        runId: run2,
        platform: 'tiktok',
        externalPostId: 'tiktok_post_2',
        views: 5000,
        likes: 200,
        shares: 10,
        clicks: 50,
        conversions: 2,
        revenue: 100000.00,
        currency: 'IDR',
        status: 'measured'
      }
    ];

    await importPerformanceSnapshots(adminUser, bp1, programId, snapshots);

    // Retrieve insights
    const insights = await getProgramCreativeInsights(adminUser, bp1, programId);
    assert.ok(insights);

    // Verify hooks are ordered by avgViews descending
    assert.equal(insights.hooks.length, 2);
    assert.equal(insights.hooks[0].hook, 'Hook Top');
    assert.equal(insights.hooks[0].avgViews, 20000);
    assert.equal(insights.hooks[1].hook, 'Hook Low');
    assert.equal(insights.hooks[1].avgViews, 5000);

    // Verify strategic angles
    assert.equal(insights.angles.length, 2);
    assert.equal(insights.angles[0].strategicAngle, 'Angle A');
    assert.equal(insights.angles[0].avgViews, 20000);
    assert.equal(insights.angles[1].strategicAngle, 'Angle B');
    assert.equal(insights.angles[1].avgViews, 5000);

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
