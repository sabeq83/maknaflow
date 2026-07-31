import { getDb } from '../lib/db.js';

const db = getDb();
const campaignPattern = '%qhr4ex%';
const targetProductId = 'pe_sync_1781148697786_850';

const verifiedProductTruth = 'Official Indonesia Powder BMI Cocoa Powder Premix (500g) in an authentic vertical silver metallic aluminium foil sachet packaging. Features a center beige and dark brown label with an illustration of an open cacao pod, cocoa beans, and green leaves, bounded by fine crimped silver sealed edges.';
const verifiedGeometricTruth = 'Flat rectangular silver aluminium foil sachet standing upright, vertical 3:4 aspect ratio, crimped heat-sealed margins along top, bottom, and side borders, metallic silver surface physics with subtle specular light reflections.';

console.log('🚀 Executing database repair for campaign opc_260726_qhr4ex...');

// 1. Update target_product_id in pillar_campaigns
const campaign = await db.prepare('SELECT id, campaign_name FROM pillar_campaigns WHERE campaign_name LIKE ? OR id LIKE ?').get(campaignPattern, campaignPattern);
if (!campaign) {
  console.error('❌ Campaign opc_260726_qhr4ex not found!');
  process.exit(1);
}

await db.prepare('UPDATE pillar_campaigns SET target_product_id = ? WHERE id = ?').run(targetProductId, campaign.id);
console.log(`✅ Linked target_product_id=${targetProductId} to campaign [${campaign.id}]`);

// 2. Update items from row 6 to 24 (index 5 to 23)
const items = await db.prepare('SELECT id, result_json FROM pillar_campaign_items WHERE campaign_id = ? ORDER BY id ASC').all(campaign.id);
const targetItems = items.slice(5, 24);

let repairedCount = 0;
for (let i = 0; i < targetItems.length; i++) {
  const item = targetItems[i];
  const rowIndex = i + 6;
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

console.log(`🎉 Successfully repaired ${repairedCount} items for campaign opc_260726_qhr4ex!`);
