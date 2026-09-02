import crypto from 'crypto';

/**
 * Deterministic Research-to-Planner Adapter
 * Allocates research evidence, recommended angles, sources, and prohibited claims
 * across N locked planner distribution rows without mutating structure fields.
 */
export function allocateResearchEvidence({
  planner = {},
  lockedDistribution = [],
  researchRevision = null,
  productSnapshot = null,
  plannerHistory = null
}) {
  const expectedCount = Array.isArray(lockedDistribution) ? lockedDistribution.length : 0;
  if (expectedCount === 0) {
    throw new Error('lockedDistribution wajib memiliki minimal 1 baris.');
  }

  let brief = null;
  let revisionId = 'rev_none';
  let revisionSha256 = '';

  if (researchRevision) {
    if (typeof researchRevision === 'object') {
      revisionId = researchRevision.id || researchRevision.revisionId || 'rev_unknown';
      revisionSha256 = researchRevision.payload_sha256 || researchRevision.snapshotSha256 || '';
      brief = researchRevision.payload_json || researchRevision.brief || researchRevision;
    }
  }

  const query = brief?.query || '';
  const summary = brief?.summary || '';
  const sources = Array.isArray(brief?.sources) ? brief.sources : [];
  const insights = Array.isArray(brief?.insights) ? brief.insights : [];
  const angles = Array.isArray(brief?.recommended_angles) ? brief.recommended_angles : [];
  const prohibitedClaims = Array.isArray(brief?.prohibited_claims) ? brief.prohibited_claims : [];
  const limitations = Array.isArray(brief?.limitations) ? brief.limitations : [];

  if (!revisionSha256 && brief) {
    revisionSha256 = crypto.createHash('sha256').update(JSON.stringify(brief)).digest('hex');
  }

  const sourceMap = new Map();
  for (const s of sources) {
    if (s.id) sourceMap.set(String(s.id), s);
  }

  const rowAssignments = [];

  for (let i = 0; i < expectedCount; i++) {
    const lockedRow = lockedDistribution[i];
    const sequence = lockedRow.sequence || (i + 1);

    // Deterministic angle selection (round-robin if count > angles.length)
    let assignedAngle = null;
    let angleId = null;
    let rowRiskLevel = 'low';
    let rowSourceIds = [];
    let rowInsightIds = [];

    if (angles.length > 0) {
      const angleIndex = i % angles.length;
      assignedAngle = angles[angleIndex];
      angleId = assignedAngle.id || `angle_${angleIndex + 1}`;
      rowRiskLevel = (assignedAngle.risk_level || 'low').toLowerCase();
      if (Array.isArray(assignedAngle.source_ids)) {
        rowSourceIds.push(...assignedAngle.source_ids.map(String));
      }
    }

    // Map insights matching angle sources or by round-robin
    if (insights.length > 0) {
      const matchingInsights = insights.filter(ins => {
        const insSources = Array.isArray(ins.source_ids) ? ins.source_ids.map(String) : [];
        return insSources.some(sId => rowSourceIds.includes(sId));
      });

      if (matchingInsights.length > 0) {
        rowInsightIds = matchingInsights.map((_, idx) => `insight_${idx + 1}`);
      } else {
        const insIndex = i % insights.length;
        rowInsightIds = [`insight_${insIndex + 1}`];
        if (Array.isArray(insights[insIndex].source_ids)) {
          rowSourceIds.push(...insights[insIndex].source_ids.map(String));
        }
      }
    }

    // Deduplicate source IDs
    rowSourceIds = Array.from(new Set(rowSourceIds));

    // Resolve source metadata snapshot
    const rowSourcesSnapshot = rowSourceIds.map(sId => {
      const s = sourceMap.get(sId);
      return s ? {
        id: s.id,
        url: s.url,
        title: s.title || '',
        publisher: s.publisher || '',
        verification_status: s.verification_status || 'verified'
      } : { id: sId, url: '', title: '', verification_status: 'unverified' };
    });

    const evidenceSnapshot = {
      sequence,
      pillar: lockedRow.pillar,
      category_cep: lockedRow.category_cep,
      vfo: lockedRow.vfo,
      angle: assignedAngle ? {
        id: angleId,
        title: assignedAngle.title,
        reason: assignedAngle.reason || '',
        risk_level: rowRiskLevel
      } : null,
      sources: rowSourcesSnapshot,
      prohibited_claims: prohibitedClaims,
      limitations: limitations
    };

    const evidenceSha256 = crypto.createHash('sha256')
      .update(JSON.stringify(evidenceSnapshot))
      .digest('hex');

    rowAssignments.push({
      sequence,
      angle_id: angleId,
      insight_ids: rowInsightIds,
      source_ids: rowSourceIds,
      product_fact_ids: [],
      prohibited_claims: prohibitedClaims,
      limitations: limitations,
      risk_level: rowRiskLevel,
      evidence_snapshot: evidenceSnapshot,
      evidence_sha256: evidenceSha256
    });
  }

  return {
    researchRevisionId: revisionId,
    researchSha256: revisionSha256,
    plannerEvidenceSummary: {
      query,
      summary,
      totalSources: sources.length,
      totalInsights: insights.length,
      totalAngles: angles.length,
      prohibitedClaims,
      limitations
    },
    rowAssignments
  };
}
