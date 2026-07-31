import { NextResponse } from 'next/server';
import { getInstantCampaign, listInstantCampaignItems, updateInstantCampaign, getSetting } from '@/lib/db';
import { buildPillarBatchMarkdownContent } from '@/lib/export-builder';
import { getOrCreateCampaignFolder, uploadMarkdownToCampaignFolder } from '@/lib/drive-uploader';
import { getCampaignParentFolderName } from '@/lib/scheduler-processors';
import { syncIfcCampaignAssetsToDrive } from '@/lib/drive-sync-helper';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Campaign ID is required' }, { status: 400 });
    }

    const campaign = await getInstantCampaign(id);
    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 });
    }

    const items = await listInstantCampaignItems(id);

    // 1. Build batch markdown content (buildPillarBatchMarkdownContent fits the IFC campaign structure perfectly)
    const markdownContent = buildPillarBatchMarkdownContent(campaign, items);
    const sanitizedName = campaign.campaign_name.replace(/[^a-zA-Z0-9-\s_]/g, '').trim() || campaign.id;
    const filename = `${sanitizedName}.md`;

    const storageProvider = await getSetting('storage_provider') || 'gdrive';
    const parentFolderName = getCampaignParentFolderName(campaign, 'IFC');

    if (storageProvider === 'nextcloud') {
      const { uploadBufferToNextcloud } = await import('@/lib/nextcloud-helper');
      const { syncIfcCampaignAssetsToNextcloud } = await import('@/lib/nextcloud-sync-helper');

      const targetFolder = await getSetting('nextcloud_target_folder') || '/MAKNA_Video_Generations';
      const parentFolder = `${targetFolder}/${parentFolderName}`.replace(/\/+/g, '/');
      const remotePath = `${parentFolder}/${filename}`;
      const uploadResult = await uploadBufferToNextcloud(Buffer.from(markdownContent, 'utf-8'), remotePath);

      await updateInstantCampaign(id, { target_markdown_url: uploadResult.fileUrl });

      await syncIfcCampaignAssetsToNextcloud(campaign, items, parentFolder);

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
      await updateInstantCampaign(id, { target_markdown_url: uploadResult.driveUrl });

      // 5. Sync missing campaign video/audio assets to Google Drive
      await syncIfcCampaignAssetsToDrive(campaign, items, campaignFolderId);

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
}
