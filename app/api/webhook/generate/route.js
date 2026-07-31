import { NextResponse } from 'next/server';
import { generateImage, generateVideo, getTaskStatus, webhookHealth } from '@/lib/webhook-client';
import { insertGlabsTask } from '@/lib/db';

/**
 * POST — Submit image or video generation to local webhook API
 * GET  — Check webhook server health
 */
export async function POST(request) {
  try {
    const { type, prompt, model, aspect_ratio, mode, resolution, reference_images } = await request.json();

    if (!prompt) {
      return NextResponse.json({ success: false, error: 'prompt wajib diisi' }, { status: 400 });
    }

    let result;
    if (type === 'video') {
      result = await generateVideo({ prompt, model, aspect_ratio, mode, resolution, reference_images });
    } else {
      result = await generateImage({ prompt, model, aspect_ratio });
    }

    // Log tasks to database
    if (result && result.task_id) {
      try {
        await insertGlabsTask({
          task_id: result.task_id,
          prompt,
          status: 'processing'
        });
      } catch (dbErr) {
        console.error('Failed to log G-Labs task to DB:', dbErr.message);
      }
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Webhook generate error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const host = searchParams.get('host');
    const port = searchParams.get('port');
    const health = await webhookHealth(host, port);
    return NextResponse.json({ success: true, data: health });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Webhook server offline', detail: error.message }, { status: 503 });
  }
}
