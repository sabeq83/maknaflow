import { createPillarCampaignBundle, getDb } from './db.js';
import { generateCampaignId } from './id-generator.js';
import { startCampaignScheduler } from './campaign-scheduler.js';
import { getActiveTenantId } from './tenant-context.js';

export async function ingestRecipePlannerToPillarCampaign({
  plannerId,
  selectedRowIds = [],
  campaignName = null,
  tenantId = null
}) {
  if (!plannerId) throw new Error('planner_id wajib diisi.');
  const db = getDb();
  const tId = tenantId || getActiveTenantId();

  const planner = await db.prepare('SELECT * FROM content_planners WHERE id = ?').get(plannerId);
  if (!planner) throw new Error('Content Planner tidak ditemukan.');

  let rows = [];
  if (Array.isArray(selectedRowIds) && selectedRowIds.length > 0) {
    const placeholders = selectedRowIds.map(() => '?').join(',');
    rows = await db.prepare(`SELECT * FROM content_planner_rows WHERE planner_id = ? AND id IN (${placeholders}) ORDER BY sequence ASC`).all(plannerId, ...selectedRowIds);
  } else {
    rows = await db.prepare('SELECT * FROM content_planner_rows WHERE planner_id = ? ORDER BY sequence ASC').all(plannerId);
  }

  if (!rows || rows.length === 0) {
    throw new Error('Tidak ada baris resep yang dapat di-ingest.');
  }

  const campaignId = generateCampaignId();
  const name = campaignName || `${planner.title || 'Recipe Campaign'} [OPC]`;

  const campaignData = {
    id: campaignId,
    name,
    account_name: planner.account_name || 'Recipe Channel',
    spreadsheet_id: planner.google_sheet_id || null,
    total_items: rows.length,
    status: 'idle',
    target_product_id: null, // Per-item binding used for recipes
    target_product_name: null,
    is_bridging_active: false,
    content_world: 'real_world',
    knowledge_domain: 'food_culinary',
    universe_profile: null,
    tenant_id: tId
  };

  const items = [];
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    let recipeIdea = {};
    try {
      recipeIdea = typeof row.recipe_idea_json === 'string'
        ? JSON.parse(row.recipe_idea_json || '{}')
        : (row.recipe_idea_json || {});
    } catch (e) {
      recipeIdea = {};
    }

    const itemId = `${campaignId}_item_${index + 1}`;
    const creativePayload = {
      sequence: row.sequence || (index + 1),
      planner_row_id: row.id,
      planner_id: planner.id,
      content_kind: 'recipe_campaign',
      recipe_revision: row.recipe_revision || 1,
      title: recipeIdea.title || row.title,
      category: recipeIdea.category || 'minuman',
      hook: recipeIdea.hook || row.hook,
      primary_product_id: recipeIdea.primary_product_id || null,
      primary_product_name: recipeIdea.primary_product_name || row.product_reference || null,
      product_role: recipeIdea.product_role || 'ingredient',
      integration_reason: recipeIdea.integration_reason || '',
      integration_step_hint: recipeIdea.integration_step_hint || '',
      visual_highlight: recipeIdea.visual_highlight || row.visual_action || '',
      estimated_servings: recipeIdea.estimated_servings || '1 Porsi',
      estimated_cooking_minutes: recipeIdea.estimated_cooking_minutes || 5,
      cta: recipeIdea.cta || row.cta || 'Cek link di bio!',
      target_audience: planner.target_audience || 'genz_casual',
      promotion_context: planner.promotion_context || '',
      custom_instructions: planner.custom_instructions || ''
    };

    items.push({
      id: itemId,
      campaign_id: campaignId,
      sequence: index + 1,
      status: 'pending_generator',
      target_prod_id: recipeIdea.primary_product_id || null,
      target_prod_name: recipeIdea.primary_product_name || row.product_reference || null,
      custom_prompt_summary: recipeIdea.title || row.title,
      row_creative_payload: JSON.stringify(creativePayload),
      content_kind: 'recipe_campaign',
      recipe_revision: row.recipe_revision || 1,
      tenant_id: tId
    });
  }

  await createPillarCampaignBundle(campaignData, items);

  // Trigger scheduler background processing
  try {
    startCampaignScheduler();
  } catch (err) {
    console.warn('[Recipe Ingest] startCampaignScheduler notice:', err.message);
  }

  return {
    success: true,
    campaign_id: campaignId,
    campaign_name: name,
    item_count: items.length,
    items: items.map(it => ({ id: it.id, sequence: it.sequence, title: it.custom_prompt_summary }))
  };
}
