import { NextResponse } from 'next/server';
import { getDb, dbRun, getMultiplierTaskById, getSetting } from '@/lib/db';
import { generateImage, getTaskStatus, getFileUrl } from '@/lib/webhook-client';
import fs from 'fs';
import path from 'path';
import { withTenantContext } from '@/lib/auth';

export const POST = withTenantContext(async (req, { params }) => {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const { clipIndex, t2i_prompt } = await req.json();

    if (!id || !clipIndex || !t2i_prompt) {
      return NextResponse.json({ success: false, error: "id, clipIndex, and t2i_prompt are required" }, { status: 400 });
    }

    const task = await getMultiplierTaskById(id);
    if (!task) {
      return NextResponse.json({ success: false, error: "Task tidak ditemukan" }, { status: 404 });
    }

    const imageModel = await getSetting('webhook_image_model') || 'nano_banana_pro';
    
    // Resolve product image base64 if present
    let productBase64 = null;
    let bridging = {};
    try {
      bridging = JSON.parse(task.bridging_config_json || '{}');
    } catch (_) {}

    const imagePath = bridging.product_ref_image_path || bridging.productRefImagePath;
    if (imagePath) {
      const fullPath = path.join(process.cwd(), 'public', imagePath);
      if (fs.existsSync(fullPath)) {
        productBase64 = fs.readFileSync(fullPath).toString('base64');
      }
    }

    console.log(`[Multiplier UI Regenerate] Submitting T2I task for clip ${clipIndex}...`);

    const t2iResult = await generateImage({
      prompt: t2i_prompt,
      model: imageModel,
      aspect_ratio: '9:16',
      reference_images: productBase64 ? [productBase64] : undefined
    });

    if (!t2iResult || !t2iResult.task_id) {
      return NextResponse.json({ success: false, error: "Gagal mengirim tugas T2I ke G-Labs" }, { status: 500 });
    }

    const taskId = t2iResult.task_id;
    console.log(`[Multiplier UI Regenerate] Job dispatched. Task ID: ${taskId}. Waiting for completion...`);

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
      return NextResponse.json({ success: false, error: `Generasi gambar gagal atau timeout: ${statusRes?.error || 'timeout'}` }, { status: 500 });
    }

    const results = statusRes.results || statusRes.files || [];
    let completedImageName = results.find(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.webp') || f.endsWith('.jpeg')) || results[0];
    if (!completedImageName) {
      return NextResponse.json({ success: false, error: "G-Labs tidak mengembalikan file gambar." }, { status: 500 });
    }

    if (completedImageName.startsWith('http://') || completedImageName.startsWith('https://')) {
      completedImageName = completedImageName.split('/').pop();
    }
    const downloadUrl = getFileUrl(completedImageName);
    const ext = completedImageName.split('.').pop() || 'png';
    const startFrameFilename = `start_frame_mult_${id}_clip${clipIndex}_${Date.now()}.${ext}`;

    const destDir = path.join(process.cwd(), 'public', 'uploads', 'start_frames');
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const destPath = path.join(destDir, startFrameFilename);
    const dlRes = await fetch(downloadUrl);
    if (!dlRes.ok) {
      throw new Error(`Failed to download image: ${dlRes.statusText}`);
    }
    const arrayBuffer = await dlRes.arrayBuffer();
    fs.writeFileSync(destPath, Buffer.from(arrayBuffer));

    const publicUrl = `/uploads/start_frames/${startFrameFilename}`;

    // Update t2i_images_json list in task
    let t2iImages = [];
    try {
      t2iImages = JSON.parse(task.t2i_images_json || '[]');
    } catch (_) {}
    t2iImages[Number(clipIndex) - 1] = publicUrl;

    // Update prompt text inside t2i_i2v_prompts_json if present
    let prompts = [];
    try {
      prompts = JSON.parse(task.t2i_i2v_prompts_json || '[]');
    } catch (_) {}
    if (prompts[Number(clipIndex) - 1]) {
      prompts[Number(clipIndex) - 1].t2i_prompt = t2i_prompt;
    }

    await dbRun(`
      UPDATE re_multiplier_tasks
      SET t2i_images_json = ?, t2i_i2v_prompts_json = ?
      WHERE id = ?
    `, [JSON.stringify(t2iImages), JSON.stringify(prompts), id]);

    return NextResponse.json({
      success: true,
      imageUrl: publicUrl,
      message: "T2I start frame image regenerated and updated successfully."
    });

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
