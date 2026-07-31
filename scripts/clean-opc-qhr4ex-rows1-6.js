import { getDb } from '../lib/db.js';

const db = getDb();
const campaignPattern = '%qhr4ex%';

const verifiedProductTruth = 'Official Indonesia Powder BMI Cocoa Powder Premix (500g) in an authentic vertical silver metallic aluminium foil sachet packaging. Features a center beige and dark brown label with an illustration of an open cacao pod, cocoa beans, and green leaves, bounded by fine crimped silver sealed edges.';
const verifiedRefFilename = 'cleaned_pe_sync_1781148697786_850_1785059586588.png';
const verifiedTag = `(Product Reference File: '${verifiedRefFilename}', exact high-fidelity visual design match with attached reference photo)`;

console.log('🚀 Executing Single-Line Prompt Precision Cleanup for opc_260726_qhr4ex (Rows 1 to 6 ONLY)...');

const campaign = await db.prepare('SELECT id, campaign_name FROM pillar_campaigns WHERE campaign_name LIKE ? OR id LIKE ?').get(campaignPattern, campaignPattern);
if (!campaign) {
  console.error('❌ Campaign opc_260726_qhr4ex not found!');
  process.exit(1);
}

// Target items strictly row 1 to 6 (items #106 to #111)
const items = await db.prepare('SELECT id, result_json, new_video_plan_json FROM pillar_campaign_items WHERE campaign_id = ? ORDER BY id ASC LIMIT 6').all(campaign.id);

