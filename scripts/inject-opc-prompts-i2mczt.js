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
  const cleanOptics = '[LAYER 1: OPTICS] (Angle: Top-down 45-degree tabletop macro / tight overhead culinary framing), (Shot on Phase One XF IQ4 (150MP), 100mm Macro Food Photography lens, soft appetizing shallow depth of field).';

  console.log(`[Clean Batch Inject] Starting clean prompt injection for campaign: ${campaignId}`);

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

      // Extract existing Layer 2, 3, 4 parts cleanly
      // Extract Food Truth, Cookware Truth, Product Truth
      const foodTruthMatch = t2i.match(/\(Food Truth:\s*([^)]+)\)/i);
      const cookwareTruthMatch = t2i.match(/\(Cookware Truth:\s*([^)]+)\)/i);
      const productTruthMatch = t2i.match(/\(Product Truth:\s*([^)]+)\)/i);
      const frozenActionMatch = t2i.match(/\(Frozen Action:\s*([^)]+)\)/i);

      const foodTruth = foodTruthMatch ? foodTruthMatch[1].trim() : 'Fresh culinary ingredients and wholesome recipe preparation';
      const cookwareTruth = cookwareTruthMatch ? cookwareTruthMatch[1].trim() : 'heatproof glassware and stainless kitchen cookware';
      const productTruth = productTruthMatch ? productTruthMatch[1].trim() : 'High fidelity photography of natural organic ingredients';
      const frozenAction = frozenActionMatch ? frozenActionMatch[1].trim() : 'Hands actively preparing wholesome recipe on tabletop';

      // Clean structured T2I prompt
      t2i = `(VERTICAL 9:16) --ar 9:16 --no landscape ${cleanOptics} [LAYER 2: SUBJECT, COOKWARE & VISUAL TRUTH] (Anchor: ${newSubject}), (Wardrobe: in Sage Green Muted color, highly flexible elegant color blending beautifully with skin tones), (Food Truth: ${foodTruth}), (Cookware Truth: ${cookwareTruth}), (Product Truth: ${productTruth}). [LAYER 3: SCENE & LIGHT] (Environment: in a modern bright Nordic style kitchen, featuring clean white marble countertops and light oak wood cabinets), (Lighting: illuminated by soft natural daylight coming from a side window, realistic soft-shadow roll-off, clean highlights). [LAYER 4: KINETIC IMPLICATION] (Frozen Action: ${frozenAction}).`;

      // Clean structured I2V prompt
      let i2v = clip.i2v_prompt || '';
      const sfxMatch = i2v.match(/\[SFX:\s*([^\]]+)\]/i);
      const sfx = sfxMatch ? sfxMatch[1].trim() : 'Soft culinary cooking sound and warm ambient tone';
      const actionMatch = i2v.match(/2\.0s-4\.0s:\s*\(([^)]+)\)/i);
      const secAction = actionMatch ? actionMatch[1].trim() : 'Smooth continuous camera balance over recipe workspace';

      i2v = `(VERTICAL 9:16) --ar 9:16 --no landscape [LAYER 1: INPUT & TRUTH LOCK] (Start Frame Reference: CLIP_${clip.clip_index}_START_FRAME.png), (Consistency: MAX). [LAYER 2: MICRO-PACING & ACTION] 0.0s-2.0s: (Top-down 45-degree camera focusing smoothly on tabletop action), 2.0s-4.0s: (${secAction}). [LAYER 3: SFX] [SFX: ${sfx}].`;

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
    console.log(`✓ Item ${item.id} (${plan.length} clips cleanly updated with 45-deg top-down optics)`);
  }

  // 2. Also update visual_overrides_json in pillar_campaigns
  const campRes = await client.query('SELECT visual_overrides_json FROM pillar_campaigns WHERE id = $1', [campaignId]);
  if (campRes.rows.length > 0 && campRes.rows[0].visual_overrides_json) {
    try {
      let vOverrides = JSON.parse(campRes.rows[0].visual_overrides_json);
      if (vOverrides.resolved) {
        vOverrides.resolved.subject_prompt = newSubject;
        vOverrides.resolved.camera_prompt = 'camera framing is top_down_45_degree_tabletop_macro, perspective is first_person_pov, shot with a 100mm Macro lens, depth of field is shallow, with subtle_handheld camera movement';
      }
      if (vOverrides.structured && vOverrides.structured.camera) {
        vOverrides.structured.camera.framing = 'top_down_45_degree_tabletop_macro';
        vOverrides.structured.camera.perspective = 'first_person_pov';
      }
      if (vOverrides.legacy) {
        vOverrides.legacy.subject_demographic_custom = newSubject;
      }
      await client.query(
        'UPDATE pillar_campaigns SET visual_overrides_json = $1 WHERE id = $2',
        [JSON.stringify(vOverrides), campaignId]
      );
      console.log(`✓ Campaign ${campaignId} visual_overrides_json cleanly updated.`);
    } catch (err) {
      console.warn('Could not update campaign visual_overrides_json:', err.message);
    }
  }

  console.log(`\n[Clean Batch Inject Complete] Successfully updated ${res.rows.length} items (${totalClipsUpdated} clips total).`);
  await client.end();
}

runPromptInjection().catch(err => {
  console.error('[Batch Inject Error]:', err);
  process.exit(1);
});
