import { NextResponse } from 'next/server';
import { authenticateOperator, runAsOperatorTenant } from '@/lib/operator-auth';
import { pgQuery } from '@/lib/db-pg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const identity = await authenticateOperator(request, 'research:read');

    return await runAsOperatorTenant(identity, async () => {
      const task = await pgQuery(
        `SELECT r.id,r.research_task_id,r.status,r.research_policy_json,r.created_at,
          s.operator_request_json #> '{planner}' AS planner
         FROM agent_automation_runs r JOIN content_automation_schedules s ON s.id=r.schedule_id
         WHERE r.research_task_id=$1 AND r.tenant_id=$2`,
        [id, identity.tenantId]
      );
      if (!task.rowCount) {
        return NextResponse.json({ success: false, error: 'Task tidak ditemukan.' }, { status: 404 });
      }
      return NextResponse.json({ success: true, task: task.rows[0] }, {
        headers: { 'Cache-Control': 'no-store' }
      });
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: err.status || 500 });
  }
}
