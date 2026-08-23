import { mock } from 'node:test';
mock.module('server-only', { default: {} });

import test from 'node:test';
import assert from 'node:assert/strict';
import { pgQuery } from '../lib/db-pg.js';

test('content planner connection adapter, metrics, and calendar integrations', async () => {
  const {
    createCampaignProgram,
    addProductsToCampaignProgram
  } = await import('../lib/affiliate-studio-campaign-program-adapter.js');

  const {
    linkPlannerToProgram,
    unlinkPlannerFromProgram,
    listLinkedProgramPlanners,
    listAvailableBrandPlanners,
    getPlannerRowLinks,
    updatePlannerRowLink,
    getProgramCoverageSummary,
    getProgramCalendarEvents
  } = await import('../lib/affiliate-studio-planner-adapter.js');

  const suffix = Date.now();
  const testTenant = `tenant_cpn_${suffix}`;
  const bp1 = `bp_cpn_1_${suffix}`;
  
  const planner1 = `plan_cpn_1_${suffix}`;
  const planner2 = `plan_cpn_2_${suffix}`;

  const row1 = `row_cpn_1_${suffix}`;
  const row2 = `row_cpn_2_${suffix}`;

  const p1Id = `p_cpn_1_${suffix}`;

  // Pre-cleanup
  await pgQuery(`DELETE FROM content_planner_rows WHERE planner_id IN ($1, $2)`, [planner1, planner2]);
  await pgQuery(`DELETE FROM content_planners WHERE tenant_id = $1`, [testTenant]);
  await pgQuery(`DELETE FROM brand_products WHERE tenant_id = $1`, [testTenant]);
  await pgQuery(`DELETE FROM product_extractions WHERE tenant_id = $1`, [testTenant]);
  await pgQuery(`DELETE FROM affiliate_programs WHERE tenant_id = $1`, [testTenant]);
  await pgQuery(`DELETE FROM brand_profiles WHERE tenant_id = $1`, [testTenant]);
  await pgQuery(`DELETE FROM tenants WHERE id = $1`, [testTenant]);

  // Seed
  await pgQuery(`INSERT INTO tenants (id, name) VALUES ($1, $2)`, [testTenant, 'CPN Tenant']);
  await pgQuery(`INSERT INTO brand_profiles (id, tenant_id, brand_name) VALUES ($1, $2, $3)`, [bp1, testTenant, 'Nutriblend']);
  
  await pgQuery(
    `INSERT INTO content_planners (id, tenant_id, brand_id, title, status) VALUES
     ($1, $2, $3, $4, $5),
     ($6, $7, $8, $9, $10)`,
    [planner1, testTenant, bp1, 'Nutriblend Q1 Editorial', 'completed',
     planner2, testTenant, bp1, 'Nutriblend Q2 Editorial', 'completed']
  );

  await pgQuery(
    `INSERT INTO content_planner_rows (id, planner_id, sequence, pillar, category_cep, ws_matrix, context, vfo, strategic_angle, hook, visual_action, product) VALUES
     ($1, $2, 1, 'Pilar A', 'Cat A', 'Matrix A', 'Context A', 'VFO A', 'Angle A', 'Hook A', 'Action A', 'Product A'),
     ($3, $4, 2, 'Pilar B', 'Cat B', 'Matrix B', 'Context B', 'VFO B', 'Angle B', 'Hook B', 'Action B', 'Product B')`,
    [row1, planner1, row2, planner1]
  );

  await pgQuery(
    `INSERT INTO product_extractions (id, tenant_id, product_name, category) VALUES ($1, $2, $3, $4)`,
    [p1Id, testTenant, 'Nutri Powder', 'Supplement']
  );

  await pgQuery(
    `INSERT INTO brand_products (id, tenant_id, brand_profile_id, product_id, affiliate_link, is_active) VALUES
     ($1, $2, $3, $4, $5, $6)`,
    [`bp_assoc_${suffix}`, testTenant, bp1, p1Id, 'https://aff.link/nutri', true]
  );

  try {
    const adminUser = { id: 'usr_admin', role: 'admin', tenantId: testTenant };

    // Create program
    const programId = await createCampaignProgram(adminUser, bp1, {
      name: 'Nutri Launch Kampanye',
      funnelMix: { tofu: 40, mofu: 40, bofu: 20 },
      platforms: ['tiktok', 'youtube'],
      productionTarget: 5
    });
    assert.ok(programId);

    // Bind product to program
    await addProductsToCampaignProgram(adminUser, bp1, programId, [p1Id]);

    // 1. List Available Planners before linking
    const available = await listAvailableBrandPlanners(adminUser, bp1, programId);
    assert.equal(available.length, 2);
    assert.ok(available.find(a => a.id === planner1));

    // 2. Link planner1 to campaign program
    const linkOk = await linkPlannerToProgram(adminUser, bp1, programId, planner1);
    assert.equal(linkOk, true);

    // After linking, available unlinked planners should count 1
    const availableAfter = await listAvailableBrandPlanners(adminUser, bp1, programId);
    assert.equal(availableAfter.length, 1);
    assert.equal(availableAfter[0].id, planner2);

    // 3. List linked planners
    const linked = await listLinkedProgramPlanners(adminUser, bp1, programId);
    assert.equal(linked.length, 1);
    assert.equal(linked[0].id, planner1);
    assert.equal(linked[0].totalRows, 2);
    assert.equal(linked[0].linkedRows, 0); // No rows configured yet

    // 4. Configure/Update row mappings
    const programProducts = (await pgQuery(
      `SELECT id FROM affiliate_program_products WHERE tenant_id = $1 AND affiliate_program_id = $2`,
      [testTenant, programId]
    )).rows;
    const progProductId = programProducts[0].id;

    const rowLinks = await getPlannerRowLinks(adminUser, bp1, programId, planner1);
    assert.equal(rowLinks.length, 2);

    const updateRow1Ok = await updatePlannerRowLink(
      adminUser,
      bp1,
      programId,
      planner1,
      row1,
      progProductId,
      'TOFU',
      { scheduled_date: '2026-09-01' }
    );
    assert.equal(updateRow1Ok, true);

    const updateRow2Ok = await updatePlannerRowLink(
      adminUser,
      bp1,
      programId,
      planner1,
      row2,
      progProductId,
      'BOFU',
      { scheduled_date: '2026-09-03' }
    );
    assert.equal(updateRow2Ok, true);

    // Verify row links counts updated
    const linkedAfterConfig = await listLinkedProgramPlanners(adminUser, bp1, programId);
    assert.equal(linkedAfterConfig[0].linkedRows, 2);

    // 5. Assert Coverage Summary Dashboard
    const coverage = await getProgramCoverageSummary(adminUser, bp1, programId);
    assert.ok(coverage);
    assert.equal(coverage.production.actual, 2);
    assert.equal(coverage.production.target, 5);
    assert.equal(coverage.production.progressPercent, 40);

    assert.equal(coverage.products.total, 1);
    assert.equal(coverage.products.linked, 1);
    assert.equal(coverage.products.progressPercent, 100);

    assert.deepEqual(coverage.funnel.target, { tofu: 40, mofu: 40, bofu: 20 });
    // TOFU: 1 row (50%), BOFU: 1 row (50%), MOFU: 0 row
    assert.deepEqual(coverage.funnel.actual, { tofu: 50, mofu: 0, bofu: 50 });

    // 6. Assert Calendar Events
    const calendar = await getProgramCalendarEvents(adminUser, bp1, programId);
    assert.equal(calendar.length, 2);
    
    const ev1 = calendar.find(c => c.date === '2026-09-01');
    assert.ok(ev1);
    assert.equal(ev1.funnelStage, 'TOFU');
    assert.equal(ev1.category, 'Cat A');

    const ev2 = calendar.find(c => c.date === '2026-09-03');
    assert.ok(ev2);
    assert.equal(ev2.funnelStage, 'BOFU');
    assert.equal(ev2.category, 'Cat B');

    // 7. Unlink planner and verify cleanup
    const unlinkOk = await unlinkPlannerFromProgram(adminUser, bp1, programId, planner1);
    assert.equal(unlinkOk, true);

    const emptyLinked = await listLinkedProgramPlanners(adminUser, bp1, programId);
    assert.equal(emptyLinked.length, 0);

    // Check row links also deleted
    const leftoverLinks = (await pgQuery(
      `SELECT * FROM affiliate_planner_row_links WHERE tenant_id = $1 AND affiliate_program_id = $2`,
      [testTenant, programId]
    )).rows;
    assert.equal(leftoverLinks.length, 0);

  } finally {
    // Cleanup
    await pgQuery(`DELETE FROM content_planner_rows WHERE planner_id IN ($1, $2)`, [planner1, planner2]);
    await pgQuery(`DELETE FROM content_planners WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM brand_products WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM product_extractions WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM affiliate_programs WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM brand_profiles WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM tenants WHERE id = $1`, [testTenant]);
  }
});
