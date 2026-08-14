import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import { getPublishingAccountById } from '@/lib/publishing-repository';
import { probePublishingMedia, validateFacebookReelProbe } from '@/lib/publishing-media-probe';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (request) => {
  try {
    const tenantId = getActiveTenantId();
    const body = await request.json();
    const {
      mediaUrl,
      mediaType = 'text_only',
      caption,
      accountIds = []
    } = body;

    const warnings = [];
    const errors = [];

    // 1. Validasi Media URL jika bukan text_only
    if (mediaType !== 'text_only') {
      if (!mediaUrl || !mediaUrl.trim()) {
        errors.push('Media URL wajib disediakan untuk tipe media ini.');
      } else {
        const cleanUrl = mediaUrl.trim();
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
          errors.push('Media URL harus menggunakan protokol http atau https publik.');
        } else {
          // Preflight HEAD request untuk memeriksa accessibility & MIME type
          try {
            const headRes = await fetch(cleanUrl, { method: 'HEAD', signal: AbortSignal.timeout(6000) });
            if (!headRes.ok && headRes.status !== 405) { // 405 Method Not Allowed fallback to GET
              warnings.push(`Server media merespon dengan status HTTP ${headRes.status}. Pastikan URL dapat diakses publik tanpa login.`);
            } else {
              const contentType = headRes.headers.get('content-type') || '';
              const contentLength = parseInt(headRes.headers.get('content-length') || '0', 10);

              if (mediaType === 'image') {
                if (contentType && !contentType.startsWith('image/')) {
                  warnings.push(`Content-Type media '${contentType}' mungkin bukan gambar standar (JPEG/PNG/WebP).`);
                }
                if (contentLength > 10 * 1024 * 1024) {
                  warnings.push(`Ukuran gambar (${Math.round(contentLength / 1024 / 1024)}MB) mendekati batas maksimum Facebook/Instagram (10MB).`);
                }
              } else if (mediaType === 'video' || mediaType === 'reels') {
                if (contentType && !contentType.startsWith('video/')) {
                  warnings.push(`Content-Type media '${contentType}' mungkin bukan video MP4/MOV.`);
                }
                if (contentLength > 500 * 1024 * 1024) {
                  errors.push(`Ukuran video (${Math.round(contentLength / 1024 / 1024)}MB) melebihi batas maksimum 500MB.`);
                }
              }
            }
          } catch (netErr) {
            warnings.push(`Preflight pemeriksaan URL media timeout atau tidak dapat dijangkau: ${netErr.message}`);
          }
        }
      }
    }

    // 2. Validasi Caption
    if (!caption || !caption.trim()) {
      warnings.push('Caption masih kosong. Postingan akan dipublikasikan tanpa teks.');
    } else if (caption.length > 2200) {
      warnings.push(`Panjang caption (${caption.length} karakter) mendekati batas maksimum Instagram (2.200 karakter).`);
    }

    // 3. Validasi Akun Target
    const validAccounts = [];
    for (const accId of accountIds) {
      const acc = await getPublishingAccountById(tenantId, accId);
      if (!acc) {
        errors.push(`Akun publishing '${accId}' tidak ditemukan.`);
      } else if (acc.status === 'paused') {
        warnings.push(`Akun '${acc.display_name}' sedang dijeda (paused).`);
        validAccounts.push(acc);
      } else {
        validAccounts.push(acc);
      }
    }

    if (mediaType === 'reels' && validAccounts.some(account => account.platform === 'facebook') && mediaUrl) {
      try {
        const probe = await probePublishingMedia(mediaUrl.trim());
        const validation = validateFacebookReelProbe(probe);
        errors.push(...validation.errors);
        warnings.push(...validation.warnings);
      } catch (probeError) {
        errors.push(`Metadata Facebook Reel tidak dapat diverifikasi: ${probeError.message}`);
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      isValid: errors.length === 0,
      errors,
      warnings,
      accounts: validAccounts.map(a => ({
        id: a.id,
        displayName: a.display_name,
        platform: a.platform,
        status: a.status
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status || 500 }
    );
  }
});
