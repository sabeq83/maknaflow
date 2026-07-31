import { getDb } from '../lib/db.js';

export function repairOpcDnarszPhoto() {
  const db = getDb();
  const campaignId = 'opc_260727_dnarsz';
  const targetCleanPath = '/uploads/products/clean/cleaned_pe_jit_1781329942894_306_1785141403215.png';

  console.log(`[Repair Script] Starting database repair for campaign: ${campaignId}...`);

  // 1. Update pillar_campaigns
  const resCamp = await db.prepare('UPDATE pillar_campaigns SET product_ref_image_path = ? WHERE id = ?').run(targetCleanPath, campaignId);
  console.log(`[Repair Script] Updated pillar_campaigns for ${campaignId}: ${resCamp.changes} row(s) updated.`);

  // 2. Update item payload & reset old start frames
  const items = await db.prepare('SELECT id, row_creative_payload FROM pillar_campaign_items WHERE campaign_id = ?').all(campaignId);
  let updatedItems = 0;

  for (const item of items) {
    if (item.row_creative_payload) {
      try {
        const payload = JSON.parse(item.row_creative_payload);
        payload.product_ref_image_path = targetCleanPath;
        await db.prepare('UPDATE pillar_campaign_items SET row_creative_payload = ?, t2i_start_frame_path = NULL, t2i_images_json = NULL WHERE id = ?').run(JSON.stringify(payload), item.id);
        updatedItems++;
      } catch (e) {
        console.error(`[Repair Script] Failed to update item #${item.id}:`, e.message);
      }
    }
  }

  console.log(`[Repair Script] Updated ${updatedItems} item(s) in pillar_campaign_items.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  repairOpcDnarszPhoto();
}
