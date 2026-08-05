import { NextResponse } from 'next/server';
import { getDb, updateReCampaignItem } from '../../../../../../../lib/db';
import fs from 'fs';
import path from 'path';

import { withTenantContext } from '@/lib/auth';

export const POST = withTenantContext(async (req, { params }) => {
  try {
    const resolvedParams = await params;
    const itemId = resolvedParams.itemId;
    
    if (!itemId) {
      return NextResponse.json({ success: false, error: 'Item ID is required' }, { status: 400 });
    }

    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ success: false, error: 'Content type must be multipart/form-data' }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const clipIndexStr = formData.get('clipIndex');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ success: false, error: 'No image file uploaded' }, { status: 400 });
    }
    if (!clipIndexStr) {
      return NextResponse.json({ success: false, error: 'clipIndex is required' }, { status: 400 });
    }

    const clipIndex = Number(clipIndexStr);
    const db = getDb();
    
    const item = await db.prepare("SELECT * FROM re_campaign_items WHERE id = ?").get(itemId);
    if (!item) {
      return NextResponse.json({ success: false, error: "Campaign item not found" }, { status: 404 });
    }

    const campaign = await db.prepare("SELECT * FROM re_campaigns WHERE id = ?").get(item.campaign_id);
    if (!campaign) {
      return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const startFrameFilename = `start_frame_${item.id}_clip_${clipIndex}.png`;
    const startFrameLocalPath = path.join(process.cwd(), 'public', 'uploads', 'start_frames', startFrameFilename);
    
    const startFrameDir = path.dirname(startFrameLocalPath);
    if (!fs.existsSync(startFrameDir)) {
      fs.mkdirSync(startFrameDir, { recursive: true });
    }
    
    fs.writeFileSync(startFrameLocalPath, buffer);
    const relativeStartFramePath = `/uploads/start_frames/${startFrameFilename}`;

    // Update database atomically
    await db.transaction(async () => {
      const currentItem = await db.prepare("SELECT t2i_images_json FROM re_campaign_items WHERE id = ?").get(itemId);
      if (!currentItem) throw new Error("Campaign item not found in transaction");

      let localT2iImages = [];
      try {
        localT2iImages = JSON.parse(currentItem.t2i_images_json || '[]');
      } catch {}

      const targetIdx = clipIndex - 1;
      while (localT2iImages.length <= targetIdx) {
        localT2iImages.push(null);
      }
      localT2iImages[targetIdx] = relativeStartFramePath;

      const updates = {
        t2i_images_json: JSON.stringify(localT2iImages)
      };

      // If it is the bridging clip, update t2i_start_frame_path column
      const bridgeAtClip = campaign.bridge_at_clip || 3;
      const bridgeDurationClips = campaign.bridge_duration_clips !== undefined ? Number(campaign.bridge_duration_clips) : 1;
      const productEndClip = bridgeDurationClips > 0 ? (bridgeAtClip + bridgeDurationClips - 1) : bridgeAtClip;
      const isBridge = (clipIndex >= bridgeAtClip && clipIndex <= productEndClip);

      if (isBridge) {
        updates.t2i_start_frame_path = relativeStartFramePath;
      }

      await updateReCampaignItem(itemId, updates);
    })();

    const localUrl = `${relativeStartFramePath}?t=${Date.now()}`;
    return NextResponse.json({
      success: true,
      imageUrl: localUrl,
      message: "Start frame replaced successfully"
    });

  } catch (error) {
    console.error('[Replace Start Frame Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
