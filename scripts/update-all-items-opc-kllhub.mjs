import { getPgPool, closePgPool } from '../lib/db-pg.js';

async function updateAllItems() {
  const pool = getPgPool();

  console.log('🔄 Fetching master visual_overrides from staging.pillar_campaigns for opc_260928_kllhub...');
  const campRes = await pool.query(`SELECT visual_overrides_json FROM staging.pillar_campaigns WHERE id = 'opc_260928_kllhub'`);
  if (campRes.rows.length === 0) {
    throw new Error('Campaign opc_260928_kllhub not found in staging.pillar_campaigns');
  }

  const masterOverrides = JSON.parse(campRes.rows[0].visual_overrides_json);
  const itemsRes = await pool.query(`
    SELECT id, result_json, new_video_plan_json 
    FROM staging.pillar_campaign_items 
    WHERE campaign_id = 'opc_260928_kllhub'
    ORDER BY id ASC
  `);

  console.log(`Found ${itemsRes.rows.length} items in staging.pillar_campaign_items to update.`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const row of itemsRes.rows) {
      console.log(`\nProcessing Item ID: ${row.id}...`);

      let resultJsonStr = row.result_json || '{}';
      let planJsonStr = row.new_video_plan_json || '{}';

      // Transform Text Tokens from Editorial Graphic Novel -> Culinary Cinematic Photorealism
      const replacements = [
        [/editorial_graphic_novel/g, 'culinary_cinematic'],
        [/modern editorial political illustration/gi, 'cinematic culinary and student lifestyle photography, warm appetizing realism'],
        [/modern graphic novel aesthetic/gi, 'photorealistic culinary and lifestyle cinematography, authentic natural lighting'],
        [/political illustration aesthetic/gi, 'commercial food and student lifestyle realism, appetizing visual storytelling'],
        [/intelligent visual journalism storytelling/gi, 'authentic documentary and lifestyle storytelling, natural film aesthetics'],
        [/printed_paper_grain,\s*editorial_ink,\s*matte vector ink finish/gi, 'natural_skin_textures, authentic_steam_and_moisture, warm_wood_and_ceramic, 8k_photorealistic_film_optics'],
        [/printed_paper_grain,\s*editorial_ink,\s*tactile paper fibers/gi, 'natural_skin_textures, authentic_steam_and_moisture, warm_wood_and_ceramic, 8k_photorealistic_film_optics'],
        [/printed_paper_grain,\s*editorial_ink,\s*matte vector finish/gi, 'natural_skin_textures, authentic_steam_and_moisture, warm_wood_and_ceramic, 8k_photorealistic_film_optics'],
        [/printed_paper_grain,\s*tactile paper texture,\s*editorial_ink/gi, 'natural_skin_textures, authentic_steam_and_moisture, warm_wood_and_ceramic, 8k_photorealistic_film_optics'],
        [/printed_paper_grain,\s*matte_editorial_ink/gi, 'natural_skin_textures, authentic_steam_and_moisture, warm_wood_and_ceramic, 8k_photorealistic_film_optics'],
        [/matte vector ink with printed paper grain/gi, 'photorealistic cinematic film grain with natural lighting roll-off'],
        [/sharp graphic silhouettes/gi, 'natural organic contours and clean depth of field'],
        [/tekstur kertas cetak/gi, 'pencahayaan natural sinematik dan tekstur fotorealistis'],
        [/gaya estetika editorial graphic novel/gi, 'gaya estetika culinary cinematic dan student lifestyle photorealistic'],
        [/editorial editorial graphic novel/gi, 'culinary cinematic']
      ];

      for (const [pattern, repl] of replacements) {
        resultJsonStr = resultJsonStr.replace(pattern, repl);
        planJsonStr = planJsonStr.replace(pattern, repl);
      }

      // Parse and update structured fields
      const resultObj = JSON.parse(resultJsonStr);
      const planObj = JSON.parse(planJsonStr);

      resultObj.resolved_visual_overrides = masterOverrides.resolved || resultObj.resolved_visual_overrides;

      // Update scenes in storyboard & plan
      if (Array.isArray(resultObj.storyboard)) {
        resultObj.storyboard.forEach(clip => {
          if (clip.visual_mode === 'editorial_graphic_novel') {
            clip.visual_mode = 'culinary_cinematic';
          }
        });
      }

      if (Array.isArray(resultObj.t2i_prompts)) {
        resultObj.t2i_prompts.forEach(p => {
          if (p && typeof p.prompt === 'string') {
            for (const [pattern, repl] of replacements) {
              p.prompt = p.prompt.replace(pattern, repl);
            }
          }
        });
      }

      // Update new_video_plan_json
      const sceneKeys = Object.keys(planObj);
      for (const k of sceneKeys) {
        const scene = planObj[k];
        if (scene && typeof scene === 'object') {
          if (scene.t2i_prompt) {
            for (const [pattern, repl] of replacements) {
              scene.t2i_prompt = scene.t2i_prompt.replace(pattern, repl);
            }
          }
          if (scene.i2v_prompt) {
            for (const [pattern, repl] of replacements) {
              scene.i2v_prompt = scene.i2v_prompt.replace(pattern, repl);
            }
          }
        }
      }

      const updatedResultJson = JSON.stringify(resultObj);
      const updatedPlanJson = JSON.stringify(planObj);

      await client.query(`
        UPDATE staging.pillar_campaign_items
        SET result_json = $1, new_video_plan_json = $2
        WHERE id = $3
      `, [updatedResultJson, updatedPlanJson, row.id]);

      console.log(`✅ Item ${row.id} updated.`);
    }

    await client.query('COMMIT');
    console.log('\n🎉 ALL 7 ITEMS IN STAGING.PILLAR_CAMPAIGN_ITEMS SUCCESSFULLY UPDATED!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error updating items:', err);
    throw err;
  } finally {
    client.release();
  }

  await closePgPool();
}

updateAllItems().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
