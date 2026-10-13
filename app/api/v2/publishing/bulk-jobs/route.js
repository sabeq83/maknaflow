import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import { createPublishingJobs } from '@/lib/publishing-repository';
import { pgQuery } from '@/lib/db-pg';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (request, user) => {
  try {
    const tenantId = getActiveTenantId();
    const body = await request.json();

    const {
      items = [],
      account_ids = [],
      publish_mode = 'live',
      media_type = 'reels',
      is_ai_generated = true,
      timezone = 'Asia/Jakarta'
    } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Daftar konten (items) wajib disertakan dan tidak boleh kosong.' },
        { status: 400 }
      );
    }

    if (!Array.isArray(account_ids) || account_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Pilih minimal satu akun media sosial tujuan.' },
        { status: 400 }
      );
    }

    const allCreatedJobs = [];
    const scheduledContentIds = [];

    for (const rawItem of items) {
      const contentId = rawItem.content_id || rawItem.video_id;
      if (!contentId) continue;

      let caption = rawItem.caption || '';
      let mediaUrl = rawItem.media_url || '';
      const scheduledAt = rawItem.scheduled_at || new Date().toISOString();

      // Hydrate missing caption or mediaUrl from database jika belum ada
      if (!caption || !mediaUrl) {
        try {
          const dbItemRes = await pgQuery(
            `SELECT hook, caption, url_asset, nextcloud_url 
             FROM content_flow_items 
             WHERE (video_id = $1 OR id::text = $1) AND tenant_id = $2
             LIMIT 1`,
            [contentId, tenantId]
          );
          if (dbItemRes.rowCount > 0) {
            const dbRow = dbItemRes.rows[0];
            if (!caption) caption = dbRow.caption || dbRow.hook || '';
            if (!mediaUrl) mediaUrl = dbRow.url_asset || dbRow.nextcloud_url || '';
          }
        } catch (dbFetchErr) {
          console.warn('[Bulk Publishing] Gagal hydrate data item:', dbFetchErr.message);
        }
      }

      // Build target entries per account
      const targets = account_ids.map(accId => ({
        accountId: accId,
        publishMode: publish_mode,
        mediaType: rawItem.media_type || media_type || 'reels',
        caption: caption,
        mediaUrl: mediaUrl,
        scheduledAt: scheduledAt,
        approvalStatus: 'not_required',
        isAiGenerated: !!is_ai_generated
      }));

      // Call repository creation
      const created = await createPublishingJobs({
        tenantId,
        userId: user?.id || null,
        contentId: contentId,
        targets
      });

      if (Array.isArray(created) && created.length > 0) {
        allCreatedJobs.push(...created);
        scheduledContentIds.push(contentId);

        // Auto-sync status ContentFlow ke 'Scheduled'
        try {
          const platforms = [...new Set(created.map(j => j.platform).filter(Boolean))];
          const platformColumnMap = {
            facebook: 'facebook_status',
            instagram: 'instagram_status',
            tiktok: 'tiktok_status',
            youtube: 'youtube_status',
            threads: 'threads_status',
            linkedin: 'linkedin_status'
          };

          for (const platform of platforms) {
            const col = platformColumnMap[platform];
            if (!col) continue;

            await pgQuery(
              `UPDATE content_flow_items
               SET ${col} = 'Scheduled', updated_at = CURRENT_TIMESTAMP
               WHERE (video_id = $1 OR id::text = $1) AND tenant_id = $2`,
              [contentId, tenantId]
            );
          }
        } catch (syncErr) {
          console.warn('[Bulk Publishing] Gagal auto-sync status ContentFlow:', syncErr.message);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil menjadwalkan ${scheduledContentIds.length} konten massal (${allCreatedJobs.length} posting publikasi).`,
      total_items: scheduledContentIds.length,
      total_jobs: allCreatedJobs.length,
      data: allCreatedJobs
    }, { status: 201 });

  } catch (error) {
    console.error('[Bulk Publishing POST Error]:', error);
    return NextResponse.json(
      {
        success: false,
        code: error.code || 'BULK_SCHEDULE_ERROR',
        error: error.message || 'Gagal memproses penjadwalan konten massal.'
      },
      { status: 500 }
    );
  }
});
