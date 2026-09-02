import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateResearchEvidence } from '../lib/research-to-planner-adapter.js';

test('Research-to-Planner Adapter - Deterministic allocation across N rows', () => {
  const lockedDistribution = [
    { sequence: 1, pillar: 'Edukasi & Problem Solving', category_cep: 'Problem-Solution Based', vfo: 'Concrete' },
    { sequence: 2, pillar: 'Routine & Habit Building', category_cep: 'Routine Based', vfo: 'Instinctive' },
    { sequence: 3, pillar: 'Review & Honest Comparison', category_cep: 'Emotional Based', vfo: 'Uncharted' },
    { sequence: 4, pillar: 'Behind the Scene & Lifestyle', category_cep: 'Aspirational Based', vfo: 'Aspirational' },
    { sequence: 5, pillar: 'Edukasi & Problem Solving', category_cep: 'Commitment Based', vfo: 'Concrete' },
    { sequence: 6, pillar: 'Routine & Habit Building', category_cep: 'Opportunistic Based', vfo: 'Instinctive' }
  ];

  const mockBrief = {
    schema_version: '1',
    query: 'Kebaikan oatmeal gluten free untuk diet sehat',
    summary: 'Riset membuktikan beta-glukan pada oat membantu menjaga kadar gula darah dan kenyang lebih lama.',
    sources: [
      { id: 'src_1', url: 'https://healthline.com/nutrition/oatmeal-benefits', title: 'Oatmeal Benefits', publisher: 'Healthline' },
      { id: 'src_2', url: 'https://who.int/diet/nutrition', title: 'Healthy Diet', publisher: 'WHO' }
    ],
    insights: [
      { claim: 'Tinggi serat beta-glukan untuk kestabilan energi', confidence: 0.95, source_ids: ['src_1'] },
      { claim: 'Bebas gluten cocok untuk pencernaan sensitif', confidence: 0.9, source_ids: ['src_1', 'src_2'] }
    ],
    recommended_angles: [
      { id: 'angle_1', title: 'The Energy Stability Hack', reason: 'Fokus pada kenyang lebih lama', risk_level: 'low', source_ids: ['src_1'] },
      { id: 'angle_2', title: 'The Digestion Contrast', reason: 'Fokus pada bebas kembung gluten free', risk_level: 'medium', source_ids: ['src_2'] }
    ],
    prohibited_claims: ['Menyembuhkan maag 100%', 'Garansi turun berat badan 10kg seminggu'],
    limitations: ['Hanya untuk edukasi gaya hidup sehat, bukan pengganti obat resep']
  };

  const result = allocateResearchEvidence({
    planner: { id: 'cp_123', product_name: 'Pagibaik Rolled Oat' },
    lockedDistribution,
    researchRevision: {
      id: 'arev_456',
      payload_json: mockBrief,
      payload_sha256: 'sha256_mock_abc'
    }
  });

  assert.equal(result.researchRevisionId, 'arev_456');
  assert.equal(result.researchSha256, 'sha256_mock_abc');
  assert.equal(result.rowAssignments.length, 6);

  // Check deterministic distribution
  assert.equal(result.rowAssignments[0].sequence, 1);
  assert.equal(result.rowAssignments[0].angle_id, 'angle_1');
  assert.equal(result.rowAssignments[0].risk_level, 'low');
  assert.deepEqual(result.rowAssignments[0].source_ids, ['src_1']);
  assert.deepEqual(result.rowAssignments[0].prohibited_claims, mockBrief.prohibited_claims);

  assert.equal(result.rowAssignments[1].sequence, 2);
  assert.equal(result.rowAssignments[1].angle_id, 'angle_2');
  assert.equal(result.rowAssignments[1].risk_level, 'medium');
  assert.deepEqual(result.rowAssignments[1].source_ids, ['src_2']);

  // Round-robin reuse on row 3
  assert.equal(result.rowAssignments[2].sequence, 3);
  assert.equal(result.rowAssignments[2].angle_id, 'angle_1');

  // SHA256 integrity
  assert.ok(result.rowAssignments[0].evidence_sha256);
  assert.equal(result.rowAssignments[0].evidence_sha256.length, 64);
});
