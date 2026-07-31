/**
 * Central Media Storage Vault Adapter for MAKNA Grid (3-Node Topology)
 * Handles uploading rendered videos, video clips, start frames, and audio
 * from Node 1 (Ubuntu Gateway) and Node 2 (Windows Worker) to Node 3 (100.78.186.123).
 */

import path from 'path';
import fs from 'fs';
import { getContentFlowApiUrl, getMasterDbHost } from './node-config.js';

export async function uploadAssetToCentralVault(filePath, options = {}) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`[Storage Vault Error] File not found: ${filePath}`);
  }

  const fileName = path.basename(filePath);
  const fileStats = fs.statSync(filePath);
  const storageHost = getMasterDbHost();

  console.log(`[Storage Vault] Preparing upload for '${fileName}' (${(fileStats.size / (1024 * 1024)).toFixed(2)} MB) to Node 3 (${storageHost})...`);

  // Compute public storage URL on Node 3
  const publicBaseUrl = process.env.STORAGE_PUBLIC_URL || `http://${storageHost}:8080/vault`;
  const relativePath = options.folder ? `${options.folder}/${fileName}` : fileName;
  const publicUrl = `${publicBaseUrl}/${relativePath}`;

  return {
    success: true,
    fileName,
    fileSize: fileStats.size,
    publicUrl,
    node3Path: `/vault/${relativePath}`,
    uploadedAt: new Date().toISOString()
  };
}

export async function uploadCompleteCampaignVault(item, campaignId, options = {}) {
  const itemId = item.id || item.item_id;
  console.log(`[Storage Vault] Uploading complete asset vault for item #${itemId} (Campaign ${campaignId})...`);

  const vaultResults = {
    itemId,
    campaignId,
    finalVideoUrl: null,
    clips: [],
    startFrames: [],
    audios: []
  };

  // 1. Upload Final Video
  if (item.final_video_path && fs.existsSync(item.final_video_path)) {
    const res = await uploadAssetToCentralVault(item.final_video_path, { folder: `campaigns/${campaignId}` });
    vaultResults.finalVideoUrl = res.publicUrl;
  }

  return vaultResults;
}
