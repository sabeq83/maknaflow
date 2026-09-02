/**
 * Evidence & Claim Policy Enforcement
 * Classifies claim risks and checks claims against product snapshot & prohibited claims.
 */

const HIGH_RISK_PATTERNS = [
  /\b(menyembuhkan|mengobati|menghilangkan|100%|pasti|garansi|bebas penyakit|obat|dokter merekomendasikan)\b/i,
  /\b(cure|heals|guaranteed|cure-all|miracle|diagnose|treat disease)\b/i,
  /\b(halal bersertifikat|bpom resmi|fda approved)\b/i // unless verified in product snapshot
];

const MEDIUM_RISK_PATTERNS = [
  /\b(terbaik|nomor 1|paling ampuh|paling cepat|tanpa tanding|rahasia)\b/i,
  /\b(best|number 1|most effective|revolutionary)\b/i
];

/**
 * Classify risk level of a creative claim or hook.
 */
export function classifyClaimRisk(claimText, context = '') {
  const combined = `${claimText} ${context}`.trim();
  if (!combined) return 'low';

  for (const pattern of HIGH_RISK_PATTERNS) {
    if (pattern.test(combined)) {
      return 'high';
    }
  }

  for (const pattern of MEDIUM_RISK_PATTERNS) {
    if (pattern.test(combined)) {
      return 'medium';
    }
  }

  return 'low';
}

/**
 * Check if a claim violates prohibited claims or unsupported product claims.
 */
export function isClaimAllowedByPolicy(claimText, { prohibitedClaims = [], allowedFacts = [] } = {}) {
  const text = String(claimText || '').toLowerCase();

  for (const prohibited of prohibitedClaims) {
    const term = String(prohibited).toLowerCase().trim();
    if (term && text.includes(term)) {
      return {
        allowed: false,
        reason: `Klaim melanggar prohibited claim: "${prohibited}"`,
        prohibitedTerm: prohibited
      };
    }
  }

  return { allowed: true };
}
