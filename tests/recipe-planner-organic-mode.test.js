import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRecipePlannerDraft, validateCanonicalRecipe, validateRecipeProductionPackage } from '../lib/recipe-campaign-contract.js';
import { ingestPlannerToPillarCampaign } from '../lib/pillar-campaign-ingest.js';
import { getDb } from '../lib/db.js';
import { closePgPool } from '../lib/db-pg.js';

test.after(async () => {
  await closePgPool();
});

test('validateRecipePlannerDraft allows empty product_ids for Organic Recipe Mode', () => {
  const result = validateRecipePlannerDraft({
    category: 'minuman',
    count: 3,
    product_ids: [],
    target_audience: 'genz_casual'
  });

  assert.equal(result.category, 'minuman');
  assert.equal(result.count, 3);
  assert.deepEqual(result.productIds, []);
  assert.equal(result.isOrganicMode, true);
});

test('validateRecipePlannerDraft correctly identifies product-integrated campaign', () => {
  const result = validateRecipePlannerDraft({
    category: 'dessert',
    count: 5,
    product_ids: ['prod_123', 'prod_456'],
    strategy_mode: 'synergy'
  });

  assert.equal(result.category, 'dessert');
  assert.equal(result.count, 5);
  assert.deepEqual(result.productIds, ['prod_123', 'prod_456']);
  assert.equal(result.isOrganicMode, false);
});

test('ingestPlannerToPillarCampaign successfully ingests Organic Recipe Planner into Pillar Campaign', async () => {
  const db = getDb();
  const testPlannerId = `test_organic_pln_${Date.now()}`;
  const testTenantId = 'default_tenant';

  // 1. Insert Organic Recipe Planner (0 products in snapshot)
  await db.prepare(`
    INSERT INTO content_planners (
      id, title, account_name, planner_focus, recipe_config_json, products_snapshot_json, status, target_audience, tenant_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    testPlannerId,
    'Resep Organik Dapur Viral - Batch 1',
    'Resep Kuliner',
    'recipe_campaign',
    JSON.stringify({ category: 'minuman', product_ids: [] }),
    JSON.stringify([]),
    'planned',
    'genz_casual',
    testTenantId
  );

  // 2. Insert test organic recipe row
  const rowId = `cpr_organic_${Date.now()}`;
  const organicIdea = {
    title: 'Es Kopi Susu Aren Spesial Kafe',
    category: 'minuman',
    hook: 'Resep es kopi susu gula aren terenak modal 5 ribu!',
    primary_product_id: null,
    primary_product_name: null,
    featured_products: [],
    servings: '1-2 Porsi',
    prep_time_minutes: 2,
    cook_time_minutes: 3,
    difficulty: 'Mudah',
    ingredients: [
      { name: 'Kopi Espresso / Bubuk Kopi Tanpa Ampas', amount: '2', unit: 'sdm', product_id: null },
      { name: 'Gula Aren Cair', amount: '25', unit: 'ml', product_id: null },
      { name: 'Susu UHT Fresh', amount: '120', unit: 'ml', product_id: null },
      { name: 'Es Batu', amount: '1', unit: 'gelas', product_id: null }
    ],
    steps: [
      { index: 1, instruction: 'Larutkan bubuk kopi dengan 50ml air panas mendidih.' },
      { index: 2, instruction: 'Tuangkan sirup gula aren ke dasar gelas saji.' },
      { index: 3, instruction: 'Tambahkan es batu hingga penuh, lalu tuang susu UHT secara perlahan.' },
      { index: 4, instruction: 'Tuang larutan kopi di atas lapisan susu untuk menghasilkan efek layer estetik.' }
    ],
    chef_tips: [
      'Gunakan es batu padat agar lapisan kopi dan susu terpisah cantik.'
    ],
    storyboard: [
      { index: 1, title: 'Scene 1: Hook / Problem', visual: 'Macro close-up pour kopi di atas susu berlapis gula aren.', vo: 'Gak perlu antre kafe mahal, ini rahasia es kopi susu aren legit!' },
      { index: 2, title: 'Scene 2: Persiapan Bahan & Gula Aren', visual: 'Menuang gula aren kental ke dasar gelas kaca bening.', vo: 'Pertama tuang gula aren pekat ke dasar gelas.' },
      { index: 3, title: 'Scene 3: Susu & Es Batu Layering', visual: 'Memasukkan es batu dan menuang susu UHT putih bersih.', vo: 'Isi es batu melimpah lalu tuang susu fresh dingin perlahan.' },
      { index: 4, title: 'Scene 4: Coffee Pour & CTA', visual: 'Tuangan kopi espresso membentuk marmer swirl memikat.', vo: 'Terakhir tuang espresso mantap! Simpan resep ini dan cobain yuk!' }
    ],
    visual_highlight: 'Coffee marble swirl pour effect',
    cta: 'Simpan resep ini dan tag teman ngopi kamu!'
  };

  await db.prepare(`
    INSERT INTO content_planner_rows (
      id, planner_id, sequence, title, hook, status, recipe_idea_json, product, product_id,
      pillar, category_cep, ws_matrix, context, vfo, strategic_angle, video_id, tenant_id, visual_action
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    rowId,
    testPlannerId,
    1,
    organicIdea.title,
    organicIdea.hook,
    'planned',
    JSON.stringify(organicIdea),
    null,
    null,
    'Recipe Campaign',
    'minuman',
    'Resep & Tutorial',
    organicIdea.title,
    'Kreasi Praktis',
    'Resep Cepat',
    'REC-001',
    testTenantId,
    organicIdea.visual_highlight
  );

  // 3. Ingest into Pillar Campaign
  const result = await ingestPlannerToPillarCampaign({
    plannerId: testPlannerId,
    selectedRowIds: [rowId],
    campaignName: 'Test Campaign Recipe Organik',
    tenantId: testTenantId,
    globalSettings: {
      status: 'draft',
      execution_mode: 'manual_review',
      video_model: 'veo_31_lite',
      clip_duration: 4,
      target_clips_count: 4
    }
  });

  assert.equal(result.ingestedCount, 1);
  assert.ok(result.campaignId);

  // 4. Verify ingested campaign and item
  const campaign = await db.prepare('SELECT * FROM pillar_campaigns WHERE id = ?').get(result.campaignId);
  assert.ok(campaign);
  assert.equal(campaign.content_pillar, 'Recipe Campaign');
  assert.equal(campaign.visual_style, 'photorealistic_culinary');

  const items = await db.prepare('SELECT * FROM pillar_campaign_items WHERE campaign_id = ?').all(result.campaignId);
  assert.equal(items.length, 1);

  const payload = JSON.parse(items[0].row_creative_payload);
  assert.equal(payload.title, organicIdea.title);
  assert.equal(payload.content_kind, 'recipe_campaign');
  assert.equal(payload.primary_product_id, null);
  assert.deepEqual(payload.featured_products, []);

  // Cleanup test data
  await db.prepare('DELETE FROM campaign_product_bindings WHERE source_campaign_id = ?').run(result.campaignId);
  await db.prepare('DELETE FROM pillar_campaign_items WHERE campaign_id = ?').run(result.campaignId);
  await db.prepare('DELETE FROM pillar_campaigns WHERE id = ?').run(result.campaignId);
  await db.prepare('DELETE FROM content_planner_rows WHERE planner_id = ?').run(testPlannerId);
  await db.prepare('DELETE FROM content_planners WHERE id = ?').run(testPlannerId);
});
