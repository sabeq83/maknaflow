import { NextResponse } from 'next/server';
import { authenticateOperator, runAsOperatorTenant } from '@/lib/operator-auth';
import { transitionAgentRun, appendAgentRunEvent } from '@/lib/agent-automation-repository';
import { pgQuery } from '@/lib/db-pg';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const identity = await authenticateOperator(request, 'research:submit');

    return await runAsOperatorTenant(identity, async () => {
      const body = await request.json();
      const runRes = await pgQuery(
        'SELECT id FROM agent_automation_runs WHERE (research_task_id = $1 OR id = $1) AND tenant_id = $2',
        [id, identity.tenantId]
      );
      const run = runRes.rows[0];
      if (!run) {
        return NextResponse.json({ success: false, error: 'Run tidak ditemukan' }, { status: 404 });
      }

      await transitionAgentRun(run.id, 'researching', 'research_failed');
      await appendAgentRunEvent(run.id, 'research_failed_callback', {
        failure_class: body.failure_class,
        code: body.code,
        message: body.message
      });

      return NextResponse.json({ success: true });
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: err.status || 500 });
  }
}
