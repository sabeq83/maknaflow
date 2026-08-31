import { NextResponse } from 'next/server';
import { authenticateOperator, runAsOperatorTenant } from '@/lib/operator-auth';
import { dispatchPublishingIntent } from '@/lib/agent-publishing-service';
import { pgQuery } from '@/lib/db-pg';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const identity = await authenticateOperator(request, 'publishing:approve');
    const idempotencyKey = request.headers.get('idempotency-key')?.trim();

    if (!idempotencyKey) {
      return NextResponse.json({ success: false, error: 'Idempotency-Key required' }, { status: 400 });
    }

    return await runAsOperatorTenant(identity, async () => {
      const body = await request.json();
      const intentRes = await pgQuery(
        'SELECT id, payload_sha256 FROM agent_publishing_intents WHERE run_id = $1 AND tenant_id = $2 AND status = \'pending\'',
        [id, identity.tenantId]
      );
      const intent = intentRes.rows[0];
      if (!intent) {
        return NextResponse.json({ success: false, error: 'Intent pending tidak ditemukan.' }, { status: 404 });
      }

      if (intent.payload_sha256 !== body.review_sha256) {
        return NextResponse.json({ success: false, error: 'Revision hash mismatch.' }, { status: 400 });
      }

      await pgQuery(
        "UPDATE agent_publishing_intents SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP WHERE id = $2",
        [identity.actor, intent.id]
      );

      const jobs = await dispatchPublishingIntent(intent.id);
      return NextResponse.json({ success: true, jobs_dispatched: jobs.length });
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: err.status || 500 });
  }
}
