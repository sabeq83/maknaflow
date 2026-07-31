import { NextResponse } from 'next/server';
import { getDb, updateReCampaignItem, getSetting } from '../../../../../../../lib/db';
import { generateImage, getTaskStatus, getFileUrl } from '../../../../../../../lib/webhook-client';
import fs from 'fs';
import path from 'path';

export async function POST(req, { params }) {
  try {
    const resolvedParams = await params;
    const itemId = resolvedParams.itemId;

    if (!itemId) {
      return NextResponse.json({ success: false, error: "itemId is required" }, { status: 400 });
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

    if (item.regenerate_start_frames_status === 'running') {
      return NextResponse.json({ success: false, error: "Regenerasi start frame untuk item ini sedang berjalan." }, { status: 400 });
    }

    let newVideoPlan = [];
    try {
      newVideoPlan = JSON.parse(item.new_video_plan_json || '[]');
    } catch {}

    const clipsToProcess = newVideoPlan.filter(p => p.clip_index && p.t2i_prompt);
    if (clipsToProcess.length === 0) {
      return NextResponse.json({ success: false, error: "Tidak ada prompt T2I ditemukan pada item ini." }, { status: 400 });
    }

    // Set status to running
    await updateReCampaignItem(itemId, {
      regenerate_start_frames_status: 'running',
      regenerate_start_frames_progress: `0/${clipsToProcess.length}`
    });

    // Start background process
    runItemRegenerateStartFramesBackground(itemId, campaign, item, newVideoPlan);

    return NextResponse.json({
      success: true,
      message: "Regenerasi semua start frame telah dimulai di latar belakang."
    });

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

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

async function runItemRegenerateStartFramesBackground(itemId, campaign, item, newVideoPlan) {
  const db = getDb();
  try {
    const imageModel = await getSetting('webhook_image_model') || 'nano_banana_pro';
    
    let productBase64 = null;
    if (campaign.product_ref_image_path) {
      productBase64 = fileToBase64(campaign.product_ref_image_path);
    }
    
    const clipsToProcess = newVideoPlan.filter(p => p.clip_index && p.t2i_prompt);
    const totalCount = clipsToProcess.length;
    let processedCount = 0;
    
    for (let i = 0; i < totalCount; i++) {
      const clip = clipsToProcess[i];
      const clipIndex = clip.clip_index;
      
      console.log(`[Item SF Regen] Processing clip ${clipIndex} for item ${itemId} (${i+1}/${totalCount})...`);
      
      // Update progress state
      await updateReCampaignItem(itemId, {
        regenerate_start_frames_progress: `Mengirim ${i+1}/${totalCount}`
      });
      
      // 1. Submit T2I task to Webhook
      // [Fix v2.2.87] Lookup brand profile via account_name untuk webhookOverride
      const brandProfile = campaign.account_name
        ? await db.prepare('SELECT * FROM brand_profiles WHERE LOWER(brand_name) = LOWER(?)').get(campaign.account_name)
        : null;

      const t2iResult = await generateImage({
        prompt: clip.t2i_prompt,
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
        console.error(`[Item SF Regen] Clip ${clipIndex} failed to submit (no task_id)`);
        processedCount++;
        await updateReCampaignItem(itemId, {
          regenerate_start_frames_progress: `${processedCount}/${totalCount}`
        });
        
        // Safety Delay if not the last clip
        if (i < totalCount - 1) {
          const delayMs = 10000 + Math.floor(Math.random() * 10000); // 10-20 seconds delay
          console.log(`[Item SF Regen] Safety delay: waiting ${Math.round(delayMs / 1000)}s...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        continue;
      }
      
      const t2iTaskId = t2iResult.task_id;
      console.log(`[Item SF Regen] Clip ${clipIndex} task ${t2iTaskId} submitted. Polling...`);
      
      let t2iCompleted = false;
      let t2iImageUrl = null;
      const maxAttempts = 75; // 150s max
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const statusResult = await getTaskStatus(t2iTaskId);
        const status = (statusResult?.status || '').toLowerCase();
        
        if (status === 'completed') {
          const files = statusResult.results || statusResult.files || [];
          let imageFile = files.find(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')) || files[0];
          if (imageFile && (imageFile.startsWith('http://') || imageFile.startsWith('https://'))) {
            imageFile = imageFile.split('/').pop();
          }
          if (imageFile) {
            t2iImageUrl = getFileUrl(imageFile);
            t2iCompleted = true;
            break;
          }
        } else if (status === 'failed') {
          break;
        }
      }
      
      if (t2iCompleted && t2iImageUrl) {
        // Download and save image
        console.log(`[Item SF Regen] Downloading image from ${t2iImageUrl}...`);
        const imgResponse = await fetch(t2iImageUrl);
        if (imgResponse.ok) {
          const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
          const startFrameFilename = `start_frame_${itemId}_clip_${clipIndex}.png`;
          const startFrameLocalPath = path.join(process.cwd(), 'public', 'uploads', 'start_frames', startFrameFilename);
          const startFrameDir = path.dirname(startFrameLocalPath);
          if (!fs.existsSync(startFrameDir)) {
            fs.mkdirSync(startFrameDir, { recursive: true });
          }
          fs.writeFileSync(startFrameLocalPath, imgBuffer);
          
          // Update DB atomically
          await db.transaction(async () => {
            const currentItem = await db.prepare("SELECT t2i_images_json FROM re_campaign_items WHERE id = ?").get(itemId);
            if (!currentItem) throw new Error("Item not found");
            
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
              t2i_images_json: JSON.stringify(localT2iImages)
            });
          })();
          console.log(`[Item SF Regen] Clip ${clipIndex} regenerated successfully.`);
        } else {
          console.error(`[Item SF Regen] Failed to download image for clip ${clipIndex}`);
        }
      } else {
        console.error(`[Item SF Regen] Clip ${clipIndex} generation timed out or failed`);
      }
      
      processedCount++;
      await updateReCampaignItem(itemId, {
        regenerate_start_frames_progress: `${processedCount}/${totalCount}`
      });
      
      // 2. Safety Delay (10-20 seconds) before sending next prompt
      if (i < totalCount - 1) {
        const delayMs = 10000 + Math.floor(Math.random() * 10000); // 10 to 20 seconds delay
        console.log(`[Item SF Regen] Safety delay: waiting ${Math.round(delayMs / 1000)}s before next submission...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    // Complete and reset status/progress to null so UI returns to normal
    await updateReCampaignItem(itemId, {
      regenerate_start_frames_status: null,
      regenerate_start_frames_progress: null
    });
    console.log(`[Item SF Regen] Item ${itemId} start frame regeneration finished successfully.`);
  } catch (err) {
    console.error(`[Item SF Regen] Error:`, err.message);
    await updateReCampaignItem(itemId, {
      regenerate_start_frames_status: 'failed',
      regenerate_start_frames_progress: err.message
    });
  }
}
