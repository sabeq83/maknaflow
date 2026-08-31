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
        'SELECT * FROM agent_publishing_intents WHERE run_id=$1 AND id=$2 AND tenant_id=$3',
        [id, String(body.intent_id || ''), identity.tenantId]
      );
      const intent = intentRes.rows[0];
      if (!intent) {
        return NextResponse.json({ success: false, error: 'Publishing intent tidak ditemukan.' }, { status: 404 });
      }

      if (intent.payload_sha256 !== body.review_sha256) {
        return NextResponse.json({ success: false, error: 'Revision hash mismatch.' }, { status: 400 });
      }
      if (intent.approval_idempotency_key) {
        if (intent.approval_idempotency_key !== idempotencyKey) {
          return NextResponse.json({ success: false, error: 'Intent sudah disetujui dengan idempotency key berbeda.' }, { status: 409 });
        }
        return NextResponse.json({ success: true, reused: true, publishing_job_id: intent.publishing_job_id }, {
          headers: { 'Cache-Control': 'no-store' }
        });
      }
      if (intent.status !== 'pending') {
        return NextResponse.json({ success: false, error: `Intent tidak dapat disetujui pada status ${intent.status}.` }, { status: 409 });
      }

      const approved = await pgQuery(`UPDATE agent_publishing_intents
        SET status='approved',approved_by=$1,approved_at=CURRENT_TIMESTAMP,approval_idempotency_key=$2
        WHERE id=$3 AND tenant_id=$4 AND status='pending' RETURNING id`,
      [identity.actor, idempotencyKey, intent.id, identity.tenantId]);
      if (!approved.rowCount) return NextResponse.json({ success: false, error: 'Intent telah berubah; muat ulang review.' }, { status: 409 });

      const jobs = await dispatchPublishingIntent(intent.id);
      return NextResponse.json({ success: true, reused: false, jobs_dispatched: jobs.length }, {
        headers: { 'Cache-Control': 'no-store' }
      });
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: err.status || 500 });
  }
}
