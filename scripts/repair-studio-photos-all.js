import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { generateImage, getTaskStatus, getFileUrl } from '../lib/webhook-client.js';

async function run() {
  const db = new Database('./data/maknaflow.db');

  console.log('🧹 [Studio Photo Repair] Cleaning up product_extractions & campaign product_ref_image_path...');

  const prods = await db.prepare('SELECT * FROM product_extractions').all();
  let cleanedProdsCount = 0;

  for (const p of prods) {
    let cleanPhoto = p.clean_photo_url || p.cleaned_photo_url || p.raw_photo_url;
    if (cleanPhoto) {
      await db.prepare('UPDATE product_extractions SET photo_url = ?, active_photo = ? WHERE id = ?')
        .run(cleanPhoto, 'clean_photo_url', p.id);
      cleanedProdsCount++;
    }
  }

  console.log(`✅ [Studio Photo Repair] Updated ${cleanedProdsCount} product records to use Studio Clean Photo!`);

  // Target OPC Campaigns to Repair: Omura (opc_260726_5vv88b) & Nezafit (opc_260726_mnl6o0)
  const targetCampaigns = ['opc_260726_5vv88b', 'opc_260726_mnl6o0'];

  for (const campaignId of targetCampaigns) {
    console.log(`\n======================================================`);
    console.log(`🔍 Repairing T2I Start Frames for Campaign: ${campaignId}`);
    console.log(`======================================================`);

    const campaign = await db.prepare('SELECT * FROM pillar_campaigns WHERE id = ?').get(campaignId);
    if (!campaign) {
      console.warn(`⚠️ Campaign ${campaignId} not found in database.`);
      continue;
    }

    // Resolve studio photo
    let studioPath = null;
    if (campaignId === 'opc_260726_5vv88b') {
      const p = await db.prepare("SELECT * FROM product_extractions WHERE product_name LIKE '%Omura%' ORDER BY id DESC LIMIT 1").get();
      studioPath = p?.clean_photo_url || p?.cleaned_photo_url || p?.raw_photo_url || '/uploads/products/clean/clean_pe_sync_1781148697786_850.jpg';
    } else if (campaignId === 'opc_260726_mnl6o0') {
      const p = await db.prepare("SELECT * FROM product_extractions WHERE id = ? OR product_name LIKE '%NEZAFIT%' ORDER BY id DESC LIMIT 1").get(campaign.target_product_id);
      studioPath = p?.clean_photo_url || p?.cleaned_photo_url || p?.raw_photo_url || '/uploads/products/studio_prod_pe_1784449324421_126_1784450424659.png';
    }

    if (studioPath) {
      await db.prepare('UPDATE pillar_campaigns SET product_ref_image_path = ? WHERE id = ?').run(studioPath, campaignId);
      console.log(`✅ Updated campaign.product_ref_image_path to: ${studioPath}`);
    }

    // Encode studio photo to Base64
    const absPath = studioPath ? path.join(process.cwd(), 'public', studioPath.startsWith('/') ? studioPath.slice(1) : studioPath) : null;
    let productBase64 = null;
    if (absPath && fs.existsSync(absPath)) {
      const buf = fs.readFileSync(absPath);
      let mime = 'image/jpeg';
      if (absPath.endsWith('.png')) mime = 'image/png';
      else if (absPath.endsWith('.webp')) mime = 'image/webp';
      productBase64 = `data:${mime};base64,${buf.toString('base64')}`;
      console.log(`🖼️ Encoded Studio Base64 (${productBase64.length} bytes) for ${campaignId}`);
    }

    const items = await db.prepare('SELECT * FROM pillar_campaign_items WHERE campaign_id = ?').all(campaignId);
    const bridgeAtClip = campaign.bridge_at_clip || 4;
    const bridgeDuration = campaign.bridge_duration_clips || 2;
    const bridgeClips = [];
    for (let i = 0; i < bridgeDuration; i++) {
      bridgeClips.push(bridgeAtClip + i);
    }

    for (const item of items) {
      const resultObj = JSON.parse(item.result_json || '{}');
      const t2iPrompts = resultObj.t2i_prompts || [];

      for (const clipNum of bridgeClips) {
        const t2iPromptObj = t2iPrompts.find(p => Number(p.clip) === clipNum);
        if (!t2iPromptObj) continue;

        console.log(`\n🎨 Submitting T2I task to G-Labs for Item #${item.id} Clip ${clipNum}: "${t2iPromptObj.prompt.slice(0, 60)}..."`);
        try {
          const t2iResult = await generateImage({
            prompt: t2iPromptObj.prompt,
            model: campaign.image_model || 'nano_banana_pro',
            aspect_ratio: campaign.aspect_ratio || '9:16',
            reference_images: productBase64 ? [productBase64] : undefined
          });

          if (!t2iResult?.task_id) {
            throw new Error(`Failed to submit T2I task for item ${item.id} clip ${clipNum}`);
          }

          console.log(`⏳ Polling task ${t2iResult.task_id}...`);
          let t2iImageUrl = null;
          for (let attempt = 0; attempt < 30; attempt++) {
            await new Promise(r => setTimeout(r, 2000));
            const statusRes = await getTaskStatus(t2iResult.task_id);
            const status = (statusRes?.status || '').toLowerCase();
            if (status === 'completed') {
              const files = statusRes.results || statusRes.files || [];
              let imgFile = files.find(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')) || files[0];
              if (imgFile && (imgFile.startsWith('http://') || imgFile.startsWith('https://'))) {
                imgFile = imgFile.split('/').pop();
              }
              if (imgFile) {
                t2iImageUrl = getFileUrl(imgFile);
                break;
              }
            } else if (status === 'failed') {
              throw new Error(`T2I task failed: ${t2iResult.task_id}`);
            }
          }

          if (!t2iImageUrl) {
            throw new Error(`T2I task timed out for item ${item.id} clip ${clipNum}`);
          }

          console.log(`📥 Downloading regenerated start frame from ${t2iImageUrl}...`);
          const imgRes = await fetch(t2iImageUrl);
          const imgBuf = Buffer.from(await imgRes.arrayBuffer());

          const startFrameFilename = `opc_start_frame_${item.id}_clip_${clipNum}.png`;
          const startFrameLocalPath = path.join(process.cwd(), 'public', 'uploads', 'start_frames', startFrameFilename);
          const relativeStartFramePath = `/uploads/start_frames/${startFrameFilename}`;

          const startFramesDir = path.join(process.cwd(), 'public', 'uploads', 'start_frames');
          if (!fs.existsSync(startFramesDir)) fs.mkdirSync(startFramesDir, { recursive: true });

          fs.writeFileSync(startFrameLocalPath, imgBuf);
          await db.prepare('UPDATE pillar_campaign_items SET t2i_start_frame_path = ? WHERE id = ?').run(relativeStartFramePath, item.id);

          console.log(`✅ Saved Studio Start Frame for Item #${item.id} Clip ${clipNum} at ${relativeStartFramePath}`);
        } catch (err) {
          console.error(`❌ Item #${item.id} Clip ${clipNum} failed:`, err.message);
        }
      }
    }
  }

  console.log('\n🎉 [Studio Photo Repair Complete] All Studio Photos and Start Frames repaired successfully!');
  db.close();
}

run().catch(console.error);
