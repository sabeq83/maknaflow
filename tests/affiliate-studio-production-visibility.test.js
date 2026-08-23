import { mock } from 'node:test';
mock.module('server-only', { default: {} });

import test from 'node:test';
import assert from 'node:assert/strict';
import { pgQuery } from '../lib/db-pg.js';

test('production visibility content runs, queue, and reconciliation', async () => {
  const {
    createCampaignProgram
  } = await import('../lib/affiliate-studio-campaign-program-adapter.js');

  const {
    linkPlannerToProgram,
    updatePlannerRowLink
  } = await import('../lib/affiliate-studio-planner-adapter.js');

  const {
    createContentRun,
    listProgramContentRuns,
    reconcileProgramRuns
  } = await import('../lib/affiliate-studio-production-adapter.js');

  const suffix = Date.now();
  const testTenant = `tenant_vis_${suffix}`;
  const bp1 = `bp_vis_1_${suffix}`;
  const planner1 = `plan_vis_1_${suffix}`;
  const row1 = `row_vis_1_${suffix}`;

  const mockCampaignId = `camp_legacy_${suffix}`;
  const mockItemIdNum = 9999 + Math.floor(Math.random() * 100000);
  const mockItemId = String(mockItemIdNum);

  // Pre-cleanup
  await pgQuery(`DELETE FROM content_planner_rows WHERE planner_id = $1`, [planner1]);
  await pgQuery(`DELETE FROM content_planners WHERE tenant_id = $1`, [testTenant]);
  await pgQuery(`DELETE FROM affiliate_programs WHERE tenant_id = $1`, [testTenant]);
  await pgQuery(`DELETE FROM brand_profiles WHERE tenant_id = $1`, [testTenant]);
  await pgQuery(`DELETE FROM tenants WHERE id = $1`, [testTenant]);
  await pgQuery(`DELETE FROM re_campaign_items WHERE campaign_id = $1`, [mockCampaignId]);
  await pgQuery(`DELETE FROM re_campaigns WHERE id = $1`, [mockCampaignId]);

  // Seed
  await pgQuery(`INSERT INTO tenants (id, name) VALUES ($1, $2)`, [testTenant, 'Visibility Tenant']);
  await pgQuery(`INSERT INTO brand_profiles (id, tenant_id, brand_name) VALUES ($1, $2, $3)`, [bp1, testTenant, 'Nutriblend']);
  
  await pgQuery(
    `INSERT INTO content_planners (id, tenant_id, brand_id, title, status) VALUES ($1, $2, $3, $4, $5)`,
    [planner1, testTenant, bp1, 'Nutriblend Editorial Plan', 'completed']
  );

  await pgQuery(
    `INSERT INTO content_planner_rows (id, planner_id, sequence, pillar, category_cep, ws_matrix, context, vfo, strategic_angle, hook, visual_action, product) VALUES
     ($1, $2, 1, 'Pilar A', 'Cat A', 'Matrix A', 'Context A', 'VFO A', 'Angle A', 'Hook A', 'Action A', 'Product A')`,
    [row1, planner1]
  );

  try {
    const adminUser = { id: 'usr_admin', role: 'admin', tenantId: testTenant };

    // Create program
    const programId = await createCampaignProgram(adminUser, bp1, {
      name: 'Nutri Launch Kampanye',
      funnelMix: { tofu: 40, mofu: 40, bofu: 20 },
      platforms: ['tiktok'],
      productionTarget: 5
    });
    assert.ok(programId);

    // Link planner
    await linkPlannerToProgram(adminUser, bp1, programId, planner1);
    await updatePlannerRowLink(adminUser, bp1, programId, planner1, row1, null, 'TOFU');

    // 1. Create run reference
    const runId = await createContentRun(
      adminUser,
      bp1,
      programId,
      planner1,
      row1,
      're',
      mockCampaignId,
      mockItemId,
      { test_ref: true }
    );
    assert.ok(runId);

    // Verify list runs has the newly created run
    const runs = await listProgramContentRuns(adminUser, bp1, programId);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].id, runId);
    assert.equal(runs[0].normalizedStatus, 'Planned');
    assert.equal(runs[0].engineType, 're');
    assert.equal(runs[0].engineCampaignId, mockCampaignId);
    assert.equal(runs[0].engineItemId, mockItemId);
    assert.equal(runs[0].deepLink, `/re-campaigns/${mockCampaignId}`);

    // Seed mock legacy campaign in DB
    await pgQuery(
      `INSERT INTO re_campaigns (id, tenant_id, campaign_name, status) VALUES ($1, $2, $3, $4)`,
      [mockCampaignId, testTenant, 'Mock Legacy Campaign', 'running']
    );

    await pgQuery(
      `INSERT INTO re_campaign_items (id, campaign_id, source_url, ffmpeg_status, visual_status) VALUES ($1, $2, $3, $4, $5)`,
      [mockItemId, mockCampaignId, 'http://source.url', 'processing', 'completed']
    );

    // 2. Perform reconciliation
    const reconOk = await reconcileProgramRuns(adminUser, bp1, programId);
    assert.equal(reconOk, true);

    // Check status projected to Rendering (since ffmpeg_status is processing)
    const runsAfterRecon = await listProgramContentRuns(adminUser, bp1, programId);
    assert.equal(runsAfterRecon[0].normalizedStatus, 'Rendering');

    // Update item ffmpeg status to completed and check again
    await pgQuery(
      `UPDATE re_campaign_items SET ffmpeg_status = 'completed' WHERE id = $1 AND campaign_id = $2`,
      [mockItemId, mockCampaignId]
    );

    await reconcileProgramRuns(adminUser, bp1, programId);

    const runsAfterReconCompleted = await listProgramContentRuns(adminUser, bp1, programId);
    assert.equal(runsAfterReconCompleted[0].normalizedStatus, 'Ready');

  } finally {
    // Cleanup
    await pgQuery(`DELETE FROM content_planner_rows WHERE planner_id = $1`, [planner1]);
    await pgQuery(`DELETE FROM content_planners WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM affiliate_programs WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM brand_profiles WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM tenants WHERE id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM re_campaign_items WHERE campaign_id = $1`, [mockCampaignId]);
    await pgQuery(`DELETE FROM re_campaigns WHERE id = $1`, [mockCampaignId]);
  }
});
