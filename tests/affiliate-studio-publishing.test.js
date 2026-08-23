import { mock } from 'node:test';
mock.module('server-only', { default: {} });

import test from 'node:test';
import assert from 'node:assert/strict';
import { pgQuery } from '../lib/db-pg.js';

test('publishing connection preflight checks and status projection', async () => {
  const {
    createCampaignProgram
  } = await import('../lib/affiliate-studio-campaign-program-adapter.js');

  const {
    linkPlannerToProgram,
    updatePlannerRowLink
  } = await import('../lib/affiliate-studio-planner-adapter.js');

  const {
    getPublishingPreflight,
    projectPublishingStatus
  } = await import('../lib/affiliate-studio-publishing-adapter.js');

  const suffix = Date.now();
  const testTenant = `tenant_pub_${suffix}`;
  const bp1 = `bp_pub_1_${suffix}`;
  const planner1 = `plan_pub_1_${suffix}`;
  const row1 = `row_pub_1_${suffix}`;
  const prod1 = `prod_pub_1_${suffix}`;
  const run1 = `run_pub_1_${suffix}`;
  const job1 = `job_pub_1_${suffix}`;
  const account1 = `acc_pub_1_${suffix}`;

  // Pre-cleanup
  await pgQuery(`DELETE FROM publishing_jobs WHERE tenant_id = $1`, [testTenant]);
  await pgQuery(`DELETE FROM publishing_accounts WHERE tenant_id = $1`, [testTenant]);
  await pgQuery(`DELETE FROM affiliate_content_runs WHERE tenant_id = $1`, [testTenant]);
  await pgQuery(`DELETE FROM content_planner_rows WHERE planner_id = $1`, [planner1]);
  await pgQuery(`DELETE FROM content_planners WHERE tenant_id = $1`, [testTenant]);
  await pgQuery(`DELETE FROM affiliate_programs WHERE tenant_id = $1`, [testTenant]);
  await pgQuery(`DELETE FROM brand_profiles WHERE tenant_id = $1`, [testTenant]);
  await pgQuery(`DELETE FROM tenants WHERE id = $1`, [testTenant]);

  // Seed baseline
  await pgQuery(`INSERT INTO tenants (id, name) VALUES ($1, $2)`, [testTenant, 'Publishing Tenant']);
  await pgQuery(`INSERT INTO brand_profiles (id, tenant_id, brand_name) VALUES ($1, $2, $3)`, [bp1, testTenant, 'Nutriblend Publishing']);
  
  await pgQuery(
    `INSERT INTO content_planners (id, tenant_id, brand_id, title, status) VALUES ($1, $2, $3, $4, $5)`,
    [planner1, testTenant, bp1, 'Nutriblend Publishing Editorial', 'completed']
  );

  await pgQuery(
    `INSERT INTO content_planner_rows (id, planner_id, sequence, pillar, category_cep, ws_matrix, context, vfo, strategic_angle, hook, visual_action, product) VALUES
     ($1, $2, 1, 'Pilar Pub', 'recipe', 'Matrix A', 'Context A', 'VFO A', 'Angle A', 'Hook A', 'Action A', 'Product A')`,
    [row1, planner1]
  );

  // Seed active publishing account
  await pgQuery(
    `INSERT INTO publishing_accounts (id, tenant_id, provider, provider_account_id, platform, display_name, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [account1, testTenant, 'repliz', 'repliz_acc_id_123', 'tiktok', 'Repliz TikTok Channel', 'active']
  );

  try {
    const adminUser = { id: 'usr_admin', role: 'admin', tenantId: testTenant };

    // Create program
    const programId = await createCampaignProgram(adminUser, bp1, {
      name: 'Nutri Publishing Kampanye',
      funnelMix: { tofu: 40, mofu: 40, bofu: 20 },
      platforms: ['tiktok'],
      productionTarget: 5
    });
    assert.ok(programId);

    // Link products
    await pgQuery(
      `INSERT INTO affiliate_program_products (id, tenant_id, affiliate_program_id, product_id, brand_product_id, product_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        prod1, testTenant, programId, 'bp_prod_pub', 'bp_prod_pub', 
        JSON.stringify({ productId: 'bp_prod_pub', name: 'Nutriblend Cooking Bumbu', affiliate: { link: 'http://aff.link' } })
      ]
    );

    // Link planners & associate row
    await linkPlannerToProgram(adminUser, bp1, programId, planner1);
    await updatePlannerRowLink(adminUser, bp1, programId, planner1, row1, prod1, 'BOFU');

    // Create a run in 'Planned' status
    const engineCampaignId = `camp_aff_pub_${suffix}`;
    const engineItemId = `item_aff_pub_${suffix}`;
    await pgQuery(
      `INSERT INTO affiliate_content_runs (
         id, tenant_id, brand_profile_id, affiliate_program_id, content_planner_id, planner_row_id,
         engine_type, engine_campaign_id, engine_item_id, normalized_status, product_snapshot_json
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        run1, testTenant, bp1, programId, planner1, row1, 
        're', engineCampaignId, engineItemId, 'Planned',
        JSON.stringify({ productId: 'bp_prod_pub', name: 'Nutriblend Cooking Bumbu', affiliate: { link: 'http://aff.link' } })
      ]
    );

    // 1. Get preflight check for Planned run -> expect mediaReady = false
    const preflight1 = await getPublishingPreflight(adminUser, bp1, programId, run1);
    assert.ok(preflight1);
    assert.equal(preflight1.affiliateLinkPresent, true);
    assert.equal(preflight1.accountReady, true);
    assert.equal(preflight1.mediaReady, false);
    assert.equal(preflight1.eligible, false);

    // Seed dummy publishing job representing ContentFlow item
    await pgQuery(
      `INSERT INTO publishing_jobs (id, tenant_id, provider, content_id, account_id, platform, publish_mode, media_type, caption_snapshot, media_url_snapshot, scheduled_at, status, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, $11, $12)`,
      [
        job1, testTenant, 'repliz', engineCampaignId, account1, 'tiktok', 'live', 'video', 'Caption test', 'http://media.test',
        'scheduled', `idem_key_${suffix}`
      ]
    );

    // 2. Project publishing status -> expect status projected to 'Scheduled' and deepLink defined
    const projection1 = await projectPublishingStatus(adminUser, bp1, run1);
    assert.ok(projection1);
    assert.equal(projection1.status, 'Scheduled');
    assert.equal(projection1.deepLink, `/content-flow/jobs/${job1}`);

  } finally {
    // Cleanup
    await pgQuery(`DELETE FROM publishing_jobs WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM publishing_accounts WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM affiliate_content_runs WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM content_planner_rows WHERE planner_id = $1`, [planner1]);
    await pgQuery(`DELETE FROM content_planners WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM affiliate_programs WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM brand_profiles WHERE tenant_id = $1`, [testTenant]);
    await pgQuery(`DELETE FROM tenants WHERE id = $1`, [testTenant]);
  }
});
