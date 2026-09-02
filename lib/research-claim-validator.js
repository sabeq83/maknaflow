import { validateLockedPlannerStructure } from './content-planner-contract.js';
import { isClaimAllowedByPolicy, classifyClaimRisk } from './research-evidence-policy.js';

/**
 * Validate generated planner rows against locked structure, evidence allocations, and policy.
 */
export function validatePlannerRowsAgainstEvidence({
  rows = [],
  lockedDistribution = [],
  evidenceAssignments = [],
  productSnapshot = null,
  prohibitedClaims = []
}) {
  const errors = [];

  // 1. Structure validation
  try {
    validateLockedPlannerStructure(rows, lockedDistribution);
  } catch (structErr) {
    errors.push({ type: 'STRUCTURE_DRIFT', message: structErr.message });
  }

  // 2. Row count & evidence length alignment
  if (rows.length !== evidenceAssignments.length) {
    errors.push({
      type: 'EVIDENCE_COUNT_MISMATCH',
      message: `Jumlah baris (${rows.length}) tidak sesuai dengan alokasi evidence (${evidenceAssignments.length}).`
    });
  }

  // 3. Per-row claim, prohibited term, and risk checks
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const evidence = evidenceAssignments[i] || {};
    const seq = row.sequence || (i + 1);

    const combinedText = `${row.hook || ''} ${row.context || ''} ${row.strategic_angle || ''} ${row.visual_action || ''}`;

    // Prohibited claims check
    const policyResult = isClaimAllowedByPolicy(combinedText, {
      prohibitedClaims: [
        ...(prohibitedClaims || []),
        ...(evidence.prohibited_claims || [])
      ]
    });

    if (!policyResult.allowed) {
      errors.push({
        type: 'PROHIBITED_CLAIM_VIOLATION',
        sequence: seq,
        message: `Baris ke-${seq}: ${policyResult.reason}`,
        violatingTerm: policyResult.prohibitedTerm
      });
    }

    // High risk detection without medical/scientific evidence
    const detectedRisk = classifyClaimRisk(combinedText);
    if (detectedRisk === 'high' && evidence.risk_level !== 'high') {
      errors.push({
        type: 'UNSUPPORTED_HIGH_RISK_CLAIM',
        sequence: seq,
        message: `Baris ke-${seq} menghasilkan klaim berisiko tinggi tanpa dasar evidence yang memadai.`
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
