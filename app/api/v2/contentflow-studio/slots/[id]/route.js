import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import { pgQuery } from '@/lib/db-pg';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (request, context) => {
  try {
    const tenantId = getActiveTenantId() || 'default_tenant';
    const { id } = await context.params;

    const slotRes = await pgQuery(`
      SELECT s.*, b.title as batch_title, b.source_kind as batch_source_kind, b.engine_kind as batch_engine_kind, b.configuration_json as batch_config
      FROM content_studio_slots s
      JOIN content_studio_batches b ON s.batch_id = b.id
      WHERE s.id = $1 AND s.tenant_id = $2
    `, [id, tenantId]);

    if (slotRes.rowCount === 0) {
      return NextResponse.json({ success: false, error: 'Slot tidak ditemukan.' }, { status: 404 });
    }

    const slot = slotRes.rows[0];

    const targetsRes = await pgQuery(`
      SELECT * FROM content_studio_targets WHERE slot_id = $1 AND tenant_id = $2 ORDER BY created_at ASC
    `, [id, tenantId]);
    slot.targets = targetsRes.rows;
    const { computeApprovalRevisionHash } = await import('@/lib/contentflow-studio-contract');
    slot.current_revision_hash = computeApprovalRevisionHash({mediaUrl:slot.final_media_url,caption:slot.final_caption,accountIds:slot.targets.map(t=>t.account_id),scheduledPublishAt:slot.scheduled_publish_at});

    const approvalsRes = await pgQuery(`
      SELECT * FROM content_studio_approvals WHERE slot_id = $1 AND tenant_id = $2 ORDER BY created_at DESC
    `, [id, tenantId]);
    slot.approvals = approvalsRes.rows;

    const eventsRes = await pgQuery(`
      SELECT * FROM content_studio_events WHERE slot_id = $1 AND tenant_id = $2 ORDER BY created_at DESC
    `, [id, tenantId]);
    slot.events = eventsRes.rows;

    // Enrich with live engine tracker data
    const { resolveLiveEngineState } = await import('@/lib/contentflow-studio-live-tracker');
    slot.live_engine = await resolveLiveEngineState(slot, tenantId);

    return NextResponse.json({ success: true, data: slot });
  } catch (error) {
    console.error('[Slot GET Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const PATCH = withTenantContext(async (request, context) => {
  try {
    const tenantId = getActiveTenantId() || 'default_tenant';
    const { id } = await context.params;
    const body = await request.json();

    const { scheduled_publish_at, scheduled_production_at, caption, notes } = body;

    let updateFields = [];
    let params = [id, tenantId];

    if (scheduled_publish_at) {
      params.push(new Date(scheduled_publish_at).toISOString());
      updateFields.push(`scheduled_publish_at = $${params.length}`);
    }
    if (scheduled_production_at) {
      params.push(new Date(scheduled_production_at).toISOString());
      updateFields.push(`scheduled_production_at = $${params.length}`);
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ success: false, error: 'Tidak ada perubahan yang dikirim.' }, { status: 400 });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');

    const query = `
      UPDATE content_studio_slots
      SET ${updateFields.join(', ')}
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `;

    const res = await pgQuery(query, params);
    return NextResponse.json({ success: true, data: res.rows[0] });
  } catch (error) {
    console.error('[Slot PATCH Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
