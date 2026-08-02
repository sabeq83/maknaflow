import { NextResponse } from 'next/server';
import { authenticateOperator, runAsOperatorTenant } from '@/lib/operator-auth';
import { hashOperatorRequest, normalizeOperatorContentRequest } from '@/lib/operator-content-contract';
import { appendOperatorJobEvent, createOperatorJob } from '@/lib/db';

export const runtime = 'nodejs';

function errorResponse(error) {
  return NextResponse.json({
    success: false,
    code: error.code || 'OPERATOR_INTERNAL_ERROR',
    error: error.status && error.status < 500 ? error.message : 'Operator API gagal memproses permintaan.'
  }, { status: error.status || 500 });
}

export async function POST(request) {
  try {
    const identity = await authenticateOperator(request, 'content:create');
    const idempotencyKey = request.headers.get('idempotency-key')?.trim();
    if (!idempotencyKey || idempotencyKey.length > 128) {
      return NextResponse.json({
        success: false,
        code: 'OPERATOR_IDEMPOTENCY_KEY_REQUIRED',
        error: 'Idempotency-Key wajib diisi dan maksimum 128 karakter.'
      }, { status: 400 });
    }
    return await runAsOperatorTenant(identity, async () => {
      const payload = normalizeOperatorContentRequest(await request.json());
      const requestHash = hashOperatorRequest(payload);
      const job = await createOperatorJob({
        idempotencyKey,
        requestHash,
        requestJson: JSON.stringify(payload)
      });
      if (!job) throw new Error('Gagal membaca job setelah idempotent insert.');
      if (!job.created && job.request_hash !== requestHash) {
        return NextResponse.json({
          success: false,
          code: 'OPERATOR_IDEMPOTENCY_CONFLICT',
          error: 'Idempotency-Key sudah dipakai untuk payload yang berbeda.'
        }, { status: 409 });
      }
      if (job.created) {
        await appendOperatorJobEvent(job.id, 'job_created', { actor: identity.actor });
      }
      return NextResponse.json({
        success: true,
        job_id: job.id,
        status: job.status,
        reused: !job.created,
        status_url: `/api/operator/v1/content-jobs/${job.id}`
      }, {
        status: job.created ? 202 : 200,
        headers: { 'Cache-Control': 'no-store' }
      });
    });
  } catch (error) {
    console.error('[Operator API] Create content job failed:', error.code || error.name, error.message);
    return errorResponse(error);
  }
}
