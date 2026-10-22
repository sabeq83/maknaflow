import { pgQuery } from './db-pg.js';
import {
  submitReCampaign,
  submitMultiplierCampaign,
  submitRecipeCampaign
} from './campaign-submission-service.js';

/**
 * Domain adapter to dispatch production for a claimed slot.
 */
export async function dispatchSlotProduction(slot) {
  const tenantId = slot.tenant_id || 'default_tenant';
  const sourceKind = slot.source_kind || slot.batch_source_kind;
  const batchConfig = typeof slot.batch_config === 'string'
    ? JSON.parse(slot.batch_config)
    : (slot.batch_config || {});

  let campaignId = null;
  let campaignItemId = null;

  if (sourceKind === 're') {
    const payload = {
      ...batchConfig,
      campaign_name: `[ STUDIO SLOT #${slot.slot_number} ] - ${slot.batch_title || 'RE'}`,
      urls: slot.creative_snapshot_json?.source_url ? [slot.creative_snapshot_json.source_url] : (batchConfig.urls || []),
      custom_instruction: slot.creative_snapshot_json?.topic_title || slot.creative_snapshot_json?.hook_angle || batchConfig.custom_instruction
    };
    const res = await submitReCampaign({ tenantId, payload });
    campaignId = res.campaign_id;
  } else if (sourceKind === 'multiplier') {
    const row = {
      deconstruct_asset_id: slot.creative_snapshot_json?.deconstruct_asset_id || batchConfig.rows?.[0]?.deconstruct_asset_id || 'asset_default',
      target_product_id: batchConfig.rows?.[0]?.target_product_id || null,
      target_product_url: batchConfig.rows?.[0]?.target_product_url || null,
      campaign_type: batchConfig.rows?.[0]?.campaign_type || 'pure_storytelling',
      editorial_topic: slot.creative_snapshot_json?.topic_title || slot.batch_title || 'Multiplier Slot',
      editorial_outro: ''
    };
    const payload = {
      ...batchConfig,
      campaign_name: `[ STUDIO SLOT #${slot.slot_number} ] - ${slot.batch_title || 'Multiplier'}`,
      rows: [row]
    };
    const res = await submitMultiplierCampaign({ tenantId, payload });
    campaignId = res.batch_id;
  } else if (sourceKind === 'recipe') {
    const payload = {
      ...batchConfig,
      campaign_name: `[ STUDIO SLOT #${slot.slot_number} ] - ${slot.batch_title || 'Recipe'}`,
      custom_category: slot.creative_snapshot_json?.topic_title || batchConfig.custom_category || 'Makanan',
      target_recipe_count: 1
    };
    const res = await submitRecipeCampaign({ tenantId, payload });
    campaignId = res.campaign_id;
    campaignItemId = res.item_ids?.[0] || null;
  }

  // Update slot with campaign identifiers
  await pgQuery(`
    UPDATE content_studio_slots
    SET source_campaign_id = $1, source_item_id = $2, stage_status = 'in_progress', updated_at = CURRENT_TIMESTAMP
    WHERE id = $3 AND tenant_id = $4
  `, [campaignId, campaignItemId, slot.id, tenantId]);

  return { campaignId, campaignItemId };
}

/**
 * Reconciles production status of an in-progress slot.
 */
export async function reconcileSlotProgress(slot) {
  const tenantId = slot.tenant_id || 'default_tenant';
  const campaignId = slot.source_campaign_id;
  if (!campaignId) return null;

  // Lookup in content_flow_items to see if final media asset is ready
  const cfRes = await pgQuery(`
    SELECT * FROM content_flow_items
    WHERE (source_campaign_id = $1 OR id = $1 OR source_item_id = $1)
      AND tenant_id = $2
    ORDER BY created_at DESC
    LIMIT 1
  `, [campaignId, tenantId]);

  if (cfRes.rowCount > 0) {
    const cf = cfRes.rows[0];
    const isCompleted = cf.pipeline_status === 'Completed' || cf.status === 'Completed' || Boolean(cf.video_url || cf.drive_url || cf.local_path);
    const isFailed = cf.pipeline_status === 'Failed' || cf.status === 'Failed';

    if (isCompleted) {
      const mediaUrl = cf.video_url || cf.drive_url || cf.local_path || cf.thumbnail_url;
      const caption = cf.catatan || cf.title || 'Konten Studio';

      await pgQuery(`
        UPDATE content_studio_slots
        SET stage_status = 'completed',
            contentflow_id = $1,
            final_media_url = $2,
            final_caption = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4 AND tenant_id = $5
      `, [cf.id, mediaUrl, caption, slot.id, tenantId]);

      return { status: 'completed', mediaUrl };
    } else if (isFailed) {
      await pgQuery(`
        UPDATE content_studio_slots
        SET stage_status = 'failed', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND tenant_id = $2
      `, [slot.id, tenantId]);

      return { status: 'failed' };
    }
  }

  return { status: 'in_progress' };
}
