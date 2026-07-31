import { NextResponse } from 'next/server';
import { getDb, getSetting } from '@/lib/db';
import { generateImage, getTaskStatus, getFileUrl } from '@/lib/webhook-client';
import fs from 'fs';
import path from 'path';

export async function POST(req, { params }) {
  try {
    const resolvedParams = await params;
    const { id: campaignId, itemId } = resolvedParams;
    const body = await req.json().catch(() => ({}));
    const sceneNumber = body.sceneNumber || body.scene_number || body.clipIndex || 1;

    const db = getDb();
    const item = await db.prepare("SELECT * FROM strategic_campaign_items WHERE id = ?").get(itemId);
    if (!item) {
      return NextResponse.json({ success: false, error: "Item tidak ditemukan" }, { status: 404 });
    }

    const scene = await db.prepare("SELECT * FROM strategic_campaign_scenes WHERE campaign_item_id = ? AND scene_number = ?").get(itemId, Number(sceneNumber));
    if (!scene) {
      return NextResponse.json({ success: false, error: `Adegan Klip #${sceneNumber} tidak ditemukan` }, { status: 404 });
    }

    if (!scene.t2i_prompt || !scene.t2i_prompt.trim()) {
      return NextResponse.json({ success: false, error: `Prompt T2I untuk Klip #${sceneNumber} masih kosong` }, { status: 400 });
    }

    const campaign = await db.prepare("SELECT * FROM strategic_campaigns WHERE id = ?").get(campaignId);
    const workflow = JSON.parse(campaign?.workflow_config_json || '{}');

    const fileToBase64 = (filePath) => {
      if (!filePath) return null;
      const relativePart = filePath.startsWith('/') ? filePath.slice(1) : filePath;
      const absolutePath = path.join(process.cwd(), 'public', relativePart);
      if (!fs.existsSync(absolutePath)) return null;
      const buffer = fs.readFileSync(absolutePath);
      let mimeType = 'image/png';
      if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        mimeType = 'image/jpeg';
      } else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        mimeType = 'image/png';
      }
      return `data:${mimeType};base64,${buffer.toString('base64')}`;
    };

    let productData = null;
    if (workflow.target_product_id) {
      productData = await db.prepare("SELECT * FROM product_extractions WHERE id = ?").get(workflow.target_product_id);
    }
    if (!productData && workflow.product_name) {
      const firstWord = workflow.product_name.split(' ')[0] || workflow.product_name;
      productData = await db.prepare("SELECT * FROM product_extractions WHERE product_name LIKE ? ORDER BY id DESC LIMIT 1").get(`%${firstWord}%`);
    }

    const { resolveProductBase64 } = await import('@/lib/scheduler-processors');
    const productBase64 = resolveProductBase64(workflow, productData);

    const scenes = await db.prepare('SELECT id FROM strategic_campaign_scenes WHERE campaign_item_id = ?').all(itemId);
    const bridgeAt = Math.min(Math.max(2, workflow.bridge_at_clip || 2), scenes.length || 4);
    const bridgeDur = workflow.bridge_duration_clips !== undefined ? parseInt(workflow.bridge_duration_clips, 10) : 1;
    const bridgeEnd = bridgeDur === 0 ? (scenes.length || 4) : Math.min((scenes.length || 4), bridgeAt + bridgeDur - 1);
    const isBridge = workflow.is_bridging_active && (Number(sceneNumber) >= bridgeAt && Number(sceneNumber) <= bridgeEnd);

    const imageModel = await getSetting('webhook_image_model') || 'nano_banana_pro';
    console.log(`[SC Single T2I Regen] Submitting T2I task for Item #${itemId} Scene #${sceneNumber}...`);

    // [Fix v2.2.87] Lookup brand profile via brand_profile_id (dengan fallback ke account_name)
    const brandProfile = campaign
      ? (campaign.brand_profile_id
          ? await db.prepare('SELECT * FROM brand_profiles WHERE id = ?').get(campaign.brand_profile_id)
          : await db.prepare('SELECT * FROM brand_profiles WHERE LOWER(brand_name) = LOWER(?)').get(campaign.account_name || ''))
      : null;

    const t2iRes = await generateImage({
      prompt: scene.t2i_prompt,
      model: imageModel,
      aspect_ratio: '9:16',
      reference_images: (isBridge && productBase64) ? [productBase64] : undefined,
      webhookOverride: brandProfile
    });

    if (!t2iRes?.task_id) {
      return NextResponse.json({ success: false, error: "Gagal mengirim tugas T2I ke Webhook G-Labs" }, { status: 500 });
    }

    const startFrameDir = path.join(process.cwd(), 'public', 'uploads', 'start_frames');
    if (!fs.existsSync(startFrameDir)) {
      fs.mkdirSync(startFrameDir, { recursive: true });
    }

    let relPath = null;
    for (let poll = 0; poll < 40; poll++) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      const statusRes = await getTaskStatus(t2iRes.task_id);
      if (statusRes?.status === 'completed') {
        const files = statusRes.results || statusRes.files || [];
        let imgFile = files.find(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')) || files[0];
        if (imgFile && (imgFile.startsWith('http://') || imgFile.startsWith('https://'))) {
          imgFile = imgFile.split('/').pop();
        }
        if (imgFile) {
          const downloadUrl = getFileUrl(imgFile);
          const imgBuf = await fetch(downloadUrl).then(r => r.arrayBuffer());
          const filename = `sc_start_frame_${itemId}_scene_${sceneNumber}.png`;
          const absPath = path.join(startFrameDir, filename);
          fs.writeFileSync(absPath, Buffer.from(imgBuf));
          relPath = `/uploads/start_frames/${filename}?t=${Date.now()}`;
          await db.prepare('UPDATE strategic_campaign_scenes SET start_frame_path = ? WHERE id = ?').run(`/uploads/start_frames/${filename}`, scene.id);

          // Delete old video clip file on disk if exists
          if (scene.local_clip_path) {
            try {
              const oldClipAbs = path.join(process.cwd(), 'public', scene.local_clip_path.replace(/^\//, ''));
              if (fs.existsSync(oldClipAbs)) fs.unlinkSync(oldClipAbs);
            } catch (_) {}
          }

          // Reset scene task and local clip state
          await db.prepare('UPDATE strategic_campaign_scenes SET task_id = NULL, local_clip_path = NULL WHERE id = ?').run(scene.id);

          // Reset item visual & ffmpeg status so scheduler automatically regenerates fresh I2V video
          await db.prepare("UPDATE strategic_campaign_items SET visual_status = 'pending', visual_tasks_json = NULL, visual_clip_paths = NULL, ffmpeg_status = 'pending', workflow_status = 'processing' WHERE id = ?").run(itemId);
        }
        break;
      }
    }

    if (!relPath) {
      return NextResponse.json({ success: false, error: "Timeout / Gagal merender gambar T2I dari G-Labs" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Gambar Start Frame Klip #${sceneNumber} berhasil diregenerasi!`,
      start_frame_path: relPath,
      scene_number: Number(sceneNumber)
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
