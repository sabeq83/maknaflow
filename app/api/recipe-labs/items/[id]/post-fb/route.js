import { NextResponse } from 'next/server';
import { getRecipeItemById, getRecipeCampaignById, updateRecipeItem, getSetting } from '@/lib/db';
import { postDraftToFacebookPage, formatFacebookRecipeCaption } from '@/lib/facebook-helper';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const item = await getRecipeItemById(id);

    if (!item) {
      return NextResponse.json({ success: false, error: 'Item resep tidak ditemukan.' }, { status: 404 });
    }

    const campaign = await getRecipeCampaignById(item.campaign_id);
    const body = await request.json().catch(() => ({}));
    const postType = body.post_type || 'text_only'; // 'text_only' atau 'photo'

    const caption = formatFacebookRecipeCaption(item.recipe_title, item.recipe_markdown_text);
    let mediaUrl = null;
    let mediaType = 'text_only';

    if (postType === 'photo' && campaign?.nextcloud_folder_url) {
      let cleanShareUrl = campaign.nextcloud_folder_url.replace(/\/+$/, '');
      const nextcloudUrl = await getSetting('nextcloud_url');
      const fbServerUrl = await getSetting('fb_server_url');

      if (nextcloudUrl && fbServerUrl) {
        const cleanNcBase = nextcloudUrl.replace(/\/+$/, '');
        const cleanFbBase = fbServerUrl.replace(/\/+$/, '');
        if (cleanShareUrl.startsWith(cleanNcBase)) {
          cleanShareUrl = cleanShareUrl.replace(cleanNcBase, cleanFbBase);
          console.log(`[Facebook Draft] Replaced local Nextcloud base URL with public base: ${cleanShareUrl}`);
        }
      }

      mediaUrl = cleanShareUrl.includes('/download') ? cleanShareUrl : `${cleanShareUrl}/download`;
      mediaType = 'image';
    }

    console.log(`[Manual FB Post] Dispatching ${mediaType} draft for item #${item.id}...`);
    const fbRes = await postDraftToFacebookPage({ message: caption, mediaUrl, mediaType });

    if (!fbRes.success) {
      await updateRecipeItem(item.id, { fb_post_status: `failed: ${fbRes.error}` });
      return NextResponse.json({ success: false, error: fbRes.error }, { status: 400 });
    }

    await updateRecipeItem(item.id, { fb_post_id: fbRes.fb_post_id, fb_post_status: 'draft_created' });

    return NextResponse.json({
      success: true,
      message: 'Draft postingan berhasil dikirim ke Facebook Page!',
      data: { fb_post_id: fbRes.fb_post_id }
    });

  } catch (error) {
    console.error('[Manual FB Post API Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
