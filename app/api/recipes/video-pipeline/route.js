import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { uploadVideoBufferToR2 } from '@/lib/cloudflare-r2-client';
import { getActiveTenantId } from '@/lib/tenant-context';

const execFileAsync = promisify(execFile);

export async function POST(req) {
  let tmpMutedPath = null;
  try {
    const body = await req.json();
    const { videoPath, videoUrl, recipeId = 'rcitem_' + Date.now(), tenantId = getActiveTenantId() } = body;

    let sourcePath = videoPath;

    // Jika videoPath berupa URL publik/remote, atau diberikan videoUrl
    if ((!sourcePath || !fs.existsSync(sourcePath)) && videoUrl) {
      // Download remote video to temp file
      const res = await fetch(videoUrl);
      if (!res.ok) throw new Error(`Gagal mengunduh video dari URL sumber: HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      const tmpSource = path.join('/tmp', `source_${recipeId}_${Date.now()}.mp4`);
      fs.writeFileSync(tmpSource, Buffer.from(arrayBuffer));
      sourcePath = tmpSource;
    }

    if (!sourcePath || !fs.existsSync(sourcePath)) {
      return NextResponse.json({ success: false, error: 'File video sumber tidak ditemukan di server.' }, { status: 400 });
    }

    tmpMutedPath = path.join('/tmp', `recipe_${recipeId}_${Date.now()}_muted.mp4`);

    // FFmpeg Audio Stripping: -c:v copy -an (Mute audio murni instan tanpa re-encoding)
    await execFileAsync('ffmpeg', ['-y', '-i', sourcePath, '-c:v', 'copy', '-an', tmpMutedPath]);

    if (!fs.existsSync(tmpMutedPath)) {
      throw new Error('Eksekusi FFmpeg gagal menghasilkan file video ter-mute.');
    }

    const videoBuffer = fs.readFileSync(tmpMutedPath);
    const key = `recipes/video_${recipeId}_${Date.now()}_muted.mp4`;

    // Upload to Cloudflare R2 Bucket
    const uploadResult = await uploadVideoBufferToR2({
      buffer: videoBuffer,
      key,
      contentType: 'video/mp4',
      tenantId
    });

    // Cleanup temp
    if (fs.existsSync(tmpMutedPath)) {
      try { fs.unlinkSync(tmpMutedPath); } catch (_) {}
    }

    return NextResponse.json({
      success: true,
      mutedReady: true,
      videoR2Url: uploadResult.publicUrl,
      key: uploadResult.key,
      bucket: uploadResult.bucket,
      sizeBytes: videoBuffer.length,
      message: 'Video berhasil di-mute via FFmpeg (-an) dan diunggah ke Cloudflare R2.'
    });
  } catch (err) {
    if (tmpMutedPath && fs.existsSync(tmpMutedPath)) {
      try { fs.unlinkSync(tmpMutedPath); } catch (_) {}
    }
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
