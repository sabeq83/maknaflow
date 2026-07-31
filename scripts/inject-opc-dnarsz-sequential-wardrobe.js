import { getDb } from '../lib/db.js';
import { WARDROBE_PRESETS } from '../lib/prompts.js';

export function injectOpcDnarszSequentialWardrobe() {
  const db = getDb();
  const campaignId = 'opc_260727_dnarsz';

  const wardrobeKeys = [
    'amber_terracotta', 'mocca_caramel', 'warm_grey', 'sage_muted',
    'lavender_lilac', 'butter_yellow', 'teal_navy', 'olive_modern',
    'mahogany_maroon', 'cloud_dancer'
  ];

  console.log(`[Sequential Wardrobe Script] Starting injection for campaign: ${campaignId}...`);

  const items = await db.prepare('SELECT id, row_creative_payload, new_video_plan_json FROM pillar_campaign_items WHERE campaign_id = ? ORDER BY id ASC').all(campaignId);
  let updatedCount = 0;

  items.forEach((item, index) => {
    const rowNum = index + 1;
    const key = wardrobeKeys[(rowNum - 1) % wardrobeKeys.length];
    const wardrobeDesc = WARDROBE_PRESETS[key] || 'dressed in modest gamis dress';

    let modified = false;
    let plan = [];
    try {
      plan = JSON.parse(item.new_video_plan_json || '[]');
    } catch (_) {}

    for (const clip of plan) {
      if (clip.t2i_prompt) {
        if (/\(Wardrobe: [^\)]+\)/gi.test(clip.t2i_prompt)) {
          clip.t2i_prompt = clip.t2i_prompt.replace(/\(Wardrobe: [^\)]+\)/gi, `(Wardrobe: ${wardrobeDesc})`);
        } else if (/\(Anchor: [^\)]+\)/gi.test(clip.t2i_prompt)) {
          clip.t2i_prompt = clip.t2i_prompt.replace(/\(Anchor: ([^\)]+)\)/gi, `(Anchor: $1), (Wardrobe: ${wardrobeDesc})`);
        }
        modified = true;
      }
    }

    let payloadStr = item.row_creative_payload;
    if (payloadStr) {
      try {
        const payloadObj = JSON.parse(payloadStr);
        payloadObj.wardrobe_style = key;
        payloadObj.wardrobe_desc = wardrobeDesc;
        payloadStr = JSON.stringify(payloadObj);
        modified = true;
      } catch (_) {}
    }

    if (modified) {
      await db.prepare('UPDATE pillar_campaign_items SET new_video_plan_json = ?, row_creative_payload = ? WHERE id = ?')
        .run(JSON.stringify(plan), payloadStr, item.id);
      updatedCount++;
      console.log(`[Row ${rowNum} | Item ${item.id}] Injected wardrobe: ${key} -> "${wardrobeDesc.slice(0, 50)}..."`);
    }
  });

  console.log(`[Sequential Wardrobe Script] Successfully injected sequential wardrobe to ${updatedCount} items in campaign ${campaignId}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  injectOpcDnarszSequentialWardrobe();
}
