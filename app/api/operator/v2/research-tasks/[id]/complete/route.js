import { NextResponse } from 'next/server';
import { normalizeHermesResearchBrief, hashHermesResearchBrief } from '@/lib/hermes-research-contract';
import { completeResearchTask } from '@/lib/agent-automation-repository';
import { pgQuery } from '@/lib/db-pg';
import { tenantContext } from '@/lib/tenant-context';
import { verifyHermesCallbackToken } from '@/lib/hermes-callback-token';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
    const claims = verifyHermesCallbackToken(bearer, id);
    const idempotencyKey = request.headers.get('idempotency-key')?.trim();

    if (!idempotencyKey) {
      return NextResponse.json({ success: false, error: 'Idempotency-Key required' }, { status: 400 });
    }

    return await tenantContext.run(claims.tenant_id, async () => {
      const body = await request.json();
      const runRes = await pgQuery(
        'SELECT id, status, research_policy_json FROM agent_automation_runs WHERE research_task_id = $1 AND id = $2 AND tenant_id = $3',
        [id, claims.run_id, claims.tenant_id]
      );
      const run = runRes.rows[0];
      if (!run) {
        return NextResponse.json({ success: false, error: 'Run tidak ditemukan' }, { status: 404 });
      }
      const policy = typeof run.research_policy_json === 'string'
        ? JSON.parse(run.research_policy_json) : run.research_policy_json;
      const brief = normalizeHermesResearchBrief(body, policy);
      const sha256 = hashHermesResearchBrief(brief);

      const result = await completeResearchTask({ runId: run.id, idempotencyKey, brief, sha256 });
      return NextResponse.json({ success: true, reused: result.reused, research_sha256: sha256 }, {
        status: result.reused ? 200 : 202,
        headers: { 'Cache-Control': 'no-store' }
      });
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: err.status || 500 });
  }
}
