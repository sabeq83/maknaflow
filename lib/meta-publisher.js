/**
 * Meta Graph API Publisher Abstraction Module
 * Supports Facebook Pages (Draft & Live) and Instagram Professional (Container Lifecycle).
 * Strict token and security isolation: secrets are never leaked into logs.
 */

import { sanitizeErrorMessage } from './publishing-contract.js';

export function getGraphApiVersion() {
  return process.env.META_GRAPH_VERSION || process.env.FB_GRAPH_VERSION || 'v25.0';
}

export function getGraphBaseUrl() {
  return `https://graph.facebook.com/${getGraphApiVersion()}`;
}

function buildMetaError(result, response, fallbackMessage) {
  const source = result?.error || result || {};
  const err = new Error(source.message || fallbackMessage);
  err.code = source.code;
  err.error_subcode = source.error_subcode;
  err.httpStatus = response?.status || 0;
  return err;
}

export function isFacebookReelsPublishingEnabled() {
  return process.env.ENABLE_FACEBOOK_REELS_PUBLISHING === 'true' || process.env.ENABLE_FACEBOOK_REELS_PUBLISHING === '1';
}

/**
 * Mendapatkan Page Access Token murni dari User Token atau langsung verifikasi Page Token.
 */
export async function resolvePageAccessToken(pageId, token) {
  if (!token) throw new Error('Token akses Meta tidak disediakan.');
  const cleanToken = token.trim();
  const graphUrl = getGraphBaseUrl();

  // 1. Coba cari di /me/accounts (jika User Token)
  try {
    const res = await fetch(`${graphUrl}/me/accounts?access_token=${encodeURIComponent(cleanToken)}`);
    const data = await res.json();
    if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
      const matchedPage = data.data.find(p => String(p.id) === String(pageId));
      if (matchedPage?.access_token) {
        return matchedPage.access_token;
      }
    }
  } catch (err) {
    // Ignore and fallback
  }

  // 2. Coba minta access_token langsung dari endpoint page
  try {
    const res = await fetch(`${graphUrl}/${pageId}?fields=access_token&access_token=${encodeURIComponent(cleanToken)}`);
    const data = await res.json();
    if (data?.access_token) {
      return data.access_token;
    }
  } catch (err) {
    // Ignore and fallback
  }

  return cleanToken;
}

/**
 * Verifikasi koneksi dan izin Facebook Page.
 */
export async function verifyFacebookAccount({ token, pageId = null }) {
  const graphUrl = getGraphBaseUrl();
  const cleanToken = (token || '').trim();
  if (!cleanToken) throw new Error('Access token Facebook wajib diisi.');

  // Jika target pageId ditentukan:
  if (pageId) {
    const cleanPageId = String(pageId).trim();
    const pageToken = await resolvePageAccessToken(cleanPageId, cleanToken);
    const res = await fetch(`${graphUrl}/${cleanPageId}?fields=id,name,category,tasks,instagram_business_account&access_token=${encodeURIComponent(pageToken)}`);
    const data = await res.json();

    if (data.error) {
      throw new Error(`Meta API Error: ${data.error.message || 'Gagal memverifikasi Facebook Page'}`);
    }

    return {
      platform: 'facebook',
      displayName: data.name || `Facebook Page #${data.id}`,
      facebookPageId: data.id,
      instagramUserId: data.instagram_business_account?.id || null,
      permissions: data.tasks || ['CREATE_CONTENT', 'MANAGE'],
      token: pageToken
    };
  }

  // Jika tidak ada pageId, coba resolve akun pertama dari /me/accounts
  const accRes = await fetch(`${graphUrl}/me/accounts?fields=id,name,category,tasks,instagram_business_account,access_token&access_token=${encodeURIComponent(cleanToken)}`);
  const accData = await accRes.json();

  if (accData.data && accData.data.length > 0) {
    const firstPage = accData.data[0];
    return {
      platform: 'facebook',
      displayName: firstPage.name,
      facebookPageId: firstPage.id,
      instagramUserId: firstPage.instagram_business_account?.id || null,
      permissions: firstPage.tasks || ['CREATE_CONTENT', 'MANAGE'],
      token: firstPage.access_token || cleanToken
    };
  }

  // Fallback ke profil /me jika token adalah direct profile/page token
  const meRes = await fetch(`${graphUrl}/me?fields=id,name&access_token=${encodeURIComponent(cleanToken)}`);
  const meData = await meRes.json();
  if (meData?.id) {
    return {
      platform: 'facebook',
      displayName: meData.name || `Meta Node #${meData.id}`,
      facebookPageId: meData.id,
      instagramUserId: null,
      permissions: ['CREATE_CONTENT'],
      token: cleanToken
    };
  }

  throw new Error(accData?.error?.message || 'Token tidak memiliki akses ke Facebook Page.');
}

