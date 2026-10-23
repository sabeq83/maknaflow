import { NextResponse } from 'next/server';
import { withTenantContext, getCurrentUser } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import { pgQuery } from '@/lib/db-pg';
import { logStudioEvent } from '@/lib/contentflow-studio-repository';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (request, context) => {
  try {
    const tenantId = getActiveTenantId() || 'default_tenant';
    const currentUser = getCurrentUser(request);
    const { id } = await context.params;
    const body = await request.json();
    const { action } = body;

    // Verify slot exists
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

    // ACTION 1: Retry AI Production (Option 1)
    if (action === 'retry_production') {
      const updateRes = await pgQuery(`
        UPDATE content_studio_slots
        SET stage_status = 'pending',
            error_message = NULL,
            progress_percent = 0,
            dispatched_at = NULL,
            completed_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND tenant_id = $2
        RETURNING *
      `, [id, tenantId]);

      const updatedSlot = updateRes.rows[0];

      await logStudioEvent({
        tenantId,
        batchId: slot.batch_id,
        slotId: id,
        eventType: 'retry_production',
        checkpointState: 'pending',
        payload: {
          initiated_by: currentUser?.username || currentUser?.email || 'user',
          reason: body.reason || 'Manual retry after failure'
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Produksi AI berhasil di-queue ulang.',
        data: updatedSlot
      });
    }

    // ACTION 2: Reschedule & Re-target (Option 2)
    if (action === 'reschedule') {
      const { scheduled_publish_at, target_account_ids } = body;

      const pubDate = scheduled_publish_at ? new Date(scheduled_publish_at) : null;
      if (scheduled_publish_at && isNaN(pubDate.getTime())) {
        return NextResponse.json({ success: false, error: 'Format tanggal tayang tidak valid.' }, { status: 400 });
      }

      let updateFields = ['updated_at = CURRENT_TIMESTAMP'];
      let params = [id, tenantId];

      if (pubDate) {
        params.push(pubDate.toISOString());
        updateFields.push(`scheduled_publish_at = $${params.length}`);
      }

      // If slot had an error message, clear it
      updateFields.push(`error_message = NULL`);

      const updateSlotQuery = `
        UPDATE content_studio_slots
        SET ${updateFields.join(', ')}
        WHERE id = $1 AND tenant_id = $2
        RETURNING *
      `;
      const updatedSlotRes = await pgQuery(updateSlotQuery, params);
      const updatedSlot = updatedSlotRes.rows[0];

      // Handle target accounts if provided
      if (Array.isArray(target_account_ids) && target_account_ids.length > 0) {
        // Query account details
        const accsRes = await pgQuery(
          `SELECT id, platform FROM publishing_accounts WHERE tenant_id = $1 AND id = ANY($2::text[]) AND status <> 'paused'`,
          [tenantId, target_account_ids]
        );

        if (accsRes.rowCount > 0) {
          // Remove existing targets for this slot
          await pgQuery(`DELETE FROM content_studio_targets WHERE slot_id = $1 AND tenant_id = $2`, [id, tenantId]);

          // Insert new targets
          const newPublishDate = pubDate ? pubDate.toISOString() : updatedSlot.scheduled_publish_at;
          for (const acc of accsRes.rows) {
            const targetId = `stt_${crypto.randomUUID().replaceAll('-', '')}`;
            await pgQuery(`
              INSERT INTO content_studio_targets (
                id, tenant_id, slot_id, account_id, platform, scheduled_at, status, error_message, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, 'awaiting_approval', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [targetId, tenantId, id, acc.id, acc.platform, newPublishDate]);
          }
        }
      } else if (pubDate) {
        // Just update existing targets' scheduled_at and clear errors
        await pgQuery(`
          UPDATE content_studio_targets
          SET scheduled_at = $1, error_message = NULL, status = 'awaiting_approval', updated_at = CURRENT_TIMESTAMP
          WHERE slot_id = $2 AND tenant_id = $3
        `, [pubDate.toISOString(), id, tenantId]);
      }

      await logStudioEvent({
        tenantId,
        batchId: slot.batch_id,
        slotId: id,
        eventType: 'reschedule_target',
        checkpointState: 'rescheduled',
        payload: {
          scheduled_publish_at: pubDate ? pubDate.toISOString() : undefined,
          target_account_ids,
          initiated_by: currentUser?.username || currentUser?.email || 'user',
          reason: body.reason || 'Manual reschedule'
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Jadwal dan akun target berhasil diperbarui.',
        data: updatedSlot
      });
    }

    return NextResponse.json({ success: false, error: `Aksi tidak dikenal: '${action}'` }, { status: 400 });
  } catch (error) {
    console.error('[Slot Actions API Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
