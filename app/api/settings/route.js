import { NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/lib/db';
import { testGeminiConnection } from '@/lib/gemini';
import { getCurrentUser, withTenantContext } from '@/lib/auth';
import { isNewSecret, maskSecret } from '@/lib/secret-values';

function requireSettingsAdmin(request) {
  const user = getCurrentUser(request);
  if (!user) {
    const error = new Error('Unauthorized'); error.status = 401; throw error;
  }
  if (user.role !== 'admin') {
    const error = new Error('Hanya Admin tenant yang dapat mengelola credential.'); error.status = 403; throw error;
  }
  return user;
}

export const GET = withTenantContext(async (request, user) => {
  try {
    if (user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Hanya Admin tenant yang dapat mengelola credential.' }, { status: 403 });
    }
    const apiKey = await getSetting('gemini_api_key');
    const minimaxKey = await getSetting('minimax_api_key');
    const webhookKey = await getSetting('webhook_api_key');
    const nextcloudPassword = await getSetting('nextcloud_app_password');
    return NextResponse.json({
      success: true,
      data: {
        gemini_api_key: maskSecret(apiKey) || null,
        has_api_key: !!apiKey,
        gemini_api_tier: await getSetting('gemini_api_tier') || 'paid',
        gemini_context_caching: await getSetting('gemini_context_caching') || 'on',
        minimax_api_key: maskSecret(minimaxKey) || null,
        has_minimax_key: !!minimaxKey,
        minimax_group_id: await getSetting('minimax_group_id') || '',
        webhook_api_key: maskSecret(webhookKey),
        has_webhook_key: !!webhookKey,
        webhook_host: await getSetting('webhook_host') || '100.117.59.92',
        webhook_port: await getSetting('webhook_port') || '8765',
        webhook_image_model: await getSetting('webhook_image_model') || 'nano_banana_pro',
        webhook_video_model: await getSetting('webhook_video_model') || 'veo_31_lite_relaxed',
        webhook_delay_enabled: await getSetting('webhook_delay_enabled') !== null ? Number(await getSetting('webhook_delay_enabled')) : 1,
        webhook_delay_min: await getSetting('webhook_delay_min') !== null ? Number(await getSetting('webhook_delay_min')) : 10,
        webhook_delay_max: await getSetting('webhook_delay_max') !== null ? Number(await getSetting('webhook_delay_max')) : 20,
        webhook_t2i_pattern: await getSetting('webhook_t2i_pattern') || 'threading',
        // V3 Workspace & Drive Target Folder
        drive_target_folder: await getSetting('drive_target_folder') || '/MAKNA_Video_Generations',
        drive_glabs_folder_id: await getSetting('drive_glabs_folder_id') || '',
        drive_re_markdown_folder_id: await getSetting('drive_re_markdown_folder_id') || '',
        master_re_sheet_id: await getSetting('master_re_sheet_id') || '',
        drive_product_photo_folder: await getSetting('drive_product_photo_folder') || '_fotoproduk',
        // Nextcloud
        storage_provider: await getSetting('storage_provider') || 'gdrive',
        nextcloud_url: await getSetting('nextcloud_url') || '',
        nextcloud_username: await getSetting('nextcloud_username') || '',
        nextcloud_app_password: maskSecret(nextcloudPassword),
        has_nextcloud_password: !!nextcloudPassword,
        nextcloud_target_folder: await getSetting('nextcloud_target_folder') || '/MAKNA_Video_Generations',
        save_to_local_storage: Number(await getSetting('save_to_local_storage') || 0),
        local_storage_path: await getSetting('local_storage_path') || 'renders',
        // Facebook Page Credentials
        fb_page_id: await getSetting('fb_page_id') || '',
        fb_page_ids: await getSetting('fb_page_ids') || '',
        fb_page_token: maskSecret(await getSetting('fb_page_token')),
        has_fb_token: !!await getSetting('fb_page_token'),
        fb_server_url: await getSetting('fb_server_url') || '',
        scraper_headless_enabled: await getSetting('scraper_headless_enabled') !== null ? Number(await getSetting('scraper_headless_enabled')) : 1,
        scraper_use_cdp: await getSetting('scraper_use_cdp') !== null ? Number(await getSetting('scraper_use_cdp')) : 0,
        scraper_chrome_profile: await getSetting('scraper_chrome_profile') || 'Default',
        ytdlp_cookies_from_browser: await getSetting('ytdlp_cookies_from_browser') || 'none',
        // Content Flow Direct Ingestion API
        contentflow_api_key: maskSecret(await getSetting('contentflow_api_key')),
        has_contentflow_key: !!await getSetting('contentflow_api_key'),
        contentflow_api_url: await getSetting('contentflow_api_url') || 'http://100.78.186.123:3001/api/v1/content/ingest',
      }
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status || 500 });
  }
});

export const POST = withTenantContext(async (request, user) => {
  try {
    if (user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Hanya Admin tenant yang dapat mengelola credential.' }, { status: 403 });
    }
    const body = await request.json();
    const { gemini_api_key, gemini_api_tier, gemini_context_caching, google_client_id, google_client_secret,
      webhook_api_key, webhook_host, webhook_port, webhook_image_model, webhook_video_model,
      webhook_delay_enabled, webhook_delay_min, webhook_delay_max, webhook_t2i_pattern,
      drive_target_folder, drive_glabs_folder_id, drive_re_markdown_folder_id, master_re_sheet_id, drive_product_photo_folder,
      storage_provider, nextcloud_url, nextcloud_username, nextcloud_app_password, nextcloud_target_folder,
      minimax_api_key, minimax_group_id, save_to_local_storage, local_storage_path,
      fb_page_id, fb_page_ids, fb_page_token, fb_server_url, scraper_headless_enabled, scraper_use_cdp, scraper_chrome_profile, ytdlp_cookies_from_browser,
      contentflow_api_key, contentflow_api_url } = body;
    
    if (isNewSecret(gemini_api_key)) {
      await setSetting('gemini_api_key', gemini_api_key);
    }
    if (gemini_api_tier !== undefined) {
      await setSetting('gemini_api_tier', gemini_api_tier);
    }
    if (gemini_context_caching !== undefined) {
      await setSetting('gemini_context_caching', gemini_context_caching);
    }
    if (isNewSecret(minimax_api_key)) {
      await setSetting('minimax_api_key', minimax_api_key);
    }
    if (minimax_group_id !== undefined) {
      await setSetting('minimax_group_id', minimax_group_id);
    }
    if (google_client_id) {
      await setSetting('google_client_id', google_client_id);
    }
    if (isNewSecret(google_client_secret)) {
      await setSetting('google_client_secret', google_client_secret);
    }
    if (isNewSecret(webhook_api_key)) await setSetting('webhook_api_key', webhook_api_key);
    if (webhook_host !== undefined) await setSetting('webhook_host', webhook_host);
    if (webhook_port !== undefined) await setSetting('webhook_port', webhook_port);
    if (webhook_image_model !== undefined) await setSetting('webhook_image_model', webhook_image_model);
    if (webhook_video_model !== undefined) await setSetting('webhook_video_model', webhook_video_model);
    if (webhook_delay_enabled !== undefined) await setSetting('webhook_delay_enabled', String(webhook_delay_enabled ? 1 : 0));
    if (webhook_delay_min !== undefined) await setSetting('webhook_delay_min', String(webhook_delay_min));
    if (webhook_delay_max !== undefined) await setSetting('webhook_delay_max', String(webhook_delay_max));
    if (webhook_t2i_pattern !== undefined) await setSetting('webhook_t2i_pattern', webhook_t2i_pattern);
    // V3 Workspace
    if (drive_target_folder !== undefined) await setSetting('drive_target_folder', drive_target_folder);
    if (drive_glabs_folder_id !== undefined) await setSetting('drive_glabs_folder_id', drive_glabs_folder_id);
    if (drive_re_markdown_folder_id !== undefined) await setSetting('drive_re_markdown_folder_id', drive_re_markdown_folder_id);
    if (master_re_sheet_id !== undefined) await setSetting('master_re_sheet_id', master_re_sheet_id);
    if (drive_product_photo_folder !== undefined) await setSetting('drive_product_photo_folder', drive_product_photo_folder);
    // Nextcloud
    if (storage_provider !== undefined) await setSetting('storage_provider', storage_provider);
    if (nextcloud_url !== undefined) await setSetting('nextcloud_url', nextcloud_url);
    if (nextcloud_username !== undefined) await setSetting('nextcloud_username', nextcloud_username);
    if (isNewSecret(nextcloud_app_password)) await setSetting('nextcloud_app_password', nextcloud_app_password);
    if (nextcloud_target_folder !== undefined) await setSetting('nextcloud_target_folder', nextcloud_target_folder);
    if (save_to_local_storage !== undefined) await setSetting('save_to_local_storage', String(save_to_local_storage));
    if (local_storage_path !== undefined) await setSetting('local_storage_path', local_storage_path);
    // Facebook Page Credentials
    if (fb_page_id !== undefined) await setSetting('fb_page_id', fb_page_id);
    if (fb_page_ids !== undefined) await setSetting('fb_page_ids', fb_page_ids);
    if (isNewSecret(fb_page_token)) await setSetting('fb_page_token', fb_page_token);
    if (fb_server_url !== undefined) await setSetting('fb_server_url', fb_server_url);
    if (scraper_headless_enabled !== undefined) await setSetting('scraper_headless_enabled', String(scraper_headless_enabled ? 1 : 0));
    if (scraper_use_cdp !== undefined) await setSetting('scraper_use_cdp', String(scraper_use_cdp ? 1 : 0));
    if (scraper_chrome_profile !== undefined) await setSetting('scraper_chrome_profile', scraper_chrome_profile);
    if (ytdlp_cookies_from_browser !== undefined) await setSetting('ytdlp_cookies_from_browser', ytdlp_cookies_from_browser);
    // Content Flow Direct Ingestion API
    if (isNewSecret(contentflow_api_key)) await setSetting('contentflow_api_key', contentflow_api_key);
    if (contentflow_api_url !== undefined) await setSetting('contentflow_api_url', contentflow_api_url);

    return NextResponse.json({ success: true, message: 'Settings saved' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status || 500 });
  }
});
