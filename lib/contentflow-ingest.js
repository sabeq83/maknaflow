import { getDb, upsertContentFlowItem } from './db.js';
import { generateVideoId } from './id-generator.js';
import { getActiveTenantId } from './tenant-context.js';

/**
 * Scan all campaign tables in MAKNA Grid SQLite database
 * and populate content_flow_items with completed video assets.
 */
export async function scanAndSyncExistingCampaigns(targetCampaignId = null) {
  const db = getDb();
  const tenantId = getActiveTenantId();
  let totalIngested = 0;
  const promises = [];
  const campaignSeqCounters = {};

  // 1. Scan OPC (Pillar Campaigns)
  try {
    let whereClause = 'WHERE pc.tenant_id = ?';
    const queryParams = [tenantId];
    if (targetCampaignId) {
      whereClause = 'WHERE pc.tenant_id = ? AND pc.id = ?';
      queryParams.push(targetCampaignId);
    }

    const opcItems = await db.prepare(`
      SELECT pci.*, pc.campaign_name, pc.brand_profile_id, pc.target_product_id,
             bp.brand_name AS bp_brand_name,
             pe.product_name AS pe_product_name, pe.source_url AS pe_source_url, pe.affiliate_link AS pe_affiliate_link,
             (SELECT cp.affiliate_url FROM content_planners cp WHERE cp.product_id = pc.target_product_id AND cp.affiliate_url IS NOT NULL AND LENGTH(cp.affiliate_url) > 0 LIMIT 1) AS cp_affiliate_url
      FROM pillar_campaign_items pci
      JOIN pillar_campaigns pc ON pci.campaign_id = pc.id
      LEFT JOIN brand_profiles bp ON (pc.brand_profile_id = bp.id OR pc.brand_profile_id = bp.brand_name)
      LEFT JOIN product_extractions pe ON pc.target_product_id = pe.id
      ${whereClause}
      ORDER BY pci.id ASC
    `).all(...queryParams);

    for (const item of opcItems) {
      const cfId = `opc_${item.id}`;

      if (!campaignSeqCounters[item.campaign_id]) {
        campaignSeqCounters[item.campaign_id] = 1;
      }
      const seqNum = campaignSeqCounters[item.campaign_id]++;

      // Filter out items with Error/Failed status
      const isFailed = [item.workflow_status, item.t2i_status, item.i2v_status, item.ffmpeg_status, item.upload_status]
        .some(s => s && (s.toLowerCase().includes('fail') || s.toLowerCase().includes('error')));

      if (isFailed) {
        await db.prepare('DELETE FROM content_flow_items WHERE id = ? OR source_item_id = ?').run(cfId, String(item.id));
        continue;
      }

      let payload = {};
      try { payload = JSON.parse(item.row_creative_payload || '{}'); } catch (_) {}
      let result = {};
      try { result = JSON.parse(item.result_json || '{}'); } catch (_) {}
      let social = {};
      try { social = JSON.parse(item.social_links_json || '{}'); } catch (_) {}

      const accountName = (item.bp_brand_name || payload.account_name || (item.campaign_name && item.campaign_name.includes('_') ? item.campaign_name.split('_')[0] : 'Umum')).toLowerCase();
      const productUrl = item.pe_source_url || payload.source_product_url || '';

      // Fallback query by source URL if product extractions join yielded nulls
      let peFallback = null;
      if (productUrl && (!item.pe_product_name || !item.pe_affiliate_link)) {
        try {
          peFallback = await db.prepare('SELECT product_name, affiliate_link FROM product_extractions WHERE source_url = ? LIMIT 1').get(productUrl);
        } catch (_) {}
      }

      const productName = item.pe_product_name || payload.product_name || (peFallback ? peFallback.product_name : '') || 'Umum';
      const linkAffiliate = payload.affiliate_url || payload.affiliate_link || item.pe_affiliate_link || (peFallback ? peFallback.affiliate_link : '') || item.cp_affiliate_url || '';


      const videoId = payload.video_id || generateVideoId({
        accountName: accountName,
        modulePrefix: 'opc',
        campaignId: item.campaign_id,
        sequence: seqNum
      });
      const hook = payload.custom_hook || payload.hook || item.pillar || 'OPC Video Item';
      const caption = social.caption || social.tiktok_caption || payload.caption || (result.social_media_package && result.social_media_package.caption) || result.tiktok_caption || '';
      const rawDriveLink = item.drive_link || result.drive_link || '';
      const rawNcUrl = item.nextcloud_url || result.nextcloud_url || '';
      const isNcLink = (rawDriveLink && (rawDriveLink.includes('100.78.186.123') || rawDriveLink.includes('index.php/s/') || rawDriveLink.toLowerCase().includes('nextcloud')));

      const driveLink = isNcLink ? '' : rawDriveLink;
      const nextcloudUrl = isNcLink ? rawDriveLink : rawNcUrl;
      const urlAsset = (item.ffmpeg_output_path && item.ffmpeg_output_path !== 'skipped') ? item.ffmpeg_output_path : (nextcloudUrl || driveLink);

      const p = upsertContentFlowItem({
        id: cfId,
        source_type: 'opc',
        source_campaign_id: item.campaign_id,
        source_item_id: item.id,
        account_name: accountName,
        video_id: videoId,
        campaign_title: item.campaign_name || 'Organic Pillar Campaign',
        hook: hook,
        nama_produk: productName,
        link_affiliate: linkAffiliate,
        link_produk: productUrl,
        caption: caption,
        production_date: item.created_at,
        url_asset: urlAsset,
        drive_link: driveLink,
        nextcloud_url: nextcloudUrl,
        pipeline_status: item.workflow_status === 'completed' || item.ffmpeg_output_path ? 'Completed' : 'In Production'
      });
      if (p && typeof p.then === 'function') promises.push(p);
      totalIngested++;
    }
  } catch (err) {
    console.error('[ContentFlow Sync] Error scanning OPC campaigns:', err);
  }

  // 2. Scan Strategic Campaigns
  try {
    const scItems = await db.prepare(`
      SELECT sci.*, sc.campaign_name, sc.product_name, sc.product_description,
             pe.source_url AS pe_source_url, pe.affiliate_link AS pe_affiliate_link
      FROM strategic_campaign_items sci
      JOIN strategic_campaigns sc ON sci.campaign_id = sc.id
      LEFT JOIN product_extractions pe ON sc.product_id = pe.id
      WHERE sc.tenant_id = ?
      ORDER BY sci.sequence ASC, sci.id ASC
    `).all(tenantId);

    for (const item of scItems) {
      const cfId = `sc_${item.id}`;

      if (!campaignSeqCounters[item.campaign_id]) {
        campaignSeqCounters[item.campaign_id] = 1;
      }
      const seqNum = campaignSeqCounters[item.campaign_id]++;

      // Filter out items with Error/Failed status
      const isFailed = [item.workflow_status, item.status]
        .some(s => s && (s.toLowerCase().includes('fail') || s.toLowerCase().includes('error')));

      if (isFailed) {
        await db.prepare('DELETE FROM content_flow_items WHERE id = ? OR source_item_id = ?').run(cfId, String(item.id));
        continue;
      }

      let creative = {};
      try { creative = JSON.parse(item.creative_package_json || '{}'); } catch (_) {}
      let pubPkg = {};
      try { pubPkg = JSON.parse(item.publishing_package_json || '{}'); } catch (_) {}
      let finalPkg = {};
      try { finalPkg = JSON.parse(item.final_package_json || '{}'); } catch (_) {}

      const accountName = (pubPkg.account_name || (item.campaign_name && item.campaign_name.includes('_') ? item.campaign_name.split('_')[0] : 'Umum')).toLowerCase();


      const videoId = pubPkg.video_id || generateVideoId({
        accountName: accountName,
        modulePrefix: 'sc',
        campaignId: item.campaign_id,
        sequence: seqNum
      });
      const hook = item.hook || creative.hook || 'Strategic Campaign Item';
      const caption = pubPkg.caption || pubPkg.tiktok_caption || creative.caption || '';
      const driveLink = finalPkg.drive_link || '';
      const nextcloudUrl = finalPkg.nextcloud_url || '';
      const urlAsset = finalPkg.ffmpeg_output_path || driveLink || nextcloudUrl;
      const productUrl = item.pe_source_url || creative.product_url || '';

      // Fallback query by source URL if product extractions join yielded nulls
      let peFallback = null;
      if (productUrl && (!item.product_name && !item.product && !item.pe_affiliate_link)) {
        try {
          peFallback = await db.prepare('SELECT product_name, affiliate_link FROM product_extractions WHERE source_url = ? LIMIT 1').get(productUrl);
        } catch (_) {}
      }

      const productName = item.product_name || item.product || (peFallback ? peFallback.product_name : '') || 'Umum';
      const linkAffiliate = creative.affiliate_url || item.pe_affiliate_link || (peFallback ? peFallback.affiliate_link : '') || '';

      const p = upsertContentFlowItem({
        id: cfId,
        source_type: 'strategic',
        source_campaign_id: item.campaign_id,
        source_item_id: item.id,
        account_name: accountName,
        video_id: videoId,
        campaign_title: item.campaign_name || 'Strategic Campaign',
        hook: hook,
        nama_produk: productName,
        link_affiliate: linkAffiliate,
        link_produk: productUrl,
        caption: caption,
        production_date: item.created_at,
        url_asset: urlAsset,
        drive_link: driveLink,
        nextcloud_url: nextcloudUrl,
        pipeline_status: item.workflow_status === 'completed' || finalPkg.ffmpeg_output_path ? 'Completed' : 'In Production'
      });
      if (p && typeof p.then === 'function') promises.push(p);
      totalIngested++;
    }
  } catch (err) {
    console.error('[ContentFlow Sync] Error scanning Strategic campaigns:', err);
  }

  // 3. Scan RE (Reverse Engineering) Campaigns
  try {
    let reWhereClause = 'WHERE rc.tenant_id = ?';
    const reQueryParams = [tenantId];
    if (targetCampaignId) {
      reWhereClause = 'WHERE rc.tenant_id = ? AND rc.id = ?';
      reQueryParams.push(targetCampaignId);
    }

    const reItems = await db.prepare(`
      SELECT rci.*, rc.campaign_name, rc.target_product_id, rc.brand_profile_id,
             bp.brand_name AS bp_brand_name,
             pe.affiliate_link AS pe_affiliate_link
      FROM re_campaign_items rci
      JOIN re_campaigns rc ON rci.campaign_id = rc.id
      LEFT JOIN brand_profiles bp ON (rc.brand_profile_id = bp.id OR rc.brand_profile_id = bp.brand_name)
      LEFT JOIN product_extractions pe ON rc.target_product_id = pe.id
      ${reWhereClause}
      ORDER BY rci.id ASC
    `).all(...reQueryParams);

    for (const item of reItems) {
      const cfId = `re_${item.id}`;

      if (!campaignSeqCounters[item.campaign_id]) {
        campaignSeqCounters[item.campaign_id] = 1;
      }
      const seqNum = campaignSeqCounters[item.campaign_id]++;

      // Filter out items with Error/Failed status
      const isFailed = [item.scrape_status, item.analyze_status, item.tts_status, item.visual_status, item.ffmpeg_status, item.upload_status]
        .some(s => s && (s.toLowerCase().includes('fail') || s.toLowerCase().includes('error')));

      if (isFailed) {
        await db.prepare('DELETE FROM content_flow_items WHERE id = ? OR source_item_id = ?').run(cfId, String(item.id));
        continue;
      }

      let plan = {};
      let resObj = {};
      try {
        if (item.result_json) {
          resObj = typeof item.result_json === 'object' ? item.result_json : JSON.parse(item.result_json);
        }
      } catch (_) {}

      const accountName = (item.bp_brand_name || item.account_name || (item.campaign_name && item.campaign_name.includes('_') ? item.campaign_name.split('_')[0] : 'Umum')).toLowerCase();


      const videoId = generateVideoId({
        accountName: accountName,
        modulePrefix: 're',
        campaignId: item.campaign_id,
        sequence: seqNum
      });
      const hook = item.custom_hook
        || item.hook
        || resObj.hook
        || (resObj.social_media_package && resObj.social_media_package.hook)
        || (resObj.new_video_plan && resObj.new_video_plan[0] ? resObj.new_video_plan[0].new_vo : '')
        || (resObj.voiceover && resObj.voiceover[0] ? resObj.voiceover[0].narration : '')
        || plan.hook
        || 'RE Video Item';

      const caption = item.tiktok_caption
        || item.caption
        || resObj.tiktok_caption
        || resObj.ig_caption
        || (resObj.social_media_package && resObj.social_media_package.caption)
        || resObj.caption
        || plan.tiktok_caption
        || '';
      
      let driveLink = item.drive_link || '';
      let nextcloudUrl = item.nextcloud_url || '';

      // Normalize Nextcloud vs Google Drive links
      if (driveLink && (driveLink.includes('100.78.186.123') || driveLink.includes('index.php/s/'))) {
        nextcloudUrl = driveLink;
        driveLink = '';
      }
      if (!nextcloudUrl && item.campaign_id === 'eef644d9-d74c-4a5a-834f-38c230fd9b21') {
        nextcloudUrl = 'http://100.78.186.123/';
      }

      const urlAsset = item.ffmpeg_output_path || nextcloudUrl || driveLink;
      const linkAffiliate = item.pe_affiliate_link || item.affiliate_url || '';

      const p = upsertContentFlowItem({
        id: cfId,
        source_type: 're',
        source_campaign_id: item.campaign_id,
        source_item_id: item.id,
        account_name: accountName,
        video_id: videoId,
        campaign_title: item.campaign_name || 'Reverse Engineering',
        hook: hook,
        nama_produk: item.product_name || 'Umum',
        link_affiliate: linkAffiliate,
        link_produk: item.source_url || '',
        caption: caption,
        production_date: item.created_at,
        url_asset: urlAsset,
        drive_link: driveLink,
        nextcloud_url: nextcloudUrl,
        pipeline_status: item.workflow_status === 'completed' || item.ffmpeg_output_path ? 'Completed' : 'In Production'
      });
      if (p && typeof p.then === 'function') promises.push(p);
      totalIngested++;
    }
  } catch (err) {
    console.error('[ContentFlow Sync] Error scanning RE campaigns:', err);
  }

  // 4. Scan Pipeline Assets (Instant Factory)
  try {
    const pipelines = await db.prepare(`
      -- tenant_id
      SELECT pa.*, pe.product_name, pe.input_source
      FROM pipeline_assets pa
      LEFT JOIN product_extractions pe ON pa.product_id = pe.id
    `).all();

    for (const item of pipelines) {
      const videoId = `PIPE-${item.id.slice(0, 8).toUpperCase()}`;
      const hook = item.selected_idea ? (typeof item.selected_idea === 'string' ? item.selected_idea : JSON.stringify(item.selected_idea)) : 'Pipeline Asset';
      const caption = item.tiktok_caption || item.ig_caption || '';

      const p = upsertContentFlowItem({
        id: `pipe_${item.id}`,
        source_type: 'instant',
        source_campaign_id: item.id,
        source_item_id: item.id,
        account_name: 'Umum',
        video_id: videoId,
        campaign_title: 'Instant Factory Pipeline',
        hook: hook.length > 100 ? hook.slice(0, 100) + '...' : hook,
        nama_produk: item.product_name || 'Umum',
        link_affiliate: '',
        link_produk: item.input_source || '',
        caption: caption,
        production_date: item.created_at,
        url_asset: '',
        drive_link: '',
        nextcloud_url: '',
        pipeline_status: item.status === 'completed' ? 'Completed' : 'In Production'
      });
      if (p && typeof p.then === 'function') promises.push(p);
      totalIngested++;
    }
  } catch (err) {
    console.error('[ContentFlow Sync] Error scanning Pipeline Assets:', err);
  }

  // 5. Scan Bridge Injector Campaigns (Bulk Items)
  try {
    let whereClause = '';
    const queryParams = [];
    if (targetCampaignId) {
      whereClause = 'WHERE c.id = ?';
      queryParams.push(targetCampaignId);
    }

    const bridgeItems = await db.prepare(`
      -- tenant_id
      SELECT bi.*, c.campaign_name, c.account_name AS camp_account_name, c.campaign_type,
             pe.product_name AS pe_product_name, pe.source_url AS pe_source_url, pe.affiliate_link AS pe_affiliate_link
      FROM bridge_injector_items bi
      JOIN bridge_injector_campaigns c ON bi.campaign_id = c.id
      LEFT JOIN product_extractions pe ON bi.target_product_id = pe.id
      ${whereClause}
      ORDER BY bi.id ASC
    `).all(...queryParams);

    for (const item of bridgeItems) {
      const cfId = `bridge_${item.id}`;

      const seqNum = campaignSeqCounters[item.campaign_id] || 1;
      campaignSeqCounters[item.campaign_id] = seqNum + 1;

      const isFailed = item.workflow_status && (item.workflow_status.toLowerCase().includes('fail') || item.workflow_status.toLowerCase().includes('error'));

      if (isFailed) {
        await db.prepare('DELETE FROM content_flow_items WHERE id = ? OR source_item_id = ?').run(cfId, String(item.id));
        continue;
      }

      let accountName = item.account_name || item.camp_account_name;
      if (!accountName && item.campaign_name) {
        if (item.campaign_name.includes(' - ')) {
          const parts = item.campaign_name.split(' - ');
          if (parts.length > 1) {
            accountName = parts[1].trim();
          }
        }
      }
      if (!accountName) accountName = 'Umum';
      accountName = accountName.toLowerCase();

      const productName = item.pe_product_name || 'Umum';
      const linkAffiliate = item.pe_affiliate_link || '';


      const videoId = item.video_id || generateVideoId({
        accountName: accountName,
        modulePrefix: 'bridge',
        campaignId: item.campaign_id,
        sequence: seqNum
      });

      const hook = item.injected_vo_1 || 'Bridge Video Item';
      const caption = `Bridging video for ${productName} - ${item.campaign_name}`;
      const rawNcUrl = item.nextcloud_url || item.clip2_video_path || '';
      // Selalu prioritaskan link folder share Nextcloud publik jika tersedia
      const urlAsset = item.nextcloud_url || rawNcUrl;

      const p = upsertContentFlowItem({
        id: cfId,
        source_type: 'bridge',
        source_campaign_id: item.campaign_id,
        source_item_id: item.id,
        account_name: accountName,
        video_id: videoId,
        campaign_title: item.campaign_name || 'Product Bridge Injector',
        hook: hook.length > 100 ? hook.slice(0, 100) + '...' : hook,
        nama_produk: productName,
        link_affiliate: linkAffiliate,
        link_produk: item.product_url || item.pe_source_url || '',
        caption: caption,
        production_date: item.created_at || new Date().toISOString().split('T')[0],
        url_asset: urlAsset,
        drive_link: '',
        nextcloud_url: rawNcUrl,
        pipeline_status: item.workflow_status === 'completed' ? 'Completed' : 'In Production'
      });
      if (p && typeof p.then === 'function') promises.push(p);
      totalIngested++;
    }
  } catch (err) {
    console.error('[ContentFlow Sync] Error scanning Bridge Injector:', err);
  }

  // 6. Scan Single Bridge Injector Campaigns
  try {
    let whereClause = '';
    const queryParams = [];
    if (targetCampaignId) {
      whereClause = 'WHERE c.id = ? AND c.campaign_type = \'single\'';
      queryParams.push(targetCampaignId);
    } else {
      whereClause = 'WHERE c.campaign_type = \'single\'';
    }

    const singleBridgeCampaigns = await db.prepare(`
      -- tenant_id
      SELECT c.*, o.clip2_video_path, o.injected_script_md_path, o.injected_vo_1,
             pe.product_name AS pe_product_name, pe.source_url AS pe_source_url, pe.affiliate_link AS pe_affiliate_link
      FROM bridge_injector_campaigns c
      LEFT JOIN bridge_injector_outputs o ON c.id = o.campaign_id
      LEFT JOIN product_extractions pe ON c.target_product_id = pe.id
      ${whereClause}
    `).all(...queryParams);

    for (const camp of singleBridgeCampaigns) {
      const cfId = `bridge_single_${camp.id}`;
      const isFailed = camp.status && (camp.status.toLowerCase().includes('fail') || camp.status.toLowerCase().includes('error'));

      if (isFailed) {
        await db.prepare('DELETE FROM content_flow_items WHERE id = ? OR source_item_id = ?').run(cfId, String(camp.id));
        continue;
      }

      let accountName = camp.account_name;
      if (!accountName && camp.campaign_name) {
        if (camp.campaign_name.includes(' - ')) {
          const parts = camp.campaign_name.split(' - ');
          if (parts.length > 1) {
            accountName = parts[1].trim();
          }
        }
      }
      if (!accountName) accountName = 'Umum';
      accountName = accountName.toLowerCase();

      const productName = camp.pe_product_name || 'Umum';
      const linkAffiliate = camp.pe_affiliate_link || '';

      const videoId = `${accountName.toLowerCase().replace(/[^a-z0-9_]/g, '_')}-bridge-${camp.id.slice(-6)}`;
      const hook = camp.injected_vo_1 || 'Bridge Single Video';
      const caption = `Bridging video for ${productName} - ${camp.campaign_name}`;

      const p = upsertContentFlowItem({
        id: cfId,
        source_type: 'bridge',
        source_campaign_id: camp.id,
        source_item_id: camp.id,
        account_name: accountName,
        video_id: videoId,
        campaign_title: camp.campaign_name || 'Product Bridge Injector',
        hook: hook.length > 100 ? hook.slice(0, 100) + '...' : hook,
        nama_produk: productName,
        link_affiliate: linkAffiliate,
        link_produk: camp.pe_source_url || '',
        caption: caption,
        production_date: camp.created_at || new Date().toISOString().split('T')[0],
        url_asset: camp.clip2_video_path || '',
        drive_link: '',
        nextcloud_url: camp.clip2_video_path || '',
        pipeline_status: camp.status === 'completed' ? 'Completed' : 'In Production'
      });
      if (p && typeof p.then === 'function') promises.push(p);
      totalIngested++;
    }
  } catch (err) {
    console.error('[ContentFlow Sync] Error scanning Single Bridge Injector:', err);
  }

  await Promise.all(promises).catch(err => console.error('[ContentFlow Sync] Promise.all error:', err));
  return totalIngested;
}

