import test from 'node:test';
import assert from 'node:assert/strict';
import { ingestPlannerToPillarCampaign } from '../lib/pillar-campaign-ingest.js';
import { getDb } from '../lib/db.js';
import { closePgPool } from '../lib/db-pg.js';

test.after(async () => {
  await closePgPool();
});

test('ingestPlannerToPillarCampaign successfully handles Recipe Campaign planners with multi-products and custom settings', async () => {
  const db = getDb();
  const testPlannerId = `test_recipe_modal_pln_${Date.now()}`;
  const testTenantId = 'default_tenant';

  // 1. Insert test recipe planner
  await db.prepare(`
    INSERT INTO content_planners (
      id, title, account_name, planner_focus, recipe_config_json, products_snapshot_json, status, target_audience, tenant_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    testPlannerId,
    'nutribake - 20260917 - Resep - Diet',
    'nutribake',
    'recipe_campaign',
    JSON.stringify({ category: 'minuman', product_ids: ['prod_rc_1', 'prod_rc_2'] }),
    JSON.stringify([
      { product_id: 'prod_rc_1', name: 'Nutrifarm Matcha Premium' },
      { product_id: 'prod_rc_2', name: 'Omura Premium Cocoa Powder' }
    ]),
    'planned',
    'genz_casual',
    testTenantId
  );

  // 2. Insert test planner rows with recipe ideas
  const row1Id = `cpr_rc_${Date.now()}_1`;
  const row2Id = `cpr_rc_${Date.now()}_2`;

  const idea1 = {
    title: 'Iced Almond Choco-Matcha Fusion Latte',
    category: 'minuman',
    hook: 'Stop beli latte 50 ribuan di kafe!',
    primary_product_id: 'prod_rc_1',
    primary_product_name: 'Nutrifarm Matcha Premium',
    featured_products: [
      { product_id: 'prod_rc_1', name: 'Nutrifarm Matcha Premium' },
      { product_id: 'prod_rc_2', name: 'Omura Premium Cocoa Powder' }
    ],
    estimated_servings: '1 Porsi',
    estimated_cooking_minutes: 3,
    visual_highlight: 'Three layer color pour'
  };

  const idea2 = {
    title: 'Smoothie Diet Choco-Matcha Layer Shake',
    category: 'minuman',
    hook: 'Pengen diet tapi gak tahan jus sayur?',
    primary_product_id: 'prod_rc_2',
    primary_product_name: 'Omura Premium Cocoa Powder',
    featured_products: [
      { product_id: 'prod_rc_2', name: 'Omura Premium Cocoa Powder' }
    ],
    estimated_servings: '1 Porsi',
    estimated_cooking_minutes: 2,
    visual_highlight: 'Two-tone smoothie in mason jar'
  };

  await db.prepare(`
    INSERT INTO content_planner_rows (
      id, planner_id, sequence, title, hook, status, recipe_idea_json, product, product_id,
      pillar, category_cep, ws_matrix, context, vfo, strategic_angle, video_id, tenant_id, visual_action
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    row1Id, testPlannerId, 1, idea1.title, idea1.hook, 'planned', JSON.stringify(idea1),
    idea1.primary_product_name, idea1.primary_product_id,
    'Recipe Campaign', 'minuman', 'Resep & Tutorial', idea1.title, 'Kreasi Praktis', 'Resep Cepat', 'REC-001', testTenantId, idea1.visual_highlight
  );

  await db.prepare(`
    INSERT INTO content_planner_rows (
      id, planner_id, sequence, title, hook, status, recipe_idea_json, product, product_id,
      pillar, category_cep, ws_matrix, context, vfo, strategic_angle, video_id, tenant_id, visual_action
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    row2Id, testPlannerId, 2, idea2.title, idea2.hook, 'planned', JSON.stringify(idea2),
    idea2.primary_product_name, idea2.primary_product_id,
    'Recipe Campaign', 'minuman', 'Resep & Tutorial', idea2.title, 'Kreasi Praktis', 'Resep Cepat', 'REC-002', testTenantId, idea2.visual_highlight
  );

  // 3. Execute unified ingest simulation (with globalSettings from ImportPlannerModal)
  const result = await ingestPlannerToPillarCampaign({
    plannerId: testPlannerId,
    selectedRowIds: [row1Id, row2Id],
    campaignName: '[ Recipe OPC 20260921 ] - nutribake - Test Campaign',
    globalSettings: {
      status: 'draft',
      execution_mode: 'manual_review',
      video_model: 'veo_31_lite',
      clip_duration: 8,
      voice_persona: 'Indonesian_casual_reporter_vv2',
      voice_provider: 'minimax',
      visual_style: 'photorealistic_culinary',
      narrative_mode: 'Storytelling',
      aspect_ratio: '9:16',
      target_demographic: 'genz_casual'
    }
  });

  assert.equal(result.status, 'draft');
  assert.equal(result.ingestedCount, 2);
  assert.ok(result.campaignId);

  // 4. Verify campaign record in database
  const createdCampaign = await db.prepare('SELECT * FROM pillar_campaigns WHERE id = ?').get(result.campaignId);
  assert.equal(createdCampaign.content_pillar, 'Recipe Campaign');
  assert.equal(createdCampaign.visual_style, 'photorealistic_culinary');
  assert.equal(createdCampaign.video_model, 'veo_31_lite');
  assert.equal(createdCampaign.status, 'draft');

  // 5. Verify created items & payloads
  const createdItems = await db.prepare('SELECT * FROM pillar_campaign_items WHERE campaign_id = ? ORDER BY id ASC').all(result.campaignId);
  assert.equal(createdItems.length, 2);

  const payload1 = JSON.parse(createdItems[0].row_creative_payload);
  assert.equal(payload1.title, idea1.title);
  assert.equal(payload1.content_kind, 'recipe_campaign');
  assert.equal(payload1.knowledge_domain, 'food_culinary');
  assert.equal(payload1.featured_products.length, 2);
  assert.equal(payload1.primary_product_id, 'prod_rc_1');

  const payload2 = JSON.parse(createdItems[1].row_creative_payload);
  assert.equal(payload2.title, idea2.title);
  assert.equal(payload2.content_kind, 'recipe_campaign');
  assert.equal(payload2.primary_product_id, 'prod_rc_2');

  // 6. Clean up test records
  await db.prepare('DELETE FROM campaign_product_bindings WHERE source_campaign_id = ?').run(result.campaignId);
  await db.prepare('DELETE FROM pillar_campaign_items WHERE campaign_id = ?').run(result.campaignId);
  await db.prepare('DELETE FROM pillar_campaigns WHERE id = ?').run(result.campaignId);
  await db.prepare('DELETE FROM content_planner_rows WHERE planner_id = ?').run(testPlannerId);
  await db.prepare('DELETE FROM content_planners WHERE id = ?').run(testPlannerId);
});


