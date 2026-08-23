import { mock } from 'node:test';
mock.module('server-only', { default: {} });

import test from 'node:test';
import assert from 'node:assert/strict';
import { pgQuery } from '../lib/db-pg.js';

test('smart route recommendation logic and audit logging', async () => {
  const {
    createCampaignProgram
  } = await import('../lib/affiliate-studio-campaign-program-adapter.js');

  const {
    linkPlannerToProgram,
    updatePlannerRowLink
  } = await import('../lib/affiliate-studio-planner-adapter.js');

  const {
    getSmartRouteRecommendation
  } = await import('../lib/affiliate-studio-recommendation-adapter.js');

  const suffix = Date.now();
  const testTenant = `tenant_rec_${suffix}`;
  const bp1 = `bp_rec_1_${suffix}`;
  const planner1 = `plan_rec_1_${suffix}`;
  const rowRecipe = `row_rec_recipe_${suffix}`;
  const rowEdu = `row_rec_edu_${suffix}`;
  const rowUnlinked = `row_rec_unlinked_${suffix}`;

  const prodFood = `prod_rec_food_${suffix}`;
  const prodEdu = `prod_rec_edu_${suffix}`;

  // Pre-cleanup
  await pgQuery(`DELETE FROM content_planner_rows WHERE planner_id = $1`, [planner1]);
  await pgQuery(`DELETE FROM content_planners WHERE tenant_id = $1`, [testTenant]);
  await pgQuery(`DELETE FROM affiliate_programs WHERE tenant_id = $1`, [testTenant]);
  await pgQuery(`DELETE FROM brand_profiles WHERE tenant_id = $1`, [testTenant]);
  await pgQuery(`DELETE FROM tenants WHERE id = $1`, [testTenant]);

  // Seed
  await pgQuery(`INSERT INTO tenants (id, name) VALUES ($1, $2)`, [testTenant, 'Recommendations Tenant']);
  await pgQuery(`INSERT INTO brand_profiles (id, tenant_id, brand_name) VALUES ($1, $2, $3)`, [bp1, testTenant, 'Nutriblend Recs']);
  
  await pgQuery(
    `INSERT INTO content_planners (id, tenant_id, brand_id, title, status) VALUES ($1, $2, $3, $4, $5)`,
    [planner1, testTenant, bp1, 'Nutriblend Recs Editorial', 'completed']
  );

  await pgQuery(
    `INSERT INTO content_planner_rows (id, planner_id, sequence, pillar, category_cep, ws_matrix, context, vfo, strategic_angle, hook, visual_action, product) VALUES
     ($1, $2, 1, 'Pilar Food', 'recipe', 'Matrix A', 'Context A', 'VFO A', 'Angle A', 'Hook A', 'Action A', 'Product A'),
     ($3, $2, 2, 'education', 'tips', 'Matrix B', 'Context B', 'VFO B', 'Angle B', 'Hook B', 'Action B', 'Product B'),
     ($4, $2, 3, 'Pilar C', 'general', 'Matrix C', 'Context C', 'VFO C', 'Angle C', 'Hook C', 'Action C', 'Product C')`,
    [rowRecipe, planner1, rowEdu, rowUnlinked]
  );

  try {
    const adminUser = { id: 'usr_admin', role: 'admin', tenantId: testTenant };

    // Create program
    const programId = await createCampaignProgram(adminUser, bp1, {
      name: 'Nutri Recs Kampanye',
      funnelMix: { tofu: 40, mofu: 40, bofu: 20 },
      platforms: ['tiktok'],
      productionTarget: 5
    });
    assert.ok(programId);

    // Link products
    await pgQuery(
      `INSERT INTO affiliate_program_products (id, tenant_id, affiliate_program_id, product_id, brand_product_id, product_snapshot)
       VALUES 
       ($1, $2, $3, $4, $5, $6),
       ($7, $8, $9, $10, $11, $12)`,
      [
        prodFood, testTenant, programId, 'bp_prod_food', 'bp_prod_food', 
        JSON.stringify({ productId: 'bp_prod_food', name: 'Nutriblend Cooking Bumbu', affiliate: { link: 'http://aff' } }),
        prodEdu, testTenant, programId, 'bp_prod_edu', 'bp_prod_edu', 
        JSON.stringify({ productId: 'bp_prod_edu', name: 'Educate E-Book', affiliate: { link: 'http://aff' } })
      ]
    );

    // Link planners
    await linkPlannerToProgram(adminUser, bp1, programId, planner1);
    
    // Associate rows
    await updatePlannerRowLink(adminUser, bp1, programId, planner1, rowRecipe, prodFood, 'BOFU');
    await updatePlannerRowLink(adminUser, bp1, programId, planner1, rowEdu, prodEdu, 'MOFU');

    // 1. Get recommendation for Recipe row (BOFU + recipe category + bumbu name) -> expect 'recipe'
    const recRecipe = await getSmartRouteRecommendation(adminUser, bp1, programId, planner1, rowRecipe);
    assert.equal(recRecipe.recommendedEngine, 'recipe');
    assert.match(recRecipe.reasoning, /Recipe Labs/);

    // 2. Get recommendation for Edu row (MOFU + education pillar) -> expect 'pillar'
    const recEdu = await getSmartRouteRecommendation(adminUser, bp1, programId, planner1, rowEdu);
    assert.equal(recEdu.recommendedEngine, 'pillar');
    assert.match(recEdu.reasoning, /Pillar Campaign/);

    // 3. Get recommendation for Unlinked row -> expect default 're'
    const recUnlinked = await getSmartRouteRecommendation(adminUser, bp1, programId, planner1, rowUnlinked);
    assert.equal(recUnlinked.recommendedEngine, 're');

    // Verify audit logs
    const logs = (await pgQuery(
      `SELECT * FROM affiliate_program_events WHERE tenant_id = $1 AND event_type = 'route_recommended'`,
      [testTenant]
    )).rows;
    assert.equal(logs.length, 2); // 2 linked calls logged event

  } finally {
    // Cleanup
    await pgQuery(`DELETE FROM content_planner_rows WHERE planner_id = $1`, [planner1]);
    await pgQuery(`DELETE FROM content_planners WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM affiliate_programs WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM brand_profiles WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM tenants WHERE id = $1`, [testTenant]);
  }
});
