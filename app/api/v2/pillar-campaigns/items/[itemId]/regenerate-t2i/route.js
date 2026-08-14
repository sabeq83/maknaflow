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
    const { clipIndex, t2i_prompt } = await req.json();

    if (!itemId || !clipIndex || !t2i_prompt) {
      return NextResponse.json({ success: false, error: "itemId, clipIndex, and t2i_prompt are required" }, { status: 400 });
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
      // Strip leading slash from web-relative paths (e.g. /uploads/...) so they resolve under public/
      const relativePart = filePath.startsWith('/') ? filePath.slice(1) : filePath;
      const absolutePath = path.join(process.cwd(), 'public', relativePart);
      if (!fs.existsSync(absolutePath)) {
        console.warn(`[OPC Single SF Regen] File not found: ${absolutePath}`);
        return null;
      }
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

    const rowPayload = item.row_creative_payload ? JSON.parse(item.row_creative_payload) : {};

    // Call T2I webhook helper
    const payload = {
      imageModel: imageModel,
      aspectRatio: campaign.aspect_ratio || '9:16',
      faceVisibility: campaign.face_visibility || 'Faceless',
      subjectDemographic: campaign.target_demographic || null,
      subjectDemographicCustom: campaign.target_demographic_custom || null,
      visualOverrides: campaign.visual_overrides_json ? JSON.parse(campaign.visual_overrides_json) : null
    };

    const brandProfile = campaign.brand_profile_id
      ? await db.prepare('SELECT * FROM brand_profiles WHERE id = ?').get(campaign.brand_profile_id)
      : null;

    // Resolve characters for this clip
    const parsed = JSON.parse(item.result_json || '{}');
    const storyboardObj = (parsed.storyboard || []).find(s => Number(s.scene) === Number(clipIndex) || Number(s.clip) === Number(clipIndex));
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
    let contextReferences = [];
    if (isCartoon) {
      let universeSnapshot = null;
      try {
        universeSnapshot = campaign.universe_snapshot_json ? JSON.parse(campaign.universe_snapshot_json) : null;
      } catch (_) {}
      const resolvedRefs = resolveClipReferenceImages({
        contentWorld: 'cartoon_universe',
        universeProfile: campaign.universe_profile || rowPayload.universe_profile || 'pawville',
        universeSnapshot,
        clip: clipIndex,
        productReference: null,
        productRevealBeat: rowPayload.product_reveal_beat || campaign.product_reveal_beat || 'none',
        clipCharacters: normalizedClipChars
      });
      contextReferences = resolvedRefs.allReferences || [];
    }

    const { buildOpcStartFrameRequest } = await import('../../../../../../../lib/opc-start-frame-request');
    const { recordStartFrameRequestAudit } = await import('../../../../../../../lib/opc-start-frame-audit');
    const builtRequest = await buildOpcStartFrameRequest({ campaign, item, clipIndex, prompt: t2i_prompt, origin: 'manual_regen', contextReferences });
    const t2iResult = await generateImage(builtRequest.providerRequest);

    if (!t2iResult?.task_id) {
      return NextResponse.json({ success: false, error: "Failed to submit T2I task to G-Labs" }, { status: 500 });
    }

    const t2iTaskId = t2iResult.task_id;
    await recordStartFrameRequestAudit(builtRequest.audit, t2iTaskId);
    console.log(`[OPC Single SF Regen] T2I task ${t2iTaskId} submitted. Polling...`);

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

    console.log(`[OPC Single SF Regen] Downloading image from ${t2iImageUrl}...`);
    const imgResponse = await fetch(t2iImageUrl);
    if (!imgResponse.ok) {
      return NextResponse.json({ success: false, error: "Failed to download generated image" }, { status: 500 });
    }
    const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());

    const startFrameFilename = `opc_start_frame_${item.id}_clip_${clipIndex}.png`;
    const startFrameLocalPath = path.join(process.cwd(), 'public', 'uploads', 'start_frames', startFrameFilename);
    const startFrameDir = path.dirname(startFrameLocalPath);
    if (!fs.existsSync(startFrameDir)) {
      fs.mkdirSync(startFrameDir, { recursive: true });
    }
    fs.writeFileSync(startFrameLocalPath, imgBuffer);

    // Update database atomically
    await db.transaction(async () => {
      const currentItem = await db.prepare("SELECT t2i_images_json FROM pillar_campaign_items WHERE id = ?").get(itemId);
      if (!currentItem) throw new Error("Campaign item not found in transaction");

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
        new_video_plan_json: JSON.stringify(newVideoPlan),
        result_json: updatedResultJson,
        t2i_images_json: JSON.stringify(localT2iImages),
        t2i_start_frame_path: `/uploads/start_frames/${startFrameFilename}`
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
