import { NextResponse } from 'next/server';
import { getDb, updateReCampaignItem, getSetting } from '../../../../../../../lib/db';
import { generateImage, getTaskStatus, getFileUrl } from '../../../../../../../lib/webhook-client';
import fs from 'fs';
import path from 'path';

export async function POST(req, { params }) {
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

    // 1. Update t2i_prompt inside new_video_plan_json
    let newVideoPlan = [];
    try {
      newVideoPlan = JSON.parse(item.new_video_plan_json || '[]');
    } catch {}

    const clipObj = newVideoPlan.find(p => Number(p.clip_index) === Number(clipIndex));
    if (clipObj) {
      clipObj.t2i_prompt = t2i_prompt;
    }

    // 2. Also map to result_json (for backward compatibility)
    let oldParsed = {};
    try {
      oldParsed = JSON.parse(item.result_json || '{}');
    } catch {}
    const t2i_prompts = (oldParsed.t2i_prompts || []).map(p => {
      if (Number(p.clip) === Number(clipIndex)) {
        return { ...p, prompt: t2i_prompt };
      }
      return p;
    });
    const updatedResultJson = JSON.stringify({ ...oldParsed, t2i_prompts });

    // 3. Generate Image on G-Labs
    const imageModel = await getSetting('webhook_image_model') || 'nano_banana_pro';

    const fileToBase64 = (filePath) => {
      const absolutePath = (!path.isAbsolute(filePath) || !fs.existsSync(filePath)) ? path.join(process.cwd(), 'public', filePath.startsWith('/') ? filePath.slice(1) : filePath) : filePath;
      if (!fs.existsSync(absolutePath)) return null;
      const buffer = fs.readFileSync(absolutePath);
      let mimeType = 'image/png';
      if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        mimeType = 'image/jpeg';
      } else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        mimeType = 'image/png';
      } else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
        mimeType = 'image/webp';
      }
      return `data:${mimeType};base64,${buffer.toString('base64')}`;
    };

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

    // [Fix v2.2.87] Lookup brand profile via account_name untuk webhookOverride
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

    if (!t2iResult?.task_id) {
      return NextResponse.json({ success: false, error: "Failed to submit T2I task to G-Labs" }, { status: 500 });
    }

    const t2iTaskId = t2iResult.task_id;
    console.log(`[RE UI Regenerate] T2I task ${t2iTaskId} submitted. Polling...`);

    let t2iCompleted = false;
    let t2iImageUrl = null;
    const maxT2iAttempts = 75; // 150s max
    for (let attempt = 0; attempt < maxT2iAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const t2iStatusResult = await getTaskStatus(t2iTaskId);
      const t2iStatus = (t2iStatusResult?.status || '').toLowerCase();

      if (t2iStatus === 'completed') {
        const files = t2iStatusResult.results || t2iStatusResult.files || [];
        let imageFile = files.find(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')) || files[0];
        if (imageFile && (imageFile.startsWith('http://') || imageFile.startsWith('https://'))) {
          imageFile = imageFile.split('/').pop();
        }
        if (imageFile) {
          t2iImageUrl = getFileUrl(imageFile);
          t2iCompleted = true;
          break;
        }
      } else if (t2iStatus === 'failed') {
        return NextResponse.json({ success: false, error: `T2I task failed on G-Labs` }, { status: 500 });
      }
    }

    if (!t2iCompleted || !t2iImageUrl) {
      return NextResponse.json({ success: false, error: "T2I generation timed out" }, { status: 504 });
    }

    // 4. Download new start frame and overwrite
    console.log(`[RE UI Regenerate] Downloading start frame from ${t2iImageUrl}...`);
    const imgResponse = await fetch(t2iImageUrl);
    if (!imgResponse.ok) {
      return NextResponse.json({ success: false, error: "Failed to download generated image" }, { status: 500 });
    }
    const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());

    const startFrameFilename = `start_frame_${item.id}_clip_${clipIndex}.png`;
    const startFrameLocalPath = path.join(process.cwd(), 'public', 'uploads', 'start_frames', startFrameFilename);
    const startFrameDir = path.dirname(startFrameLocalPath);
    if (!fs.existsSync(startFrameDir)) {
      fs.mkdirSync(startFrameDir, { recursive: true });
    }
    fs.writeFileSync(startFrameLocalPath, imgBuffer);

    // 5. Update database atomically using a transaction to avoid overwriting concurrent updates (e.g. from parallel T2I runs or user edits)
    await db.transaction(async () => {
      // Re-read item state from DB to get the latest JSON values
      const currentItem = await db.prepare("SELECT t2i_images_json, new_video_plan_json, result_json FROM re_campaign_items WHERE id = ?").get(itemId);
      if (!currentItem) throw new Error("Campaign item not found in transaction");

      // Update t2i_prompt inside new_video_plan_json
      let localNewVideoPlan = [];
      try {
        localNewVideoPlan = JSON.parse(currentItem.new_video_plan_json || '[]');
      } catch {}
      const currentClipObj = localNewVideoPlan.find(p => Number(p.clip_index) === Number(clipIndex));
      if (currentClipObj) {
        currentClipObj.t2i_prompt = t2i_prompt;
      }

      // Update result_json (for backward compatibility)
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

      // Update t2i_images_json
      let localT2iImages = [];
      try {
        localT2iImages = JSON.parse(currentItem.t2i_images_json || '[]');
      } catch {}
      const targetIdx = Number(clipIndex) - 1;
      while (localT2iImages.length <= targetIdx) {
        localT2iImages.push(null);
      }
      localT2iImages[targetIdx] = `/uploads/start_frames/${startFrameFilename}`;

      // Perform updates
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
}
