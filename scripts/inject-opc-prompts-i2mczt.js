import { Pool } from 'pg';
import { DEMOGRAPHIC_PRESETS } from '../lib/prompts.js';

const pool = new Pool({
  host: '100.78.186.123',
  port: 5432,
  user: 'makna_user',
  password: 'maknagridpass',
  database: 'maknaflow_db',
});

async function runPromptInjection() {
  const client = await pool.connect();
  await client.query('SET search_path TO staging');
  const campaignId = 'opc_260930_i2mczt';
  const newSubject = DEMOGRAPHIC_PRESETS.caucasian_male;

  console.log(`[Batch Inject] Starting prompt update for campaign: ${campaignId}`);
  console.log(`[Batch Inject] New Subject: ${newSubject}\n`);

  // 1. Fetch all items in campaign
  const res = await client.query('SELECT id, new_video_plan_json FROM pillar_campaign_items WHERE campaign_id = $1 ORDER BY id ASC', [campaignId]);
  console.log(`Found ${res.rows.length} items for campaign ${campaignId}`);

  let totalClipsUpdated = 0;

  for (const item of res.rows) {
    if (!item.new_video_plan_json) continue;
    let plan = [];
    try {
      plan = JSON.parse(item.new_video_plan_json);
    } catch (e) {
      console.warn(`Failed to parse plan for item ${item.id}`);
      continue;
    }

    if (!Array.isArray(plan)) continue;

    plan = plan.map(clip => {
      let t2i = clip.t2i_prompt || '';
      // Replace old Anchor pattern with new Hands-First Anchor
      t2i = t2i.replace(/\(Anchor:[^)]+\)/gi, `(Anchor: ${newSubject})`);
      t2i = t2i.replace(/\(Biometric Anchor:[^)]+\)/gi, `(Anchor: ${newSubject})`);
      
      let i2v = clip.i2v_prompt || '';
      totalClipsUpdated++;

      return {
        ...clip,
        t2i_prompt: t2i,
        i2v_prompt: i2v
      };
    });

    await client.query(
      'UPDATE pillar_campaign_items SET new_video_plan_json = $1 WHERE id = $2',
      [JSON.stringify(plan), item.id]
    );
    console.log(`✓ Item ${item.id} (${plan.length} clips updated)`);
  }

  // 2. Also update visual_overrides_json in pillar_campaigns
  const campRes = await client.query('SELECT visual_overrides_json FROM pillar_campaigns WHERE id = $1', [campaignId]);
  if (campRes.rows.length > 0 && campRes.rows[0].visual_overrides_json) {
    try {
      let vOverrides = JSON.parse(campRes.rows[0].visual_overrides_json);
      if (vOverrides.resolved) {
        vOverrides.resolved.subject_prompt = newSubject;
      }
      if (vOverrides.legacy) {
        vOverrides.legacy.subject_demographic_custom = newSubject;
      }
      await client.query(
        'UPDATE pillar_campaigns SET visual_overrides_json = $1 WHERE id = $2',
        [JSON.stringify(vOverrides), campaignId]
      );
      console.log(`✓ Campaign ${campaignId} visual_overrides_json updated.`);
    } catch (err) {
      console.warn('Could not update campaign visual_overrides_json:', err.message);
    }
  }

  console.log(`\n[Batch Inject Complete] Successfully updated ${res.rows.length} items (${totalClipsUpdated} clips total).`);
  await client.end();
}

runPromptInjection().catch(err => {
  console.error('[Batch Inject Error]:', err);
  process.exit(1);
});
