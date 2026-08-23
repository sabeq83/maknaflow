import { mock } from 'node:test';
mock.module('server-only', { default: {} });

import test from 'node:test';
import assert from 'node:assert/strict';
import { pgQuery } from '../lib/db-pg.js';

test('creative intelligence campaign bindings launch validation', async () => {
  const {
    createCampaignProgram
  } = await import('../lib/affiliate-studio-campaign-program-adapter.js');

  const {
    linkPlannerToProgram,
    updatePlannerRowLink
  } = await import('../lib/affiliate-studio-planner-adapter.js');

  const {
    launchEngineCampaign
  } = await import('../lib/affiliate-studio-launch-adapter.js');

  const suffix = Date.now();
  const testTenant = `tenant_cr_${suffix}`;
  const bp1 = `bp_cr_1_${suffix}`;
  const planner1 = `plan_cr_1_${suffix}`;
  const row1 = `row_cr_1_${suffix}`;
  const prodLink = `prod_cr_link_${suffix}`;

  // Pre-cleanup
  await pgQuery(`DELETE FROM content_planner_rows WHERE planner_id = $1`, [planner1]);
  await pgQuery(`DELETE FROM content_planners WHERE tenant_id = $1`, [testTenant]);
  await pgQuery(`DELETE FROM affiliate_programs WHERE tenant_id = $1`, [testTenant]);
  await pgQuery(`DELETE FROM brand_profiles WHERE tenant_id = $1`, [testTenant]);
  await pgQuery(`DELETE FROM tenants WHERE id = $1`, [testTenant]);

  // Seed
  await pgQuery(`INSERT INTO tenants (id, name) VALUES ($1, $2)`, [testTenant, 'Creative Tenant']);
  await pgQuery(`INSERT INTO brand_profiles (id, tenant_id, brand_name) VALUES ($1, $2, $3)`, [bp1, testTenant, 'Nutriblend Creative']);
  
  await pgQuery(
    `INSERT INTO content_planners (id, tenant_id, brand_id, title, status) VALUES ($1, $2, $3, $4, $5)`,
    [planner1, testTenant, bp1, 'Nutriblend Creative Editorial', 'completed']
  );

  await pgQuery(
    `INSERT INTO content_planner_rows (id, planner_id, sequence, pillar, category_cep, ws_matrix, context, vfo, strategic_angle, hook, visual_action, product) VALUES
     ($1, $2, 1, 'Pilar A', 'Cat A', 'Matrix A', 'Context A', 'VFO A', 'Angle A', 'Hook A', 'Action A', 'Product A')`,
    [row1, planner1]
  );

  try {
    const adminUser = { id: 'usr_admin', role: 'admin', tenantId: testTenant };

    // Create program with creative parameters
    const programId = await createCampaignProgram(adminUser, bp1, {
      name: 'Nutri Creative Kampanye',
      funnelMix: { tofu: 40, mofu: 40, bofu: 20 },
      platforms: ['tiktok'],
      productionTarget: 5,
      objective: 'Launch organic multivitamin conversion',
      targetDemographic: 'Youth 18-24 years',
      aiDirective: 'Engaging, energetic and humorous tone',
      mandatoryOutroLine: 'Buy Nutriblend on discount link in bio!'
    });
    assert.ok(programId);

    // Link products
    await pgQuery(
      `INSERT INTO affiliate_program_products (id, tenant_id, affiliate_program_id, product_id, brand_product_id, product_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        prodLink, testTenant, programId, 'bp_prod_link', 'bp_prod_link', 
        JSON.stringify({ productId: 'bp_prod_link', name: 'Product With Link', affiliate: { link: 'https://shopee.co.id/product_ok' } })
      ]
    );

    // Link planners
    await linkPlannerToProgram(adminUser, bp1, programId, planner1);
    await updatePlannerRowLink(adminUser, bp1, programId, planner1, row1, prodLink, 'TOFU');

    // Launch campaign
    const launchResult = await launchEngineCampaign(adminUser, bp1, programId, planner1, row1, 're');
    assert.ok(launchResult.runId);

    // Verify inserted campaign creative configuration matches program parameters
    const reCampaign = (await pgQuery(`SELECT * FROM re_campaigns WHERE id = $1`, [launchResult.engineCampaignId])).rows[0];
    assert.ok(reCampaign);
    assert.equal(reCampaign.target_demographic, 'Youth 18-24 years');
    assert.equal(reCampaign.ai_directive, 'Engaging, energetic and humorous tone');
    assert.equal(reCampaign.mandatory_outro_line, 'Buy Nutriblend on discount link in bio!');
    assert.equal(reCampaign.custom_instruction, 'Launch organic multivitamin conversion');

  } finally {
    // Cleanup
    await pgQuery(`DELETE FROM content_planner_rows WHERE planner_id = $1`, [planner1]);
    await pgQuery(`DELETE FROM content_planners WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM affiliate_programs WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM brand_profiles WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM tenants WHERE id = $1`, [testTenant]);
  }
});
