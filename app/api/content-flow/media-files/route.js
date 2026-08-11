import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getContentFlowItemByVideoId } from '@/lib/contentflow-repository';
import { getSetting } from '@/lib/db';
import { createClient } from 'webdav';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');
    const folderUrl = searchParams.get('folderUrl');

    let targetShareUrl = folderUrl || '';
    let item = null;

    if (videoId) {
      item = await getContentFlowItemByVideoId(videoId);
      if (item) {
        targetShareUrl = item.nextcloud_url || item.drive_link || item.url_asset || '';
      }
    }

    if (!targetShareUrl) {
      return NextResponse.json({ success: false, error: 'URL atau Video ID tidak ditemukan.' }, { status: 400 });
    }

    // Ekstrak share token dari Nextcloud URL
    let shareToken = '';
    if (targetShareUrl.includes('/index.php/s/')) {
      const parts = targetShareUrl.split('/index.php/s/');
      shareToken = parts[1].split('/')[0].split('?')[0];
    } else if (targetShareUrl.includes('/s/')) {
      const parts = targetShareUrl.split('/s/');
      shareToken = parts[1].split('/')[0].split('?')[0];
    }

    const publicCloudDomain = (getSetting('fb_server_url') || getSetting('nextcloud_url') || 'https://cloud.ast402.my.id').replace(/\/+$/, '');
    const internalNcBase = (getSetting('nextcloud_url') || 'http://100.78.186.123').replace(/\/+$/, '');

    const filesList = [];

    if (shareToken) {
      let contents = null;
      const hostsToTry = [internalNcBase, publicCloudDomain, 'http://100.78.186.123', 'https://cloud.ast402.my.id'];
      const uniqueHosts = [...new Set(hostsToTry.filter(Boolean))];

      for (const host of uniqueHosts) {
        try {
          const publicClient = createClient(`${host}/public.php/webdav/`, {
            username: shareToken,
            password: ''
          });
          contents = await publicClient.getDirectoryContents('/');
          if (Array.isArray(contents) && contents.length > 0) break;
        } catch (err) {
          // Try next host
        }
      }

      if (Array.isArray(contents)) {
        for (const c of contents) {
          if (c.type === 'file') {
            const isVideo = /\.(mp4|mov|webm)$/i.test(c.basename);
            const isImage = /\.(png|jpg|jpeg|webp)$/i.test(c.basename);
            const isAudio = /\.(mp3|wav|ogg|m4a)$/i.test(c.basename);

            const directUrl = `${publicCloudDomain}/index.php/s/${shareToken}/download?files=${encodeURIComponent(c.basename)}`;
            const isRecommended = c.basename.includes('_video_final') || (isVideo && !c.basename.includes('_audio') && !c.basename.includes('_clip_'));

            filesList.push({
              name: c.basename,
              size: c.size,
              sizeFormatted: `${(c.size / (1024 * 1024)).toFixed(2)} MB`,
              mime: c.mime || (isVideo ? 'video/mp4' : (isImage ? 'image/jpeg' : (isAudio ? 'audio/mpeg' : 'application/octet-stream'))),
              mediaType: isVideo ? 'video' : (isImage ? 'image' : (isAudio ? 'audio' : 'other')),
              isRecommended,
              directUrl
            });
          }
        }
      }
    }

    // Urutkan file: Rekomendasi paling atas, lalu video, lalu gambar, lalu audio
    filesList.sort((a, b) => {
      if (a.isRecommended && !b.isRecommended) return -1;
      if (!a.isRecommended && b.isRecommended) return 1;
      if (a.mediaType === 'video' && b.mediaType !== 'video') return -1;
      if (a.mediaType !== 'video' && b.mediaType === 'video') return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      success: true,
      videoId: videoId || null,
      shareToken,
      publicCloudDomain,
      files: filesList,
      defaultFile: filesList.find(f => f.isRecommended) || filesList.find(f => f.mediaType === 'video') || filesList[0] || null
    });
  } catch (error) {
    console.error('[Media Files API Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
