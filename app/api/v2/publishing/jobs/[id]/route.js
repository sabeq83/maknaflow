import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import {
  getPublishingJobById,
  reschedulePublishingJob,
  cancelPublishingJob,
  approvePublishingJob,
  getPublishingAccountById,
  markPublishingResult
} from '@/lib/publishing-repository';
import { fetchMetaPostDetails, fetchFacebookReelDetails, resolvePageAccessToken } from '@/lib/meta-publisher';
import { decryptSecret } from '@/lib/encrypted-secret';
import { pgQuery } from '@/lib/db-pg';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (request, { params }) => {
  try {
    const { id } = await params;
    const tenantId = getActiveTenantId();
    const job = await getPublishingJobById(tenantId, id);

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Publishing job tidak ditemukan.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: job
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status || 500 }
    );
  }
});

export const PATCH = withTenantContext(async (request, { params }, user) => {
  try {
    const { id } = await params;
    const tenantId = getActiveTenantId();
    const body = await request.json();
    const { action, scheduledAt, reason } = body;

    let result;
    if (action === 'reschedule') {
      if (!scheduledAt) {
        return NextResponse.json({ success: false, error: 'scheduledAt wajib diisi untuk reschedule.' }, { status: 400 });
      }
      result = await reschedulePublishingJob(tenantId, id, scheduledAt);
    } else if (action === 'cancel') {
      const job = await getPublishingJobById(tenantId, id);
      if (job && job.provider === 'repliz' && job.external_schedule_id) {
        try {
          const { deleteReplizSchedule } = await import('@/lib/repliz-client');
          const { getSetting } = await import('@/lib/db');
          const url = await getSetting('repliz_api_url') || 'https://api.repliz.com';
          const accessKey = await getSetting('repliz_access_key');
          const secretKey = await getSetting('repliz_secret_key');
          if (accessKey && secretKey) {
            await deleteReplizSchedule({ apiUrl: url, accessKey, secretKey }, job.external_schedule_id);
          }
        } catch (cancelErr) {
          console.warn('[Publishing Jobs API] Repliz cancel schedule warning:', cancelErr.message);
        }
      }
      result = await cancelPublishingJob(tenantId, id, reason);
    } else if (action === 'approve') {
      result = await approvePublishingJob(tenantId, id, user?.id || 'admin');
    } else if (action === 'sync-meta' || action === 'sync-status') {
      const job = await getPublishingJobById(tenantId, id);
      if (!job) {
        return NextResponse.json({ success: false, error: 'Job tidak ditemukan.' }, { status: 404 });
      }

      if (job.provider === 'repliz') {
        if (!job.external_schedule_id) {
          return NextResponse.json({ success: false, error: 'Job ini belum memiliki ID jadwal Repliz.' }, { status: 400 });
        }

        const { getReplizSchedule } = await import('@/lib/repliz-client');
        const { getSetting } = await import('@/lib/db');
        const url = await getSetting('repliz_api_url') || 'https://api.repliz.com';
        const accessKey = await getSetting('repliz_access_key');
        const secretKey = await getSetting('repliz_secret_key');
        if (!accessKey || !secretKey) {
          return NextResponse.json({ success: false, error: 'Kredensial Repliz tidak ditemukan.' }, { status: 400 });
        }

        const res = await getReplizSchedule({ apiUrl: url, accessKey, secretKey }, job.external_schedule_id);
        const schedule = res?.data || res;
        const replizStatus = (schedule?.status || 'scheduled').toLowerCase();

        let reconciledStatus = job.status;
        let isPublished = false;
        if (['completed', 'success', 'published'].includes(replizStatus)) {
          reconciledStatus = 'published';
          isPublished = true;
        } else if (replizStatus === 'failed') {
          reconciledStatus = 'failed';
        } else if (replizStatus === 'cancelled') {
          reconciledStatus = 'cancelled';
        }

        const permalink = schedule?.permalink || schedule?.publishedUrl || null;
        const postId = schedule?.postId || schedule?.externalId || null;

        await markPublishingResult(tenantId, id, {
          status: reconciledStatus,
          external_post_id: postId,
          provider_stage: replizStatus,
          verified_at: isPublished ? new Date().toISOString() : null,
          published_at: isPublished ? new Date().toISOString() : null
        });

        // Sync ke Content Flow item
        if (job.content_id) {
          const colName = `permalink_${job.platform.toLowerCase()}`;
          const statusCol = `${job.platform.toLowerCase()}_status`;
          const publishDateCol = `${job.platform.toLowerCase()}_publish_date`;

          let updateFields = [];
          let queryParams = [job.content_id, tenantId];

          if (isPublished) {
            updateFields.push(`${statusCol} = 'Published'`);
            if (permalink) {
              updateFields.push(`${colName} = $${queryParams.length + 1}`);
              queryParams.push(permalink);
            }
            updateFields.push(`${publishDateCol} = CURRENT_TIMESTAMP`);
          } else if (reconciledStatus === 'failed') {
            updateFields.push(`${statusCol} = 'Failed'`);
          } else if (reconciledStatus === 'cancelled') {
            updateFields.push(`${statusCol} = 'Cancelled'`);
          }

          if (updateFields.length > 0) {
            await pgQuery(`
              UPDATE content_flow_items
              SET 
                ${updateFields.join(', ')},
                updated_at = CURRENT_TIMESTAMP
              WHERE video_id = $1 AND tenant_id = $2
            `, queryParams);
          }
        }

        result = {
          jobId: id,
          postId: postId,
          permalink: permalink,
          status: reconciledStatus
        };
      } else {
        if (!job.external_post_id) {
          return NextResponse.json({ success: false, error: 'Job ini belum memiliki ID postingan Meta. Tunggu hingga job selesai dieksekusi.' }, { status: 400 });
        }

        const account = await getPublishingAccountById(tenantId, job.account_id, true);
        if (!account || !account.token_ciphertext) {
          return NextResponse.json({ success: false, error: 'Akun publishing atau token tidak ditemukan.' }, { status: 400 });
        }

        const plainToken = decryptSecret(account.token_ciphertext);
        let metaDetail;
        if (job.platform === 'facebook' && job.media_type === 'reels') {
          const pageToken = await resolvePageAccessToken(job.facebook_page_id, plainToken);
          const reelDetail = await fetchFacebookReelDetails({ videoId: job.external_post_id, token: pageToken });
          metaDetail = {
            ...reelDetail,
            isPublished: job.publish_mode === 'draft' ? reelDetail.publishStatus === 'draft' : reelDetail.isPublished
          };
        } else {
          metaDetail = await fetchMetaPostDetails({
            token: plainToken,
            platform: job.platform,
            externalPostId: job.external_post_id
          });
        }

        const reconciledStatus = metaDetail.isPublished
          ? (job.publish_mode === 'draft' ? 'draft_created' : 'published')
          : 'verifying';

        // Update job di database
        await markPublishingResult(tenantId, id, {
          externalPermalink: metaDetail.permalink,
          status: reconciledStatus,
          externalMediaStatus: metaDetail.videoStatus || null,
          externalObjectType: job.media_type === 'reels' ? 'REEL' : null,
          providerStage: reconciledStatus,
          verifiedAt: metaDetail.isPublished ? new Date().toISOString() : null,
          publishedAt: reconciledStatus === 'published' ? new Date().toISOString() : null
        });

        // Sync ke Content Flow item
        if (job.content_id) {
          if (job.platform === 'facebook') {
            await pgQuery(`
              UPDATE content_flow_items
              SET 
                permalink_facebook = $1,
                facebook_status = CASE WHEN $2 = true AND $3 = 'live' THEN 'Published' WHEN $2 = true THEN 'Draft Created' ELSE 'Verifying' END,
                facebook_publish_date = CASE WHEN $2 = true AND $3 = 'live' THEN CURRENT_TIMESTAMP ELSE facebook_publish_date END,
                updated_at = CURRENT_TIMESTAMP
              WHERE video_id = $4 AND tenant_id = $5
            `, [metaDetail.permalink, metaDetail.isPublished, job.publish_mode, job.content_id, tenantId]);
          } else if (job.platform === 'instagram') {
            await pgQuery(`
              UPDATE content_flow_items
              SET 
                permalink_instagram = $1,
                instagram_status = CASE WHEN $2 = true THEN 'Published' ELSE instagram_status END,
                updated_at = CURRENT_TIMESTAMP
              WHERE video_id = $3 AND tenant_id = $4
            `, [metaDetail.permalink, metaDetail.isPublished, job.content_id, tenantId]);
          }
        }

        result = {
          jobId: id,
          postId: metaDetail.postId,
          permalink: metaDetail.permalink,
          isPublished: metaDetail.isPublished
        };
      }
    } else {
      return NextResponse.json(
        { success: false, error: `Action '${action}' tidak dikenal. Pilih: 'reschedule', 'cancel', 'approve', atau 'sync-meta'.` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Action '${action}' berhasil dijalankan.`,
      data: result
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status || 400 }
    );
  }
});
