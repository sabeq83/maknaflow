import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

const THUMBNAIL_DIR = path.join(process.cwd(), 'data', 'thumbnails');

/**
 * GET /api/scraper/thumbnail?id=xxx
 * Serve thumbnail image for a video in the library.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
    }

    const thumbPath = path.join(THUMBNAIL_DIR, `${id}.jpg`);

    if (!fs.existsSync(thumbPath)) {
      // Return a 1x1 transparent pixel as fallback
      const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      return new NextResponse(pixel, {
        headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'public, max-age=3600' },
      });
    }

    const fileBuffer = fs.readFileSync(thumbPath);
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
