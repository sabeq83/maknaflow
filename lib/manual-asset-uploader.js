import fs from 'fs';
import path from 'path';
import { getDb, getSetting } from './db.js';

/**
 * Memindai aset lokal untuk item campaign (RE atau OPC) dan mengunggahnya ke Nextcloud / Drive.
 * @param {string} campaignType - 're' atau 'opc'
 * @param {number|string} itemId - ID baris item
 */
export async function syncItemAssetsToCloud(campaignType, itemId) {
  const db = getDb();
  const isRE = campaignType === 're';
  const itemTable = isRE ? 're_campaign_items' : 'pillar_campaign_items';
  const campaignTable = isRE ? 're_campaigns' : 'pillar_campaigns';

  const item = await db.prepare(`SELECT * FROM ${itemTable} WHERE id = ?`).get(itemId);
  if (!item) {
    throw new Error(`Item ID ${itemId} tidak ditemukan pada tabel ${itemTable}.`);
  }

  const campaign = await db.prepare(`SELECT * FROM ${campaignTable} WHERE id = ?`).get(item.campaign_id);
  const campaignName = (campaign?.campaign_name || `Campaign_${item.campaign_id}`).replace(/[^a-zA-Z0-9_-]/g, '_');
  const itemTitle = (item.angle_name || item.product_name || `Item_${itemId}`).replace(/[^a-zA-Z0-9_-]/g, '_');

  const storageProvider = getSetting('storage_provider') || 'nextcloud';
  const targetParentFolder = getSetting('nextcloud_target_folder') || '/MAKNA_Assets/MAKNA_Production_Final';
  const remoteFolderPath = `${targetParentFolder.replace(/\/+$/, '')}/${campaignName}/${itemTitle}_${itemId}`;

  const assetsToUpload = []; // { name, localPath, type, clipIndex }

  // 1. Scan Start Frames T2I
  let t2iImages = [];
  if (item.t2i_images_json) {
    try {
      t2iImages = JSON.parse(item.t2i_images_json || '[]');
    } catch (e) {}
  }
  t2iImages.forEach((relPath, idx) => {
    if (relPath) {
      const cleanRel = relPath.split('?')[0];
      const absPath = path.join(process.cwd(), 'public', cleanRel.startsWith('/') ? cleanRel.slice(1) : cleanRel);
      if (fs.existsSync(absPath)) {
        assetsToUpload.push({
          name: `Klip_${idx + 1}_StartFrame${path.extname(absPath) || '.jpg'}`,
          localPath: absPath,
          type: 'start_frame',
          clipIndex: idx + 1
        });
      }
    }
  });

  // 2. Scan Audio TTS
  const ttsDir = path.join(process.cwd(), 'public', 'uploads', 'tts');
  if (fs.existsSync(ttsDir)) {
    const ttsFiles = fs.readdirSync(ttsDir);
    ttsFiles.forEach(file => {
      if (file.includes(`item_${itemId}_`) || file.includes(`re_${itemId}_`) || file.includes(`opc_${itemId}_`)) {
        assetsToUpload.push({
          name: file,
          localPath: path.join(ttsDir, file),
          type: 'audio_tts',
          clipIndex: null
        });
      }
    });
  }

  // 3. Scan Video Clips & Final Video (dari result_json / ffmpeg_output_path)
  let resultJson = {};
  if (item.result_json) {
    try {
      resultJson = JSON.parse(item.result_json || '{}');
    } catch (e) {}
  }

  const videoPaths = resultJson.downloaded_video_paths || resultJson.video_paths || [];
  videoPaths.forEach((relPath, idx) => {
    if (relPath) {
      const cleanRel = relPath.split('?')[0];
      let absPath = cleanRel.startsWith('/') && fs.existsSync(cleanRel)
        ? cleanRel
        : path.join(process.cwd(), 'public', cleanRel.startsWith('/') ? cleanRel.slice(1) : cleanRel);

      if (fs.existsSync(absPath)) {
        assetsToUpload.push({
          name: `Klip_${idx + 1}_Video${path.extname(absPath) || '.mp4'}`,
          localPath: absPath,
          type: 'video_clip',
          clipIndex: idx + 1
        });
      }
    }
  });

  if (item.ffmpeg_output_path) {
    const cleanRel = item.ffmpeg_output_path.split('?')[0];
    let absPath = cleanRel.startsWith('/') && fs.existsSync(cleanRel)
      ? cleanRel
      : path.join(process.cwd(), 'public', cleanRel.startsWith('/') ? cleanRel.slice(1) : cleanRel);

    if (fs.existsSync(absPath)) {
      assetsToUpload.push({
        name: `Final_Video_Muxed${path.extname(absPath) || '.mp4'}`,
        localPath: absPath,
        type: 'final_video',
        clipIndex: null
      });
    }
  }

  // 4. Generate Narrative / Prompt Markdown Document
  let planJson = [];
  if (item.new_video_plan_json) {
    try {
      planJson = JSON.parse(item.new_video_plan_json || '[]');
    } catch (e) {}
  }

  if (planJson.length > 0) {
    let mdText = `# Naskah & Visual Plan - ${itemTitle}\n\n`;
    mdText += `- **Campaign**: ${campaignName}\n`;
    mdText += `- **Item ID**: ${itemId}\n`;
    mdText += `- **Status**: ${item.status || item.workflow_status || 'In Progress'}\n\n`;
    mdText += `## Storyboard Clips\n\n`;
    planJson.forEach((p, idx) => {
      mdText += `### Klip #${idx + 1}\n`;
      mdText += `- **Voiceover**: ${p.new_vo || '-'}\n`;
      mdText += `- **Aksi Visual**: ${p.visual_action || '-'}\n`;
      mdText += `- **Prompt I2V**: \`${p.i2v_prompt || '-'}\`\n\n`;
    });

    const tmpMdPath = path.join(process.cwd(), 'public', 'uploads', `Naskah_Script_Plan_Item_${itemId}.md`);
    fs.writeFileSync(tmpMdPath, mdText, 'utf-8');
    assetsToUpload.push({
      name: `Naskah_Script_Plan.md`,
      localPath: tmpMdPath,
      type: 'markdown',
      clipIndex: null
    });
  }

  if (assetsToUpload.length === 0) {
    throw new Error('Belum ada file aset lokal (T2I, Video, TTS, atau Markdown) yang ditemukan di server untuk item ini.');
  }

  // 5. Perform Upload
  const syncedFiles = [];
  let folderShareUrl = null;

  if (storageProvider === 'nextcloud') {
    const { checkAndCreateFolder, uploadFileToNextcloud, getOrCreatePublicShareLink } = await import('./nextcloud-helper.js');
    await checkAndCreateFolder(remoteFolderPath);

    for (const asset of assetsToUpload) {
      const targetRemotePath = `${remoteFolderPath}/${asset.name}`;
      const uploadRes = await uploadFileToNextcloud(asset.localPath, targetRemotePath, false);
      syncedFiles.push({
        name: asset.name,
        type: asset.type,
        clipIndex: asset.clipIndex,
        url: uploadRes.fileUrl
      });
    }

    try {
      folderShareUrl = await getOrCreatePublicShareLink(remoteFolderPath);
    } catch (e) {
      folderShareUrl = `${getSetting('nextcloud_url')}/remote.php/webdav${remoteFolderPath}`;
    }

    await db.prepare(`UPDATE ${itemTable} SET nextcloud_folder_url = ? WHERE id = ?`).run(folderShareUrl, itemId);
  } else {
    // Google Drive
    const { getOrCreateCampaignFolder, uploadVideoToFolder } = await import('./drive-uploader.js');
    const targetFolderId = item.target_drive_folder_id || campaign.target_drive_folder_id;
    const itemFolder = await getOrCreateCampaignFolder(itemTitle, targetFolderId);

    for (const asset of assetsToUpload) {
      const uploadRes = await uploadVideoToFolder(asset.localPath, asset.name, itemFolder.folderId);
      syncedFiles.push({
        name: asset.name,
        type: asset.type,
        clipIndex: asset.clipIndex,
        url: uploadRes.driveUrl
      });
    }
    folderShareUrl = itemFolder.folderUrl;
    await db.prepare(`UPDATE ${itemTable} SET drive_folder_id = ? WHERE id = ?`).run(itemFolder.folderId, itemId);
  }

  return {
    success: true,
    storageProvider,
    folderUrl: folderShareUrl,
    totalFiles: syncedFiles.length,
    files: syncedFiles
  };
}

