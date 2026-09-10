import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import {
  listPublishingJobs,
  createPublishingJobs
} from '@/lib/publishing-repository';
import { validateScheduleRequest } from '@/lib/publishing-contract';
import { pgQuery } from '@/lib/db-pg';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (request) => {
  try {
    const tenantId = getActiveTenantId();
    const { searchParams } = new URL(request.url);

    const view = searchParams.get('view') || 'all';
    const status = searchParams.get('status') || 'all';
    const platform = searchParams.get('platform') || 'all';
    const accountId = searchParams.get('account_id') || searchParams.get('accountId') || 'all';
    const brand = searchParams.get('brand') || searchParams.get('brand_profile') || 'all';
    const contentId = searchParams.get('content_id') || searchParams.get('contentId') || '';
    const startDate = searchParams.get('start_date') || searchParams.get('startDate') || '';
    const endDate = searchParams.get('end_date') || searchParams.get('endDate') || '';
    const search = searchParams.get('search') || searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const result = await listPublishingJobs(tenantId, {
      view,
      status,
      platform,
      accountId,
      brand,
      contentId,
      startDate,
      endDate,
      search,
      limit,
      offset
    });

    return NextResponse.json({
      success: true,
      data: result.items,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      metrics: result.metrics
    });
  } catch (error) {
    console.error('[Publishing Jobs GET Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memuat antrean jadwal publikasi.' },
      { status: error.status || 500 }
    );
  }
});

export const POST = withTenantContext(async (request, user) => {
  try {
    const tenantId = getActiveTenantId();
    const rawBody = await request.json();
    const validated = validateScheduleRequest(rawBody);

    const targets = validated.account_ids.map(accId => ({
      accountId: accId,
      publishMode: validated.publish_mode,
      mediaType: validated.media_type,
      caption: validated.caption,
      mediaUrl: validated.media_url,
      scheduledAt: validated.schedules?.[accId] || validated.scheduled_at,
      approvalStatus: validated.publish_mode === 'live' ? 'pending_approval' : 'not_required',
      isAiGenerated: !!validated.is_ai_generated
    }));


    // === SERVER-SIDE READINESS & AUTO-RECONNECT GATE ===
    const { getPublishingAccountById, recordPublishingAccountHealth } = await import('@/lib/publishing-repository');
    const { getReplizAccount } = await import('@/lib/repliz-client');
    const { verifyPublishingDriveReady } = await import('@/lib/publishing-drive-staging');

    let requiresReplizStaging = false;
    for (const accId of validated.account_ids) {
      let acc = await getPublishingAccountById(tenantId, accId);
      if (!acc) continue;

      if (acc.provider === 'repliz') {
        if (validated.media_type !== 'text_only') {
          requiresReplizStaging = true;
        }

        // Live Auto-Reconnect & Health Probe jika akun lokal tercatat disconnected
        if (acc.status === 'disconnected') {
          try {
            const url = await getSetting('repliz_api_url') || 'https://api.repliz.com';
            const accessKey = await getSetting('repliz_access_key');
            const secretKey = await getSetting('repliz_secret_key');
            if (accessKey && secretKey) {
              const remoteAcc = await getReplizAccount({ apiUrl: url, accessKey, secretKey }, acc.provider_account_id);
              const isConnected = remoteAcc && remoteAcc.isConnected !== false && remoteAcc.status !== 'disconnected';
              if (isConnected) {
                acc = await recordPublishingAccountHealth(tenantId, acc.id, {
                  isConnected: true,
                  lastErrorCode: null,
                  lastErrorMessage: null
                });
                console.log(`[Publishing Jobs] Auto-reconnected Repliz account ${acc.display_name} (${acc.id})`);
              } else {
                return NextResponse.json({
                  success: false,
                  error: `Akun ${acc.display_name} (${acc.platform.toUpperCase()}) terputus di Repliz. Silakan hubungkan ulang (reconnect) akun Anda di Repliz, lalu coba kembali.`,
                  code: 'REPLIZ_ACCOUNT_DISCONNECTED',
                  reconnectUrl: 'https://repliz.com/user/account'
                }, { status: 409 });
              }
            }
          } catch (probeErr) {
            console.warn('[Publishing Jobs] Gagal live probe Repliz account:', probeErr.message);
            return NextResponse.json({
              success: false,
              error: `Akun ${acc.display_name} (${acc.platform.toUpperCase()}) terputus di Repliz. Silakan hubungkan ulang akun Anda di Repliz.`,
              code: 'REPLIZ_ACCOUNT_DISCONNECTED',
              reconnectUrl: 'https://repliz.com/user/account'
            }, { status: 409 });
          }
        }
      }
    }

    if (requiresReplizStaging) {
      await verifyPublishingDriveReady({ bypassCache: true });
    }

    const createdJobs = await createPublishingJobs({
      tenantId,
      userId: user?.id || null,
      contentId: validated.content_id,
      targets
    });


    // === AUTO-SYNC ContentFlow: tandai 'Scheduled' segera setelah job dibuat ===
    // Langkah ini memastikan status di library berubah TANPA menunggu worker pick up job.
    if (validated.content_id && createdJobs.length > 0) {
      try {
        const platforms = [...new Set(createdJobs.map(j => j.platform).filter(Boolean))];
        const platformColumnMap = {
          facebook:  'facebook_status',
          instagram: 'instagram_status',
          tiktok:    'tiktok_status',
          youtube:   'youtube_status',
          threads:   'threads_status',
          linkedin:  'linkedin_status'
        };
        for (const platform of platforms) {
          const col = platformColumnMap[platform];
          if (!col) continue;
          await pgQuery(
            `UPDATE content_flow_items
             SET ${col} = 'Scheduled', updated_at = CURRENT_TIMESTAMP
             WHERE video_id = $1 AND tenant_id = $2`,
            [validated.content_id, tenantId]
          );
        }
        console.log(`[Publishing Jobs] Auto-synced ContentFlow to Scheduled for ${validated.content_id} (${platforms.join(', ')})`);
      } catch (syncErr) {
        console.warn('[Publishing Jobs] Gagal auto-sync ContentFlow status:', syncErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil menjadwalkan ${createdJobs.length} posting publikasi.`,
      data: createdJobs
    }, { status: 201 });
  } catch (error) {
    console.error('[Publishing Jobs POST Error]:', error);
    return NextResponse.json(
      {
        success: false,
        code: error.code || 'SCHEDULE_ERROR',
        error: error.message || 'Gagal membuat jadwal publikasi.',
        reconnectUrl: error.reconnectUrl || null
      },
      { status: error.status || 400 }
    );
  }
});

