import { getDb, updateReCampaignItem, updatePillarCampaignItem, updateInstantCampaignItem } from './db.js';
import { getNextcloudClient, getOrCreatePublicShareLink } from './nextcloud-helper.js';
import {
  getCloudFolderPath,
  getCloudMasterFileName,
  getCloudVoFileName,
  getCloudThumbFileName,
  getCloudClipFileName
} from './cloud-naming-helper.js';
import fs from 'fs';
import path from 'path';

import {
  getProductSlug,
  formatVideoId,
  getCampaignParentFolderName,
  getFilePrefixFromBatchId,
  getReBatchId as getReBatchIdLocal,
  getIfcBatchId as getIfcBatchIdLocal,
  getOpcBatchId as getOpcBatchIdLocal
} from './naming-helper.js';

/**
 * Helper to upload a local file to Nextcloud WebDAV if it doesn't already exist.
 * Returns the Nextcloud remote WebDAV URL.
 */
async function uploadToNextcloudIfMissing(client, localPath, remotePath) {
  const exists = await client.exists(remotePath);
  if (!exists) {
    console.log(`[Nextcloud Sync] Uploading missing file: ${localPath} -> ${remotePath}`);
    // Ensure folders are created recursively
    const folderPath = remotePath.substring(0, remotePath.lastIndexOf('/'));
    if (folderPath) {
      const parts = folderPath.split('/').filter(p => p.trim() !== '');
      let currentPath = '';
      for (const part of parts) {
        currentPath += `/${part}`;
        const folderExists = await client.exists(currentPath);
        if (!folderExists) {
          await client.createDirectory(currentPath);
        }
      }
    }
    const readStream = fs.createReadStream(localPath);
    await client.putFileContents(remotePath, readStream, { overwrite: true });
  }

  return await getOrCreatePublicShareLink(remotePath);
}

