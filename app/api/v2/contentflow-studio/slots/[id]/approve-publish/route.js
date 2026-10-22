import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import { pgQuery } from '@/lib/db-pg';
import { recordStudioApproval, recordStudioEvent } from '@/lib/contentflow-studio-repository';
import { computeApprovalRevisionHash } from '@/lib/contentflow-studio-contract';
import { schedulePublishingJobs } from '@/lib/publishing-service';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (request, context, user) => {
  try {
    const tenantId = getActiveTenantId() || 'default_tenant';
    const { id } = await context.params;
    const body = await request.json();

    const {
      decision = 'approved',
      notes = '',
      clientRevisionHash = null,
      publishMode = 'schedule', // 'schedule' | 'now' | 'manual_evidence'
      manualEvidenceUrl = null,
      customCaption = null,
      selectedAccountIds = []
    } = body;

    const slotRes = await pgQuery(`
      SELECT s.*, b.title as batch_title
      FROM content_studio_slots s
      JOIN content_studio_batches b ON s.batch_id = b.id
      WHERE s.id = $1 AND s.tenant_id = $2
    `, [id, tenantId]);

    if (slotRes.rowCount === 0) {
      return NextResponse.json({ success: false, error: 'Slot tidak ditemukan.' }, { status: 404 });
    }

    const slot = slotRes.rows[0];

    // Read media url
    let mediaUrl = null;
    let caption = customCaption || '';
    if (slot.creative_snapshot_json) {
      const snap = typeof slot.creative_snapshot_json === 'string'
        ? JSON.parse(slot.creative_snapshot_json)
        : slot.creative_snapshot_json;
      caption = caption || snap.caption || snap.hook_text || snap.title || '';
      mediaUrl = snap.output_video_url || snap.output_image_url || snap.video_url || snap.image_url || null;
    }
    if (manualEvidenceUrl) {
      mediaUrl = manualEvidenceUrl;
    }

    // Require media unless manual evidence mode
    if (!mediaUrl && publishMode !== 'manual_evidence') {
      return NextResponse.json({
        success: false,
        error: 'Media output belum selesai diproduksi. Slot belum siap untuk publikasi.'
      }, { status: 400 });
    }

    // Hash check
    const currentHash = computeApprovalRevisionHash({
      caption,
      mediaUrl,
      scheduledPublishAt: slot.scheduled_publish_at
    });

    if (clientRevisionHash && clientRevisionHash !== currentHash) {
      return NextResponse.json({
        success: false,
        code: 'REVISION_HASH_MISMATCH',
        error: 'Konten atau jadwal telah diperbarui sejak terakhir ditinjau. Silakan periksa kembali pratinjau sebelum menyetujui.'
      }, { status: 409 });
    }

    // Record Approval
    const approval = await recordStudioApproval({
      slotId: id,
      tenantId,
      revisionHash: currentHash,
      decision,
      notes,
      actor: user?.id || user?.username || 'user'
    });

    let publishingJobResult = null;
    let nextPublishingStatus = 'approved';

    // Fetch slot target accounts
    const targetsRes = await pgQuery(`
      SELECT * FROM content_studio_targets WHERE slot_id = $1 AND tenant_id = $2
    `, [id, tenantId]);
    const slotTargets = targetsRes.rows;

    const effectiveAccountIds = selectedAccountIds.length > 0
      ? selectedAccountIds
      : slotTargets.map(t => t.account_id);

    if (publishMode === 'manual_evidence') {
      nextPublishingStatus = 'published';
      await recordStudioEvent({
        batchId: slot.batch_id,
        slotId: id,
        tenantId,
        eventType: 'manual_evidence_logged',
        eventPayloadJson: { manualEvidenceUrl, notes },
        actor: user?.id || 'user'
      });
    } else if (effectiveAccountIds.length > 0 && mediaUrl) {
      // Dispatch via schedulePublishingJobs
      try {
        const scheduleRawBody = {
          account_ids: effectiveAccountIds,
          publish_mode: publishMode === 'now' ? 'now' : 'schedule',
          media_type: mediaUrl.endsWith('.jpg') || mediaUrl.endsWith('.png') ? 'single_image' : 'video',
          title: slot.batch_title || 'Konten Studio',
          caption: caption || 'Konten Studio Terpublikasi',
          media_url: mediaUrl,
          scheduled_at: slot.scheduled_publish_at ? new Date(slot.scheduled_publish_at).toISOString() : new Date().toISOString(),
          is_ai_generated: true,
          content_id: slot.content_flow_item_id || slot.id
        };

        publishingJobResult = await schedulePublishingJobs({
          tenantId,
          userId: user?.id || null,
          rawBody: scheduleRawBody
        });

        nextPublishingStatus = publishMode === 'now' ? 'publishing' : 'scheduled';

        // Link publishing job IDs to targets
        if (publishingJobResult?.data) {
          for (const job of publishingJobResult.data) {
            await pgQuery(`
              UPDATE content_studio_targets
              SET publishing_job_id = $1, status = 'scheduled', updated_at = CURRENT_TIMESTAMP
              WHERE slot_id = $2 AND account_id = $3 AND tenant_id = $4
            `, [job.id, id, job.account_id, tenantId]);
          }
        }
      } catch (pubErr) {
        console.error('[Slot Publishing Dispatch Warning]:', pubErr);
        // If publishing schedule fails (e.g. Repliz disconnected), record event but don't drop approval
        await recordStudioEvent({
          batchId: slot.batch_id,
          slotId: id,
          tenantId,
          eventType: 'publishing_dispatch_failed',
          eventPayloadJson: { error: pubErr.message, code: pubErr.code },
          actor: user?.id || 'user'
        });
        return NextResponse.json({
          success: false,
          code: pubErr.code || 'PUBLISHING_DISPATCH_FAILED',
          error: pubErr.message || 'Persetujuan disimpan, namun penjadwalan ke platform publikasi gagal.',
          reconnectUrl: pubErr.reconnectUrl || null
        }, { status: 400 });
      }
    }

    // Update slot status
    await pgQuery(`
      UPDATE content_studio_slots
      SET publishing_status = $1, approval_revision_hash = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND tenant_id = $4
    `, [nextPublishingStatus, currentHash, id, tenantId]);

    return NextResponse.json({
      success: true,
      message: `Slot #${slot.slot_number} berhasil disetujui untuk publikasi (${nextPublishingStatus}).`,
      data: {
        approval,
        publishingStatus: nextPublishingStatus,
        publishingJobs: publishingJobResult?.data || []
      }
    });

  } catch (error) {
    console.error('[Slot Approve-Publish Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
