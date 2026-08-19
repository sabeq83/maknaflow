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
        let urlObj;
        try {
          urlObj = new URL(cleanUrl);
        } catch (_) {
          errors.push('Format URL media tidak valid.');
        }

        if (urlObj) {
          if (urlObj.protocol !== 'https:') {
            errors.push('Media URL wajib menggunakan HTTPS agar dapat diakses oleh provider.');
          }
          const hostname = urlObj.hostname;
          if (
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname.startsWith('192.168.') ||
            hostname.startsWith('10.') ||
            hostname.startsWith('172.16.') ||
            hostname.startsWith('172.17.') ||
            hostname.startsWith('172.18.') ||
            hostname.startsWith('172.19.') ||
            hostname.startsWith('172.20.') ||
            hostname.startsWith('172.21.') ||
            hostname.startsWith('172.22.') ||
            hostname.startsWith('172.23.') ||
            hostname.startsWith('172.24.') ||
            hostname.startsWith('172.25.') ||
            hostname.startsWith('172.26.') ||
            hostname.startsWith('172.27.') ||
            hostname.startsWith('172.28.') ||
            hostname.startsWith('172.29.') ||
            hostname.startsWith('172.30.') ||
            hostname.startsWith('172.31.')
          ) {
            errors.push('Media URL tidak boleh berupa alamat local/private network.');
          }
        }

        if (errors.length === 0) {
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
