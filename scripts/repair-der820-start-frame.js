import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { generateImage, getTaskStatus, getFileUrl } from '../lib/webhook-client.js';

async function run() {
  const db = new Database('./data/maknaflow.db');
  const campaignId = 'opc_260726_der820';

  console.log(`🔍 Repairing T2I Start Frames for campaign ${campaignId}...`);

  const campaign = await db.prepare('SELECT * FROM pillar_campaigns WHERE id = ?').get(campaignId);
  if (!campaign) {
    console.error(`❌ Campaign ${campaignId} not found in database!`);
    return;
  }

  // Find NEZAFIT product extraction in database
  const product = await db.prepare("SELECT * FROM product_extractions WHERE product_name LIKE '%NEZAFIT%' OR product_name LIKE '%Daun Jati%' ORDER BY created_at DESC LIMIT 1").get();
  console.log('📦 Resolved product record:', product?.product_name || 'None');

  // Find local photo in /uploads/products/
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'products');
  let refProductFile = null;
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    refProductFile = files.find(f => f.toLowerCase().includes('nezafit') || f.toLowerCase().includes('teh_diet') || f.toLowerCase().includes('teh')) || files[0];
  }

  let productRefPath = product?.photo_url || (refProductFile ? `/uploads/products/${refProductFile}` : null);
  console.log('📷 Product Reference Path:', productRefPath);

  if (productRefPath) {
    await db.prepare('UPDATE pillar_campaigns SET product_ref_image_path = ? WHERE id = ?').run(productRefPath, campaignId);
    console.log(`✅ Updated campaign.product_ref_image_path to: ${productRefPath}`);
  }

  // Convert product image to Base64
  const absRefPath = productRefPath ? path.join(process.cwd(), 'public', productRefPath.startsWith('/') ? productRefPath.slice(1) : productRefPath) : null;
  let productBase64 = null;
  if (absRefPath && fs.existsSync(absRefPath)) {
    const buf = fs.readFileSync(absRefPath);
    let mime = 'image/jpeg';
    if (absRefPath.endsWith('.png')) mime = 'image/png';
    else if (absRefPath.endsWith('.webp')) mime = 'image/webp';
    productBase64 = `data:${mime};base64,${buf.toString('base64')}`;
    console.log(`🖼️ Encoded Product Base64 (${productBase64.length} bytes)`);
  }

  const items = await db.prepare('SELECT * FROM pillar_campaign_items WHERE campaign_id = ?').all(campaignId);

  for (const item of items) {
    try {
      console.log(`\n--- Regenerating Start Frame for Item #${item.id} ---`);
      const resultObj = JSON.parse(item.result_json || '{}');
      const t2iPrompts = resultObj.t2i_prompts || [];
      const bridgeAtClip = campaign.bridge_at_clip || 2;
      const t2iPromptObj = t2iPrompts.find(p => Number(p.clip) === bridgeAtClip) || t2iPrompts[0];

      if (!t2iPromptObj) {
        console.warn(`⚠️ No T2I prompt found for clip ${bridgeAtClip}`);
        continue;
      }

      console.log(`🎨 Submitting T2I task to G-Labs for clip ${t2iPromptObj.clip}: "${t2iPromptObj.prompt.slice(0, 60)}..."`);
      const t2iResult = await generateImage({
        prompt: t2iPromptObj.prompt,
        model: campaign.image_model || 'nano_banana_pro',
        aspect_ratio: campaign.aspect_ratio || '9:16',
        reference_images: productBase64 ? [productBase64] : undefined
      });

      if (!t2iResult?.task_id) {
        throw new Error(`Failed to submit T2I task for item ${item.id}`);
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
        throw new Error(`T2I task timed out for item ${item.id}`);
      }

      console.log(`📥 Downloading regenerated start frame from ${t2iImageUrl}...`);
      const imgRes = await fetch(t2iImageUrl);
      const imgBuf = Buffer.from(await imgRes.arrayBuffer());

      const startFrameFilename = `opc_start_frame_${item.id}_clip_${t2iPromptObj.clip}.png`;
      const startFrameLocalPath = path.join(process.cwd(), 'public', 'uploads', 'start_frames', startFrameFilename);
      const relativeStartFramePath = `/uploads/start_frames/${startFrameFilename}`;

      const startFramesDir = path.join(process.cwd(), 'public', 'uploads', 'start_frames');
      if (!fs.existsSync(startFramesDir)) fs.mkdirSync(startFramesDir, { recursive: true });

      fs.writeFileSync(startFrameLocalPath, imgBuf);
      await db.prepare('UPDATE pillar_campaign_items SET t2i_start_frame_path = ? WHERE id = ?').run(relativeStartFramePath, item.id);

      console.log(`✅ Saved Start Frame for Item #${item.id} at ${relativeStartFramePath}`);
    } catch (err) {
      console.error(`❌ Item #${item.id} failed:`, err.message);
    }
  }

  console.log(`\n🎉 Campaign ${campaignId} T2I Start Frame repair complete!`);
  db.close();
}

run().catch(console.error);
