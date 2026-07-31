import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { path: pathSegments } = await params;
    if (!pathSegments || pathSegments.length === 0) {
      return new NextResponse('File path is required', { status: 400 });
    }

    // Gabungkan path segments ke format file system
    const relativePath = pathSegments.join('/');

    // 1. Resolve base directory
    const baseDir = path.join(process.cwd(), 'public', 'uploads');

    // 2. Sanitize input path to prevent directory traversal
    let cleanPath = relativePath.replace(/\\/g, '/');
    cleanPath = cleanPath.replace(/\/+/g, '/');

    // Protect against path traversal (e.g. ".." patterns)
    const resolvedPath = path.resolve(path.join(baseDir, cleanPath));

    // Security check: ensure the resolved path starts with baseDir
    if (!resolvedPath.startsWith(baseDir)) {
      return new NextResponse('Unauthorized path traversal access', { status: 403 });
    }

    // 3. Check if file exists on disk
    if (!fs.existsSync(resolvedPath)) {
      return new NextResponse('File Not Found', { status: 404 });
    }

    // 4. Determine content-type based on extension
    const ext = path.extname(resolvedPath).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.png') {
      contentType = 'image/png';
    } else if (ext === '.jpg' || ext === '.jpeg') {
      contentType = 'image/jpeg';
    } else if (ext === '.gif') {
      contentType = 'image/gif';
    } else if (ext === '.webp') {
      contentType = 'image/webp';
    } else if (ext === '.svg') {
      contentType = 'image/svg+xml';
    } else if (ext === '.mp4') {
      contentType = 'video/mp4';
    } else if (ext === '.mp3') {
      contentType = 'audio/mpeg';
    } else if (ext === '.wav') {
      contentType = 'audio/wav';
    } else if (ext === '.md') {
      contentType = 'text/markdown';
    }

    // 5. Read file and serve
    const fileBuffer = fs.readFileSync(resolvedPath);
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache 1 hour
      },
    });
  } catch (error) {
    console.error('[Dynamic Uploads API Error]:', error);
    return new NextResponse(error.message, { status: 500 });
  }
}
