import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import { getSetting } from '@/lib/db';
import {
  getPublishingAccountById,
  recordPublishingAccountHealth
} from '@/lib/publishing-repository';
import { getReplizAccount, ReplizApiError } from '@/lib/repliz-client';
import { verifyFacebookAccount, verifyInstagramAccount } from '@/lib/meta-publisher';
import { decryptSecret } from '@/lib/encrypted-secret';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (request, { params }, user) => {
  try {
    const { id } = await params;
    const tenantId = getActiveTenantId();

    const account = await getPublishingAccountById(tenantId, id, true);
    if (!account) {
      return NextResponse.json({ success: false, error: 'Akun publishing tidak ditemukan.' }, { status: 404 });
    }

    let isConnected = false;
    let errorCode = null;
    let message = '';
    const nowIso = new Date().toISOString();

    if (account.provider === 'repliz') {
      const url = await getSetting('repliz_api_url') || 'https://api.repliz.com';
      const accessKey = await getSetting('repliz_access_key');
      const secretKey = await getSetting('repliz_secret_key');

      if (!accessKey || !secretKey) {
        return NextResponse.json({
          success: false,
          error: 'Kredensial Repliz belum dikonfigurasi di Settings.'
        }, { status: 400 });
      }

      try {
        const remote = await getReplizAccount({ apiUrl: url, accessKey, secretKey }, account.provider_account_id);
        if (remote && (remote.id || remote._id)) {
          isConnected = remote.isConnected !== false && remote.status !== 'disconnected';
          message = isConnected
            ? `Koneksi Repliz ${account.platform?.toUpperCase()} aktif.`
            : `Akun Repliz ${account.platform?.toUpperCase()} terdeteksi terputus (disconnected) di Repliz.`;
          if (!isConnected) {
            errorCode = 'REPLIZ_ACCOUNT_DISCONNECTED';
          }
        } else {
          isConnected = false;
          errorCode = 'REPLIZ_ACCOUNT_NOT_FOUND';
          message = `Akun tidak ditemukan di dashboard Repliz. Silakan hubungkan ulang.`;
        }
      } catch (replizErr) {
        isConnected = false;
        errorCode = replizErr.code || 'REPLIZ_HEALTH_CHECK_FAILED';
        message = replizErr.message || 'Gagal menghubungi API Repliz.';
      }
    } else {
      // Meta (Facebook / Instagram)
      if (!account.token_ciphertext) {
        isConnected = false;
        errorCode = 'TOKEN_MISSING';
        message = 'Token autentikasi Meta tidak ditemukan.';
      } else {
        try {
          const plainToken = decryptSecret(account.token_ciphertext);
          if (account.platform === 'facebook') {
            const fbVerify = await verifyFacebookAccount(plainToken, account.facebook_page_id);
            isConnected = fbVerify.isValid;
            message = fbVerify.isValid
              ? `Halaman Facebook '${fbVerify.pageName}' terhubung dan valid.`
              : (fbVerify.error || 'Token atau izin Facebook tidak valid.');
            if (!isConnected) errorCode = 'FACEBOOK_AUTH_INVALID';
          } else if (account.platform === 'instagram') {
            const igVerify = await verifyInstagramAccount(plainToken, account.instagram_user_id);
            isConnected = igVerify.isValid;
            message = igVerify.isValid
              ? `Akun Instagram @${igVerify.username} terhubung dan valid.`
              : (igVerify.error || 'Token atau izin Instagram tidak valid.');
            if (!isConnected) errorCode = 'INSTAGRAM_AUTH_INVALID';
          }
        } catch (metaErr) {
          isConnected = false;
          errorCode = 'META_HEALTH_CHECK_FAILED';
          message = metaErr.message || 'Gagal memverifikasi akun Meta.';
        }
      }
    }

    // Simpan status health ke database
    const updatedAccount = await recordPublishingAccountHealth(tenantId, id, {
      isConnected,
      errorCode,
      message
    });

    return NextResponse.json({
      success: true,
      data: {
        id: account.id,
        displayName: account.display_name,
        platform: account.platform,
        provider: account.provider,
        isConnected,
        status: updatedAccount?.status || (isConnected ? 'active' : 'disconnected'),
        lastVerifiedAt: nowIso,
        lastErrorCode: errorCode,
        lastErrorMessage: message
      }
    });
  } catch (error) {
    console.error('[Publishing Account Health Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal melakukan health check akun.' },
      { status: error.status || 500 }
    );
  }
});
