import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import { updateAffiliateSchedule } from '@/lib/affiliate-content-schedules-repository';
import { createPublishingJobs, listPublishingAccounts } from '@/lib/publishing-repository';
import { pgQuery } from '@/lib/db-pg';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (request, user) => {
  try {
    const tenantId = getActiveTenantId();
    const body = await request.json();
    const { schedule_id, video_id, media_url, caption, custom_account_ids } = body;

    if (!schedule_id) {
      return NextResponse.json(
        { success: false, error: 'schedule_id wajib disertakan.' },
        { status: 400 }
      );
    }

    // Ambil detail jadwal
    const schedRes = await pgQuery(
      `SELECT * FROM affiliate_content_schedules WHERE id = $1 AND tenant_id = $2`,
      [schedule_id, tenantId]
    );
    if (schedRes.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Jadwal affiliate tidak ditemukan.' },
        { status: 404 }
      );
    }

    const schedule = schedRes.rows[0];
    const targetContentId = video_id || schedule.content_flow_id || schedule.id;
    const targetMediaUrl = media_url || '';
    const targetCaption = caption || schedule.promotion_context || '';

    // Resolve target account IDs
    let targetAccountIds = custom_account_ids || [];
    if (targetAccountIds.length === 0 && Array.isArray(schedule.target_account_ids) && schedule.target_account_ids.length > 0) {
      targetAccountIds = schedule.target_account_ids;
    }

    // Jika target_account_ids masih kosong, resolve dari target_platforms & brand_name
    if (targetAccountIds.length === 0) {
      const allAccounts = await listPublishingAccounts(tenantId);
      const platforms = Array.isArray(schedule.target_platforms) ? schedule.target_platforms : ['instagram', 'tiktok'];
      
      const matched = allAccounts.filter(acc => {
        if (acc.status !== 'active') return false;
        return platforms.includes(acc.platform);
      });
      targetAccountIds = matched.map(a => a.id);
    }

    if (targetAccountIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tidak ada akun publishing aktif yang sesuai dengan platform target.' },
        { status: 400 }
      );
    }

    const scheduledAt = schedule.scheduled_at ? new Date(schedule.scheduled_at).toISOString() : new Date().toISOString();

    const targets = targetAccountIds.map(accId => ({
      accountId: accId,
      publishMode: 'live',
      mediaType: 'reels',
      caption: targetCaption,
      mediaUrl: targetMediaUrl,
      scheduledAt: scheduledAt,
      approvalStatus: 'pending_approval',
      isAiGenerated: true
    }));

    const createdJobs = await createPublishingJobs({
      tenantId,
      userId: user?.id || null,
      contentId: targetContentId,
      targets
    });

    const jobIds = createdJobs.map(j => j.id);

    // Update status schedule
    await updateAffiliateSchedule(tenantId, schedule_id, {
      status: 'scheduled',
      content_flow_id: targetContentId,
      publishing_job_ids: jobIds
    });

    return NextResponse.json({
      success: true,
      message: `Berhasil mendispatch ${createdJobs.length} posting ke Repliz Publishing! 🚀`,
      job_ids: jobIds,
      jobs: createdJobs
    });
  } catch (error) {
    console.error('[Affiliate Content Schedules Publish-Repliz Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mendispatch ke Repliz.' },
      { status: 500 }
    );
  }
});
