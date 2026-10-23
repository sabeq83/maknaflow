import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import { withPgTransaction } from '@/lib/db-pg';
export const POST = withTenantContext(async (request, context) => {
  try {
    const { id } = await context.params;
    const { action } = await request.json();
    const tenantId = getActiveTenantId();
    if (!['activate_slots','pause_batch'].includes(action)) return NextResponse.json({ success: false, error: 'Action tidak didukung.' }, { status: 400 });
    const count = await withPgTransaction(async client => {
      const batch = (await client.query('SELECT * FROM content_studio_batches WHERE id=$1 AND tenant_id=$2 FOR UPDATE', [id,tenantId])).rows[0];
      if (!batch) throw Object.assign(Error('Batch tidak ditemukan.'), { status:404 });
      if (!batch.engine_kind || (batch.config_version !== 2 && batch.config_version !== 3)) throw Object.assign(Error('Batch legacy membutuhkan review.'), { status:409 });
      if (action === 'pause_batch') { await client.query("UPDATE content_studio_batches SET status='paused' WHERE id=$1", [id]); return 0; }
      await client.query("UPDATE content_studio_batches SET status='active' WHERE id=$1", [id]);
      const res = await client.query("UPDATE content_studio_slots SET stage_status='pending',activation_status='active' WHERE batch_id=$1 AND tenant_id=$2 AND stage_status='draft' AND NOT legacy_requires_review", [id,tenantId]);
      return res.rowCount;
    });
    return NextResponse.json({ success:true, activated:count });
  } catch(e) { return NextResponse.json({ success:false,error:e.message }, { status:e.status || 500 }); }
});
