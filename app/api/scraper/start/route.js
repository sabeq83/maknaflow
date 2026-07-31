import { NextResponse } from 'next/server';
import { createVideoLibraryEntry, updateVideoStatus } from '@/lib/db';
import { downloadFromUrl, moveToLibrary, generateThumbnail, getFileSize } from '@/lib/video-downloader';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

/**
 * POST /api/scraper/start
 * Download video from URL and save to local video library.
 * Used by UI and n8n Webhook 1.
 */
export async function POST(request) {
  try {
    const { source_url, tags } = await request.json();

    if (!source_url) {
      return NextResponse.json({ success: false, error: 'source_url wajib diisi' }, { status: 400 });
    }

    const videoId = uuidv4();
    const ext = '.mp4'; // yt-dlp always outputs mp4

    // Create DB entry with 'downloading' status
    await createVideoLibraryEntry({
      id: videoId,
      source_type: 'url',
      source_url: source_url,
      filename: `pending_${videoId}`,
      local_path: '',
      file_size: 0,
      mime_type: 'video/mp4',
      thumbnail_path: null,
      status: 'downloading',
      error_note: null,
      tags: tags ? JSON.stringify(tags) : null,
    });

    try {
      // Download video to temp
      const downloaded = await downloadFromUrl(source_url);

      // Move to permanent library storage
      const libraryFilename = `${videoId}${path.extname(downloaded.filename) || ext}`;
      const libraryPath = moveToLibrary(downloaded.filePath, libraryFilename);
      const fileSize = getFileSize(libraryPath);

      // Generate thumbnail via ffmpeg
      const thumbFilename = `${videoId}.jpg`;
      const thumbPath = await generateThumbnail(libraryPath, thumbFilename);

      // Update DB entry
      await updateVideoStatus(videoId, 'ready', null);
      const db = (await import('@/lib/db'));
      await db.updateVideoLibraryEntry(videoId, {
        filename: downloaded.filename || libraryFilename,
        local_path: libraryPath,
        file_size: fileSize,
        mime_type: downloaded.mimeType || 'video/mp4',
        thumbnail_path: thumbPath || null,
      });

      return NextResponse.json({
        success: true,
        data: {
          video_id: videoId,
          filename: downloaded.filename || libraryFilename,
          local_path: libraryPath,
          file_size: fileSize,
          has_thumbnail: !!thumbPath,
        },
      });
    } catch (dlError) {
      await updateVideoStatus(videoId, 'failed', dlError.message);
      return NextResponse.json({ success: false, error: dlError.message }, { status: 500 });
    }
  } catch (error) {
    console.error('Scraper start error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
