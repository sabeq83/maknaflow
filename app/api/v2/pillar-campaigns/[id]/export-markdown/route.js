import { NextResponse } from 'next/server';
import { getPillarCampaign, listPillarCampaignItems, updatePillarCampaign, getSetting } from '@/lib/db';
import { buildPillarBatchMarkdownContent } from '@/lib/export-builder';
import { getOrCreateCampaignFolder, uploadMarkdownToCampaignFolder, moveFileToFolder } from '@/lib/drive-uploader';
import { getCampaignParentFolderName } from '@/lib/scheduler-processors';
import { syncOpcCampaignAssetsToDrive } from '@/lib/drive-sync-helper';

import { withTenantContext } from '@/lib/auth';

export const POST = withTenantContext(async (request, { params }) => {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Campaign ID is required' }, { status: 400 });
    }

    const campaign = await getPillarCampaign(id);
    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 });
    }

    const items = await listPillarCampaignItems(id);

    // 1. Build batch markdown content
    const markdownContent = buildPillarBatchMarkdownContent(campaign, items);
    const sanitizedName = campaign.campaign_name.replace(/[^a-zA-Z0-9-\s_]/g, '').trim() || campaign.id;
    const filename = `${sanitizedName}.md`;

    const storageProvider = await getSetting('storage_provider') || 'gdrive';
    const parentFolderName = getCampaignParentFolderName(campaign, 'OPC');

    if (storageProvider === 'nextcloud') {
      const { uploadBufferToNextcloud } = await import('@/lib/nextcloud-helper');
      const { syncOpcCampaignAssetsToNextcloud } = await import('@/lib/nextcloud-sync-helper');

      const baseFolder = campaign.nextcloud_parent_folder || await getSetting('nextcloud_target_folder') || '/MAKNA_Video_Generations';
      const targetFolder = baseFolder.startsWith('/') ? baseFolder : '/' + baseFolder;
      const parentFolder = `${targetFolder}/${parentFolderName}`.replace(/\/+/g, '/');
      const remotePath = `${parentFolder}/${filename}`;
      const uploadResult = await uploadBufferToNextcloud(Buffer.from(markdownContent, 'utf-8'), remotePath);

      await updatePillarCampaign(id, { target_markdown_url: uploadResult.fileUrl });

      await syncOpcCampaignAssetsToNextcloud(campaign, items, parentFolder);

      return NextResponse.json({
        success: true,
        driveUrl: uploadResult.fileUrl,
        folderId: parentFolder
      });
    } else {
      // 2. Get or create Google Drive campaign folder
      const campaignFolderId = await getOrCreateCampaignFolder(parentFolderName, '');

      // 3. Upload markdown to the campaign folder
      const uploadResult = await uploadMarkdownToCampaignFolder(markdownContent, filename, campaignFolderId);

      // 4. Update the campaign target markdown url in the database
      await updatePillarCampaign(id, { target_markdown_url: uploadResult.driveUrl });

      // 5. Check and Self-Heal Google Spreadsheet if missing
      let targetSpreadsheetId = campaign.target_spreadsheet_id;
      if (!targetSpreadsheetId) {
        try {
          console.log(`[OPC Export Markdown] Creating missing spreadsheet for campaign "${campaign.campaign_name}"...`);
          const { google } = await import('googleapis');
          const { getAuthorizedClient } = await import('@/lib/google-auth');
          const { createSpreadsheet } = await import('@/lib/drive-uploader');
          const { 
            buildREStoryboardRows, buildREVoiceoverRows, buildREPromptRows, buildRECaptionsRow
          } = await import('@/lib/export-builder');

          // Create spreadsheet
          const createdSheet = await createSpreadsheet(campaign.campaign_name);
          targetSpreadsheetId = createdSheet.spreadsheetId;
          await updatePillarCampaign(id, { target_spreadsheet_id: targetSpreadsheetId });

          const auth = getAuthorizedClient();
          const sheets = google.sheets({ version: 'v4', auth });

          // Write tab headers
          const headerMap = {
            'CAMPAIGN_OPC': ['pilar_content', 'hook', 'visual_action', 'nama_produk', 'product_desc', 'usp', 'custom_instruction', 'source_product_url', 'product_image_url', 'review_status', 'pipeline_status', 'markdown_url', 'asset_url', 'processed_at'],
            Storyboard:     ['batch_id', 'scene_id', 'scene_number', 'duration', 'visual_description', 'camera_movement', 'audio_mood'],
            Voiceover:      ['batch_id', 'scene_id', 'scene_number', 'narration'],
            Prompt:         ['batch_id', 'scene_id', 'scene_number', 't2v_prompt', 't2i_prompt', 'i2v_prompt'],
            Captions:       ['batch_id', 'tiktok_caption', 'ig_caption', 'yt_title', 'yt_desc']
          };
          for (const [tab, headers] of Object.entries(headerMap)) {
            await sheets.spreadsheets.values.update({
              spreadsheetId: targetSpreadsheetId, 
              range: `'${tab}'!A1`,
              valueInputOption: 'RAW',
              requestBody: { values: [headers] },
            });
          }

          // Populate rows for each completed item
          for (let idx = 0; idx < items.length; idx++) {
            const item = items[idx];
            if (item.generation_status === 'completed') {
              let parsed = {};
              try {
                parsed = item.result_json ? JSON.parse(item.result_json) : {};
              } catch (_) {}

              const paddedIndex = String(idx + 1).padStart(3, '0');
              const batchId = `OPC-${campaign.campaign_name.replace(/[^a-zA-Z0-9_]/g, '_')}-${paddedIndex}`;

              const fullResult = {
                id: item.id.toString(),
                source_type: 'pillar_campaign',
                source_url: campaign.content_pillar || '',
                video_filename: campaign.campaign_name,
                custom_instruction: campaign.custom_instruction || '',
                aspect_ratio: campaign.aspect_ratio || '9:16',
                target_ai: campaign.target_ai || 'Google Veo (8s)',
                prompt_output_format: 'plain_text',
                storyboard: parsed.storyboard || [],
                voiceover: parsed.voiceover || [],
                t2v_prompts: parsed.t2v_prompts || [],
                t2i_prompts: parsed.t2i_prompts || [],
                i2v_prompts: parsed.i2v_prompts || [],
                tiktok_caption: parsed.tiktok_caption || '',
                ig_caption: parsed.ig_caption || '',
                yt_title: parsed.yt_title || '',
                yt_desc: parsed.yt_desc || '',
                tanggal_dibuat: new Date().toISOString()
              };

              let payloadObj = {};
              try {
                payloadObj = item.row_creative_payload ? JSON.parse(item.row_creative_payload) : {};
              } catch (_) {}

              const resultsRow = [
                payloadObj.content_pillar || campaign.content_pillar || '',
                payloadObj.custom_hook || campaign.custom_hook || '',
                payloadObj.visual_action_guideline || campaign.visual_action_guideline || '',
                payloadObj.product_name || '',
                payloadObj.product_description || '',
                payloadObj.unique_selling_point || '',
                payloadObj.custom_instruction || campaign.custom_instruction || '',
                payloadObj.source_product_url || '',
                payloadObj.product_image_url || '',
                'Approved',
                'Ready For Review',
                '', // markdown_url (leave empty)
                `https://drive.google.com/drive/folders/${campaignFolderId}`, // asset_url folder link!
                new Date().toISOString()
              ];

              const storyboardRows = buildREStoryboardRows(fullResult, batchId);
              const voiceoverRows = buildREVoiceoverRows(fullResult, batchId);
              const promptRows = buildREPromptRows(fullResult, batchId);
              const captionsRow = buildRECaptionsRow(fullResult, batchId);

              await sheets.spreadsheets.values.append({ spreadsheetId: targetSpreadsheetId, range: "'CAMPAIGN_OPC'!A1", valueInputOption: 'RAW', requestBody: { values: [resultsRow] } });
              if (storyboardRows.length) await sheets.spreadsheets.values.append({ spreadsheetId: targetSpreadsheetId, range: "'Storyboard'!A1", valueInputOption: 'RAW', requestBody: { values: storyboardRows } });
              if (voiceoverRows.length) await sheets.spreadsheets.values.append({ spreadsheetId: targetSpreadsheetId, range: "'Voiceover'!A1", valueInputOption: 'RAW', requestBody: { values: voiceoverRows } });
              if (promptRows.length) await sheets.spreadsheets.values.append({ spreadsheetId: targetSpreadsheetId, range: "'Prompt'!A1", valueInputOption: 'RAW', requestBody: { values: promptRows } });
              await sheets.spreadsheets.values.append({ spreadsheetId: targetSpreadsheetId, range: "'Captions'!A1", valueInputOption: 'RAW', requestBody: { values: [captionsRow] } });
            }
          }
        } catch (err) {
          console.error('[OPC Export Markdown] Failed to generate Google Sheet on the fly:', err.message);
        }
      }

      // Move the sheet into the campaign's Drive folder
      if (targetSpreadsheetId) {
        try {
          await moveFileToFolder(targetSpreadsheetId, campaignFolderId);
        } catch (err) {
          console.warn(`[OPC Export Markdown] Failed to move Google Sheet ${targetSpreadsheetId}:`, err.message);
        }
      }

      // 6. Sync missing campaign video/audio assets to Google Drive
      await syncOpcCampaignAssetsToDrive(campaign, items, campaignFolderId);

      return NextResponse.json({
        success: true,
        driveUrl: uploadResult.driveUrl,
        folderId: campaignFolderId,
      });
    }
  } catch (error) {
    console.error('Export markdown API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
