import { mock } from 'node:test';
mock.module('server-only', { default: {} });

import test from 'node:test';
import assert from 'node:assert/strict';
import { pgQuery } from '../lib/db-pg.js';

test('launch connectors preflight, trigger, and idempotency validation', async () => {
  const {
    createCampaignProgram,
    associateProductsToProgram
  } = await import('../lib/affiliate-studio-campaign-program-adapter.js');

  const {
    linkPlannerToProgram,
    updatePlannerRowLink
  } = await import('../lib/affiliate-studio-planner-adapter.js');

  const {
    preflightCheck,
    launchEngineCampaign
  } = await import('../lib/affiliate-studio-launch-adapter.js');

  const suffix = Date.now();
  const testTenant = `tenant_launch_${suffix}`;
  const bp1 = `bp_launch_1_${suffix}`;
  const planner1 = `plan_launch_1_${suffix}`;
  const row1 = `row_launch_1_${suffix}`;
  const rowNoLink = `row_launch_nolink_${suffix}`;

  const prodLink = `prod_launch_link_${suffix}`;
  const prodNoLink = `prod_launch_nolink_${suffix}`;

  // Pre-cleanup
  await pgQuery(`DELETE FROM content_planner_rows WHERE planner_id = $1`, [planner1]);
  await pgQuery(`DELETE FROM content_planners WHERE tenant_id = $1`, [testTenant]);
  await pgQuery(`DELETE FROM affiliate_programs WHERE tenant_id = $1`, [testTenant]);
  await pgQuery(`DELETE FROM brand_profiles WHERE tenant_id = $1`, [testTenant]);
  await pgQuery(`DELETE FROM tenants WHERE id = $1`, [testTenant]);

  // Seed
  await pgQuery(`INSERT INTO tenants (id, name) VALUES ($1, $2)`, [testTenant, 'Launch Connectors Tenant']);
  await pgQuery(`INSERT INTO brand_profiles (id, tenant_id, brand_name) VALUES ($1, $2, $3)`, [bp1, testTenant, 'Nutriblend Launch']);
  
  await pgQuery(
    `INSERT INTO content_planners (id, tenant_id, brand_id, title, status) VALUES ($1, $2, $3, $4, $5)`,
    [planner1, testTenant, bp1, 'Nutriblend Launch Editorial', 'completed']
  );

  await pgQuery(
    `INSERT INTO content_planner_rows (id, planner_id, sequence, pillar, category_cep, ws_matrix, context, vfo, strategic_angle, hook, visual_action, product) VALUES
     ($1, $2, 1, 'Pilar A', 'Cat A', 'Matrix A', 'Context A', 'VFO A', 'Angle A', 'Hook A', 'Action A', 'Product A'),
     ($3, $2, 2, 'Pilar B', 'Cat B', 'Matrix B', 'Context B', 'VFO B', 'Angle B', 'Hook B', 'Action B', 'Product B')`,
    [row1, planner1, rowNoLink]
  );

  try {
    const adminUser = { id: 'usr_admin', role: 'admin', tenantId: testTenant };

    // Create program
    const programId = await createCampaignProgram(adminUser, bp1, {
      name: 'Nutri Expert Kampanye',
      funnelMix: { tofu: 40, mofu: 40, bofu: 20 },
      platforms: ['tiktok'],
      productionTarget: 5
    });
    assert.ok(programId);

    // Link products (one with link, one without)
    await pgQuery(
      `INSERT INTO affiliate_program_products (id, tenant_id, affiliate_program_id, product_id, brand_product_id, product_snapshot)
       VALUES 
       ($1, $2, $3, $4, $5, $6),
       ($7, $8, $9, $10, $11, $12)`,
      [
        prodLink, testTenant, programId, 'bp_prod_link', 'bp_prod_link', 
        JSON.stringify({ productId: 'bp_prod_link', name: 'Product With Link', affiliate: { link: 'https://shopee.co.id/product_ok' } }),
        prodNoLink, testTenant, programId, 'bp_prod_nolink', 'bp_prod_nolink', 
        JSON.stringify({ productId: 'bp_prod_nolink', name: 'Product Without Link', affiliate: {} })
      ]
    );

    // Link planners
    await linkPlannerToProgram(adminUser, bp1, programId, planner1);
    
    // Associate row 1 with linked product, row 2 with unlinked product
    await updatePlannerRowLink(adminUser, bp1, programId, planner1, row1, prodLink, 'TOFU');
    await updatePlannerRowLink(adminUser, bp1, programId, planner1, rowNoLink, prodNoLink, 'MOFU');

    // 1. Preflight check for row with no affiliate link
    const checkNoLink = await preflightCheck(adminUser, bp1, programId, planner1, rowNoLink);
    assert.equal(checkNoLink.ok, false);
    assert.match(checkNoLink.error, /missing a resolved affiliate link/);

    // 2. Preflight check for row with valid link
    const checkOk = await preflightCheck(adminUser, bp1, programId, planner1, row1);
    assert.equal(checkOk.ok, true);

    // 3. Launch campaign (RE engine)
    const launchResult = await launchEngineCampaign(adminUser, bp1, programId, planner1, row1, 're');
    assert.ok(launchResult.runId);
    assert.ok(launchResult.engineCampaignId);
    assert.ok(launchResult.engineItemId);

    // Verify campaign and item insertions in legacy table
    const reCampaign = (await pgQuery(`SELECT * FROM re_campaigns WHERE id = $1`, [launchResult.engineCampaignId])).rows[0];
    assert.ok(reCampaign);
    assert.equal(reCampaign.tenant_id, testTenant);
    assert.equal(reCampaign.target_product_id, 'bp_prod_link');

    const reItem = (await pgQuery(`SELECT * FROM re_campaign_items WHERE campaign_id = $1 AND id = $2`, [launchResult.engineCampaignId, launchResult.engineItemId])).rows[0];
    assert.ok(reItem);

    // 4. Test Idempotency: Triggering launch again on same row should fail
    const checkIdempotency = await preflightCheck(adminUser, bp1, programId, planner1, row1);
    assert.equal(checkIdempotency.ok, false);
    assert.match(checkIdempotency.error, /already in progress/);

    await assert.rejects(
      async () => {
        await launchEngineCampaign(adminUser, bp1, programId, planner1, row1, 're');
      },
      /already in progress/
    );

  } finally {
    // Cleanup
    await pgQuery(`DELETE FROM content_planner_rows WHERE planner_id = $1`, [planner1]);
    await pgQuery(`DELETE FROM content_planners WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM affiliate_programs WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM brand_profiles WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM tenants WHERE id = $1`, [testTenant]);
  }
});
