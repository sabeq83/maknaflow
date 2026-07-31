import { getDb } from '../lib/db.js';

const db = getDb();
const campaignPattern = '%1xk9de%';
const targetProductId = 'pe_1781998087509_929';

const verifiedProductTruth = 'Official Beorganik Peanut Butter in an authentic clear glass jar with metal screw cap and Beorganik label';
const verifiedGeometricTruth = 'Stout cylindrical glass jar standing vertically, metallic lid, thick creamy peanut butter texture visible inside';

console.log('🚀 Executing database repair for campaign opc_260726_1xk9de...');

// 1. Update target_product_id in pillar_campaigns
const campaign = await db.prepare('SELECT id, campaign_name FROM pillar_campaigns WHERE campaign_name LIKE ? OR id LIKE ?').get(campaignPattern, campaignPattern);
if (!campaign) {
  console.error('❌ Campaign opc_260726_1xk9de not found!');
  process.exit(1);
}

await db.prepare('UPDATE pillar_campaigns SET target_product_id = ? WHERE id = ?').run(targetProductId, campaign.id);
console.log(`✅ Linked target_product_id=${targetProductId} to campaign [${campaign.id}]`);

// 2. Update items from row 1 to 18
const items = await db.prepare('SELECT id, result_json FROM pillar_campaign_items WHERE campaign_id = ? ORDER BY id ASC').all(campaign.id);

let repairedCount = 0;
for (let i = 0; i < items.length; i++) {
  const item = items[i];
  const rowIndex = i + 1;
  if (!item.result_json) continue;

  try {
    const res = JSON.parse(item.result_json);
    
    // Update t2i_prompts for clip 3 (Product Truth)
    if (Array.isArray(res.t2i_prompts)) {
      const clip3Obj = res.t2i_prompts.find(p => p && typeof p === 'object' && p.clip === 3);
      if (clip3Obj && clip3Obj.prompt) {
        if (/\(Product Truth: [^)]+\)/i.test(clip3Obj.prompt)) {
          clip3Obj.prompt = clip3Obj.prompt.replace(/\(Product Truth: [^)]+\)/i, `(Product Truth: ${verifiedProductTruth}, geometry_lock: DO NOT HALLUCINATE)`);
        } else {
          clip3Obj.prompt += ` [LAYER 2: SUBJECT & VISUAL TRUTH] (Product Truth: ${verifiedProductTruth}, geometry_lock: DO NOT HALLUCINATE)`;
        }
      } else if (typeof res.t2i_prompts[2] === 'string') {
        let pStr = res.t2i_prompts[2];
        if (/\(Product Truth: [^)]+\)/i.test(pStr)) {
          pStr = pStr.replace(/\(Product Truth: [^)]+\)/i, `(Product Truth: ${verifiedProductTruth}, geometry_lock: DO NOT HALLUCINATE)`);
        } else {
          pStr += ` [LAYER 2: SUBJECT & VISUAL TRUTH] (Product Truth: ${verifiedProductTruth}, geometry_lock: DO NOT HALLUCINATE)`;
        }
        res.t2i_prompts[2] = pStr;
      }
    }

    // Update i2v_prompts for clip 3 (Geometric Truth)
    if (Array.isArray(res.i2v_prompts)) {
      const i2v3Obj = res.i2v_prompts.find(p => p && typeof p === 'object' && p.clip === 3);
      if (i2v3Obj && typeof i2v3Obj.prompt === 'string') {
        if (/\(Geometric Truth: [^)]+\)/i.test(i2v3Obj.prompt)) {
          i2v3Obj.prompt = i2v3Obj.prompt.replace(/\(Geometric Truth: [^)]+\)/i, `(Geometric Truth: ${verifiedGeometricTruth})`);
        } else {
          i2v3Obj.prompt = `[LAYER 1: INPUT & TRUTH LOCK] (Geometric Truth: ${verifiedGeometricTruth}). ${i2v3Obj.prompt}`;
        }
      } else if (typeof res.i2v_prompts[2] === 'string') {
        let iStr = res.i2v_prompts[2];
        if (/\(Geometric Truth: [^)]+\)/i.test(iStr)) {
          iStr = iStr.replace(/\(Geometric Truth: [^)]+\)/i, `(Geometric Truth: ${verifiedGeometricTruth})`);
        } else {
          iStr = `[LAYER 1: INPUT & TRUTH LOCK] (Geometric Truth: ${verifiedGeometricTruth}). ${iStr}`;
        }
        res.i2v_prompts[2] = iStr;
      }
    }

    await db.prepare('UPDATE pillar_campaign_items SET result_json = ? WHERE id = ?').run(JSON.stringify(res), item.id);
    repairedCount++;
    console.log(`✅ [Row ${rowIndex} - Item #${item.id}]: Injected Product Truth & Geometric Truth into clip 3.`);
  } catch (err) {
    console.error(`❌ Error repairing item #${item.id}:`, err.message);
  }
}

console.log(`🎉 Successfully repaired ${repairedCount} items for campaign opc_260726_1xk9de!`);