/**
 * Verifikasi Instagram Professional Account yang terhubung ke Facebook Page.
 */
export async function verifyInstagramAccount({ token, facebookPageId, instagramUserId = null }) {
  const graphUrl = getGraphBaseUrl();
  const cleanToken = (token || '').trim();
  if (!cleanToken) throw new Error('Access token wajib diisi.');

  const pageToken = await resolvePageAccessToken(facebookPageId, cleanToken);

  let targetIgId = instagramUserId;
  if (!targetIgId) {
    const pageRes = await fetch(`${graphUrl}/${facebookPageId}?fields=instagram_business_account&access_token=${encodeURIComponent(pageToken)}`);
    const pageData = await pageRes.json();
    if (pageData?.instagram_business_account?.id) {
      targetIgId = pageData.instagram_business_account.id;
    } else {
      throw new Error('Facebook Page ini belum terhubung dengan akun Instagram Professional / Creator.');
    }
  }

  const igRes = await fetch(`${graphUrl}/${targetIgId}?fields=id,username,name,profile_picture_url&access_token=${encodeURIComponent(pageToken)}`);
  const igData = await igRes.json();

  if (igData.error) {
    throw new Error(`Meta Instagram Error: ${igData.error.message}`);
  }

  return {
    platform: 'instagram',
    displayName: igData.username ? `@${igData.username} (${igData.name || 'Instagram'})` : `Instagram #${igData.id}`,
    facebookPageId: facebookPageId,
    instagramUserId: targetIgId,
    permissions: ['instagram_content_publish', 'instagram_basic'],
    token: pageToken
  };
}

/**
 * Publikasi Draft ke Halaman Facebook (MANDATORY ROLLOUT TAHAP 1).
 */
export async function createFacebookDraft({
  facebookPageId,
  token,
  caption,
  mediaUrl,
  mediaType = 'text_only'
}) {
  if (mediaType === 'reels') {
    throw new Error('Facebook Reel draft harus menggunakan lifecycle Reels Publishing API.');
  }
  const graphUrl = getGraphBaseUrl();
  const cleanPageId = String(facebookPageId).trim();
  const pageToken = await resolvePageAccessToken(cleanPageId, token);

  const isImage = (mediaType === 'image') && Boolean(mediaUrl);
  const isVideo = (mediaType === 'video' || mediaType === 'reels') && Boolean(mediaUrl);

  let endpoint = `/${cleanPageId}/feed`;
  if (isImage) endpoint = `/${cleanPageId}/photos`;
  else if (isVideo) endpoint = `/${cleanPageId}/videos`;

  const payload = {
    access_token: pageToken,
    published: false,
    unpublished_content_type: 'DRAFT'
  };

  if (isImage) {
    payload.message = caption || '';
    payload.url = mediaUrl;
  } else if (isVideo) {
    payload.description = caption || '';
    payload.file_url = mediaUrl;
  } else {
    payload.message = caption || '';
  }

  console.log(`[Meta Publisher] Creating Facebook draft on ${endpoint} for page ${cleanPageId}...`);

  const response = await fetch(`${graphUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  if (result.error) {
    const err = new Error(result.error.message || 'Meta Facebook Draft Error');
    err.code = result.error.code;
    err.error_subcode = result.error.error_subcode;
    err.httpStatus = response.status;
    throw err;
  }

  const postId = result.id;
  return {
    success: true,
    postId,
    permalink: `https://facebook.com/${postId}`
  };
}

/**
 * Publikasi Live ke Halaman Facebook (Di belakang Feature Flag & Approval).
 */
export async function publishFacebookLive({
  facebookPageId,
  token,
  caption,
  mediaUrl,
  mediaType = 'text_only'
}) {
  if (mediaType === 'reels') {
    throw new Error('Facebook Reel live harus menggunakan lifecycle Reels Publishing API.');
  }
  const graphUrl = getGraphBaseUrl();
  const cleanPageId = String(facebookPageId).trim();
  const pageToken = await resolvePageAccessToken(cleanPageId, token);

  const isImage = (mediaType === 'image') && Boolean(mediaUrl);
  const isVideo = (mediaType === 'video' || mediaType === 'reels') && Boolean(mediaUrl);

  let endpoint = `/${cleanPageId}/feed`;
  if (isImage) endpoint = `/${cleanPageId}/photos`;
  else if (isVideo) endpoint = `/${cleanPageId}/videos`;

  const payload = {
    access_token: pageToken,
    published: true
  };

  if (isImage) {
    payload.message = caption || '';
    payload.url = mediaUrl;
  } else if (isVideo) {
    payload.description = caption || '';
    payload.file_url = mediaUrl;
  } else {
    payload.message = caption || '';
  }

  console.log(`[Meta Publisher] Publishing live Facebook post on ${endpoint} for page ${cleanPageId}...`);

  const response = await fetch(`${graphUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  if (result.error) {
    const err = new Error(result.error.message || 'Meta Facebook Live Error');
    err.code = result.error.code;
    err.error_subcode = result.error.error_subcode;
    err.httpStatus = response.status;
    throw err;
  }

  const postId = result.id;
  return {
    success: true,
    postId,
    permalink: `https://facebook.com/${postId}`
  };
}

