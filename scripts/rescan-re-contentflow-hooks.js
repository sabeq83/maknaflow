const { getDb } = require('../lib/db.js');
const { pgQuery } = require('../lib/db-pg.js');

async function rescanReContentFlowHooks() {
  console.log('🔄 [RE Rescan] Starting ContentFlow Hook & Caption rescan for all RE campaigns...');

  const db = getDb();
  const items = await db.prepare(`
    SELECT r.*, c.campaign_name
    FROM re_campaign_items r
    LEFT JOIN re_campaigns c ON r.campaign_id = c.id
  `).all();

  console.log(`📦 Found ${items.length} items in re_campaign_items.`);

  let updatedCount = 0;

  for (const item of items) {
    let resObj = {};
    if (item.result_json) {
      try {
        const parsed = typeof item.result_json === 'object' ? item.result_json : JSON.parse(item.result_json);
        if (parsed && typeof parsed === 'object') resObj = parsed;
      } catch (_) {}
    }

    const hook = item.custom_hook
      || item.hook
      || resObj.hook
      || (resObj.social_media_package && resObj.social_media_package.hook)
      || (resObj.new_video_plan && Array.isArray(resObj.new_video_plan) && resObj.new_video_plan[0] ? resObj.new_video_plan[0].new_vo : '')
      || (resObj.voiceover && Array.isArray(resObj.voiceover) && resObj.voiceover[0] ? resObj.voiceover[0].narration : '')
      || '';

    const caption = item.tiktok_caption
      || item.caption
      || resObj.tiktok_caption
      || resObj.ig_caption
      || (resObj.social_media_package && resObj.social_media_package.caption)
      || resObj.caption
      || '';

    if (!hook && !caption) continue;

    // Update SQLite content_flow_items
    try {
      await db.prepare(`
        UPDATE content_flow_items
        SET hook = CASE WHEN hook = '' OR hook IS NULL THEN ? ELSE hook END,
            caption = CASE WHEN caption = '' OR caption IS NULL THEN ? ELSE caption END,
            updated_at = CURRENT_TIMESTAMP
        WHERE source_type = 're' AND (source_item_id = ? OR source_campaign_id = ?)
      `).run(hook, caption, String(item.id), item.campaign_id);
    } catch (e) {
      console.warn(`[SQLite Rescan Error] Item ${item.id}:`, e.message);
    }

    // Update PostgreSQL content_flow_items
    try {
      await pgQuery(`
        UPDATE content_flow_items
        SET hook = CASE WHEN hook = '' OR hook IS NULL THEN $1 ELSE hook END,
            caption = CASE WHEN caption = '' OR caption IS NULL THEN $2 ELSE caption END,
            updated_at = NOW()
        WHERE source_type = 're' AND (source_item_id = $3 OR source_campaign_id = $4)
      `, [hook, caption, String(item.id), item.campaign_id]);
    } catch (e) {
      console.warn(`[PG Rescan Error] Item ${item.id}:`, e.message);
    }

    updatedCount++;
  }

  console.log(`🎉 [RE Rescan Complete] Updated ${updatedCount} RE items in ContentFlow databases!`);
  process.exit(0);
}

rescanReContentFlowHooks().catch(err => {
  console.error('❌ [Rescan Error]', err);
  process.exit(1);
});
