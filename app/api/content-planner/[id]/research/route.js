import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getPlannerResearchContext, listPlannerRowsEvidence } from '@/lib/content-planner-research-repository.js';
import { pgQuery } from '@/lib/db-pg.js';

export const GET = withTenantContext(async (request, { params }, user) => {
  try {
    const { id: plannerId } = await params;
    const tenantId = user?.tenantId || 'default_tenant';

    const context = await getPlannerResearchContext({ tenantId, plannerId });
    if (!context) {
      return NextResponse.json({ success: false, error: 'Planner tidak ditemukan.' }, { status: 404 });
    }

    let brief = null;
    if (context.research_revision_id && context.research_revision_id !== 'rev_none') {
      const revRes = await pgQuery(`
        SELECT payload_json, payload_sha256, created_at
        FROM agent_research_revisions
        WHERE id = $1 AND tenant_id = $2
        LIMIT 1
      `, [context.research_revision_id, tenantId]);

      if (revRes.rowCount > 0) {
        brief = typeof revRes.rows[0].payload_json === 'string'
          ? JSON.parse(revRes.rows[0].payload_json)
          : revRes.rows[0].payload_json;
      }
    }

    const rowEvidenceList = await listPlannerRowsEvidence({ tenantId, plannerId });

    return NextResponse.json({
      success: true,
      planner_id: plannerId,
      research_context: {
        revision_id: context.research_revision_id,
        status: context.research_status || 'none',
        query: context.research_query,
        researched_at: context.researched_at,
        source_policy: context.research_source_policy,
        snapshot_sha256: context.research_snapshot_sha256 ? context.research_snapshot_sha256.substring(0, 16) : null
      },
      brief: brief ? {
        query: brief.query,
        summary: brief.summary,
        sources: (brief.sources || []).map(s => ({
          id: s.id,
          url: s.url,
          title: s.title,
          publisher: s.publisher,
          verification_status: s.verification_status || 'verified',
          authority_class: s.authority_class || 'unknown'
        })),
        insights: brief.insights || [],
        recommended_angles: brief.recommended_angles || [],
        prohibited_claims: brief.prohibited_claims || [],
        limitations: brief.limitations || []
      } : null,
      evidence_rows_count: rowEvidenceList.length
    });
  } catch (error) {
    console.error('[API /content-planner/[id]/research GET Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
