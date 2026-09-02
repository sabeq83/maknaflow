import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePlannerRowsAgainstEvidence } from '../lib/research-claim-validator.js';
import { classifyClaimRisk, isClaimAllowedByPolicy } from '../lib/research-evidence-policy.js';

test('Claim Risk Policy - Detects high, medium, and low risks accurately', () => {
  assert.equal(classifyClaimRisk('Sarapan praktis tinggi serat untuk energi'), 'low');
  assert.equal(classifyClaimRisk('Rahasia sarapan nomor 1 paling ampuh'), 'medium');
  assert.equal(classifyClaimRisk('Oat ini menyembuhkan diabetes dan maag 100%'), 'high');
  assert.equal(classifyClaimRisk('Garansi bebas penyakit selamanya'), 'high');
});

test('Claim Allowed Policy - Detects prohibited claims violation', () => {
  const prohibited = ['menyembuhkan maag', 'garansi turun 10kg'];
  const check1 = isClaimAllowedByPolicy('Sarapan sehat bebas gluten', { prohibitedClaims: prohibited });
  assert.equal(check1.allowed, true);

  const check2 = isClaimAllowedByPolicy('Oatmeal yang ampuh menyembuhkan maag kamu', { prohibitedClaims: prohibited });
  assert.equal(check2.allowed, false);
  assert.match(check2.reason, /prohibited claim/);
});

test('Planner Post-Generation Evidence Validator - Detects structure & prohibited claim drift', () => {
  const lockedDistribution = [
    { sequence: 1, pillar: 'Edukasi', category_cep: 'Problem-Solution Based', vfo: 'Concrete' }
  ];

  const evidenceAssignments = [
    {
      sequence: 1,
      risk_level: 'low',
      prohibited_claims: ['pasti sembuh']
    }
  ];

  const validRows = [
    {
      sequence: 1,
      pillar: 'Edukasi',
      category_cep: 'Problem-Solution Based',
      vfo: 'Concrete',
      hook: 'Sarapan oat hangat bikin fokus kerja terjaga',
      context: 'Pagi hari sebelum mulai rapat',
      strategic_angle: 'The Focus Hack',
      visual_action: 'Close-up tuang air panas ke mangkuk oat'
    }
  ];

  const result1 = validatePlannerRowsAgainstEvidence({
    rows: validRows,
    lockedDistribution,
    evidenceAssignments
  });

  assert.equal(result1.valid, true);
  assert.equal(result1.errors.length, 0);

  // Prohibited claim violation
  const violatingRows = [
    {
      ...validRows[0],
      hook: 'Makan oat ini dijamin pasti sembuh dari maag'
    }
  ];

  const result2 = validatePlannerRowsAgainstEvidence({
    rows: violatingRows,
    lockedDistribution,
    evidenceAssignments
  });

  assert.equal(result2.valid, false);
  assert.ok(result2.errors.some(e => e.type === 'PROHIBITED_CLAIM_VIOLATION'));
});
