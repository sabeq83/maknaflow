import { NextResponse } from 'next/server';
import { getReCampaign, listReCampaignItems, updateReCampaign, getSetting } from '@/lib/db';
import { buildBatchMarkdownContent } from '@/lib/export-builder';
import { getOrCreateCampaignFolder, uploadMarkdownToCampaignFolder, moveFileToFolder } from '@/lib/drive-uploader';
import { getCampaignParentFolderName } from '@/lib/scheduler-processors';
import { syncReCampaignAssetsToDrive } from '@/lib/drive-sync-helper';

import { withTenantContext } from '@/lib/auth';

export const POST = withTenantContext(async (request, { params }) => {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Campaign ID is required' }, { status: 400 });
    }

    const campaign = await getReCampaign(id);
    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 });
    }

    const items = await listReCampaignItems(id);

    // 1. Build batch markdown content
    const markdownContent = buildBatchMarkdownContent(campaign, items);
    const sanitizedName = campaign.campaign_name.replace(/[^a-zA-Z0-9-\s_]/g, '').trim() || campaign.id;
    const filename = `${sanitizedName}.md`;

    const storageProvider = await getSetting('storage_provider') || 'gdrive';
    const parentFolderName = getCampaignParentFolderName(campaign, 'RE');

    if (storageProvider === 'nextcloud') {
      const { uploadBufferToNextcloud } = await import('@/lib/nextcloud-helper');
      const { syncReCampaignAssetsToNextcloud } = await import('@/lib/nextcloud-sync-helper');
      
      const baseFolder = campaign.nextcloud_parent_folder || await getSetting('nextcloud_target_folder') || '/MAKNA_Video_Generations';
      const targetFolder = baseFolder.startsWith('/') ? baseFolder : '/' + baseFolder;
      const parentFolder = `${targetFolder}/${parentFolderName}`.replace(/\/+/g, '/');
      const remotePath = `${parentFolder}/${filename}`;
      const uploadResult = await uploadBufferToNextcloud(Buffer.from(markdownContent, 'utf-8'), remotePath);

      await updateReCampaign(id, { target_markdown_url: uploadResult.fileUrl });

      await syncReCampaignAssetsToNextcloud(campaign, items, parentFolder);

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

      // Update target markdown url in the database
      await updateReCampaign(id, { target_markdown_url: uploadResult.driveUrl });

      // 4. Move the campaign's Google Sheet (if exists) into the same folder
      if (campaign.target_spreadsheet_id) {
        try {
          await moveFileToFolder(campaign.target_spreadsheet_id, campaignFolderId);
        } catch (err) {
          console.warn(`[Export Markdown] Failed to move Google Sheet ${campaign.target_spreadsheet_id}:`, err.message);
        }
      }

      // 5. Sync missing campaign video/audio assets to Google Drive
      await syncReCampaignAssetsToDrive(campaign, items, campaignFolderId);

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
