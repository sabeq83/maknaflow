import { NextResponse } from 'next/server';
import { createVideoLibraryEntry } from '@/lib/db';
import { ensureLibraryDir, generateThumbnail, getFileSize } from '@/lib/video-downloader';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

const LIBRARY_DIR = path.join(process.cwd(), 'data', 'video_library');

/**
 * POST /api/scraper/upload
 * Upload a video file directly to the local library (manual fallback).
 */
export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const tagsRaw = formData.get('tags');

    if (!file || !file.size) {
      return NextResponse.json({ success: false, error: 'File video wajib diupload' }, { status: 400 });
    }

    ensureLibraryDir();

    const videoId = uuidv4();
    const ext = path.extname(file.name) || '.mp4';
    const libraryFilename = `${videoId}${ext}`;
    const libraryPath = path.join(LIBRARY_DIR, libraryFilename);

    // Write file to library
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(libraryPath, buffer);

    const fileSize = getFileSize(libraryPath);

    // Get mime type
    const mimeMap = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska' };
    const mimeType = mimeMap[ext.toLowerCase()] || 'video/mp4';

    // Generate thumbnail
    const thumbFilename = `${videoId}.jpg`;
    const thumbPath = await generateThumbnail(libraryPath, thumbFilename);

    // Parse tags
    let tags = null;
    if (tagsRaw) {
      try { tags = JSON.stringify(JSON.parse(tagsRaw)); } catch { tags = JSON.stringify([tagsRaw]); }
    }

    // Save to DB
    await createVideoLibraryEntry({
      id: videoId,
      source_type: 'upload',
      source_url: null,
      filename: file.name,
      local_path: libraryPath,
      file_size: fileSize,
      mime_type: mimeType,
      thumbnail_path: thumbPath || null,
      status: 'ready',
      error_note: null,
      tags,
    });

    return NextResponse.json({
      success: true,
      data: {
        video_id: videoId,
        filename: file.name,
        local_path: libraryPath,
        file_size: fileSize,
        has_thumbnail: !!thumbPath,
      },
    });
  } catch (error) {
    console.error('Scraper upload error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
