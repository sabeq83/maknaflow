import { getDb } from '../lib/db.js';

export function updateOpcDnarszClip3Prompts() {
  const db = getDb();
  const productId = 'pe_jit_1781329942894_306';
  const campaignId = 'opc_260727_dnarsz';

  const productTruth = "Official Rolled Oat Gandum Utuh in a transparent standing ziplock pouch with a white rectangular label featuring delicate floral line-art border, elegant cursive typography reading 'Rolled Oat Gandum Utuh', and a small circular illustration of an oat bowl";
  const geometricTruth = "Vertical transparent standing plastic ziplock pouch filled with natural whole oat flakes, smooth plastic reflections, visible ziplock seal top";

  console.log(`[Product Truth Script] Starting update for product: ${productId} and campaign: ${campaignId}...`);

  // 1. Update Master Product Extractions
  try {
    const resProd = await db.prepare('UPDATE product_extractions SET product_truth = ?, geometric_truth = ? WHERE id = ?').run(productTruth, geometricTruth, productId);
    console.log(`[Product Truth Script] Updated product_extractions for ${productId}: ${resProd.changes} row(s) updated.`);
  } catch (e) {
    console.warn(`[Product Truth Script] Failed updating product_extractions:`, e.message);
  }

  // 2. Update all items in pillar_campaign_items for opc_260727_dnarsz
  const items = await db.prepare('SELECT id, row_creative_payload, new_video_plan_json FROM pillar_campaign_items WHERE campaign_id = ?').all(campaignId);
  let updatedCount = 0;

  for (const item of items) {
    let modified = false;
    let plan = [];
    try {
      plan = JSON.parse(item.new_video_plan_json || '[]');
    } catch (_) {}

    // Update clip 3 in new_video_plan_json
    for (const clip of plan) {
      if (Number(clip.clip_index) === 3 && clip.t2i_prompt) {
        // Inject precision Product Truth & Geometric Truth into t2i_prompt
        clip.t2i_prompt = clip.t2i_prompt.replace(/,\s*undefined\.?/gi, '');
        if (/\(Product Truth: [^\)]+\)/gi.test(clip.t2i_prompt)) {
          clip.t2i_prompt = clip.t2i_prompt.replace(
            /\(Product Truth: [^\)]+\)/gi,
            `(Product Truth: ${productTruth}, Geometric Truth: ${geometricTruth})`
          );
        } else if (/\[LAYER 2: SUBJECT & VISUAL TRUTH\]/gi.test(clip.t2i_prompt)) {
          clip.t2i_prompt = clip.t2i_prompt.replace(
            /\[LAYER 2: SUBJECT & VISUAL TRUTH\]/gi,
            `[LAYER 2: SUBJECT & VISUAL TRUTH] (Product Truth: ${productTruth}, Geometric Truth: ${geometricTruth}),`
          );
        }
        clip.t2i_prompt = clip.t2i_prompt.replace(/,\s*undefined\.?/gi, '');
        modified = true;
      }
    }

    // Update row_creative_payload if present
    let payloadStr = item.row_creative_payload;
    if (payloadStr) {
      try {
        const payloadObj = JSON.parse(payloadStr);
        payloadObj.product_truth = productTruth;
        payloadObj.geometric_truth = geometricTruth;
        payloadStr = JSON.stringify(payloadObj);
        modified = true;
      } catch (_) {}
    }

    if (modified) {
      await db.prepare('UPDATE pillar_campaign_items SET new_video_plan_json = ?, row_creative_payload = ?, t2i_start_frame_path = NULL, t2i_images_json = NULL WHERE id = ?')
        .run(JSON.stringify(plan), payloadStr, item.id);
      updatedCount++;
    }
  }

  console.log(`[Prompt Injection Script] Successfully injected precision Klip 3 prompts to ${updatedCount} items in campaign ${campaignId}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  updateOpcDnarszClip3Prompts();
}