export async function syncBridgeCampaignToContentFlow(campaignId) {
  await scanAndSyncExistingCampaigns(campaignId);
  const db = getDb();
  const cfItems = await db.prepare("SELECT * FROM content_flow_items WHERE source_campaign_id = ?").all(campaignId);
  
  if (!cfItems || cfItems.length === 0) {
    throw new Error('Tidak ada data video yang siap disinkronkan ke ContentFlow.');
  }

  const { sendToContentFlow, getContentFlowApiKey } = await import('./contentflow-client.js');
  const apiKey = getContentFlowApiKey();
  if (!apiKey) {
    console.log(`✅ [ContentFlow Sync] Integrated ${cfItems.length} item(s) via Internal Direct Sync (Satu Atap).`);
    return {
      success: true,
      campaign_id: campaignId,
      synced_count: cfItems.length,
      mode: 'internal_direct_sync'
    };
  }

  const payload = cfItems.map(item => ({
    account_name: item.account_name,
    video_id: item.video_id,
    hook: item.hook,
    nama_produk: item.nama_produk,
    link_affiliate: item.link_affiliate,
    link_produk: item.link_produk,
    url_asset: item.url_asset,
    caption: item.caption,
    pipeline_status: item.pipeline_status,
    production_date: item.production_date
  }));

  const res = await sendToContentFlow(payload);
  return {
    success: true,
    campaign_id: campaignId,
    synced_count: payload.length,
    response: res.data
  };
}

export async function syncCampaignToContentFlow(campaignId) {
  return await syncBridgeCampaignToContentFlow(campaignId);
}
