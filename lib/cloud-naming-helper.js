/**
 * Centralized Cloud Naming & Folder Helper for Nextcloud & Google Drive
 * Standardized for MAKNA Grid V2.0
 */

/**
 * Generate standardized Cloud Folder Path
 * Format: /<account_slug>/<campaign_id>/<video_id>/
 * @param {Object} params
 * @param {string} params.accountName - e.g. 'Nutribake', 'Siasat Sehat'
 * @param {string} params.campaignId - e.g. 're_260725_66b4d6' or '66b4d649-8045-4edf-b3e4-375428108797'
 * @param {string} params.videoId - e.g. 'nutribake_re_66b4d6_01'
 * @returns {string} e.g. '/nutribake/re_260725_66b4d6/nutribake_re_66b4d6_01'
 */
export function getCloudFolderPath({ accountName, campaignId, videoId }) {
  const accountSlug = (accountName || 'umum')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');

  let cleanCampaignId = (campaignId || 'general')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]/g, '_');

  const cleanVideoId = (videoId || 'video_item')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]/g, '_');

  return `/${accountSlug}/${cleanCampaignId}/${cleanVideoId}`;
}

/**
 * Generate Master Final Video Filename
 * Format: <video_id>_final.mp4
 * @param {string} videoId
 * @param {string} [ext='mp4']
 * @returns {string} e.g. 'nutribake_re_66b4d6_01_final.mp4'
 */
export function getCloudMasterFileName(videoId, ext = 'mp4') {
  const cleanVideoId = (videoId || 'video_item')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]/g, '_');
  const cleanExt = ext.replace(/^\./, '');
  return `${cleanVideoId}_final.${cleanExt}`;
}

/**
 * Generate Master Final Voice-Over Audio Filename
 * Format: <video_id>_vo_final.mp3
 * @param {string} videoId
 * @param {string} [ext='mp3']
 * @returns {string} e.g. 'nutribake_re_66b4d6_01_vo_final.mp3'
 */
export function getCloudVoFileName(videoId, ext = 'mp3') {
  const cleanVideoId = (videoId || 'video_item')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]/g, '_');
  const cleanExt = ext.replace(/^\./, '');
  return `${cleanVideoId}_vo_final.${cleanExt}`;
}

/**
 * Generate Video Thumbnail Filename
 * Format: <video_id>_thumb.jpg
 * @param {string} videoId
 * @param {string} [ext='jpg']
 * @returns {string} e.g. 'nutribake_re_66b4d6_01_thumb.jpg'
 */
export function getCloudThumbFileName(videoId, ext = 'jpg') {
  const cleanVideoId = (videoId || 'video_item')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]/g, '_');
  const cleanExt = ext.replace(/^\./, '');
  return `${cleanVideoId}_thumb.${cleanExt}`;
}

/**
 * Generate Clip Scene / Frame / VO Segment Filename
 * Format: <video_id>_<type>_c<clipNo>.<ext>
 * @param {Object} params
 * @param {string} params.videoId
 * @param {string} params.type - 'scene', 'frame', 'vo'
 * @param {number|string} params.clipNo - Clip sequence number
 * @param {string} [params.ext='mp4']
 * @returns {string} e.g. 'nutribake_re_66b4d6_01_scene_c01.mp4'
 */
export function getCloudClipFileName({ videoId, type = 'scene', clipNo = 1, ext = 'mp4' }) {
  const cleanVideoId = (videoId || 'video_item')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]/g, '_');
  const cleanType = type.toLowerCase().trim();
  const paddedClip = String(clipNo).padStart(2, '0');
  const cleanExt = ext.replace(/^\./, '');

  return `${cleanVideoId}_${cleanType}_c${paddedClip}.${cleanExt}`;
}
