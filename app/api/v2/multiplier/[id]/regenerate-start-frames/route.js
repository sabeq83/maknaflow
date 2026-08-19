import { NextResponse } from 'next/server';
import { dbRun, getMultiplierTaskById, getSetting } from '@/lib/db';
import { generateImage, getTaskStatus, getFileUrl } from '@/lib/webhook-client';
import fs from 'fs';
import path from 'path';
import { withTenantContext } from '@/lib/auth';

export const POST = withTenantContext(async (req, { params }) => {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const task = await getMultiplierTaskById(id);
    if (!task) {
      return NextResponse.json({ success: false, error: "Task tidak ditemukan" }, { status: 404 });
    }

    let prompts = [];
    try {
      prompts = JSON.parse(task.t2i_i2v_prompts_json || '[]');
    } catch (_) {}

    if (prompts.length === 0) {
      return NextResponse.json({ success: false, error: "Tidak ada prompt T2I ditemukan pada task ini." }, { status: 400 });
    }

    // Start background process
    runTaskRegenerateStartFramesBackground(id, task, prompts);

    return NextResponse.json({
      success: true,
      message: "Regenerasi semua start frame telah dimulai di latar belakang."
    });

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

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

async function runTaskRegenerateStartFramesBackground(taskId, task, prompts) {
  try {
    const imageModel = await getSetting('webhook_image_model') || 'nano_banana_pro';
    
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

    const totalCount = prompts.length;
    
    for (let i = 0; i < totalCount; i++) {
      const clip = prompts[i];
      const clipIndex = clip.clip || (i + 1);
      const promptText = clip.t2i_prompt || '';

      if (!promptText) continue;

      console.log(`[Multiplier SF Batch] Processing clip ${clipIndex} for task ${taskId}...`);

      const t2iResult = await generateImage({
        prompt: promptText,
        model: imageModel,
        aspect_ratio: '9:16',
        reference_images: productBase64 ? [productBase64] : undefined
      });

      if (!t2iResult?.task_id) {
        console.error(`[Multiplier SF Batch] Clip ${clipIndex} failed to submit`);
        continue;
      }

      const glabsTaskId = t2iResult.task_id;
      let t2iCompleted = false;
      let t2iImageUrl = null;
      const maxAttempts = 60; // 120s max
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const statusResult = await getTaskStatus(glabsTaskId);
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
        const imgResponse = await fetch(t2iImageUrl);
        if (imgResponse.ok) {
          const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
          const startFrameFilename = `start_frame_mult_${taskId}_clip${clipIndex}_${Date.now()}.png`;
          const destDir = path.join(process.cwd(), 'public', 'uploads', 'start_frames');
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }
          fs.writeFileSync(path.join(destDir, startFrameFilename), imgBuffer);

          const publicUrl = `/uploads/start_frames/${startFrameFilename}`;

          // Fetch current task state to avoid race conditions
          const currentTask = await getMultiplierTaskById(taskId);
          let currentImages = [];
          try {
            currentImages = JSON.parse(currentTask.t2i_images_json || '[]');
          } catch (_) {}

          currentImages[Number(clipIndex) - 1] = publicUrl;

          await dbRun(`
            UPDATE re_multiplier_tasks
            SET t2i_images_json = ?
            WHERE id = ?
          `, [JSON.stringify(currentImages), taskId]);

          console.log(`[Multiplier SF Batch] Clip ${clipIndex} completed and updated successfully.`);
        }
      }

      // Safety Delay (5-10 seconds) before sending next prompt
      if (i < totalCount - 1) {
        const delayMs = 5000 + Math.floor(Math.random() * 5000);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

  } catch (err) {
    console.error(`[Multiplier SF Batch] Error:`, err.message);
  }
}