let cleanedCount = 0;
for (let i = 0; i < items.length; i++) {
  const item = items[i];
  const rowIndex = i + 1;
  let updatedNewPlan = false;
  let updatedResult = false;

  // A. Clean new_video_plan_json (Web UI)
  if (item.new_video_plan_json) {
    try {
      const plan = JSON.parse(item.new_video_plan_json);
      const clip3 = plan.find(c => (c.clip_index === 3 || c.scene === 3));
      if (clip3 && clip3.t2i_prompt) {
        let p = clip3.t2i_prompt;

        // 1. Remove duplicate Product Truth tags & old reference file tags
        p = p.replace(/\[LAYER 2: SUBJECT & VISUAL TRUTH\]/gi, '');
        p = p.replace(/\(Product Truth: [^)]+\)/gi, '');
        p = p.replace(/,\s*\(Product Reference File: [^)]+\)/gi, '');
        p = p.replace(/\(Product Reference File: [^)]+\)/gi, '');
        p = p.replace(/,\s*geometry_lock: [^)]+/gi, '');
        p = p.replace(/\(geometry_lock: [^)]+\)/gi, '');

        // 2. Fix old container wording in Layer 4
        p = p.replace(/stand-up pouch/gi, 'silver metallic foil sachet');
        p = p.replace(/standup pouch/gi, 'silver metallic foil sachet');

        // 3. Inject clean single Product Truth & Reference File tag in Layer 2
        const truthSnippet = `[LAYER 2: SUBJECT & VISUAL TRUTH] (Product Truth: ${verifiedProductTruth}), ${verifiedTag}, (geometry_lock: DO NOT HALLUCINATE)`;
        
        // Insert truthSnippet right after optics layer or at the beginning of Layer 2
        if (p.includes('[LAYER 3: SCENE & LIGHT]')) {
          const parts = p.split('[LAYER 3: SCENE & LIGHT]');
          p = `${parts[0].trim()} ${truthSnippet} [LAYER 3: SCENE & LIGHT] ${parts.slice(1).join('[LAYER 3: SCENE & LIGHT]')}`;
        } else {
          p = `${p.trim()} ${truthSnippet}`;
        }

        // 4. Enforce STRICT SINGLE-LINE FORMAT (strip all newlines)
        p = p.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

        clip3.t2i_prompt = p;
        item.new_video_plan_json = JSON.stringify(plan);
        updatedNewPlan = true;
      }
    } catch (e) {
      console.error(`❌ Error parsing new_video_plan_json for item #${item.id}:`, e.message);
    }
  }

  // B. Clean result_json (Poller Engine)
  if (item.result_json) {
    try {
      const res = JSON.parse(item.result_json);
      if (Array.isArray(res.t2i_prompts)) {
        const clip3Obj = res.t2i_prompts.find(p => p && typeof p === 'object' && p.clip === 3);
        if (clip3Obj && clip3Obj.prompt) {
          let p = clip3Obj.prompt;
          p = p.replace(/\[LAYER 2: SUBJECT & VISUAL TRUTH\]/gi, '');
          p = p.replace(/\(Product Truth: [^)]+\)/gi, '');
          p = p.replace(/,\s*\(Product Reference File: [^)]+\)/gi, '');
          p = p.replace(/\(Product Reference File: [^)]+\)/gi, '');
          p = p.replace(/,\s*geometry_lock: [^)]+/gi, '');
          p = p.replace(/\(geometry_lock: [^)]+\)/gi, '');
          p = p.replace(/stand-up pouch/gi, 'silver metallic foil sachet');
          p = p.replace(/standup pouch/gi, 'silver metallic foil sachet');

          const truthSnippet = `[LAYER 2: SUBJECT & VISUAL TRUTH] (Product Truth: ${verifiedProductTruth}), ${verifiedTag}, (geometry_lock: DO NOT HALLUCINATE)`;
          if (p.includes('[LAYER 3: SCENE & LIGHT]')) {
            const parts = p.split('[LAYER 3: SCENE & LIGHT]');
            p = `${parts[0].trim()} ${truthSnippet} [LAYER 3: SCENE & LIGHT] ${parts.slice(1).join('[LAYER 3: SCENE & LIGHT]')}`;
          } else {
            p = `${p.trim()} ${truthSnippet}`;
          }
          p = p.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

          clip3Obj.prompt = p;
          updatedResult = true;
        } else if (typeof res.t2i_prompts[2] === 'string') {
          let p = res.t2i_prompts[2];
          p = p.replace(/\[LAYER 2: SUBJECT & VISUAL TRUTH\]/gi, '');
          p = p.replace(/\(Product Truth: [^)]+\)/gi, '');
          p = p.replace(/,\s*\(Product Reference File: [^)]+\)/gi, '');
          p = p.replace(/\(Product Reference File: [^)]+\)/gi, '');
          p = p.replace(/,\s*geometry_lock: [^)]+/gi, '');
          p = p.replace(/\(geometry_lock: [^)]+\)/gi, '');
          p = p.replace(/stand-up pouch/gi, 'silver metallic foil sachet');
          p = p.replace(/standup pouch/gi, 'silver metallic foil sachet');

          const truthSnippet = `[LAYER 2: SUBJECT & VISUAL TRUTH] (Product Truth: ${verifiedProductTruth}), ${verifiedTag}, (geometry_lock: DO NOT HALLUCINATE)`;
          if (p.includes('[LAYER 3: SCENE & LIGHT]')) {
            const parts = p.split('[LAYER 3: SCENE & LIGHT]');
            p = `${parts[0].trim()} ${truthSnippet} [LAYER 3: SCENE & LIGHT] ${parts.slice(1).join('[LAYER 3: SCENE & LIGHT]')}`;
          } else {
            p = `${p.trim()} ${truthSnippet}`;
          }
          p = p.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

          res.t2i_prompts[2] = p;
          updatedResult = true;
        }
        item.result_json = JSON.stringify(res);
      }
    } catch (e) {
      console.error(`❌ Error parsing result_json for item #${item.id}:`, e.message);
    }
  }

  if (updatedNewPlan || updatedResult) {
    await db.prepare('UPDATE pillar_campaign_items SET new_video_plan_json = ?, result_json = ? WHERE id = ?')
      .run(item.new_video_plan_json, item.result_json, item.id);
    cleanedCount++;
    console.log(`  ✅ [Item #${item.id}] Row ${rowIndex}: Cleaned single-line prompt.`);
  }
}

console.log(`🎉 Single-Line Prompt Precision Cleanup Complete! Processed strictly ${cleanedCount} items (Rows 1 to 6).`);
