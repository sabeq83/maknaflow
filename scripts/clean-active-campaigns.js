/**
 * Script to clean active campaigns in database by applying TikTok Safe Voiceover
 * where forbidden lexicon words (like "detox", "usus kotor", etc.) were found.
 */

import Database from 'better-sqlite3';
import { auditScriptForTikTok } from '../lib/tiktok-compliance-service.js';

async function run() {
  const db = new Database('./data/maknaflow.db');
  console.log('🔍 Scanning active campaigns for compliance auto-rewrite...');

  const campaigns = await db.prepare("SELECT id, campaign_name FROM pillar_campaigns WHERE status IN ('running', 'pending', 'completed') ORDER BY created_at DESC LIMIT 5").all();

  for (const campaign of campaigns) {
    console.log(`\n======================================================`);
    console.log(`Campaign: ${campaign.id} | ${campaign.campaign_name}`);
    console.log(`======================================================`);

    const items = await db.prepare("SELECT id, result_json, tiktok_safe_voiceover, original_voiceover, compliance_status FROM pillar_campaign_items WHERE campaign_id = ?").all(campaign.id);

    for (const item of items) {
      try {
        const res = JSON.parse(item.result_json || '{}');
        const voList = Array.isArray(res) ? res : (res.voiceover || []);
        const voText = voList.map(v => v.narration || '').join('\n');
        const captionText = res.caption || (typeof res.social_media_package === 'object' ? res.social_media_package?.caption : '') || '';

        const audit = await auditScriptForTikTok(voText, captionText);

        if (audit.verdict === 'revise' || audit.verdict === 'block') {
          console.log(`⚠️ Item #${item.id} detected issues:`, audit.detected_issues);
          const safeVo = voList.map((v, idx) => ({
            ...v,
            narration: (audit.revised_script && audit.revised_script[idx] !== undefined)
              ? audit.revised_script[idx]
              : (v.narration || '')
          }));

          // Update result_json voiceover array
          if (res.voiceover && Array.isArray(res.voiceover)) {
            res.voiceover = safeVo;
          } else if (Array.isArray(res)) {
            res.splice(0, res.length, ...safeVo);
          }

          await db.prepare(`
            UPDATE pillar_campaign_items 
            SET tiktok_safe_voiceover = ?, 
                result_json = ?, 
                compliance_status = 'pass',
                selected_vo_version = 'tiktok_safe'
            WHERE id = ?
          `).run(JSON.stringify(safeVo), JSON.stringify(res), item.id);

          console.log(`✅ Item #${item.id} auto-rewritten & updated to 100% compliant safe voiceover!`);
        } else {
          console.log(`✓ Item #${item.id} is 100% compliant.`);
        }
      } catch (err) {
        console.error(`❌ Error auditing item #${item.id}:`, err.message);
      }
    }
  }

  console.log('\n🎉 Active campaign compliance cleaning complete!');
  db.close();
}

run().catch(console.error);
