import { getDb, updateReCampaignItem, updatePillarCampaignItem, updateInstantCampaignItem } from './db.js';
import { uploadVideoToFolder, uploadLocalFileToFolder, getOrCreateFolderInFolder } from './drive-uploader.js';
import { getAuthorizedClient } from './google-auth.js';
import {
  getCloudFolderPath,
  getCloudMasterFileName,
  getCloudVoFileName,
  getCloudThumbFileName,
  getCloudClipFileName
} from './cloud-naming-helper.js';
import { google } from 'googleapis';
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

export async function syncReCampaignAssetsToDrive(campaign, items, campaignFolderId) {
  const db = getDb();
  const auth = getAuthorizedClient();
  const drive = google.drive({ version: 'v3', auth });

  // Scan items
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const paddedIndex = String(idx + 1).padStart(3, '0');

    // 1. Check if item has angle variants (Multi-Angle)
    const variants = await db.prepare('SELECT * FROM re_item_angle_variants WHERE re_item_id = ?').all(item.id);

    if (variants && variants.length > 0) {
      for (const variant of variants) {
        const baseBatchId = await getReBatchIdLocal(campaign, item, db);
        const batchFolderName = `${baseBatchId}-Angle-${variant.angle_name}`;
        
        try {
          const batchFolderId = await getOrCreateFolderInFolder(batchFolderName, campaignFolderId);

          // Get files currently in Drive batch folder
          const listRes = await drive.files.list({
            q: `'${batchFolderId}' in parents and trashed=false`,
            fields: 'files(name, id)',
            spaces: 'drive',
          });
          const existingFileNames = new Set((listRes.data.files || []).map(f => f.name));

          let driveUrl = variant.drive_link || '';

          const filePrefix = `${getFilePrefixFromBatchId(baseBatchId)}-Angle-${variant.angle_name}`;

          // A. Video final
          if (variant.ffmpeg_status === 'completed' && variant.ffmpeg_output_path) {
            const finalFileName = `${filePrefix}_video_final.mp4`;
            const finalVideoPath = path.join(process.cwd(), 'public', variant.ffmpeg_output_path);
            
            if (fs.existsSync(finalVideoPath)) {
              if (!existingFileNames.has(finalFileName)) {
                console.log(`[Drive Sync] Uploading final video for variant ${variant.angle_name}...`);
                const uploaded = await uploadVideoToFolder(finalVideoPath, finalFileName, batchFolderId);
                driveUrl = uploaded.driveUrl;

              } else if (!driveUrl) {
                const driveFile = listRes.data.files.find(f => f.name === finalFileName);
                driveUrl = `https://drive.google.com/file/d/${driveFile.id}/view`;
              }
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
                if (!existingFileNames.has(clipFileName)) {
                  console.log(`[Drive Sync] Uploading clip ${i + 1} for variant ${variant.angle_name}...`);
                  await uploadVideoToFolder(clipPath, clipFileName, batchFolderId);
                  clipUploaded = true;
                } else {
                  clipUploaded = true;
                }
              }
            }

            if (clipUploaded && !driveUrl) {
              driveUrl = `https://drive.google.com/drive/folders/${batchFolderId}`;
            }
          }

          // C. Audio files
          if (variant.tts_batch_id && variant.tts_batch_id !== 'skipped') {
            const ttsClips = await db.prepare("SELECT * FROM tts_studio_clips WHERE batch_id = ? AND status = 'completed'").all(variant.tts_batch_id);
            for (const clip of ttsClips) {
              if (clip.audio_path) {
                const audioLocalPath = path.join(process.cwd(), 'public', clip.audio_path);
                const audioFileName = `${filePrefix}_audio_clip_${clip.clip_index + 1}.mp3`;

                if (fs.existsSync(audioLocalPath) && !existingFileNames.has(audioFileName)) {
                  console.log(`[Drive Sync] Uploading audio ${clip.clip_index + 1} for variant ${variant.angle_name}...`);
                  await uploadLocalFileToFolder(audioLocalPath, audioFileName, batchFolderId, 'audio/mpeg');
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
              const mdFileName = `${filePrefix}_naskah.md`;
              if (!existingFileNames.has(mdFileName)) {
                const { uploadMarkdownToCampaignFolder } = await import('./drive-uploader.js');
                await uploadMarkdownToCampaignFolder(markdownContent, mdFileName, batchFolderId);
                await uploadMarkdownToCampaignFolder(markdownContent, 'naskah.md', batchFolderId);
              }
            } catch (mdErr) {
              console.error('[Drive Sync RE Variant MD] Failed:', mdErr.message);
            }
          }

          // Update variant DB if drive_link was resolved or changed
          if (driveUrl && driveUrl !== variant.drive_link) {
            await db.prepare("UPDATE re_item_angle_variants SET upload_status = 'completed', drive_link = ? WHERE id = ?").run(driveUrl, variant.id);
          }

        } catch (err) {
          console.error(`[Drive Sync] Failed syncing variant ${variant.angle_name}:`, err.message);
        }
      }
    } else {
      // 2. Item has no angle variants
      const batchFolderName = await getReBatchIdLocal(campaign, item, db);

      try {
        const batchFolderId = await getOrCreateFolderInFolder(batchFolderName, campaignFolderId);

        // Get files currently in Drive batch folder
        const listRes = await drive.files.list({
          q: `'${batchFolderId}' in parents and trashed=false`,
          fields: 'files(name, id)',
          spaces: 'drive',
        });
        const existingFileNames = new Set((listRes.data.files || []).map(f => f.name));

        let driveUrl = item.drive_link || '';

        const filePrefix = getFilePrefixFromBatchId(batchFolderName);

        // A. Video final
        if (item.ffmpeg_status === 'completed' && item.ffmpeg_output_path && item.ffmpeg_output_path !== 'skipped') {
          const finalFileName = `${filePrefix}_video_final.mp4`;
          const finalVideoPath = path.join(process.cwd(), 'public', item.ffmpeg_output_path);
 
          if (fs.existsSync(finalVideoPath)) {
            if (!existingFileNames.has(finalFileName)) {
              console.log(`[Drive Sync] Uploading final video for item #${item.id}...`);
              const uploaded = await uploadVideoToFolder(finalVideoPath, finalFileName, batchFolderId);
              driveUrl = uploaded.driveUrl;

            } else if (!driveUrl) {
              const driveFile = listRes.data.files.find(f => f.name === finalFileName);
              driveUrl = `https://drive.google.com/file/d/${driveFile.id}/view`;
            }
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
              if (!existingFileNames.has(clipFileName)) {
                console.log(`[Drive Sync] Uploading clip ${i + 1} for item #${item.id}...`);
                await uploadVideoToFolder(clipPath, clipFileName, batchFolderId);
                clipUploaded = true;
              } else {
                clipUploaded = true;
              }
            }
          }
 
          if (clipUploaded && !driveUrl) {
            driveUrl = `https://drive.google.com/drive/folders/${batchFolderId}`;
          }
        }
 
        // C. Audio files
        if (item.tts_batch_id && item.tts_batch_id !== 'skipped') {
          const ttsClips = await db.prepare("SELECT * FROM tts_studio_clips WHERE batch_id = ? AND status = 'completed'").all(item.tts_batch_id);
          for (const clip of ttsClips) {
            if (clip.audio_path) {
              const audioLocalPath = path.join(process.cwd(), 'public', clip.audio_path);
              const audioFileName = `${filePrefix}_audio_clip_${clip.clip_index + 1}.mp3`;
 
              if (fs.existsSync(audioLocalPath) && !existingFileNames.has(audioFileName)) {
                console.log(`[Drive Sync] Uploading audio ${clip.clip_index + 1} for item #${item.id}...`);
                await uploadLocalFileToFolder(audioLocalPath, audioFileName, batchFolderId, 'audio/mpeg');
              }
            }
          }
        }
 
        // D. Narrative Markdown (naskah.md / [filePrefix]_naskah.md)
        if (item.result_json) {
          try {
            const { buildMarkdownContent } = await import('./export-builder.js');
            const parsedResult = JSON.parse(item.result_json || '{}');
            const markdownContent = buildMarkdownContent(parsedResult, batchFolderName);
            const mdFileName = `${filePrefix}_naskah.md`;
            if (!existingFileNames.has(mdFileName)) {
              const { uploadMarkdownToCampaignFolder } = await import('./drive-uploader.js');
              await uploadMarkdownToCampaignFolder(markdownContent, mdFileName, batchFolderId);
              await uploadMarkdownToCampaignFolder(markdownContent, 'naskah.md', batchFolderId);
            }
          } catch (mdErr) {
            console.error('[Drive Sync RE Item MD] Failed:', mdErr.message);
          }
        }

        // Update item DB if drive_link was resolved or changed
        if (driveUrl && driveUrl !== item.drive_link) {
          updateReCampaignItem(item.id, { drive_link: driveUrl, upload_status: 'completed' });
        }

      } catch (err) {
        console.error(`[Drive Sync] Failed syncing item #${item.id}:`, err.message);
      }
    }
  }
}

