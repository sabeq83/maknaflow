import { NextResponse } from 'next/server';
import { authenticateOperator, runAsOperatorTenant } from '@/lib/operator-auth';
import { normalizeHermesResearchBrief, hashHermesResearchBrief } from '@/lib/hermes-research-contract';
import { saveResearchRevision, transitionAgentRun, appendAgentRunEvent } from '@/lib/agent-automation-repository';
import { pgQuery } from '@/lib/db-pg';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const identity = await authenticateOperator(request, 'research:submit');
    const idempotencyKey = request.headers.get('idempotency-key')?.trim();

    if (!idempotencyKey) {
      return NextResponse.json({ success: false, error: 'Idempotency-Key required' }, { status: 400 });
    }

    return await runAsOperatorTenant(identity, async () => {
      const body = await request.json();
      const brief = normalizeHermesResearchBrief(body);
      const sha256 = hashHermesResearchBrief(brief);

      const runRes = await pgQuery(
        'SELECT id, status FROM agent_automation_runs WHERE (research_task_id = $1 OR id = $1) AND tenant_id = $2',
        [id, identity.tenantId]
      );
      const run = runRes.rows[0];
      if (!run) {
        return NextResponse.json({ success: false, error: 'Run tidak ditemukan' }, { status: 404 });
      }

      await saveResearchRevision(run.id, brief, sha256);
      const updated = await transitionAgentRun(run.id, 'researching', 'research_ready');

      if (updated) {
        await appendAgentRunEvent(run.id, 'research_completed', { sha256 });
      }

      return NextResponse.json({ success: true, reused: !updated }, { status: updated ? 202 : 200 });
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: err.status || 500 });
  }
}
