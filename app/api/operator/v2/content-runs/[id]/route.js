import { NextResponse } from 'next/server';
import { authenticateOperator, runAsOperatorTenant } from '@/lib/operator-auth';
import { buildBoundedContentRunStatus } from '@/lib/content-run-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const identity = await authenticateOperator(request, 'automation:read');
    const { id } = await params;

    const result = await runAsOperatorTenant(identity, async () => {
      return await buildBoundedContentRunStatus(id, identity.tenantId);
    });

    return NextResponse.json(
      result,
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[Operator Content Runs GET Error]:', error);
    const status = error.status || 500;
    const isClientError = status < 500;
    return NextResponse.json(
      {
        success: false,
        code: error.code || 'RUN_FETCH_FAILED',
        error: isClientError ? error.message : 'Gagal membaca status run.'
      },
      { status, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