/**
 * Facebook Reels Publishing API: initialize -> hosted upload -> status -> finish.
 * The returned upload URL is provider-controlled and is safe to persist as non-secret state.
 */
export async function startFacebookReelUpload({ facebookPageId, token }) {
  if (!isFacebookReelsPublishingEnabled()) {
    throw new Error('Facebook Reels Publishing belum diaktifkan pada environment ini.');
  }
  const pageId = String(facebookPageId).trim();
  const pageToken = await resolvePageAccessToken(pageId, token);
  const response = await fetch(`${getGraphBaseUrl()}/${pageId}/video_reels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ upload_phase: 'start', access_token: pageToken })
  });
  const result = await response.json();
  if (!response.ok || result.error || !result.video_id || !result.upload_url) {
    throw buildMetaError(result, response, 'Gagal memulai upload Facebook Reel.');
  }
  return { videoId: String(result.video_id), uploadUrl: String(result.upload_url), pageToken };
}

export async function transferFacebookReel({ uploadUrl, token, mediaUrl }) {
  if (!uploadUrl || !mediaUrl) throw new Error('Upload URL dan media URL Facebook Reel wajib tersedia.');
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `OAuth ${token}`,
      file_url: mediaUrl
    }
  });
  const result = await response.json();
  if (!response.ok || result.error || result.success !== true) {
    throw buildMetaError(result, response, 'Transfer video Facebook Reel gagal.');
  }
  return { success: true };
}

export async function getFacebookVideoStatus({ videoId, token }) {
  const response = await fetch(`${getGraphBaseUrl()}/${encodeURIComponent(videoId)}?fields=status&access_token=${encodeURIComponent(token)}`);
  const result = await response.json();
  if (!response.ok || result.error) {
    throw buildMetaError(result, response, 'Gagal mengambil status video Facebook.');
  }
  const status = result.status || {};
  return {
    videoStatus: status.video_status || 'processing',
    uploadingStatus: status.uploading_phase?.status || null,
    processingStatus: status.processing_phase?.status || null,
    publishingStatus: status.publishing_phase?.status || null,
    publishStatus: status.publishing_phase?.publish_status || null,
    error: status.processing_phase?.error?.message || status.publishing_phase?.error?.message || null,
    raw: status
  };
}

export async function finishFacebookReel({ facebookPageId, videoId, token, caption, publishMode = 'live' }) {
  const pageId = String(facebookPageId).trim();
  const videoState = publishMode === 'draft' ? 'DRAFT' : 'PUBLISHED';
  const response = await fetch(`${getGraphBaseUrl()}/${pageId}/video_reels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token: token,
      video_id: videoId,
      upload_phase: 'finish',
      video_state: videoState,
      description: caption || ''
    })
  });
  const result = await response.json();
  if (!response.ok || result.error || result.success !== true) {
    throw buildMetaError(result, response, 'Gagal memfinalisasi Facebook Reel.');
  }
  return { success: true, videoId, videoState };
}

export async function fetchFacebookReelDetails({ videoId, token }) {
  const fields = 'id,permalink_url,published,created_time,status';
  const response = await fetch(`${getGraphBaseUrl()}/${encodeURIComponent(videoId)}?fields=${fields}&access_token=${encodeURIComponent(token)}`);
  const result = await response.json();
  if (!response.ok || result.error) {
    throw buildMetaError(result, response, 'Gagal memverifikasi Facebook Reel.');
  }
  const publishStatus = result.status?.publishing_phase?.publish_status || null;
  return {
    postId: String(result.id || videoId),
    permalink: result.permalink_url || null,
    isPublished: result.published === true || publishStatus === 'published',
    publishStatus,
    videoStatus: result.status?.video_status || null,
    objectType: 'REEL',
    createdTime: result.created_time || null,
    rawStatus: result.status || {}
  };
}