export async function syncReCampaignAssetsToNextcloud(campaign, items, parentFolder) {
  const db = getDb();
  const brandProfile = await db.prepare('SELECT * FROM brand_profiles WHERE LOWER(brand_name) = LOWER(?)').get(campaign.account_name || '');
  const client = getNextcloudClient(brandProfile);

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const paddedIndex = String(idx + 1).padStart(3, '0');

    // 1. Check if item has angle variants
    const variants = await db.prepare('SELECT * FROM re_item_angle_variants WHERE re_item_id = ?').all(item.id);

    if (variants && variants.length > 0) {
      for (const variant of variants) {
        const baseBatchId = await getReBatchIdLocal(campaign, item, db);
        const filePrefix = `${getFilePrefixFromBatchId(baseBatchId)}-Angle-${variant.angle_name}`;
        const batchId = `${baseBatchId}-Angle-${variant.angle_name}`;
        const basePath = `${parentFolder}/${batchId}`.replace(/\/+/g, '/');
 
        try {
          let driveUrl = variant.drive_link || '';
 
          // A. Video final
          if (variant.ffmpeg_status === 'completed' && variant.ffmpeg_output_path) {
            const finalFileName = `${filePrefix}_video_final.mp4`;
            const finalVideoPath = path.join(process.cwd(), 'public', variant.ffmpeg_output_path);
 
            if (fs.existsSync(finalVideoPath)) {
              driveUrl = await uploadToNextcloudIfMissing(client, finalVideoPath, `${basePath}/${finalFileName}`);
              // Backup copy for backward compatibility
              try {
                await uploadToNextcloudIfMissing(client, finalVideoPath, `${basePath}/video_final.mp4`);
              } catch (_) {}
            }
          } else if (variant.visual_clip_paths) {
            // B. Video clips
            let localPaths = [];
            try {
              localPaths = JSON.parse(variant.visual_clip_paths || '[]');
            } catch {}
 
            let clipUploaded = false;
            for (let i = 0; i < localPaths.length; i++) {
              const clipPath = path.join(process.cwd(), 'public', localPaths[i]);
              const clipFileName = `${filePrefix}_video_clip_${i + 1}.mp4`;
 
              if (fs.existsSync(clipPath)) {
                await uploadToNextcloudIfMissing(client, clipPath, `${basePath}/${clipFileName}`);
                clipUploaded = true;
              }
            }
            if (clipUploaded && !driveUrl) {
              driveUrl = await getOrCreatePublicShareLink(basePath);
            }
          }
 
          // C. Audio files
          if (variant.tts_batch_id && variant.tts_batch_id !== 'skipped') {
            const ttsClips = await db.prepare("SELECT * FROM tts_studio_clips WHERE batch_id = ? AND status = 'completed'").all(variant.tts_batch_id);
            for (const clip of ttsClips) {
              if (clip.audio_path) {
                const audioLocalPath = path.join(process.cwd(), 'public', clip.audio_path);
                const audioFileName = `${filePrefix}_audio_clip_${clip.clip_index + 1}.mp3`;
 
                if (fs.existsSync(audioLocalPath)) {
                  await uploadToNextcloudIfMissing(client, audioLocalPath, `${basePath}/${audioFileName}`);
                }
              }
            }
          }
 
          // D. Narrative Markdown (naskah.md / [filePrefix]_naskah.md)
          if (variant.result_json) {
            try {
              const { buildMarkdownContent } = await import('./export-builder.js');
              const parsedResult = JSON.parse(variant.result_json || '{}');
              const markdownContent = buildMarkdownContent(parsedResult, baseBatchId);
              const remoteMdPath = `${basePath}/${filePrefix}_naskah.md`;
              const exists = await client.exists(remoteMdPath);
              if (!exists) {
                await client.putFileContents(remoteMdPath, Buffer.from(markdownContent, 'utf-8'));
                // Backup copy — cek dulu sebelum upload agar tidak 409 Conflict
                const backupMdPathRe = `${basePath}/naskah.md`;
                const backupExistsRe = await client.exists(backupMdPathRe);
                if (!backupExistsRe) {
                  await client.putFileContents(backupMdPathRe, Buffer.from(markdownContent, 'utf-8'));
                }
              }
            } catch (mdErr) {
              console.error('[Nextcloud Sync RE Variant MD] Failed:', mdErr.message);
            }
          }
 
          if (driveUrl && driveUrl !== variant.drive_link) {
            await db.prepare("UPDATE re_item_angle_variants SET upload_status = 'completed', drive_link = ? WHERE id = ?").run(driveUrl, variant.id);
          }
 
        } catch (err) {
          console.error(`[Nextcloud Sync] Failed syncing variant ${variant.angle_name}:`, err.message);
        }
      }
    } else {
      // 2. Item has no angle variants
      const batchId = await getReBatchIdLocal(campaign, item, db);
      const basePath = `${parentFolder}/${batchId}`.replace(/\/+/g, '/');
 
      try {
        let driveUrl = item.drive_link || '';
 
        const filePrefix = getFilePrefixFromBatchId(batchId);

        // A. Video final
        if (item.ffmpeg_status === 'completed' && item.ffmpeg_output_path && item.ffmpeg_output_path !== 'skipped') {
          const finalFileName = `${filePrefix}_video_final.mp4`;
          const finalVideoPath = path.join(process.cwd(), 'public', item.ffmpeg_output_path);
 
          if (fs.existsSync(finalVideoPath)) {
            driveUrl = await uploadToNextcloudIfMissing(client, finalVideoPath, `${basePath}/${finalFileName}`);
            // Backup copy for backward compatibility
            try {
              await uploadToNextcloudIfMissing(client, finalVideoPath, `${basePath}/video_final.mp4`);
            } catch (_) {}
          }
        } else if (item.visual_clip_paths) {
          // B. Video clips
          let localPaths = [];
          try {
            localPaths = JSON.parse(item.visual_clip_paths || '[]');
          } catch {}
 
          let clipUploaded = false;
          for (let i = 0; i < localPaths.length; i++) {
            const clipPath = path.join(process.cwd(), 'public', localPaths[i]);
            const clipFileName = `${filePrefix}_video_clip_${i + 1}.mp4`;
 
            if (fs.existsSync(clipPath)) {
              await uploadToNextcloudIfMissing(client, clipPath, `${basePath}/${clipFileName}`);
              clipUploaded = true;
            }
          }
          if (clipUploaded && !driveUrl) {
            driveUrl = await getOrCreatePublicShareLink(basePath);
          }
        }
 
        // C. Audio files
        if (item.tts_batch_id && item.tts_batch_id !== 'skipped') {
          const ttsClips = await db.prepare("SELECT * FROM tts_studio_clips WHERE batch_id = ? AND status = 'completed'").all(item.tts_batch_id);
          for (const clip of ttsClips) {
            if (clip.audio_path) {
              const audioLocalPath = path.join(process.cwd(), 'public', clip.audio_path);
              const audioFileName = `${filePrefix}_audio_clip_${clip.clip_index + 1}.mp3`;
 
              if (fs.existsSync(audioLocalPath)) {
                await uploadToNextcloudIfMissing(client, audioLocalPath, `${basePath}/${audioFileName}`);
              }
            }
          }
        }
 
        // D. Narrative Markdown (naskah.md / [filePrefix]_naskah.md)
        if (item.result_json) {
          try {
            const { buildMarkdownContent } = await import('./export-builder.js');
            const parsedResult = JSON.parse(item.result_json || '{}');
            const markdownContent = buildMarkdownContent(parsedResult, batchId);
            const remoteMdPath = `${basePath}/${filePrefix}_naskah.md`;
            const exists = await client.exists(remoteMdPath);
            if (!exists) {
              await client.putFileContents(remoteMdPath, Buffer.from(markdownContent, 'utf-8'));
              // Backup copy — cek dulu sebelum upload agar tidak 409 Conflict
              const backupMdPathReItem = `${basePath}/naskah.md`;
              const backupExistsReItem = await client.exists(backupMdPathReItem);
              if (!backupExistsReItem) {
                await client.putFileContents(backupMdPathReItem, Buffer.from(markdownContent, 'utf-8'));
              }
            }
          } catch (mdErr) {
            console.error('[Nextcloud Sync RE Item MD] Failed:', mdErr.message);
          }
        }
 
        if (driveUrl && driveUrl !== item.drive_link) {
          updateReCampaignItem(item.id, { drive_link: driveUrl, upload_status: 'completed' });
        }
 
      } catch (err) {
        console.error(`[Nextcloud Sync] Failed syncing item #${item.id}:`, err.message);
      }
    }
  }
}

