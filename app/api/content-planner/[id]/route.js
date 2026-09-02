import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { withTenantContext } from '@/lib/auth';

export const GET = withTenantContext(async (request, { params }, user) => {
  try {
    const { id } = await params;
    const db = getDb();
    const tenantId = user?.tenantId || 'default_tenant';

    const planner = await db.prepare('SELECT * FROM content_planners WHERE id = ?').get(id);
    if (!planner) {
      return NextResponse.json({ success: false, error: 'Planner tidak ditemukan.' }, { status: 404 });
    }

    const rows = await db.prepare('SELECT * FROM content_planner_rows WHERE planner_id = ? ORDER BY sequence ASC').all(id);

    let evidenceMap = new Map();
    try {
      const { listPlannerRowsEvidence } = await import('@/lib/content-planner-research-repository.js');
      const evidenceList = await listPlannerRowsEvidence({ tenantId, plannerId: id });
      for (const ev of evidenceList) {
        evidenceMap.set(ev.planner_row_id, {
          id: ev.id,
          angle_id: ev.angle_id,
          risk_level: ev.risk_level,
          evidence_status: ev.evidence_status,
          insight_ids: ev.insight_ids_json || [],
          source_ids: ev.source_ids_json || [],
          evidence_snapshot: ev.evidence_snapshot_json || {}
        });
      }
    } catch (evErr) {
      console.warn('[API /content-planner/[id]] Row evidence projection warning:', evErr.message);
    }

    const projectedRows = rows.map(r => ({
      ...r,
      evidence: evidenceMap.get(r.id) || null
    }));

    return NextResponse.json({
      success: true,
      planner: {
        ...planner,
        pillars: (() => { try { return JSON.parse(planner.pillars_json || '[]'); } catch (_) { return []; } })(),
        research: {
          revision_id: planner.research_revision_id || null,
          status: planner.research_status || 'none',
          query: planner.research_query || null,
          researched_at: planner.researched_at || null,
          source_policy: planner.research_source_policy || null,
          snapshot_sha256: planner.research_snapshot_sha256 ? planner.research_snapshot_sha256.substring(0, 12) : null
        },
        rows: projectedRows
      }
    });
  } catch (error) {
    console.error('[API /content-planner/[id] GET Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const DELETE = withTenantContext(async (request, { params }, user) => {
  try {
    const { id } = await params;
    const db = getDb();

    await db.prepare('DELETE FROM content_planners WHERE id = ?').run(id);

    return NextResponse.json({ success: true, message: 'Planner berhasil dihapus.' });
  } catch (error) {
    console.error('[API /content-planner/[id] DELETE Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
