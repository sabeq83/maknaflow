import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { uploadVideoBufferToR2 } from '@/lib/cloudflare-r2-client';
import { getActiveTenantId } from '@/lib/tenant-context';
import { withTenantContext } from '@/lib/auth';

const execFileAsync = promisify(execFile);

export const POST = withTenantContext(async (req) => {
  let tmpMutedPath = null;
  let tmpSource = null;
  try {
    const body = await req.json();
    const { 
      videoPath, 
      sourceVideoPath, 
      videoUrl, 
      recipeId = 'rcitem_' + Date.now(), 
      tenantId = getActiveTenantId() 
    } = body;

    let sourcePath = sourceVideoPath || videoPath;

    // 1. Cek apakah sumber merupakan file lokal di harddisk server Mac Mini
    const targetCandidate = sourcePath || videoUrl;
    if (targetCandidate && typeof targetCandidate === 'string' && !/^https?:\/\//i.test(targetCandidate)) {
      const cleanPath = targetCandidate.replace(/^\/+/, '');
      const localCandidates = [
        path.join(process.cwd(), 'public', cleanPath),
        path.join(process.cwd(), cleanPath),
        path.join(process.cwd(), '..', 'shared', 'public', cleanPath),
        path.join('/tmp', cleanPath)
      ];

      for (const cand of localCandidates) {
        if (fs.existsSync(cand)) {
          sourcePath = cand;
          break;
        }
      }
    }

    // 2. Jika bukan path lokal, periksa apakah URL HTTP menunjuk ke file lokal server sendiri (localhost / staging IP)
    if ((!sourcePath || !fs.existsSync(sourcePath)) && targetCandidate && /^https?:\/\//i.test(targetCandidate)) {
      try {
        const parsedUrl = new URL(targetCandidate);
        const urlPath = parsedUrl.pathname.replace(/^\/+/, '');
        const internalLocalPath = path.join(process.cwd(), 'public', urlPath);
        if (fs.existsSync(internalLocalPath)) {
          sourcePath = internalLocalPath;
        }
      } catch (_) {}
    }

    // 3. Fallback: Jika benar-benar remote URL eksternal (dan bukan dummy mixkit), download ke temp
    if ((!sourcePath || !fs.existsSync(sourcePath)) && videoUrl && /^https?:\/\//i.test(videoUrl)) {
      if (videoUrl.includes('assets.mixkit.co')) {
        return NextResponse.json({
          success: false,
          error: 'Resep ini belum memiliki file video ter-render di server Mac Mini.'
        }, { status: 400 });
      }

      const res = await fetch(videoUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
      });
      if (!res.ok) throw new Error(`Gagal mengunduh video dari URL sumber: HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      tmpSource = path.join('/tmp', `source_${recipeId}_${Date.now()}.mp4`);
      fs.writeFileSync(tmpSource, Buffer.from(arrayBuffer));
      sourcePath = tmpSource;
    }

    if (!sourcePath || !fs.existsSync(sourcePath)) {
      return NextResponse.json({ 
        success: false, 
        error: 'File video lokal tidak ditemukan di harddisk server Mac Mini. Pastikan video resep telah dirender.' 
      }, { status: 400 });
    }

    // Output file copy ter-mute (file asli tidak dimodifikasi)
    tmpMutedPath = path.join('/tmp', `recipe_${recipeId}_${Date.now()}_muted.mp4`);

    // FFmpeg Audio Stripping: -c:v copy -an (Mute audio murni instan tanpa re-encoding)
    await execFileAsync('ffmpeg', ['-y', '-i', sourcePath, '-c:v', 'copy', '-an', tmpMutedPath]);

    if (!fs.existsSync(tmpMutedPath)) {
      throw new Error('Eksekusi FFmpeg gagal menghasilkan file video ter-mute.');
    }

    const videoBuffer = fs.readFileSync(tmpMutedPath);
    const key = `recipes/video_${recipeId}_${Date.now()}_muted.mp4`;

    // Upload copy ter-mute ke Cloudflare R2 Bucket (membaca setting dari tenant_settings)
    const uploadResult = await uploadVideoBufferToR2({
      buffer: videoBuffer,
      key,
      contentType: 'video/mp4',
      tenantId
    });

    // Simpan juga salinan copy ter-mute ke direktori public/temp lokal jika memungkinkan
    let localMutedUrl = '';
    try {
      const publicTempDir = path.join(process.cwd(), 'public', 'temp');
      if (fs.existsSync(publicTempDir)) {
        const localCopyFilename = `recipe_${recipeId}_muted.mp4`;
        fs.copyFileSync(tmpMutedPath, path.join(publicTempDir, localCopyFilename));
        localMutedUrl = `/temp/${localCopyFilename}`;
      }
    } catch (_) {}

    // Cleanup temp files
    if (tmpMutedPath && fs.existsSync(tmpMutedPath)) {
      try { fs.unlinkSync(tmpMutedPath); } catch (_) {}
    }
    if (tmpSource && fs.existsSync(tmpSource)) {
      try { fs.unlinkSync(tmpSource); } catch (_) {}
    }

    return NextResponse.json({
      success: true,
      mutedReady: true,
      videoR2Url: uploadResult.publicUrl,
      localMutedUrl: localMutedUrl || uploadResult.publicUrl,
      key: uploadResult.key,
      bucket: uploadResult.bucket,
      sizeBytes: videoBuffer.length,
      message: 'Video berhasil disalin dan di-mute via FFmpeg (-an), serta diunggah ke Cloudflare R2.'
    });
  } catch (err) {
    if (tmpMutedPath && fs.existsSync(tmpMutedPath)) {
      try { fs.unlinkSync(tmpMutedPath); } catch (_) {}
    }
    if (tmpSource && fs.existsSync(tmpSource)) {
      try { fs.unlinkSync(tmpSource); } catch (_) {}
    }
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});

