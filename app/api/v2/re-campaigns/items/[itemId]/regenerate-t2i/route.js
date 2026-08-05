import { NextResponse } from 'next/server';
import { getDb, updateReCampaignItem, getSetting } from '../../../../../../../lib/db';
import { generateImage, getTaskStatus, getFileUrl } from '../../../../../../../lib/webhook-client';
import fs from 'fs';
import path from 'path';

import { withTenantContext } from '@/lib/auth';

export const POST = withTenantContext(async (req, { params }) => {
  try {
    const resolvedParams = await params;
    const itemId = resolvedParams.itemId;
    const { clipIndex, t2i_prompt } = await req.json();

    if (!itemId || !clipIndex || !t2i_prompt) {
      return NextResponse.json({ success: false, error: "itemId, clipIndex, and t2i_prompt are required" }, { status: 400 });
    }

    const db = getDb();
    const item = await db.prepare("SELECT * FROM re_campaign_items WHERE id = ?").get(itemId);
    if (!item) {
      return NextResponse.json({ success: false, error: "Campaign item not found" }, { status: 404 });
    }

    const campaign = await db.prepare("SELECT * FROM re_campaigns WHERE id = ?").get(item.campaign_id);
    if (!campaign) {
      return NextResponse.json({ success: false, error: "Campaign not found" }, { status: 404 });
    }

    // 3. Generate Image on G-Labs
    const imageModel = await getSetting('webhook_image_model') || 'nano_banana_pro';

    let productData = null;
    if (campaign.target_product_id) {
      productData = await db.prepare("SELECT * FROM product_extractions WHERE id = ?").get(campaign.target_product_id);
    }
    if (!productData && campaign.campaign_name) {
      const firstWord = campaign.campaign_name.split(' ')[0] || campaign.campaign_name;
      productData = await db.prepare("SELECT * FROM product_extractions WHERE product_name LIKE ? ORDER BY id DESC LIMIT 1").get(`%${firstWord}%`);
    }

    const { resolveProductBase64 } = await import('../../../../../../../lib/scheduler-processors');
    const productBase64 = resolveProductBase64(campaign, productData);

    console.log(`[RE UI Regenerate] Submitting T2I task for clip ${clipIndex}...`);

    const brandProfile = campaign.account_name
      ? await db.prepare('SELECT * FROM brand_profiles WHERE LOWER(brand_name) = LOWER(?)').get(campaign.account_name)
      : null;

    const t2iResult = await generateImage({
      prompt: t2i_prompt,
      model: imageModel,
      aspect_ratio: campaign.aspect_ratio || '9:16',
      reference_images: productBase64 ? (
        (imageModel.startsWith('nano_') || imageModel.includes('banana'))
          ? [productBase64]
          : [{ data: productBase64, category: 'subject' }]
      ) : undefined,
      webhookOverride: brandProfile
    });

    if (!t2iResult || !t2iResult.task_id) {
      return NextResponse.json({ success: false, error: "Failed to dispatch T2I job to G-Labs" }, { status: 500 });
    }

    const taskId = t2iResult.task_id;
    console.log(`[RE UI Regenerate] Job dispatched. Task ID: ${taskId}. Waiting for completion...`);

    let statusRes = null;
    let maxRetries = 60; // 2 minutes maximum wait
    while (maxRetries > 0) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      statusRes = await getTaskStatus(taskId);
      if (statusRes.status === 'completed' || statusRes.status === 'failed') {
        break;
      }
      maxRetries--;
    }

    if (!statusRes || statusRes.status !== 'completed') {
      return NextResponse.json({ success: false, error: `Image generation failed or timed out: ${statusRes?.error || 'timeout'}` }, { status: 500 });
    }

    const results = statusRes.results || statusRes.files || [];
    let completedImageName = results.find(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.webp')) || results[0];
    if (!completedImageName) {
      return NextResponse.json({ success: false, error: "G-Labs did not return any image file path." }, { status: 500 });
    }

    // 4. Download file to local storage
    if (completedImageName.startsWith('http://') || completedImageName.startsWith('https://')) {
      completedImageName = completedImageName.split('/').pop();
    }
    const downloadUrl = getFileUrl(completedImageName);
    const ext = completedImageName.split('.').pop() || 'png';
    const startFrameFilename = `start_frame_${itemId}_clip${clipIndex}_${Date.now()}.${ext}`;

    const destDir = path.join(process.cwd(), 'public', 'uploads', 'start_frames');
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const destPath = path.join(destDir, startFrameFilename);
    console.log(`[RE UI Regenerate] Downloading generated image from ${downloadUrl} to ${destPath}...`);

    const dlRes = await fetch(downloadUrl);
    if (!dlRes.ok) {
      throw new Error(`Failed to download image: ${dlRes.statusText}`);
    }
    const arrayBuffer = await dlRes.arrayBuffer();
    fs.writeFileSync(destPath, Buffer.from(arrayBuffer));

    // 5. Update local JSON structures inside DB asynchronously (to prevent blocking)
    (async () => {
      const currentItem = await db.prepare("SELECT t2i_images_json, new_video_plan_json, result_json FROM re_campaign_items WHERE id = ?").get(itemId);
      if (!currentItem) return;

      let localNewVideoPlan = [];
      try {
        localNewVideoPlan = JSON.parse(currentItem.new_video_plan_json || '[]');
      } catch {}
      const planClip = localNewVideoPlan.find(p => Number(p.clip_index) === Number(clipIndex));
      if (planClip) {
        planClip.t2i_prompt = t2i_prompt;
      }

      let localOldParsed = {};
      try {
        localOldParsed = JSON.parse(currentItem.result_json || '{}');
      } catch {}
      const localT2iPrompts = (localOldParsed.t2i_prompts || []).map(p => {
        if (Number(p.clip) === Number(clipIndex)) {
          return { ...p, prompt: t2i_prompt };
        }
        return p;
      });
      const localUpdatedResultJson = JSON.stringify({ ...localOldParsed, t2i_prompts: localT2iPrompts });

      let localT2iImages = [];
      try {
        localT2iImages = JSON.parse(currentItem.t2i_images_json || '[]');
      } catch {}
      const targetIdx = Number(clipIndex) - 1;
      while (localT2iImages.length <= targetIdx) {
        localT2iImages.push(null);
      }
      localT2iImages[targetIdx] = `/uploads/start_frames/${startFrameFilename}`;

      await updateReCampaignItem(itemId, {
        new_video_plan_json: JSON.stringify(localNewVideoPlan),
        result_json: localUpdatedResultJson,
        t2i_images_json: JSON.stringify(localT2iImages)
      });
    })();

    const localUrl = `/uploads/start_frames/${startFrameFilename}?t=${Date.now()}`;
    return NextResponse.json({
      success: true,
      imageUrl: localUrl,
      message: "T2I image regenerated and updated successfully."
    });

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
