/**
 * Recovery Script for OPC Staging Item
 * Uploads generated assets to Nextcloud and updates upload_status to 'completed'.
 */

import fs from 'fs';
import path from 'path';
import { getDb, getSetting, ensureDbCachesLoaded, tenantSettingsCache } from '../lib/db.js';
import { tenantContext } from '../lib/tenant-context.js';
import {
  getCampaignParentFolderName,
  getFilePrefixFromBatchId,
  getOpcBatchId
} from '../lib/naming-helper.js';
import { getCampaignNextcloudTargetFolder } from '../lib/scheduler-processors.js';
import {
  checkAndCreateFolder,
  uploadBufferToNextcloud,
  getOrCreatePublicShareLink,
  getNextcloudClient
} from '../lib/nextcloud-helper.js';

async function healItem(itemId) {
  console.log(`\n========================================`);
  console.log(`🚀 Starting recovery for Item #${itemId}`);
  console.log(`========================================`);

  const db = getDb();
  await ensureDbCachesLoaded();

  const item = await db.prepare("SELECT * FROM pillar_campaign_items WHERE id = ?").get(itemId);
  if (!item) {
    throw new Error(`Item #${itemId} not found in database!`);
  }

  const campaign = await db.prepare("SELECT * FROM pillar_campaigns WHERE id = ?").get(item.campaign_id);
  if (!campaign) {
    throw new Error(`Campaign ${item.campaign_id} not found!`);
  }

  const tenantId = campaign.tenant_id || 'default_tenant';
  console.log(`Tenant: ${tenantId}`);
  console.log(`Campaign: ${campaign.campaign_name} (${campaign.id})`);
  console.log(`Item workflow_status: ${item.workflow_status}, upload_status: ${item.upload_status}`);

  return await tenantContext.run(tenantId, async () => {
    // Verify Nextcloud credentials
    const nextcloudUrl = getSetting('nextcloud_url');
    const nextcloudUser = getSetting('nextcloud_username');
    const hasPassword = Boolean(getSetting('nextcloud_app_password'));
    console.log(`Nextcloud Config -> URL: ${nextcloudUrl}, User: ${nextcloudUser}, HasPassword: ${hasPassword}`);

    const batchId = await getOpcBatchId(campaign, item, db);
    const filePrefix = getFilePrefixFromBatchId(batchId);
    const parentFolderName = getCampaignParentFolderName(campaign, 'OPC', db);
    const targetFolder = getCampaignNextcloudTargetFolder(campaign);
    const nextcloudBaseFolder = `/${targetFolder}/${parentFolderName}/${batchId}`.replace(/\/+/g, '/');

    console.log(`Target Nextcloud Folder: ${nextcloudBaseFolder}`);
    console.log(`File Prefix: ${filePrefix}`);

    // Ensure remote folder exists
    console.log(`Ensuring Nextcloud folder exists: ${nextcloudBaseFolder}...`);
    await checkAndCreateFolder(nextcloudBaseFolder);
    console.log(`✅ Remote folder verified/created.`);

    // 1. Upload Final Video
    const finalVideoName = `opc_final_${itemId}.mp4`;
    const finalVideoPath = path.join(process.cwd(), 'public', 'temp', finalVideoName);
    if (fs.existsSync(finalVideoPath)) {
      const finalTargetName = `${filePrefix}_video_final.mp4`;
      const targetPath = `${nextcloudBaseFolder}/${finalTargetName}`;
      console.log(`Uploading final video (${(fs.statSync(finalVideoPath).size / 1024 / 1024).toFixed(2)} MB) to: ${targetPath}`);
      const fileBuffer = fs.readFileSync(finalVideoPath);
      await uploadBufferToNextcloud(fileBuffer, targetPath);
      console.log(`✅ Final video uploaded.`);
    } else {
      console.warn(`⚠️ Final video not found at ${finalVideoPath}`);
    }

    // 2. Upload Clips
    const clips = JSON.parse(item.visual_clip_paths || '[]');
    for (let i = 0; i < clips.length; i++) {
      const clipRelativePath = clips[i];
      const clipPath = path.join(process.cwd(), 'public', clipRelativePath);
      const clipFileName = `${filePrefix}_video_clip_${i + 1}.mp4`;
      if (fs.existsSync(clipPath)) {
        const clipBuffer = fs.readFileSync(clipPath);
        const clipTargetPath = `${nextcloudBaseFolder}/${clipFileName}`;
        console.log(`Uploading video clip ${i + 1} to: ${clipTargetPath}`);
        await uploadBufferToNextcloud(clipBuffer, clipTargetPath);
      }
    }

    // 3. Upload Start Frames
    const startFrameDir = path.join(process.cwd(), 'public', 'uploads', 'start_frames');
    if (fs.existsSync(startFrameDir)) {
      const startFiles = fs.readdirSync(startFrameDir).filter(f => f.includes(`_${itemId}_clip_`));
      for (const sf of startFiles) {
        const match = sf.match(/_clip_(\d+)/);
        const clipNum = match ? match[1] : '1';
        const ext = path.extname(sf) || '.jpg';
        const targetSfName = `${filePrefix}_start_frame_${clipNum}${ext}`;
        const sfPath = path.join(startFrameDir, sf);
        const sfBuffer = fs.readFileSync(sfPath);
        console.log(`Uploading start frame ${clipNum} to: ${nextcloudBaseFolder}/${targetSfName}`);
        await uploadBufferToNextcloud(sfBuffer, `${nextcloudBaseFolder}/${targetSfName}`);
      }
    }

    // 4. Upload Audio Clips
    if (item.tts_batch_id && item.tts_batch_id !== 'skipped') {
      try {
        const ttsClips = await db.prepare("SELECT * FROM tts_studio_clips WHERE batch_id = ? AND status = 'completed'").all(item.tts_batch_id);
        for (const clip of ttsClips) {
          if (clip.audio_path) {
            const audioLocalPath = path.join(process.cwd(), 'public', clip.audio_path);
            if (fs.existsSync(audioLocalPath)) {
              const audioFileName = `${filePrefix}_audio_clip_${clip.clip_index + 1}.mp3`;
              const audioTargetPath = `${nextcloudBaseFolder}/${audioFileName}`;
              const audioBuffer = fs.readFileSync(audioLocalPath);
              console.log(`Uploading audio clip ${clip.clip_index + 1} to: ${audioTargetPath}`);
              await uploadBufferToNextcloud(audioBuffer, audioTargetPath);
            }
          }
        }
      } catch (audioErr) {
        console.warn(`[Audio Upload] Notice: ${audioErr.message}`);
      }
    }

    // 5. Upload Naskah Markdown
    if (item.result_json) {
      try {
        const parsedResult = JSON.parse(item.result_json || '{}');
        const { buildMarkdownContent } = await import('../lib/export-builder.js');
        const markdownContent = buildMarkdownContent(parsedResult, batchId);
        const markdownNextcloudPath = `${nextcloudBaseFolder}/${filePrefix}_naskah.md`;
        console.log(`Uploading markdown to: ${markdownNextcloudPath}`);
        await uploadBufferToNextcloud(Buffer.from(markdownContent, 'utf-8'), markdownNextcloudPath);
        try {
          await uploadBufferToNextcloud(Buffer.from(markdownContent, 'utf-8'), `${nextcloudBaseFolder}/naskah.md`);
        } catch (_) {}
      } catch (mdErr) {
        console.warn(`[Markdown Upload] Notice: ${mdErr.message}`);
      }
    }

    // 6. Generate or Get Public Share Link
    console.log(`Generating Nextcloud public share link for folder: ${nextcloudBaseFolder}...`);
    let shareLink = '';
    try {
      shareLink = await getOrCreatePublicShareLink(nextcloudBaseFolder);
      console.log(`✅ Public Share Link: ${shareLink}`);
    } catch (shareErr) {
      console.error(`⚠️ Failed to generate public share link:`, shareErr.message);
      shareLink = nextcloudBaseFolder;
    }

    // 7. Update Database
    await db.prepare(`
      UPDATE pillar_campaign_items
      SET upload_status = 'completed',
          workflow_status = 'completed',
          drive_link = ?
      WHERE id = ?
    `).run(shareLink, itemId);

    console.log(`✅ Database updated for Item #${itemId}: upload_status = completed, drive_link = ${shareLink}`);

    // Trigger ContentFlow sync
    try {
      const { syncCampaignToContentFlow } = await import('../lib/contentflow-ingest.js');
      await syncCampaignToContentFlow(campaign.id);
      console.log(`✅ ContentFlow sync updated.`);
    } catch (cfErr) {
      console.warn(`[ContentFlow Sync] Notice: ${cfErr.message}`);
    }

    return shareLink;
  });
}

async function main() {
  const targetId = process.argv[2] ? parseInt(process.argv[2], 10) : 1900;
  await healItem(targetId);
  console.log(`\n🎉 Recovery completed successfully for Item #${targetId}!`);
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error during recovery:', err);
  process.exit(1);
});
