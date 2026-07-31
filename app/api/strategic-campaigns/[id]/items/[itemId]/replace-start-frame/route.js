import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function POST(req, { params }) {
  try {
    const resolvedParams = await params;
    const { id: campaignId, itemId } = resolvedParams;
    
    if (!itemId) {
      return NextResponse.json({ success: false, error: 'Item ID is required' }, { status: 400 });
    }

    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ success: false, error: 'Content type must be multipart/form-data' }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const sceneNumberStr = formData.get('sceneNumber') || formData.get('clipIndex');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ success: false, error: 'No image file uploaded' }, { status: 400 });
    }
    if (!sceneNumberStr) {
      return NextResponse.json({ success: false, error: 'sceneNumber is required' }, { status: 400 });
    }

    const sceneNumber = Number(sceneNumberStr);
    const db = getDb();
    
    const item = await db.prepare("SELECT * FROM strategic_campaign_items WHERE id = ?").get(itemId);
    if (!item) {
      return NextResponse.json({ success: false, error: "Campaign item not found" }, { status: 404 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const startFrameFilename = `sc_start_frame_${item.id}_scene_${sceneNumber}.png`;
    const startFrameLocalPath = path.join(process.cwd(), 'public', 'uploads', 'start_frames', startFrameFilename);
    
    const startFrameDir = path.dirname(startFrameLocalPath);
    if (!fs.existsSync(startFrameDir)) {
      fs.mkdirSync(startFrameDir, { recursive: true });
    }
    
    fs.writeFileSync(startFrameLocalPath, buffer);
    const relativeStartFramePath = `/uploads/start_frames/${startFrameFilename}`;

    // Update scene table
    await db.prepare(`
      UPDATE strategic_campaign_scenes
      SET start_frame_path = ?
      WHERE campaign_item_id = ? AND scene_number = ?
    `).run(relativeStartFramePath, itemId, sceneNumber);

    return NextResponse.json({
      success: true,
      start_frame_path: relativeStartFramePath,
      sceneNumber
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
