import { NextResponse } from 'next/server';
import { dbRun, getMultiplierTaskById } from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { withTenantContext } from '@/lib/auth';

export const POST = withTenantContext(async (req, { params }) => {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    
    if (!id) {
      return NextResponse.json({ success: false, error: 'Item ID is required' }, { status: 400 });
    }

    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ success: false, error: 'Content type must be multipart/form-data' }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const clipIndexStr = formData.get('clipIndex');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ success: false, error: 'No image file uploaded' }, { status: 400 });
    }
    if (!clipIndexStr) {
      return NextResponse.json({ success: false, error: 'clipIndex is required' }, { status: 400 });
    }

    const clipIndex = Number(clipIndexStr);
    const task = await getMultiplierTaskById(id);
    if (!task) {
      return NextResponse.json({ success: false, error: 'Task tidak ditemukan' }, { status: 404 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const startFrameFilename = `start_frame_mult_${id}_clip_${clipIndex}.png`;
    const startFrameLocalPath = path.join(process.cwd(), 'public', 'uploads', 'start_frames', startFrameFilename);
    
    const startFrameDir = path.dirname(startFrameLocalPath);
    if (!fs.existsSync(startFrameDir)) {
      fs.mkdirSync(startFrameDir, { recursive: true });
    }
    
    fs.writeFileSync(startFrameLocalPath, buffer);
    const relativeStartFramePath = `/uploads/start_frames/${startFrameFilename}`;

    // Update t2i_images_json list in database
    let t2iImages = [];
    try {
      t2iImages = JSON.parse(task.t2i_images_json || '[]');
    } catch (_) {}

    const targetIdx = clipIndex - 1;
    while (t2iImages.length <= targetIdx) {
      t2iImages.push(null);
    }
    t2iImages[targetIdx] = relativeStartFramePath;

    // If it's the bridging clip, update bridging_config_json too
    let bridging = {};
    try {
      bridging = JSON.parse(task.bridging_config_json || '{}');
    } catch (_) {}
    const bridgeAtClip = Number(bridging.bridgeAtClip) || 2;
    if (clipIndex === bridgeAtClip) {
      bridging.productRefImagePath = relativeStartFramePath;
    }

    await dbRun(`
      UPDATE re_multiplier_tasks
      SET t2i_images_json = ?, bridging_config_json = ?
      WHERE id = ?
    `, [JSON.stringify(t2iImages), JSON.stringify(bridging), id]);

    const localUrl = `${relativeStartFramePath}?t=${Date.now()}`;
    return NextResponse.json({
      success: true,
      imageUrl: localUrl,
      message: "Start frame replaced successfully"
    });

  } catch (error) {
    console.error('[Replace Start Frame Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