/**
 * Mengambil daftar aset lokal yang ada di disk server untuk inspeksi UI
 */
export async function getLocalItemAssetsManifest(campaignType, itemId) {
  const db = getDb();
  const isRE = campaignType === 're';
  const itemTable = isRE ? 're_campaign_items' : 'pillar_campaign_items';
  const item = await db.prepare(`SELECT * FROM ${itemTable} WHERE id = ?`).get(itemId);
  if (!item) return { clips: [], hasFinalVideo: false };

  let planJson = [];
  if (item.new_video_plan_json) {
    try { planJson = JSON.parse(item.new_video_plan_json || '[]'); } catch (e) {}
  }

  let t2iImages = [];
  if (item.t2i_images_json) {
    try { t2iImages = JSON.parse(item.t2i_images_json || '[]'); } catch (e) {}
  }

  let resultJson = {};
  if (item.result_json) {
    try { resultJson = JSON.parse(item.result_json || '{}'); } catch (e) {}
  }
  const videoPaths = resultJson.downloaded_video_paths || resultJson.video_paths || [];

  const clips = planJson.map((p, idx) => {
    const clipIndex = p.clip_index || (idx + 1);
    
    // T2I Check
    const relT2i = t2iImages[idx];
    let t2iReady = false;
    if (relT2i) {
      const cleanRel = relT2i.split('?')[0];
      const absPath = path.join(process.cwd(), 'public', cleanRel.startsWith('/') ? cleanRel.slice(1) : cleanRel);
      t2iReady = fs.existsSync(absPath);
    }

    // Video Check
    const relVid = videoPaths[idx];
    let videoReady = false;
    if (relVid) {
      const cleanRel = relVid.split('?')[0];
      const absPath = cleanRel.startsWith('/') && fs.existsSync(cleanRel)
        ? cleanRel
        : path.join(process.cwd(), 'public', cleanRel.startsWith('/') ? cleanRel.slice(1) : cleanRel);
      videoReady = fs.existsSync(absPath);
    }

    // TTS Check
    const ttsDir = path.join(process.cwd(), 'public', 'uploads', 'tts');
    let ttsReady = false;
    let ttsUrl = null;
    if (fs.existsSync(ttsDir)) {
      const files = fs.readdirSync(ttsDir);
      const matchedFile = files.find(f => f.includes(`_clip_${clipIndex}_`) && (f.includes(`item_${itemId}`) || f.includes(`re_${itemId}`) || f.includes(`opc_${itemId}`)));
      if (matchedFile) {
        ttsReady = true;
        ttsUrl = `/uploads/tts/${matchedFile}`;
      }
    }

    return {
      clipIndex,
      t2iReady,
      t2iUrl: t2iReady ? relT2i : null,
      videoReady,
      videoUrl: videoReady ? relVid : null,
      ttsReady,
      ttsUrl
    };
  });

  let hasFinalVideo = false;
  if (item.ffmpeg_output_path) {
    const cleanRel = item.ffmpeg_output_path.split('?')[0];
    const absPath = cleanRel.startsWith('/') && fs.existsSync(cleanRel)
      ? cleanRel
      : path.join(process.cwd(), 'public', cleanRel.startsWith('/') ? cleanRel.slice(1) : cleanRel);
    hasFinalVideo = fs.existsSync(absPath);
  }

  return {
    itemId,
    clips,
    hasFinalVideo,
    finalVideoUrl: hasFinalVideo ? item.ffmpeg_output_path : null,
    nextcloudUrl: item.nextcloud_folder_url || null,
    driveFolderId: item.drive_folder_id || null
  };
}
