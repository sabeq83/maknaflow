import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import { getDb, getSetting } from '@/lib/db';
import {
  listPublishingAccounts,
  savePublishingAccount,
  getPublishingAccountById
} from '@/lib/publishing-repository';
import {
  verifyFacebookAccount,
  verifyInstagramAccount
} from '@/lib/meta-publisher';
import { encryptSecret } from '@/lib/encrypted-secret';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (request) => {
  try {
    const tenantId = getActiveTenantId();
    let accounts = await listPublishingAccounts(tenantId);

    // Auto-migrate legacy settings if no accounts exist yet for this tenant
    if (accounts.length === 0) {
      try {
        const legacyPageId = getSetting('fb_page_id');
        const legacyToken = getSetting('fb_page_token');

        if (legacyPageId && legacyToken) {
          const encrypted = encryptSecret(legacyToken);
          await savePublishingAccount({
            tenantId,
            platform: 'facebook',
            displayName: `Facebook Page (Legacy #${legacyPageId})`,
            facebookPageId: legacyPageId,
            tokenCiphertext: encrypted,
            timezone: 'Asia/Jakarta',
            permissions: ['CREATE_CONTENT', 'DRAFT_ONLY']
          });
          accounts = await listPublishingAccounts(tenantId);
        }
      } catch (migrationErr) {
        console.warn('[Publishing Accounts] Legacy settings auto-import warning:', migrationErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      data: accounts
    });
  } catch (error) {
    console.error('[Publishing Accounts GET Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat daftar akun publishing.' },
      { status: error.status || 500 }
    );
  }
});

export const POST = withTenantContext(async (request, user) => {
  try {
    const tenantId = getActiveTenantId();
    const body = await request.json();
    const {
      platform = 'facebook',
      token,
      pageId,
      instagramUserId,
      displayName: customName,
      timezone = 'Asia/Jakarta'
    } = body;

    if (!token || !token.trim()) {
      return NextResponse.json(
        { success: false, error: 'Access token Meta wajib diisi.' },
        { status: 400 }
      );
    }

    let verified;
    if (platform === 'instagram') {
      if (!pageId) {
        return NextResponse.json(
          { success: false, error: 'Facebook Page ID yang terhubung ke Instagram wajib diisi.' },
          { status: 400 }
        );
      }
      verified = await verifyInstagramAccount({
        token,
        facebookPageId: pageId,
        instagramUserId
      });
    } else {
      verified = await verifyFacebookAccount({
        token,
        pageId
      });
    }

    const tokenCiphertext = encryptSecret(verified.token || token);

    const saved = await savePublishingAccount({
      tenantId,
      platform: verified.platform,
      displayName: customName || verified.displayName,
      facebookPageId: verified.facebookPageId,
      instagramUserId: verified.instagramUserId,
      linkedFacebookPageId: verified.platform === 'instagram' ? verified.facebookPageId : null,
      tokenCiphertext,
      permissions: verified.permissions,
      timezone: timezone || 'Asia/Jakarta',
      status: 'active'
    });

    return NextResponse.json({
      success: true,
      message: `Akun ${verified.platform === 'instagram' ? 'Instagram' : 'Facebook'} '${saved.display_name}' berhasil diverifikasi dan disimpan.`,
      data: saved
    }, { status: 201 });
  } catch (error) {
    console.error('[Publishing Accounts POST Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memverifikasi atau menyimpan akun Meta.' },
      { status: error.status || 400 }
    );
  }
});