export async function syncOpcCampaignAssetsToDrive(campaign, items, campaignFolderId) {
  const db = getDb();
  const auth = getAuthorizedClient();
  const drive = google.drive({ version: 'v3', auth });

  // Scan items
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const paddedIndex = String(idx + 1).padStart(3, '0');

    const batchFolderName = await getOpcBatchIdLocal(campaign, item, db);

    try {
      const batchFolderId = await getOrCreateFolderInFolder(batchFolderName, campaignFolderId);

      // Get files currently in Drive batch folder
      const listRes = await drive.files.list({
        q: `'${batchFolderId}' in parents and trashed=false`,
        fields: 'files(name, id)',
        spaces: 'drive',
      });
      const existingFileNames = new Set((listRes.data.files || []).map(f => f.name));

      let driveUrl = item.drive_link || '';

      const filePrefix = getFilePrefixFromBatchId(batchFolderName);

      // A. Video final
      if (item.ffmpeg_status === 'completed' && item.ffmpeg_output_path && item.ffmpeg_output_path !== 'skipped') {
        const finalVideoFileNameCloud = `${filePrefix}_video_final.mp4`;
        const finalVideoPath = path.join(process.cwd(), 'public', item.ffmpeg_output_path);

        if (fs.existsSync(finalVideoPath)) {
          if (!existingFileNames.has(finalVideoFileNameCloud)) {
            console.log(`[Drive Sync] Uploading final video for OPC item #${item.id}...`);
            const uploaded = await uploadVideoToFolder(finalVideoPath, finalVideoFileNameCloud, batchFolderId);
            driveUrl = uploaded.driveUrl;

          } else if (!driveUrl) {
            const driveFile = listRes.data.files.find(f => f.name === finalVideoFileNameCloud);
            driveUrl = `https://drive.google.com/file/d/${driveFile.id}/view`;
          }
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
            if (!existingFileNames.has(clipFileName)) {
              console.log(`[Drive Sync] Uploading clip ${i + 1} for OPC item #${item.id}...`);
              await uploadVideoToFolder(clipPath, clipFileName, batchFolderId);
              clipUploaded = true;
            } else {
              clipUploaded = true;
            }
          }
        }

        if (clipUploaded && !driveUrl) {
          driveUrl = `https://drive.google.com/drive/folders/${batchFolderId}`;
        }
      }

      // C. Audio files
      if (item.tts_batch_id && item.tts_batch_id !== 'skipped') {
        const ttsClips = await db.prepare("SELECT * FROM tts_studio_clips WHERE batch_id = ? AND status = 'completed'").all(item.tts_batch_id);
        for (const clip of ttsClips) {
          if (clip.audio_path) {
            const audioLocalPath = path.join(process.cwd(), 'public', clip.audio_path);
            const audioFileName = `${filePrefix}_audio_clip_${clip.clip_index + 1}.mp3`;

            if (fs.existsSync(audioLocalPath) && !existingFileNames.has(audioFileName)) {
              console.log(`[Drive Sync] Uploading audio ${clip.clip_index + 1} for OPC item #${item.id}...`);
              await uploadLocalFileToFolder(audioLocalPath, audioFileName, batchFolderId, 'audio/mpeg');
            }
          }
        }
      }

      // D. Narrative Markdown (naskah.md / [filePrefix]_naskah.md)
      if (item.result_json) {
        try {
          const { buildMarkdownContent } = await import('./export-builder.js');
          const parsedResult = JSON.parse(item.result_json || '{}');
          const markdownContent = buildMarkdownContent(parsedResult, batchFolderName);
          const mdFileName = `${filePrefix}_naskah.md`;
          if (!existingFileNames.has(mdFileName)) {
            const { uploadMarkdownToCampaignFolder } = await import('./drive-uploader.js');
            await uploadMarkdownToCampaignFolder(markdownContent, mdFileName, batchFolderId);
            await uploadMarkdownToCampaignFolder(markdownContent, 'naskah.md', batchFolderId);
          }
        } catch (mdErr) {
          console.error('[Drive Sync OPC MD] Failed:', mdErr.message);
        }
      }

      // Update OPC item DB if drive_link was resolved or changed
      if (driveUrl && driveUrl !== item.drive_link) {
        updatePillarCampaignItem(item.id, { drive_link: driveUrl, upload_status: 'completed' });
      }

    } catch (err) {
      console.error(`[Drive Sync] Failed syncing OPC item #${item.id}:`, err.message);
    }
  }
}

