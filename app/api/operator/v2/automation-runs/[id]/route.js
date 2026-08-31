import { NextResponse } from 'next/server';
import { authenticateOperator, runAsOperatorTenant } from '@/lib/operator-auth';
import { getAgentRun } from '@/lib/agent-automation-repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const identity = await authenticateOperator(request, 'automation:read');

    return await runAsOperatorTenant(identity, async () => {
      const run = await getAgentRun(id);
      if (!run) {
        return NextResponse.json({ success: false, error: 'Automation run tidak ditemukan.' }, { status: 404 });
      }
      const { idempotency_key, research_callback_key, last_error_message, ...safeRun } = run;
      return NextResponse.json({
        success: true,
        run: { ...safeRun, has_error: Boolean(last_error_message) }
      }, { headers: { 'Cache-Control': 'no-store' } });
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: err.status || 500 });
  }
}
