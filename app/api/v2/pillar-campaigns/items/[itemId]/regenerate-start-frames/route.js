import { NextResponse } from 'next/server';
import { getDb, updatePillarCampaignItem, getSetting } from '../../../../../../../lib/db';
import { generateImage, getTaskStatus, getFileUrl } from '../../../../../../../lib/webhook-client';
import fs from 'fs';
import path from 'path';

import { withTenantContext } from '@/lib/auth';

export const POST = withTenantContext(async (req, { params }) => {
  try {
    const resolvedParams = await params;
    const itemId = resolvedParams.itemId;

    if (!itemId) {
      return NextResponse.json({ success: false, error: "itemId is required" }, { status: 400 });
    }

    const db = getDb();
    const item = await db.prepare("SELECT * FROM pillar_campaign_items WHERE id = ?").get(itemId);
    if (!item) {
      return NextResponse.json({ success: false, error: "Campaign item not found" }, { status: 404 });
    }

    const campaign = await db.prepare("SELECT * FROM pillar_campaigns WHERE id = ?").get(item.campaign_id);
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
    await updatePillarCampaignItem(itemId, {
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
});

const fileToBase64 = (filePath) => {
  // Strip leading slash from web-relative paths (e.g. /uploads/...) so they resolve under public/
  const relativePart = filePath.startsWith('/') ? filePath.slice(1) : filePath;
  const absolutePath = path.join(process.cwd(), 'public', relativePart);
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
    
    let productData = null;
    if (campaign.target_product_id) {
      productData = await db.prepare("SELECT * FROM product_extractions WHERE id = ?").get(campaign.target_product_id);
    }
    if (!productData) {
      const rowPayloadTmp = item.row_creative_payload ? JSON.parse(item.row_creative_payload) : {};
      const prodTerm = rowPayloadTmp.product_name || campaign.campaign_name || '';
      if (prodTerm) {
        const firstWord = prodTerm.split(' ')[0] || prodTerm;
        productData = await db.prepare("SELECT * FROM product_extractions WHERE product_name LIKE ? ORDER BY id DESC LIMIT 1").get(`%${firstWord}%`);
      }
    }

    const { resolveProductBase64 } = await import('../../../../../../../lib/scheduler-processors');
    const rowPayload = item.row_creative_payload ? JSON.parse(item.row_creative_payload) : {};
    const productBase64 = resolveProductBase64(campaign, productData, rowPayload);
    
    const bridgeAtClip = campaign.bridge_at_clip || 2;
    const bridgeDurationClips = campaign.bridge_duration_clips !== undefined ? Number(campaign.bridge_duration_clips) : 1;
    const productEndClip = bridgeDurationClips > 0 ? (bridgeAtClip + bridgeDurationClips - 1) : bridgeAtClip;

    const clipsToProcess = newVideoPlan.filter(p => p.clip_index && p.t2i_prompt);
    const totalCount = clipsToProcess.length;
    let processedCount = 0;
    
    for (let i = 0; i < totalCount; i++) {
      const clip = clipsToProcess[i];
      const clipIndex = clip.clip_index;
      const isBridge = (Number(clipIndex) >= bridgeAtClip && Number(clipIndex) <= productEndClip);
      
      console.log(`[OPC SF Regen] Processing clip ${clipIndex} for item ${itemId} (isBridge: ${isBridge}) (${i+1}/${totalCount})...`);
      
      // Update progress state
      await updatePillarCampaignItem(itemId, {
        regenerate_start_frames_progress: `Mengirim ${i+1}/${totalCount}`
      });
      
      // 1. Submit T2I task to Webhook
      // [Fix v2.2.87] Lookup brand profile via brand_profile_id untuk webhookOverride
      const brandProfile = campaign.brand_profile_id
        ? await db.prepare('SELECT * FROM brand_profiles WHERE id = ?').get(campaign.brand_profile_id)
        : null;

      const storyboardObj = (newVideoPlan || []).find(p => Number(p.clip_index) === Number(clipIndex));
      let clipCharacters = [];
      if (storyboardObj && Array.isArray(storyboardObj.characters)) {
        clipCharacters = storyboardObj.characters;
      } else {
        if (rowPayload.main_character) {
          const clean = rowPayload.main_character.trim().toLowerCase();
          if (clean === 'mochi') clipCharacters.push('mochi');
          else if (clean === 'dr. paw' || clean === 'dr paw') clipCharacters.push('dr_paw');
          else if (clean === 'coco') clipCharacters.push('coco');
          else if (clean === 'boba') clipCharacters.push('boba');
          else if (clean === 'tofu') clipCharacters.push('tofu');
        }
        clipCharacters = Array.from(new Set(clipCharacters));
      }

      const { normalizeCharacterId } = require('../../../../../../../lib/universe-manifests');
      const { resolveClipReferenceImages } = require('../../../../../../../lib/cartoon-reference-resolver');
      const normalizedClipChars = clipCharacters.map(normalizeCharacterId).filter(Boolean);

      const isCartoon = rowPayload.content_world === 'cartoon_universe' || campaign.content_world === 'cartoon_universe';
      let resolvedRefs = { allReferences: [] };
      if (isCartoon) {
        let universeSnapshot = null;
        try {
          universeSnapshot = campaign.universe_snapshot_json ? JSON.parse(campaign.universe_snapshot_json) : null;
        } catch (_) {}
        resolvedRefs = resolveClipReferenceImages({
          contentWorld: 'cartoon_universe',
          universeProfile: campaign.universe_profile || rowPayload.universe_profile || 'pawville',
          universeSnapshot,
          clip: clipIndex,
          productReference: productBase64,
          productRevealBeat: rowPayload.product_reveal_beat || campaign.product_reveal_beat || 'none',
          clipCharacters: normalizedClipChars
        });
      } else {
        if (isBridge && productBase64) {
          resolvedRefs = { allReferences: [productBase64] };
        }
      }

      const t2iResult = await generateImage({
        prompt: clip.t2i_prompt,
        model: imageModel,
        aspect_ratio: campaign.aspect_ratio || '9:16',
        reference_images: resolvedRefs.allReferences.length > 0 ? resolvedRefs.allReferences : undefined,
        webhookOverride: brandProfile
      });
      
      if (!t2iResult?.task_id) {
        console.error(`[OPC SF Regen] Clip ${clipIndex} failed to submit (no task_id)`);
        processedCount++;
        await updatePillarCampaignItem(itemId, {
          regenerate_start_frames_progress: `${processedCount}/${totalCount}`
        });
        
        if (i < totalCount - 1) {
          const delayMs = 10000 + Math.floor(Math.random() * 10000);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        continue;
      }
      
      const t2iTaskId = t2iResult.task_id;
      console.log(`[OPC SF Regen] Clip ${clipIndex} task ${t2iTaskId} submitted. Polling...`);
      
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
        console.log(`[OPC SF Regen] Downloading image from ${t2iImageUrl}...`);
        const imgResponse = await fetch(t2iImageUrl);
        if (imgResponse.ok) {
          const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
          const startFrameFilename = `opc_start_frame_${itemId}_clip_${clipIndex}.png`;
          const startFrameLocalPath = path.join(process.cwd(), 'public', 'uploads', 'start_frames', startFrameFilename);
          const startFrameDir = path.dirname(startFrameLocalPath);
          if (!fs.existsSync(startFrameDir)) {
            fs.mkdirSync(startFrameDir, { recursive: true });
          }
          fs.writeFileSync(startFrameLocalPath, imgBuffer);
          
          // Update DB atomically
          await db.transaction(async () => {
            const currentItem = await db.prepare("SELECT t2i_images_json FROM pillar_campaign_items WHERE id = ?").get(itemId);
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
            
            await updatePillarCampaignItem(itemId, {
              t2i_images_json: JSON.stringify(localT2iImages),
              t2i_start_frame_path: `/uploads/start_frames/${startFrameFilename}` // Also write to single path for backward compatibility
            });
          })();
          console.log(`[OPC SF Regen] Clip ${clipIndex} regenerated successfully.`);
        }
      }
      
      processedCount++;
      await updatePillarCampaignItem(itemId, {
        regenerate_start_frames_progress: `${processedCount}/${totalCount}`
      });
      
      if (i < totalCount - 1) {
        const delayMs = 10000 + Math.floor(Math.random() * 10000);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    // Complete
    await updatePillarCampaignItem(itemId, {
      regenerate_start_frames_status: null,
      regenerate_start_frames_progress: null
    });
    console.log(`[OPC SF Regen] Item ${itemId} start frame regeneration finished successfully.`);
  } catch (err) {
    console.error(`[OPC SF Regen] Error:`, err.message);
    await updatePillarCampaignItem(itemId, {
      regenerate_start_frames_status: 'failed',
      regenerate_start_frames_progress: err.message
    });
  }
}
