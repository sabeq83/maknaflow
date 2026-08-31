import { NextResponse } from 'next/server';
import { transitionAgentRun, appendAgentRunEvent } from '@/lib/agent-automation-repository';
import { pgQuery } from '@/lib/db-pg';
import { tenantContext } from '@/lib/tenant-context';
import { verifyHermesCallbackToken } from '@/lib/hermes-callback-token';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
    const claims = verifyHermesCallbackToken(bearer, id);

    return await tenantContext.run(claims.tenant_id, async () => {
      const body = await request.json();
      const runRes = await pgQuery(
        'SELECT id FROM agent_automation_runs WHERE research_task_id = $1 AND id = $2 AND tenant_id = $3',
        [id, claims.run_id, claims.tenant_id]
      );
      const run = runRes.rows[0];
      if (!run) {
        return NextResponse.json({ success: false, error: 'Run tidak ditemukan' }, { status: 404 });
      }

      const failureClass = ['transient','permanent','policy_blocked'].includes(body.failure_class)
        ? body.failure_class : 'permanent';
      const updated = await transitionAgentRun(run.id, 'researching', 'research_failed', {
        last_error_code: String(body.code || 'HERMES_RESEARCH_FAILED').slice(0, 100),
        last_error_message: String(body.message || 'Hermes research gagal.').slice(0, 500)
      });
      if (updated) await appendAgentRunEvent(run.id, 'research_failed_callback', {
        failure_class: failureClass,
        code: String(body.code || '').slice(0, 100)
      });

      return NextResponse.json({ success: true, reused: !updated }, {
        headers: { 'Cache-Control': 'no-store' }
      });
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: err.status || 500 });
  }
}
