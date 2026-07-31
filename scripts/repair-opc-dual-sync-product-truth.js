import { getDb } from '../lib/db.js';

const db = getDb();

const campaignsToRepair = [
  {
    pattern: '%qhr4ex%',
    productId: 'pe_sync_1781148697786_850',
    productTruth: 'Official Indonesia Powder BMI Cocoa Powder Premix (500g) in an authentic vertical silver metallic aluminium foil sachet packaging. Features a center beige and dark brown label with an illustration of an open cacao pod, cocoa beans, and green leaves, bounded by fine crimped silver sealed edges.',
    geometricTruth: 'Flat rectangular silver aluminium foil sachet standing upright, vertical 3:4 aspect ratio, crimped heat-sealed margins along top, bottom, and side borders, metallic silver surface physics with subtle specular light reflections.'
  },
  {
    pattern: '%1xk9de%',
    productId: 'pe_1781998087509_929',
    productTruth: 'Official Beorganik Peanut Butter in an authentic clear glass jar with metal screw cap and Beorganik label',
    geometricTruth: 'Stout cylindrical glass jar standing vertically, metallic lid, thick creamy peanut butter texture visible inside'
  }
];

console.log('🚀 Executing Dual-Sync DB Repair (new_video_plan_json + result_json)...');

for (const config of campaignsToRepair) {
  const campaign = await db.prepare('SELECT id, campaign_name FROM pillar_campaigns WHERE campaign_name LIKE ? OR id LIKE ?').get(config.pattern, config.pattern);
  if (!campaign) {
    console.error(`❌ Campaign ${config.pattern} not found!`);
    continue;
  }

  // 1. Link product_id
  await db.prepare('UPDATE pillar_campaigns SET target_product_id = ? WHERE id = ?').run(config.productId, campaign.id);
  console.log(`\n✅ Linked target_product_id=${config.productId} to campaign [${campaign.id}]`);

  // 2. Fetch items
  const items = await db.prepare('SELECT id, result_json, new_video_plan_json FROM pillar_campaign_items WHERE campaign_id = ? ORDER BY id ASC').all(campaign.id);
  
  let repairedCount = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const rowIndex = i + 1;

    let updatedNewPlan = false;
    let updatedResult = false;

    // A. Update new_video_plan_json (Web UI)
    if (item.new_video_plan_json) {
      try {
        const planArray = JSON.parse(item.new_video_plan_json);
        const clip3 = planArray.find(c => (c.clip_index === 3 || c.scene === 3));
        if (clip3) {
          if (clip3.t2i_prompt) {
            clip3.t2i_prompt = clip3.t2i_prompt.replace(/\(Product Truth: [^)]+\)/i, `(Product Truth: ${config.productTruth}, geometry_lock: DO NOT HALLUCINATE)`);
            if (!clip3.t2i_prompt.includes('Product Truth:')) {
              clip3.t2i_prompt += ` [LAYER 2: SUBJECT & VISUAL TRUTH] (Product Truth: ${config.productTruth}, geometry_lock: DO NOT HALLUCINATE)`;
            }
          }
          if (clip3.i2v_prompt) {
            clip3.i2v_prompt = clip3.i2v_prompt.replace(/\(Geometric Truth: [^)]+\)/i, `(Geometric Truth: ${config.geometricTruth})`);
            if (!clip3.i2v_prompt.includes('Geometric Truth:')) {
              clip3.i2v_prompt = `[LAYER 1: INPUT & TRUTH LOCK] (Geometric Truth: ${config.geometricTruth}). ${clip3.i2v_prompt}`;
            }
          }
          item.new_video_plan_json = JSON.stringify(planArray);
          updatedNewPlan = true;
        }
      } catch (e) {
        console.error(`❌ Failed parsing new_video_plan_json for item #${item.id}:`, e.message);
      }
    }

    // B. Update result_json (Poller Engine)
    if (item.result_json) {
      try {
        const res = JSON.parse(item.result_json);
        if (Array.isArray(res.t2i_prompts)) {
          const clip3Obj = res.t2i_prompts.find(p => p && typeof p === 'object' && p.clip === 3);
          if (clip3Obj && clip3Obj.prompt) {
            clip3Obj.prompt = clip3Obj.prompt.replace(/\(Product Truth: [^)]+\)/i, `(Product Truth: ${config.productTruth}, geometry_lock: DO NOT HALLUCINATE)`);
            if (!clip3Obj.prompt.includes('Product Truth:')) {
              clip3Obj.prompt += ` [LAYER 2: SUBJECT & VISUAL TRUTH] (Product Truth: ${config.productTruth}, geometry_lock: DO NOT HALLUCINATE)`;
            }
          } else if (typeof res.t2i_prompts[2] === 'string') {
            let pStr = res.t2i_prompts[2];
            pStr = pStr.replace(/\(Product Truth: [^)]+\)/i, `(Product Truth: ${config.productTruth}, geometry_lock: DO NOT HALLUCINATE)`);
            if (!pStr.includes('Product Truth:')) {
              pStr += ` [LAYER 2: SUBJECT & VISUAL TRUTH] (Product Truth: ${config.productTruth}, geometry_lock: DO NOT HALLUCINATE)`;
            }
            res.t2i_prompts[2] = pStr;
          }
        }
        if (Array.isArray(res.i2v_prompts)) {
          const i2v3Obj = res.i2v_prompts.find(p => p && typeof p === 'object' && p.clip === 3);
          if (i2v3Obj && typeof i2v3Obj.prompt === 'string') {
            i2v3Obj.prompt = i2v3Obj.prompt.replace(/\(Geometric Truth: [^)]+\)/i, `(Geometric Truth: ${config.geometricTruth})`);
            if (!i2v3Obj.prompt.includes('Geometric Truth:')) {
              i2v3Obj.prompt = `[LAYER 1: INPUT & TRUTH LOCK] (Geometric Truth: ${config.geometricTruth}). ${i2v3Obj.prompt}`;
            }
          } else if (typeof res.i2v_prompts[2] === 'string') {
            let iStr = res.i2v_prompts[2];
            iStr = iStr.replace(/\(Geometric Truth: [^)]+\)/i, `(Geometric Truth: ${config.geometricTruth})`);
            if (!iStr.includes('Geometric Truth:')) {
              iStr = `[LAYER 1: INPUT & TRUTH LOCK] (Geometric Truth: ${config.geometricTruth}). ${iStr}`;
            }
            res.i2v_prompts[2] = iStr;
          }
        }
        item.result_json = JSON.stringify(res);
        updatedResult = true;
      } catch (e) {
        console.error(`❌ Failed parsing result_json for item #${item.id}:`, e.message);
      }
    }

    if (updatedNewPlan || updatedResult) {
      await db.prepare('UPDATE pillar_campaign_items SET new_video_plan_json = ?, result_json = ? WHERE id = ?')
        .run(item.new_video_plan_json, item.result_json, item.id);
      repairedCount++;
      console.log(`  ✅ [Item #${item.id}] Row ${rowIndex}: Dual-sync repair completed.`);
    }
  }

  console.log(`🎉 Campaign [${campaign.id}] complete! Repaired ${repairedCount} items.`);
}
