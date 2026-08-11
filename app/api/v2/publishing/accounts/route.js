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
    const { searchParams } = new URL(request.url);
    const forceSync = searchParams.get('sync') === '1' || searchParams.get('refresh') === 'true';

    let accounts = await listPublishingAccounts(tenantId);

    // Auto-sync or force-sync connected Facebook pages & Instagram from settings
    if (accounts.length === 0 || forceSync) {
      try {
        const { getConnectedFacebookPages } = await import('@/lib/facebook-helper');
        const fbResult = await getConnectedFacebookPages();
        const legacyToken = getSetting('fb_page_token');

        if (fbResult && fbResult.success && Array.isArray(fbResult.pages) && fbResult.pages.length > 0 && legacyToken) {
          const encrypted = encryptSecret(legacyToken);
          for (const p of fbResult.pages) {
            // Save Facebook Page
            await savePublishingAccount({
              tenantId,
              platform: 'facebook',
              displayName: p.name || `Facebook Page #${p.id}`,
              facebookPageId: p.id,
              tokenCiphertext: p.access_token ? encryptSecret(p.access_token) : encrypted,
              timezone: 'Asia/Jakarta',
              permissions: ['CREATE_CONTENT', 'DRAFT_ONLY']
            });

            // Save linked Instagram Business account if present
            if (p.instagram && p.instagram.id) {
              await savePublishingAccount({
                tenantId,
                platform: 'instagram',
                displayName: `@${p.instagram.username || p.instagram.id} (IG via ${p.name})`,
                facebookPageId: p.id,
                instagramUserId: p.instagram.id,
                linkedFacebookPageId: p.id,
                tokenCiphertext: p.access_token ? encryptSecret(p.access_token) : encrypted,
                timezone: 'Asia/Jakarta',
                permissions: ['CREATE_CONTENT', 'DRAFT_ONLY']
              });
            }
          }
          accounts = await listPublishingAccounts(tenantId);
        }
      } catch (migrationErr) {
        console.warn('[Publishing Accounts] Auto-sync connected pages warning:', migrationErr.message);
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
      timezone = 'Asia/Jakarta',
      pages
    } = body;

    // Batch save multiple selected pages (from Settings auto-discovery)
    if (Array.isArray(pages) && pages.length > 0) {
      const defaultToken = (token && token.trim()) ? token.trim() : getSetting('fb_page_token');
      const savedAccounts = [];

      for (const p of pages) {
        const pageToken = p.access_token || defaultToken;
        if (!pageToken) continue;
        const encrypted = encryptSecret(pageToken);

        const acc = await savePublishingAccount({
          tenantId,
          platform: 'facebook',
          displayName: p.name || `Facebook Page #${p.id}`,
          facebookPageId: p.id,
          tokenCiphertext: encrypted,
          timezone: timezone || 'Asia/Jakarta',
          permissions: ['CREATE_CONTENT', 'DRAFT_ONLY'],
          status: 'active'
        });
        savedAccounts.push(acc);

        if (p.instagram && p.instagram.id) {
          const igAcc = await savePublishingAccount({
            tenantId,
            platform: 'instagram',
            displayName: `@${p.instagram.username || p.instagram.id} (IG via ${p.name})`,
            facebookPageId: p.id,
            instagramUserId: p.instagram.id,
            linkedFacebookPageId: p.id,
            tokenCiphertext: encrypted,
            timezone: timezone || 'Asia/Jakarta',
            permissions: ['CREATE_CONTENT', 'DRAFT_ONLY'],
            status: 'active'
          });
          savedAccounts.push(igAcc);
        }
      }

      return NextResponse.json({
        success: true,
        message: `${savedAccounts.length} akun Meta (Facebook & Instagram) berhasil disimpan.`,
        data: savedAccounts
      }, { status: 201 });
    }

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
