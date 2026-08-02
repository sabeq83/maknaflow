import { NextResponse } from 'next/server';
import { authenticateOperator, runAsOperatorTenant } from '@/lib/operator-auth';
import { buildOperatorJobStatus } from '@/lib/operator-content-worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const identity = await authenticateOperator(request, 'content:read');
    const { jobId } = await params;
    return await runAsOperatorTenant(identity, async () => {
      const job = await buildOperatorJobStatus(jobId);
      if (!job) {
        return NextResponse.json({ success: false, code: 'OPERATOR_JOB_NOT_FOUND', error: 'Job tidak ditemukan.' }, { status: 404 });
      }
      const {
        request_json: _requestJson,
        request_hash: _requestHash,
        locked_at: _lockedAt,
        locked_by: _lockedBy,
        ...publicJob
      } = job;
      return NextResponse.json({ success: true, job: publicJob }, {
        headers: { 'Cache-Control': 'no-store, max-age=0' }
      });
    });
  } catch (error) {
    console.error('[Operator API] Get content job failed:', error.code || error.name, error.message);
    return NextResponse.json({
      success: false,
      code: error.code || 'OPERATOR_INTERNAL_ERROR',
      error: error.status && error.status < 500 ? error.message : 'Gagal membaca status job.'
    }, { status: error.status || 500 });
  }
}
