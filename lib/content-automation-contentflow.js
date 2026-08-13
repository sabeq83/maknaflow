import { getDb, updatePillarCampaignItem } from './db.js';
import { scanAndSyncExistingCampaigns } from './contentflow-ingest.js';

export async function syncApprovedOpcItemToContentFlow({ itemId }) {
  const db = getDb();
  const item = await db.prepare('SELECT * FROM pillar_campaign_items WHERE id=?').get(itemId);
  if (!item) throw new Error('OPC item tidak ditemukan.');
  const campaign = await db.prepare('SELECT * FROM pillar_campaigns WHERE id=?').get(item.campaign_id);
  if (!campaign) throw new Error('OPC campaign tidak ditemukan.');
  if (!campaign.auto_sync_contentflow) return { skipped: true };
  if (!item.approved_revision) throw new Error('Item belum memiliki approved revision.');
  if (item.contentflow_sync_status === 'completed') return { success: true, idempotent: true, contentflow_item_id: item.contentflow_item_id };
  await updatePillarCampaignItem(item.id, { contentflow_sync_status: 'processing', contentflow_sync_attempts: Number(item.contentflow_sync_attempts || 0) + 1, contentflow_error: null });
  try {
    await scanAndSyncExistingCampaigns(campaign.id);
    const contentflow = await db.prepare("SELECT id FROM content_flow_items WHERE source_type='opc' AND source_campaign_id=? AND source_item_id=? LIMIT 1").get(String(campaign.id), String(item.id));
    if (!contentflow) throw new Error('ContentFlow upsert tidak menghasilkan item.');
    await updatePillarCampaignItem(item.id, { contentflow_sync_status: 'completed', contentflow_synced_at: new Date(), contentflow_item_id: contentflow.id, contentflow_error: null });
    return { success: true, contentflow_item_id: contentflow.id };
  } catch (error) {
    await updatePillarCampaignItem(item.id, { contentflow_sync_status: Number(item.contentflow_sync_attempts || 0) + 1 >= 5 ? 'failed' : 'retry_wait', contentflow_error: error.message });
    throw error;
  }
}
