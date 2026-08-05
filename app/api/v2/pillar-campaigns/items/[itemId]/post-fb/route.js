import { NextResponse } from 'next/server';
import { getDb, updatePillarCampaignItem, getSetting } from '../../../../../../../lib/db';
import { postDraftToFacebookPage } from '../../../../../../../lib/facebook-helper';

import { withTenantContext } from '@/lib/auth';

export const POST = withTenantContext(async (req, { params }) => {
  try {
    const resolvedParams = await params;
    const itemId = resolvedParams.itemId;

    if (!itemId) {
      return NextResponse.json({ success: false, error: "itemId is required" }, { status: 400 });
    }

    const db = getDb();
    const item = await db.prepare("SELECT * FROM pillar_campaign_items WHERE id = ?").get(itemId);
    if (!item) {
      return NextResponse.json({ success: false, error: "Campaign item not found" }, { status: 404 });
    }

    const campaign = await db.prepare("SELECT * FROM pillar_campaigns WHERE id = ?").get(item.campaign_id);
    if (!campaign) {
      return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
    }

    const parsed = JSON.parse(item.result_json || '{}');
    let caption = parsed.ig_caption || parsed.instagram_caption || parsed.distribution_assets?.instagram_caption || parsed.distribution_assets?.ig_caption || parsed.caption_ig || parsed.headline || parsed.caption || parsed.script || parsed.short_desc || '';
    if (!caption) {
      caption = `Draf Video OPC Campaign - ${campaign.campaign_name} #${item.id}`;
    }

    let mediaType = 'text_only';
    let mediaUrl = null;

    const hasVideoFile = item.ffmpeg_output_path && item.ffmpeg_output_path !== 'skipped';
    if (hasVideoFile) {
      const publicServerUrl = campaign.facebook_server_url ? campaign.facebook_server_url.trim() : (await getSetting('fb_server_url') || '').trim();
      if (publicServerUrl) {
        const cleanBase = publicServerUrl.endsWith('/') ? publicServerUrl.slice(0, -1) : publicServerUrl;
        const storageProvider = await getSetting('storage_provider') || 'gdrive';

        if (storageProvider === 'nextcloud' && item.drive_link && item.drive_link.includes('/index.php/s/')) {
          const urlParts = item.drive_link.split('/index.php/s/');
          if (urlParts.length > 1) {
            const sharePath = '/index.php/s/' + urlParts[1];
            mediaUrl = cleanBase + sharePath;
            if (!mediaUrl.endsWith('/download')) {
              mediaUrl = mediaUrl.endsWith('/') ? mediaUrl + 'download' : mediaUrl + '/download';
            }
            mediaType = 'video';
          }
        }

        if (!mediaUrl) {
          const cleanPath = item.ffmpeg_output_path.startsWith('/') ? item.ffmpeg_output_path : '/' + item.ffmpeg_output_path;
          mediaUrl = cleanBase + cleanPath;
          mediaType = 'video';
        }
      } else {
        return NextResponse.json({ success: false, error: "Facebook public server URL is not configured. Silakan atur di menu Settings." }, { status: 400 });
      }
    } else {
      return NextResponse.json({ success: false, error: "Video output file not found. Silakan render FFmpeg terlebih dahulu." }, { status: 400 });
    }

    console.log(`[OPC Manual FB Post] Dispatching ${mediaType} draft for OPC item #${item.id} with URL ${mediaUrl}...`);
    const fbRes = await postDraftToFacebookPage({
      message: caption,
      mediaUrl,
      mediaType,
      pageId: campaign.facebook_page_id || await getSetting('fb_page_id')
    });

    if (!fbRes.success) {
      await updatePillarCampaignItem(item.id, { 
        social_post_status: 'failed',
        social_links_json: JSON.stringify({ facebook_error: fbRes.error })
      });
      return NextResponse.json({ success: false, error: fbRes.error }, { status: 400 });
    }

    // Save Facebook link to social_links_json
    let results = {};
    try {
      results = JSON.parse(item.social_links_json || '{}');
    } catch {}
    const firstPageId = (await getSetting('fb_page_ids') || '').split(',')[0].trim();
    results.facebook = `https://business.facebook.com/latest/home?asset_id=${campaign.facebook_page_id || await getSetting('fb_page_id') || firstPageId}`;
    results.fb_post_id = fbRes.fb_post_id;

    await updatePillarCampaignItem(item.id, { 
      social_post_status: 'completed',
      social_links_json: JSON.stringify(results)
    });

    return NextResponse.json({
      success: true,
      message: 'Draft postingan berhasil dikirim ke Facebook Page!',
      data: { fb_post_id: fbRes.fb_post_id }
    });

  } catch (error) {
    console.error('[OPC Manual FB Post API Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