export async function syncIfcCampaignAssetsToDrive(campaign, items, campaignFolderId) {
  const db = getDb();
  const auth = getAuthorizedClient();
  const drive = google.drive({ version: 'v3', auth });

  // Scan items
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const paddedIndex = String(idx + 1).padStart(3, '0');

    // Folder batch name (Standardized with IFC batch ID)
    const batchId = getIfcBatchIdLocal(campaign, item, db);

    try {
      const batchFolderId = await getOrCreateFolderInFolder(batchId, campaignFolderId);

      // Get files currently in Drive batch folder
      const listRes = await drive.files.list({
        q: `'${batchFolderId}' in parents and trashed=false`,
        fields: 'files(name, id)',
        spaces: 'drive',
      });
      const existingFileNames = new Set((listRes.data.files || []).map(f => f.name));

      let driveUrl = item.drive_link || '';

      const filePrefix = getFilePrefixFromBatchId(batchId);

      // A. Video final
      if (item.ffmpeg_status === 'completed' && item.ffmpeg_output_path && item.ffmpeg_output_path !== 'skipped') {
        const finalVideoFileNameCloud = `${filePrefix}_video_final.mp4`;
        const finalVideoPath = path.join(process.cwd(), 'public', item.ffmpeg_output_path);

        if (fs.existsSync(finalVideoPath)) {
          if (!existingFileNames.has(finalVideoFileNameCloud)) {
            console.log(`[Drive Sync] Uploading final video for IFC item #${item.id}...`);
            const uploaded = await uploadVideoToFolder(finalVideoPath, finalVideoFileNameCloud, batchFolderId);
            driveUrl = uploaded.driveUrl;

          } else if (!driveUrl) {
            const driveFile = listRes.data.files.find(f => f.name === finalVideoFileNameCloud);
            driveUrl = `https://drive.google.com/file/d/${driveFile.id}/view`;
          }
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
            if (!existingFileNames.has(clipFileName)) {
              console.log(`[Drive Sync] Uploading clip ${i + 1} for IFC item #${item.id}...`);
              await uploadVideoToFolder(clipPath, clipFileName, batchFolderId);
              clipUploaded = true;
            } else {
              clipUploaded = true;
            }
          }
        }

        if (clipUploaded && !driveUrl) {
          driveUrl = `https://drive.google.com/drive/folders/${batchFolderId}`;
        }
      }

      // C. Audio files
      if (item.tts_batch_id && item.tts_batch_id !== 'skipped') {
        const ttsClips = await db.prepare("SELECT * FROM tts_studio_clips WHERE batch_id = ? AND status = 'completed'").all(item.tts_batch_id);
        for (const clip of ttsClips) {
          if (clip.audio_path) {
            const audioLocalPath = path.join(process.cwd(), 'public', clip.audio_path);
            const audioFileName = `${filePrefix}_audio_clip_${clip.clip_index + 1}.mp3`;

            if (fs.existsSync(audioLocalPath) && !existingFileNames.has(audioFileName)) {
              console.log(`[Drive Sync] Uploading audio ${clip.clip_index + 1} for IFC item #${item.id}...`);
              await uploadLocalFileToFolder(audioLocalPath, audioFileName, batchFolderId, 'audio/mpeg');
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
          const mdFileName = `${filePrefix}_naskah.md`;
          if (!existingFileNames.has(mdFileName)) {
            const { uploadMarkdownToCampaignFolder } = await import('./drive-uploader.js');
            await uploadMarkdownToCampaignFolder(markdownContent, mdFileName, batchFolderId);
            await uploadMarkdownToCampaignFolder(markdownContent, 'naskah.md', batchFolderId);
          }
        } catch (mdErr) {
          console.error('[Drive Sync IFC MD] Failed:', mdErr.message);
        }
      }

      // Update IFC item DB if drive_link was resolved or changed
      if (driveUrl && driveUrl !== item.drive_link) {
        updateInstantCampaignItem(item.id, { drive_link: driveUrl, upload_status: 'completed' });
      }

    } catch (err) {
      console.error(`[Drive Sync] Failed syncing IFC item #${item.id}:`, err.message);
    }
  }
}
