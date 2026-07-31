import { NextResponse } from 'next/server';
import { getAllVideoLibrary, getVideoById, deleteVideoFromLibrary, getVideoLibraryStorageUsage } from '@/lib/db';
import { deleteLibraryFile } from '@/lib/video-downloader';
import fs from 'fs';

/**
 * GET /api/scraper/library
 * List all videos in library, or get single video by id.
 * Query params: ?id=xxx (single), ?search=keyword (filter)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const search = searchParams.get('search');
    const type = searchParams.get('type');

    if (id) {
      const video = await getVideoById(id);
      if (!video) return NextResponse.json({ success: false, error: 'Video not found' }, { status: 404 });
      return NextResponse.json({ success: true, data: video });
    }

    let videos = await getAllVideoLibrary(search || null);
    
    // Filter by type if requested
    if (type === 'video') {
      videos = videos.filter(v => v.mime_type && v.mime_type.startsWith('video/'));
    } else if (type === 'audio') {
      videos = videos.filter(v => v.mime_type && v.mime_type.startsWith('audio/'));
    }

    const storage = await getVideoLibraryStorageUsage();
    const STORAGE_LIMIT = 15 * 1024 * 1024 * 1024; // 15GB

    return NextResponse.json({
      success: true,
      data: videos,
      storage: {
        used_bytes: storage.total_bytes,
        used_gb: (storage.total_bytes / (1024 * 1024 * 1024)).toFixed(2),
        limit_gb: 15,
        total_files: storage.total_files,
        warning: storage.total_bytes > STORAGE_LIMIT,
      },
    });
  } catch (error) {
    console.error('Library list error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/scraper/library
 * Delete a video from the library (DB entry + physical file + thumbnail).
 * Body: { id: string }
 */
export async function DELETE(request) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ success: false, error: 'id wajib diisi' }, { status: 400 });

    const video = await getVideoById(id);
    if (!video) return NextResponse.json({ success: false, error: 'Video not found' }, { status: 404 });

    // Delete physical files
    deleteLibraryFile(video.local_path);
    if (video.thumbnail_path) deleteLibraryFile(video.thumbnail_path);

    // Delete DB entry
    await deleteVideoFromLibrary(id);

    return NextResponse.json({ success: true, message: 'Video deleted from library' });
  } catch (error) {
    console.error('Library delete error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
