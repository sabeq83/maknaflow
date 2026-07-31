const { pgQuery } = require('../lib/db-pg');
const { getDb } = require('../lib/db');
const { generateVideoId } = require('../lib/id-generator.js');

async function importReCampaignToNutribake() {
  const CAMPAIGN_ID = '66b4d649-8045-4edf-b3e4-375428108797';
  const TARGET_ACCOUNT = 'nutribake';
  const SOURCE_URL = `http://100.65.62.63:3003/api/v2/re-campaigns/${CAMPAIGN_ID}`;

  console.log(`🚀 [Import Script] Connecting to ${SOURCE_URL}...`);

  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch source campaign: ${response.status} ${response.statusText}`);
  }

  const resData = await response.json();
  const campaign = resData.campaign || resData;
  const items = resData.items || campaign.items || [];

  if (!campaign || (!campaign.id && !campaign.campaign_name)) {
    throw new Error('Invalid campaign payload received from source server');
  }

  const campaignTitle = campaign.campaign_name || 'Resep Alpukat Smoothie';
  console.log(`📦 [Import Script] Found Campaign: "${campaignTitle}" (Items: ${items.length})`);

  const sqliteDb = getDb();

  // 1. Insert or Update re_campaigns in PostgreSQL & SQLite
  try {
    const sqlPgCamp = `
      INSERT INTO re_campaigns (
        id, campaign_name, status, aspect_ratio, target_ai, custom_instruction,
        promotion_style, narrative_mode, voice_provider, voice_persona, voice_speed, voice_volume,
        ffmpeg_sync_option, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET campaign_name = $2, status = $3;
    `;
    await pgQuery(sqlPgCamp, [
      CAMPAIGN_ID, campaignTitle, campaign.status || 'completed',
      campaign.aspect_ratio || '9:16', campaign.target_ai || 'Google Veo (8s)',
      campaign.custom_instruction || '', campaign.promotion_style || 'Softselling',
      campaign.narrative_mode || 'Storytelling', campaign.voice_provider || 'gemini',
      campaign.voice_persona || 'Kore', campaign.voice_speed || 1.0,
      campaign.voice_volume || 1.0, campaign.ffmpeg_sync_option || 'shortest'
    ]);
    console.log(`✓ [PostgreSQL Node 3] Campaign "${campaignTitle}" registered in re_campaigns.`);
  } catch (err) {
    console.warn(`[PostgreSQL Node 3 Warning] Campaign insert:`, err.message);
  }

  try {
    const sqliteStmt = sqliteDb.prepare(`
      INSERT OR REPLACE INTO re_campaigns (
        id, campaign_name, status, aspect_ratio, target_ai, custom_instruction,
        promotion_style, narrative_mode, voice_provider, voice_persona, voice_speed, voice_volume,
        ffmpeg_sync_option, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    sqliteStmt.run(
      CAMPAIGN_ID, campaignTitle, campaign.status || 'completed',
      campaign.aspect_ratio || '9:16', campaign.target_ai || 'Google Veo (8s)',
      campaign.custom_instruction || '', campaign.promotion_style || 'Softselling',
      campaign.narrative_mode || 'Storytelling', campaign.voice_provider || 'gemini',
      campaign.voice_persona || 'Kore', campaign.voice_speed || 1.0,
      campaign.voice_volume || 1.0, campaign.ffmpeg_sync_option || 'shortest'
    );
    console.log(`✓ [SQLite Node 1] Campaign "${campaignTitle}" registered in re_campaigns.`);
  } catch (err) {
    console.warn(`[SQLite Node 1 Warning] Campaign insert:`, err.message);
  }

  // 2. Process each item: insert into re_campaign_items AND content_flow_items
  let insertedCount = 0;

  for (const item of items) {
    insertedCount++;
    const videoId = generateVideoId({
      accountName: TARGET_ACCOUNT,
      modulePrefix: 're',
      campaignId: CAMPAIGN_ID,
      sequence: insertedCount
    });
    const cfId = `re_${item.id}`;

    // Parse JSON fields
    const resJsonStr = typeof item.result_json === 'object' ? JSON.stringify(item.result_json) : (item.result_json || '');
    const visTaskStr = typeof item.visual_tasks_json === 'object' ? JSON.stringify(item.visual_tasks_json) : (item.visual_tasks_json || '');
    const visClipStr = typeof item.visual_clip_paths === 'object' ? JSON.stringify(item.visual_clip_paths) : (item.visual_clip_paths || '');
    const socLinkStr = typeof item.social_links_json === 'object' ? JSON.stringify(item.social_links_json) : (item.social_links_json || '');
    const dnaStr = typeof item.video_dna_json === 'object' ? JSON.stringify(item.video_dna_json) : (item.video_dna_json || '');
    const t2iImgStr = typeof item.t2i_images_json === 'object' ? JSON.stringify(item.t2i_images_json) : (item.t2i_images_json || '');

    // 2a. Insert/Replace into re_campaign_items (SQLite)
    try {
      const stmtReItem = sqliteDb.prepare(`
        INSERT OR REPLACE INTO re_campaign_items (
          id, campaign_id, source_url, scrape_status, local_video_path,
          analyze_status, result_json, tts_status, tts_batch_id,
          visual_status, visual_tasks_json, visual_clip_paths, ffmpeg_status,
          ffmpeg_output_path, upload_status, drive_link, social_post_status,
          social_links_json, t2i_start_frame_path, video_dna_json, t2i_images_json,
          workflow_status, product_url, original_voiceover, tiktok_safe_voiceover,
          compliance_status, selected_vo_version
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?
        )
      `);
      stmtReItem.run(
        item.id, CAMPAIGN_ID, item.source_url || '', item.scrape_status || 'downloaded', item.local_video_path || '',
        item.analyze_status || 'analyzed', resJsonStr, item.tts_status || 'completed', item.tts_batch_id || '',
        item.visual_status || 'completed', visTaskStr, visClipStr, item.ffmpeg_status || 'completed',
        item.ffmpeg_output_path || '', item.upload_status || 'completed', item.drive_link || '', item.social_post_status || 'completed',
        socLinkStr, item.t2i_start_frame_path || '', dnaStr, t2iImgStr,
        item.workflow_status || 'completed', item.product_url || '', item.original_voiceover || '', item.tiktok_safe_voiceover || '',
        item.compliance_status || 'pending', item.selected_vo_version || 'original'
      );
    } catch (sqErr) {
      console.warn(`[SQLite re_campaign_items Error] Item ${item.id}:`, sqErr.message);
    }

    // 2b. Insert into re_campaign_items (PostgreSQL Node 3)
    try {
      const pgSqlItem = `
        INSERT INTO re_campaign_items (
          id, campaign_id, source_url, scrape_status, local_video_path,
          analyze_status, result_json, tts_status, tts_batch_id,
          visual_status, visual_tasks_json, visual_clip_paths, ffmpeg_status,
          ffmpeg_output_path, upload_status, drive_link, social_post_status,
          social_links_json, t2i_start_frame_path, video_dna_json, t2i_images_json,
          workflow_status, product_url, original_voiceover, tiktok_safe_voiceover,
          compliance_status, selected_vo_version
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12, $13,
          $14, $15, $16, $17,
          $18, $19, $20, $21,
          $22, $23, $24, $25,
          $26, $27
        )
        ON CONFLICT (id) DO UPDATE SET
          result_json = EXCLUDED.result_json,
          video_dna_json = EXCLUDED.video_dna_json,
          t2i_images_json = EXCLUDED.t2i_images_json,
          workflow_status = EXCLUDED.workflow_status;
      `;
      await pgQuery(pgSqlItem, [
        item.id, CAMPAIGN_ID, item.source_url || '', item.scrape_status || 'downloaded', item.local_video_path || '',
        item.analyze_status || 'analyzed', resJsonStr, item.tts_status || 'completed', item.tts_batch_id || '',
        item.visual_status || 'completed', visTaskStr, visClipStr, item.ffmpeg_status || 'completed',
        item.ffmpeg_output_path || '', item.upload_status || 'completed', item.drive_link || '', item.social_post_status || 'completed',
        socLinkStr, item.t2i_start_frame_path || '', dnaStr, t2iImgStr,
        item.workflow_status || 'completed', item.product_url || '', item.original_voiceover || '', item.tiktok_safe_voiceover || '',
        item.compliance_status || 'pending', item.selected_vo_version || 'original'
      ]);
    } catch (pgErr) {
      console.warn(`[PG re_campaign_items Error] Item ${item.id}:`, pgErr.message);
    }

    // Parse result_json for ContentFlow Hook & Caption
    let parsedRes = {};
    if (item.result_json) {
      try {
        parsedRes = typeof item.result_json === 'string' ? JSON.parse(item.result_json) : item.result_json;
      } catch (_) {}
    }

    let caption = item.caption || parsedRes.tiktok_caption || parsedRes.ig_caption || (parsedRes.social_package && parsedRes.social_package.caption) || parsedRes.caption || '';
    let hook = item.hook || (parsedRes.voiceover && parsedRes.voiceover[0] ? parsedRes.voiceover[0].narration : '') || parsedRes.hook || '';

    let assetUrl = item.drive_link || item.ffmpeg_output_path || item.local_video_path || '';
    if (Array.isArray(item.glabs_tasks) && item.glabs_tasks.length > 0) {
      const completedGlabs = item.glabs_tasks.find(g => g.status === 'completed' && g.video_url);
      if (completedGlabs) {
        assetUrl = completedGlabs.video_url;
      }
    }

    const namaProduk = item.product_name || campaign.product_name || 'Nutribake Alpukat Smoothie';
    const linkAffiliate = campaign.affiliate_url || '';
    const linkProduk = campaign.product_url || '';
    const todayStr = new Date().toISOString();

    // 2c. PostgreSQL Node 3 Insert into content_flow_items
    try {
      const pgSqlCF = `
        INSERT INTO content_flow_items (
          id, source_type, source_campaign_id, source_item_id, account_name,
          video_id, campaign_title, hook, nama_produk, link_affiliate, link_produk,
          caption, production_date, url_asset, drive_link, nextcloud_url,
          pipeline_status, tiktok_status, facebook_status, instagram_status, youtube_status,
          created_at, updated_at
        )
        VALUES (
          $1, 're', $2, $3, $4,
          $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15,
          'Completed', 'Not Published', 'Not Published', 'Not Published', 'Not Published',
          NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          account_name = EXCLUDED.account_name,
          video_id = EXCLUDED.video_id,
          campaign_title = EXCLUDED.campaign_title,
          hook = EXCLUDED.hook,
          nama_produk = EXCLUDED.nama_produk,
          link_affiliate = EXCLUDED.link_affiliate,
          link_produk = EXCLUDED.link_produk,
          caption = EXCLUDED.caption,
          url_asset = EXCLUDED.url_asset,
          nextcloud_url = EXCLUDED.nextcloud_url,
          updated_at = NOW();
      `;

      await pgQuery(pgSqlCF, [
        cfId, CAMPAIGN_ID, String(item.id), TARGET_ACCOUNT,
        videoId, campaignTitle, hook, namaProduk, linkAffiliate, linkProduk,
        caption, todayStr, assetUrl, item.drive_link || '', assetUrl
      ]);
    } catch (pgErr) {
      console.warn(`[PostgreSQL Node 3 Error] Item ${item.id}:`, pgErr.message);
    }

    // 2d. SQLite Insert into content_flow_items
    try {
      const sqliteStmtCF = sqliteDb.prepare(`
        INSERT OR REPLACE INTO content_flow_items (
          id, source_type, source_campaign_id, source_item_id, account_name,
          video_id, campaign_title, hook, nama_produk, link_affiliate, link_produk,
          caption, production_date, url_asset, drive_link, nextcloud_url,
          pipeline_status, tiktok_status, facebook_status, instagram_status, youtube_status,
          created_at, updated_at
        )
        VALUES (
          ?, 're', ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          'Completed', 'Not Published', 'Not Published', 'Not Published', 'Not Published',
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `);

      sqliteStmtCF.run(
        cfId, CAMPAIGN_ID, String(item.id), TARGET_ACCOUNT,
        videoId, campaignTitle, hook, namaProduk, linkAffiliate, linkProduk,
        caption, todayStr, assetUrl, item.drive_link || '', assetUrl
      );
    } catch (sqErr) {
      console.warn(`[SQLite Node 1 Error] Item ${item.id}:`, sqErr.message);
    }

    console.log(`  [Item ${insertedCount}/${items.length}] Synced to re_campaign_items & content_flow_items (video_id: "${videoId}")`);
  }

  console.log(`\n🎉 [Import Success] Successfully ingested campaign & ${insertedCount} items into re_campaign_items and content_flow_items under account "${TARGET_ACCOUNT}"!`);
  process.exit(0);
}

importReCampaignToNutribake().catch(err => {
  console.error('❌ [Import Error]', err);
  process.exit(1);
});
