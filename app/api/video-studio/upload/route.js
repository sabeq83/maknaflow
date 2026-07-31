import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

const TEMP_DIR = path.join(process.cwd(), 'public', 'temp');

// Ensure public/temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !file.size) {
      return NextResponse.json({ success: false, error: 'File wajib diunggah' }, { status: 400 });
    }

    const filename = file.name || 'unnamed_file';
    const ext = path.extname(filename).toLowerCase();
    const mimeType = file.type || '';

    const isVideo = mimeType.startsWith('video/') || ['.mp4', '.mov', '.webm', '.mkv', '.avi'].includes(ext);
    const isAudio = mimeType.startsWith('audio/') || ['.mp3', '.wav', '.ogg', '.m4a', '.aac'].includes(ext);

    if (!isVideo && !isAudio) {
      return NextResponse.json({
        success: false,
        error: 'Format file tidak didukung. Harap unggah file video (.mp4/.mov) atau audio (.mp3/.wav)'
      }, { status: 400 });
    }

    // Size validation
    const maxVideoSize = 50 * 1024 * 1024; // 50MB
    const maxAudioSize = 10 * 1024 * 1024; // 10MB

    if (isVideo && file.size > maxVideoSize) {
      return NextResponse.json({
        success: false,
        error: `Ukuran video melebihi batas maksimal (50MB). Ukuran file Anda: ${(file.size / (1024 * 1024)).toFixed(2)}MB`
      }, { status: 400 });
    }

    if (isAudio && file.size > maxAudioSize) {
      return NextResponse.json({
        success: false,
        error: `Ukuran audio melebihi batas maksimal (10MB). Ukuran file Anda: ${(file.size / (1024 * 1024)).toFixed(2)}MB`
      }, { status: 400 });
    }

    // Generate safe unique filename
    const safeBaseName = path.basename(filename, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
    const uniqueFilename = `tmp_${uuidv4().substring(0, 8)}_${safeBaseName}${ext}`;
    const destinationPath = path.join(TEMP_DIR, uniqueFilename);

    // Save file
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(destinationPath, buffer);

    // Relative web accessible path (e.g. /temp/filename.ext) and relative filesystem path
    const relativeFsPath = path.join('public', 'temp', uniqueFilename);
    const webUrlPath = `/temp/${uniqueFilename}`;

    return NextResponse.json({
      success: true,
      data: {
        filename: filename,
        fs_path: relativeFsPath,
        web_path: webUrlPath,
        size_bytes: file.size,
        mime_type: mimeType,
        is_video: isVideo
      }
    });

  } catch (error) {
    console.error('[Video Studio Upload API] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
