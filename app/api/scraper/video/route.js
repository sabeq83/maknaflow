import { NextResponse } from 'next/server';
import { getVideoById } from '@/lib/db';
import path from 'path';
import fs from 'fs';

/**
 * GET /api/scraper/video?id=xxx
 * Stream/serve the local video file for playing in the browser.
 * Supports HTTP Range requests for video seeking.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
    }

    const video = await getVideoById(id);
    if (!video || !video.local_path) {
      return NextResponse.json({ success: false, error: 'Video not found' }, { status: 404 });
    }

    const videoPath = video.local_path;

    if (!fs.existsSync(videoPath)) {
      return NextResponse.json({ success: false, error: 'Physical video file not found' }, { status: 404 });
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = request.headers.get('range');

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize) {
        return new NextResponse(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${fileSize}` },
        });
      }

      const chunksize = (end - start) + 1;
      const fileStream = fs.createReadStream(videoPath, { start, end });

      // Create a ReadableStream from the Node stream
      const stream = new ReadableStream({
        start(controller) {
          fileStream.on('data', (chunk) => controller.enqueue(chunk));
          fileStream.on('end', () => controller.close());
          fileStream.on('error', (err) => controller.error(err));
        },
        cancel() {
          fileStream.destroy();
        }
      });

      return new NextResponse(stream, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': video.mime_type || 'video/mp4',
        },
      });
    } else {
      const fileStream = fs.createReadStream(videoPath);
      const stream = new ReadableStream({
        start(controller) {
          fileStream.on('data', (chunk) => controller.enqueue(chunk));
          fileStream.on('end', () => controller.close());
          fileStream.on('error', (err) => controller.error(err));
        },
        cancel() {
          fileStream.destroy();
        }
      });

      return new NextResponse(stream, {
        headers: {
          'Content-Length': fileSize,
          'Content-Type': video.mime_type || 'video/mp4',
        },
      });
    }
  } catch (error) {
    console.error('Video streaming error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