export async function syncOpcCampaignAssetsToNextcloud(campaign, items, parentFolder) {
  const db = getDb();
  const completedItems = items.filter(item => item.ffmpeg_status === 'completed' && item.ffmpeg_output_path && item.ffmpeg_output_path !== 'skipped');
  if (completedItems.length === 0) {
    console.log(`[Nextcloud Sync OPC] Ditunda: video final FFmpeg belum tersedia untuk campaign ${campaign.id}.`);
    return { deferred: true, reason: 'FFMPEG_NOT_COMPLETED' };
  }
  // [Fix v2.2.93] pillar_campaigns tidak punya account_name — self-heal dari brand_profile_id
  if (!campaign.account_name && campaign.brand_profile_id) {
    const bp = await db.prepare('SELECT brand_name FROM brand_profiles WHERE id = ?').get(campaign.brand_profile_id);
    if (bp?.brand_name) campaign = { ...campaign, account_name: bp.brand_name };
  }
  const brandProfile = await db.prepare('SELECT * FROM brand_profiles WHERE LOWER(brand_name) = LOWER(?)').get(campaign.account_name || '');
  const client = getNextcloudClient(brandProfile);

  for (let idx = 0; idx < completedItems.length; idx++) {
    const item = completedItems[idx];
    const paddedIndex = String(idx + 1).padStart(3, '0');

    const batchId = await getOpcBatchIdLocal(campaign, item, db);
    const basePath = `${parentFolder}/${batchId}`.replace(/\/+/g, '/');

    try {
      let driveUrl = item.drive_link || '';

      const filePrefix = getFilePrefixFromBatchId(batchId);

      // A. Video final
      if (item.ffmpeg_status === 'completed' && item.ffmpeg_output_path && item.ffmpeg_output_path !== 'skipped') {
        const finalVideoFileNameCloud = `${filePrefix}_video_final.mp4`;
        const finalVideoPath = path.join(process.cwd(), 'public', item.ffmpeg_output_path);

        if (fs.existsSync(finalVideoPath)) {
          driveUrl = await uploadToNextcloudIfMissing(client, finalVideoPath, `${basePath}/${finalVideoFileNameCloud}`);
          // Backup copy
          try {
            await uploadToNextcloudIfMissing(client, finalVideoPath, `${basePath}/video_final.mp4`);
          } catch (_) {}
        }
      } else if (item.visual_clip_paths) {
        // B. Video clips
        let localPaths = [];
        try {
          localPaths = JSON.parse(item.visual_clip_paths || '[]');
        } catch {}

        let clipUploaded = false;
        for (let i = 0; i < localPaths.length; i++) {
          const clipPath = path.join(process.cwd(), 'public', localPaths[i]);
          const clipFileName = `${filePrefix}_video_clip_${i + 1}.mp4`;

          if (fs.existsSync(clipPath)) {
            await uploadToNextcloudIfMissing(client, clipPath, `${basePath}/${clipFileName}`);
            clipUploaded = true;
          }
        }
        if (clipUploaded && !driveUrl) {
          driveUrl = await getOrCreatePublicShareLink(basePath);
        }
      }

      // C. Audio files
      if (item.tts_batch_id && item.tts_batch_id !== 'skipped') {
        const ttsClips = await db.prepare("SELECT * FROM tts_studio_clips WHERE batch_id = ? AND status = 'completed'").all(item.tts_batch_id);
        for (const clip of ttsClips) {
          if (clip.audio_path) {
            const audioLocalPath = path.join(process.cwd(), 'public', clip.audio_path);
            const audioFileName = `${filePrefix}_audio_clip_${clip.clip_index + 1}.mp3`;

            if (fs.existsSync(audioLocalPath)) {
              await uploadToNextcloudIfMissing(client, audioLocalPath, `${basePath}/${audioFileName}`);
            }
          }
        }
      }

      // D. Narrative Markdown (naskah.md / [filePrefix]_naskah.md)
      if (item.result_json) {
        try {
          const { buildMarkdownContent } = await import('./export-builder.js');
          const parsedResult = JSON.parse(item.result_json || '{}');
          const markdownContent = buildMarkdownContent(parsedResult, batchId);
          const remoteMdPath = `${basePath}/${filePrefix}_naskah.md`;
          const exists = await client.exists(remoteMdPath);
          if (!exists) {
            await client.putFileContents(remoteMdPath, Buffer.from(markdownContent, 'utf-8'));
            // Backup copy — cek dulu sebelum upload agar tidak 409 Conflict
            const backupMdPathOpc = `${basePath}/naskah.md`;
            const backupExistsOpc = await client.exists(backupMdPathOpc);
            if (!backupExistsOpc) {
              await client.putFileContents(backupMdPathOpc, Buffer.from(markdownContent, 'utf-8'));
            }
          }
        } catch (mdErr) {
          console.error('[Nextcloud Sync OPC MD] Failed:', mdErr.message);
        }
      }

      if (driveUrl && driveUrl !== item.drive_link) {
        updatePillarCampaignItem(item.id, { drive_link: driveUrl, upload_status: 'completed' });
      }

    } catch (err) {
      console.error(`[Nextcloud Sync] Failed syncing OPC item #${item.id}:`, err.message);
    }
  }
}

