import test from 'node:test';
import assert from 'node:assert/strict';
import { ingestRecipePlannerToPillarCampaign } from '../lib/recipe-campaign-ingest.js';
import { getDb } from '../lib/db.js';

test('ingestRecipePlannerToPillarCampaign rejects missing planner ID', async () => {
  await assert.rejects(async () => {
    await ingestRecipePlannerToPillarCampaign({ plannerId: null });
  }, /planner_id wajib diisi/);
});

test('ingestRecipePlannerToPillarCampaign module is correctly defined and exportable', () => {
  assert.equal(typeof ingestRecipePlannerToPillarCampaign, 'function');
});

test('ingestRecipePlannerToPillarCampaign successfully ingests recipe planner rows to OPC bundle', async () => {
  const db = getDb();
  const testPlannerId = `test_pln_${Date.now()}`;
  const testTenantId = 'default_tenant';

  // 1. Insert test planner
  await db.prepare(`
    INSERT INTO content_planners (
      id, title, account_name, planner_focus, recipe_config_json, products_snapshot_json, status, target_audience, tenant_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    testPlannerId,
    'Test Recipe Campaign Ingest',
    'culinary_test_account',
    'recipe_campaign',
    JSON.stringify({ category: 'minuman', product_ids: ['prod_test_1', 'prod_test_2'] }),
    JSON.stringify([
      { product_id: 'prod_test_1', name: 'Organic Cocoa Powder' },
      { product_id: 'prod_test_2', name: 'High Speed Blender' }
    ]),
    'planned',
    'genz_casual',
    testTenantId
  );

  // 2. Insert test planner rows
  const row1Id = `cpr_test_${Date.now()}_1`;
  const row2Id = `cpr_test_${Date.now()}_2`;

  const idea1 = {
    title: 'Iced Dark Chocolate Mocha',
    category: 'minuman',
    hook: 'Minuman cokelat kafe terenak!',
    primary_product_id: 'prod_test_1',
    primary_product_name: 'Organic Cocoa Powder',
    visual_highlight: 'Thick cocoa drizzle'
  };

  const idea2 = {
    title: 'Avocado Smoothie Extra Silky',
    category: 'minuman',
    hook: 'Smoothie selembut sutra dalam 3 menit!',
    primary_product_id: 'prod_test_2',
    primary_product_name: 'High Speed Blender',
    visual_highlight: 'Swirling smoothie in glass'
  };

  await db.prepare(`
    INSERT INTO content_planner_rows (
      id, planner_id, sequence, title, hook, status, recipe_idea_json, product, product_id,
      pillar, category_cep, ws_matrix, context, vfo, strategic_angle, video_id, tenant_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    row1Id, testPlannerId, 1, idea1.title, idea1.hook, 'planned', JSON.stringify(idea1),
    idea1.primary_product_name, idea1.primary_product_id,
    'Recipe Campaign', 'minuman', 'Resep & Tutorial', idea1.title, 'Kreasi Praktis', 'Resep Cepat', 'REC-001', testTenantId
  );

  await db.prepare(`
    INSERT INTO content_planner_rows (
      id, planner_id, sequence, title, hook, status, recipe_idea_json, product, product_id,
      pillar, category_cep, ws_matrix, context, vfo, strategic_angle, video_id, tenant_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    row2Id, testPlannerId, 2, idea2.title, idea2.hook, 'planned', JSON.stringify(idea2),
    idea2.primary_product_name, idea2.primary_product_id,
    'Recipe Campaign', 'minuman', 'Resep & Tutorial', idea2.title, 'Kreasi Praktis', 'Resep Cepat', 'REC-002', testTenantId
  );

  // 3. Execute ingest
  const result = await ingestRecipePlannerToPillarCampaign({
    plannerId: testPlannerId,
    tenantId: testTenantId
  });

  assert.equal(result.success, true);
  assert.ok(result.campaign_id, 'Must return campaign_id');
  assert.equal(result.item_count, 2, 'Must ingest 2 items');
  assert.equal(result.ingested_count, 2, 'Must match ingested_count');
  assert.equal(result.campaign?.id, result.campaign_id);

  // 4. Verify created items in database
  const createdItems = await db.prepare('SELECT * FROM pillar_campaign_items WHERE campaign_id = ?').all(result.campaign_id);
  assert.equal(createdItems.length, 2);
  assert.equal(createdItems[0].generation_status, 'pending');

  // Clean up
  await db.prepare('DELETE FROM pillar_campaign_items WHERE campaign_id = ?').run(result.campaign_id);
  await db.prepare('DELETE FROM pillar_campaigns WHERE id = ?').run(result.campaign_id);
  await db.prepare('DELETE FROM content_planner_rows WHERE planner_id = ?').run(testPlannerId);
  await db.prepare('DELETE FROM content_planners WHERE id = ?').run(testPlannerId);
});