/**
 * Instagram Container Lifecycle Step 1: Create Container.
 */
export async function createInstagramContainer({
  instagramUserId,
  token,
  caption,
  mediaUrl,
  mediaType = 'image'
}) {
  const graphUrl = getGraphBaseUrl();
  const cleanIgId = String(instagramUserId).trim();

  const isVideoOrReels = mediaType === 'video' || mediaType === 'reels';
  const payload = {
    access_token: token,
    caption: caption || ''
  };

  if (isVideoOrReels) {
    payload.media_type = 'REELS';
    payload.video_url = mediaUrl;
  } else {
    payload.image_url = mediaUrl;
  }

  console.log(`[Meta Publisher] Creating Instagram ${isVideoOrReels ? 'Reels' : 'Image'} container for @${cleanIgId}...`);

  const response = await fetch(`${graphUrl}/${cleanIgId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  if (result.error) {
    const err = new Error(result.error.message || 'Instagram Media Container Error');
    err.code = result.error.code;
    err.error_subcode = result.error.error_subcode;
    err.httpStatus = response.status;
    throw err;
  }

  return {
    containerId: result.id
  };
}

/**
 * Instagram Container Lifecycle Step 2: Poll Container Readiness.
 */
export async function getInstagramContainerStatus(containerId, token) {
  const graphUrl = getGraphBaseUrl();
  const res = await fetch(`${graphUrl}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`);
  const data = await res.json();

  if (data.error) {
    const err = new Error(data.error.message || 'Instagram Container Status Check Error');
    err.code = data.error.code;
    throw err;
  }

  // status_code: 'EXPIRED' | 'ERROR' | 'FINISHED' | 'IN_PROGRESS'
  return {
    statusCode: data.status_code || 'IN_PROGRESS',
    status: data.status || 'IN_PROGRESS'
  };
}

/**
 * Instagram Container Lifecycle Step 3: Publish Container.
 */
export async function publishInstagramContainer(instagramUserId, containerId, token) {
  const graphUrl = getGraphBaseUrl();
  const cleanIgId = String(instagramUserId).trim();

  const payload = {
    creation_id: containerId,
    access_token: token
  };

  console.log(`[Meta Publisher] Publishing Instagram container ${containerId} for @${cleanIgId}...`);

  const response = await fetch(`${graphUrl}/${cleanIgId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  if (result.error) {
    const err = new Error(result.error.message || 'Instagram Publish Error');
    err.code = result.error.code;
    err.error_subcode = result.error.error_subcode;
    err.httpStatus = response.status;
    throw err;
  }

  const mediaId = result.id;
  let permalink = `https://instagram.com/p/${mediaId}`;

  // Coba ambil permalink resmi
  try {
    const pRes = await fetch(`${graphUrl}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(token)}`);
    const pData = await pRes.json();
    if (pData?.permalink) {
      permalink = pData.permalink;
    }
  } catch (_) {}

  return {
    success: true,
    postId: mediaId,
    permalink
  };
}

/**
 * Mengambil detail status publikasi dan permalink kanonikal dari Meta Graph API.
 */
export async function fetchMetaPostDetails({ token, platform, externalPostId }) {
  if (!token || !externalPostId) {
    throw new Error('Token dan externalPostId wajib disertakan untuk sinkronisasi Meta.');
  }

  const graphUrl = getGraphBaseUrl();
  const cleanId = String(externalPostId).trim();

  if (platform === 'facebook') {
    const res = await fetch(`${graphUrl}/${cleanId}?fields=permalink_url,published,created_time,description,id&access_token=${encodeURIComponent(token)}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || 'Gagal mengambil data postingan Facebook dari Graph API');

    const isPublished = data.published !== false;
    const permalink = data.permalink_url || `https://facebook.com/${data.id}`;

    return {
      platform: 'facebook',
      postId: data.id,
      isPublished,
      permalink,
      createdTime: data.created_time || null
    };
  } else if (platform === 'instagram') {
    const res = await fetch(`${graphUrl}/${cleanId}?fields=permalink,shortcode,media_type,timestamp,id&access_token=${encodeURIComponent(token)}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || 'Gagal mengambil data postingan Instagram dari Graph API');

    return {
      platform: 'instagram',
      postId: data.id,
      isPublished: true,
      permalink: data.permalink || (data.shortcode ? `https://instagram.com/p/${data.shortcode}` : `https://instagram.com/p/${data.id}`),
      createdTime: data.timestamp || null
    };
  }

  throw new Error(`Platform '${platform}' tidak didukung untuk sinkronisasi post.`);
}
