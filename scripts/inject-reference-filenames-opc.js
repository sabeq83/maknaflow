import { getDb } from '../lib/db.js';

const db = getDb();

const injectionConfig = [
  {
    pattern: '%qhr4ex%',
    refFilename: 'cleaned_pe_sync_1781148697786_850_1785059586588.png',
    customTag: "(Product Reference File: 'cleaned_pe_sync_1781148697786_850_1785059586588.png', exact high-fidelity visual design match with attached reference photo)"
  },
  {
    pattern: '%1xk9de%',
    refFilename: 'generated_pe_1781998087509_929.jpg',
    customTag: "(Product Reference File: 'generated_pe_1781998087509_929.jpg', single isolated glass jar studio product photo, exact high-fidelity visual design match with attached reference photo)"
  }
];

console.log('🚀 Injecting Reference Photo Filenames into T2I Prompts (Dual-Sync UI + Poller)...');

for (const cfg of injectionConfig) {
  const campaign = await db.prepare('SELECT id, campaign_name FROM pillar_campaigns WHERE campaign_name LIKE ? OR id LIKE ?').get(cfg.pattern, cfg.pattern);
  if (!campaign) {
    console.error(`❌ Campaign ${cfg.pattern} not found!`);
    continue;
  }

  const items = await db.prepare('SELECT id, result_json, new_video_plan_json FROM pillar_campaign_items WHERE campaign_id = ? ORDER BY id ASC').all(campaign.id);
  const tagToInject = cfg.customTag;

  let updatedCount = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const rowIndex = i + 1;
    let updatedNewPlan = false;
    let updatedResult = false;

    // A. Update new_video_plan_json (Web UI)
    if (item.new_video_plan_json) {
      try {
        const plan = JSON.parse(item.new_video_plan_json);
        const clip3 = plan.find(c => (c.clip_index === 3 || c.scene === 3));
        if (clip3 && clip3.t2i_prompt) {
          clip3.t2i_prompt = clip3.t2i_prompt.replace(/,\s*\(Product Reference File: [^)]+\)/i, '');
          clip3.t2i_prompt = clip3.t2i_prompt.replace(/\(Product Truth: [^)]+\)/i, (match) => `${match}, ${tagToInject}`);
          if (!clip3.t2i_prompt.includes('Product Reference File:')) {
            clip3.t2i_prompt += ` [LAYER 2: SUBJECT & VISUAL TRUTH] ${tagToInject}`;
          }
          item.new_video_plan_json = JSON.stringify(plan);
          updatedNewPlan = true;
        }
      } catch (e) {}
    }

    // B. Update result_json (Poller Engine)
    if (item.result_json) {
      try {
        const res = JSON.parse(item.result_json);
        if (Array.isArray(res.t2i_prompts)) {
          const clip3Obj = res.t2i_prompts.find(p => p && typeof p === 'object' && p.clip === 3);
          if (clip3Obj && clip3Obj.prompt) {
            clip3Obj.prompt = clip3Obj.prompt.replace(/,\s*\(Product Reference File: [^)]+\)/i, '');
            clip3Obj.prompt = clip3Obj.prompt.replace(/\(Product Truth: [^)]+\)/i, (match) => `${match}, ${tagToInject}`);
            if (!clip3Obj.prompt.includes('Product Reference File:')) {
              clip3Obj.prompt += ` [LAYER 2: SUBJECT & VISUAL TRUTH] ${tagToInject}`;
            }
            updatedResult = true;
          } else if (typeof res.t2i_prompts[2] === 'string') {
            let pStr = res.t2i_prompts[2];
            pStr = pStr.replace(/,\s*\(Product Reference File: [^)]+\)/i, '');
            pStr = pStr.replace(/\(Product Truth: [^)]+\)/i, (match) => `${match}, ${tagToInject}`);
            if (!pStr.includes('Product Reference File:')) {
              pStr += ` [LAYER 2: SUBJECT & VISUAL TRUTH] ${tagToInject}`;
            }
            res.t2i_prompts[2] = pStr;
            updatedResult = true;
          }
          item.result_json = JSON.stringify(res);
        }
      } catch (e) {}
    }

    if (updatedNewPlan || updatedResult) {
      await db.prepare('UPDATE pillar_campaign_items SET new_video_plan_json = ?, result_json = ? WHERE id = ?')
        .run(item.new_video_plan_json, item.result_json, item.id);
      updatedCount++;
      console.log(`  ✅ [Item #${item.id}] Row ${rowIndex}: Injected ${cfg.refFilename}`);
    }
  }

  console.log(`🎉 Campaign [${campaign.id}] complete! Injected reference photo filename into ${updatedCount} items.`);
}
