import { NextResponse } from 'next/server';
import { authenticateOperator, runAsOperatorTenant } from '@/lib/operator-auth';
import { enqueueRunOnce } from '@/lib/content-run-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const identity = await authenticateOperator(request, 'automation:write');
    const idempotencyKey = request.headers.get('idempotency-key') || '';
    const body = await request.json();

    const result = await runAsOperatorTenant(identity, async () => {
      return await enqueueRunOnce(body, identity, idempotencyKey);
    });

    return NextResponse.json(
      result,
      { status: 202, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[Operator Content Runs POST Error]:', error);
    const status = error.status || 500;
    const isClientError = status < 500;
    return NextResponse.json(
      {
        success: false,
        code: error.code || 'RUN_ENQUEUE_FAILED',
        error: isClientError ? error.message : 'Gagal membuat run-once campaign.'
      },
      { status, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