export async function syncIfcCampaignAssetsToNextcloud(campaign, items, parentFolder) {
  const db = getDb();
  const brandProfile = await db.prepare('SELECT * FROM brand_profiles WHERE LOWER(brand_name) = LOWER(?)').get(campaign.account_name || '');
  const client = getNextcloudClient(brandProfile);

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const paddedIndex = String(idx + 1).padStart(3, '0');

    // Folder batch name (Standardized with IFC batch ID)
    const batchId = getIfcBatchIdLocal(campaign, item, db);
    const basePath = `${parentFolder}/${batchId}`.replace(/\/+/g, '/');

    try {
      let driveUrl = item.drive_link || '';

      const filePrefix = getFilePrefixFromBatchId(batchId);

      // A. Video final
      if (item.ffmpeg_status === 'completed' && item.ffmpeg_output_path && item.ffmpeg_output_path !== 'skipped') {
        const finalVideoFileNameCloud = `${filePrefix}_video_final.mp4`;
        const finalVideoPath = path.join(process.cwd(), 'public', item.ffmpeg_output_path);

        if (fs.existsSync(finalVideoPath)) {
          driveUrl = await uploadToNextcloudIfMissing(client, finalVideoPath, `${basePath}/${finalVideoFileNameCloud}`);
          // Backup copy
          try {
            await uploadToNextcloudIfMissing(client, finalVideoPath, `${basePath}/video_final.mp4`);
          } catch (_) {}
        }
      } else if (item.visual_clip_paths) {
        // B. Video clips
        let localPaths = [];
        try {
          localPaths = JSON.parse(item.visual_clip_paths || '[]');
        } catch {}

        let clipUploaded = false;
        for (let i = 0; i < localPaths.length; i++) {
          const clipPath = path.join(process.cwd(), 'public', localPaths[i]);
          const clipFileName = `${filePrefix}_video_clip_${i + 1}.mp4`;

          if (fs.existsSync(clipPath)) {
            await uploadToNextcloudIfMissing(client, clipPath, `${basePath}/${clipFileName}`);
            clipUploaded = true;
          }
        }
        if (clipUploaded && !driveUrl) {
          driveUrl = await getOrCreatePublicShareLink(basePath);
        }
      }

      // C. Audio files
      if (item.tts_batch_id && item.tts_batch_id !== 'skipped') {
        const ttsClips = await db.prepare("SELECT * FROM tts_studio_clips WHERE batch_id = ? AND status = 'completed'").all(item.tts_batch_id);
        for (const clip of ttsClips) {
          if (clip.audio_path) {
            const audioLocalPath = path.join(process.cwd(), 'public', clip.audio_path);
            const audioFileName = `${filePrefix}_audio_clip_${clip.clip_index + 1}.mp3`;

            if (fs.existsSync(audioLocalPath)) {
              await uploadToNextcloudIfMissing(client, audioLocalPath, `${basePath}/${audioFileName}`);
            }
          }
        }
      }

      // D. Narrative Markdown (naskah.md / [batchId]_naskah.md)
      if (item.result_json) {
        try {
          const { buildMarkdownContent } = await import('./export-builder.js');
          const parsedResult = JSON.parse(item.result_json || '{}');
          const markdownContent = buildMarkdownContent(parsedResult, batchId);
          const remoteMdPath = `${basePath}/${filePrefix}_naskah.md`;
          const exists = await client.exists(remoteMdPath);
          if (!exists) {
            await client.putFileContents(remoteMdPath, Buffer.from(markdownContent, 'utf-8'));
            // Backup copy — cek dulu sebelum upload agar tidak 409 Conflict
            const backupMdPathIfc = `${basePath}/naskah.md`;
            const backupExistsIfc = await client.exists(backupMdPathIfc);
            if (!backupExistsIfc) {
              await client.putFileContents(backupMdPathIfc, Buffer.from(markdownContent, 'utf-8'));
            }
          }
        } catch (mdErr) {
          console.error('[Nextcloud Sync IFC MD] Failed:', mdErr.message);
        }
      }

      if (driveUrl && driveUrl !== item.drive_link) {
        updateInstantCampaignItem(item.id, { drive_link: driveUrl, upload_status: 'completed' });
      }

    } catch (err) {
      console.error(`[Nextcloud Sync] Failed syncing IFC item #${item.id}:`, err.message);
    }
  }
}
