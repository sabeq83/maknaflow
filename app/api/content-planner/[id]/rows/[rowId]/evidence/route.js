import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getPlannerRowEvidence } from '@/lib/content-planner-research-repository.js';

export const GET = withTenantContext(async (request, { params }, user) => {
  try {
    const { id: plannerId, rowId } = await params;
    const tenantId = user?.tenantId || 'default_tenant';

    const evidence = await getPlannerRowEvidence({ tenantId, plannerId, rowId });
    if (!evidence) {
      return NextResponse.json({ success: false, error: 'Evidence untuk baris ini tidak ditemukan.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      evidence: {
        id: evidence.id,
        planner_id: evidence.planner_id,
        planner_row_id: evidence.planner_row_id,
        research_revision_id: evidence.research_revision_id,
        angle_id: evidence.angle_id,
        insight_ids: evidence.insight_ids_json || [],
        source_ids: evidence.source_ids_json || [],
        product_fact_ids: evidence.product_fact_ids_json || [],
        risk_level: evidence.risk_level,
        evidence_status: evidence.evidence_status,
        evidence_snapshot: evidence.evidence_snapshot_json,
        evidence_sha256: evidence.evidence_sha256 ? evidence.evidence_sha256.substring(0, 16) : null,
        updated_at: evidence.updated_at
      }
    });
  } catch (error) {
    console.error('[API /content-planner/[id]/rows/[rowId]/evidence GET Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
