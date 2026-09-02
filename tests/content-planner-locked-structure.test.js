import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeGeneratedPlannerRows,
  validateLockedPlannerStructure,
  buildDistributionPlan
} from '../lib/content-planner-contract.js';

test('Locked Structure - normalizeGeneratedPlannerRows preserves locked fields and prevents LLM drift', () => {
  const lockedDistribution = [
    { sequence: 1, pillar: 'Edukasi & Problem Solving', category_cep: 'Problem-Solution Based', vfo: 'Concrete (Fakta & Produk Langsung)', product: 'Rolled Oat Gluten Free' },
    { sequence: 2, pillar: 'Routine & Habit Building', category_cep: 'Routine Based', vfo: 'Instinctive (Emosi & Sensorik Visual)', product: 'Rolled Oat Gluten Free' }
  ];

  // LLM tries to overwrite pillar and category_cep with unauthorized values
  const untrustedGeneratedOutput = [
    {
      sequence: 999, // drift attempt
      pillar: 'HACKED PILLAR',
      category_cep: 'HACKED CEP',
      vfo: 'HACKED VFO',
      product: 'FAKE PRODUCT',
      hook: 'Sarapan oat enak bebas gluten',
      visual_action: 'Close-up tuang susu hangat ke mangkuk oat'
    },
    {
      hook: 'Rutinitas pagi praktis',
      visual_action: 'Pagi hari menyiapkan oat jar'
    }
  ];

  const normalized = normalizeGeneratedPlannerRows(untrustedGeneratedOutput, lockedDistribution, 2);

  assert.equal(normalized.length, 2);
  // Row 1 checks
  assert.equal(normalized[0].sequence, 1);
  assert.equal(normalized[0].pillar, 'Edukasi & Problem Solving');
  assert.equal(normalized[0].category_cep, 'Problem-Solution Based');
  assert.equal(normalized[0].vfo, 'Concrete (Fakta & Produk Langsung)');
  assert.equal(normalized[0].product, 'Rolled Oat Gluten Free');
  assert.equal(normalized[0].hook, 'Sarapan oat enak bebas gluten');
  assert.equal(normalized[0].visual_action, 'Close-up tuang susu hangat ke mangkuk oat');

  // Row 2 checks
  assert.equal(normalized[1].sequence, 2);
  assert.equal(normalized[1].pillar, 'Routine & Habit Building');
  assert.equal(normalized[1].category_cep, 'Routine Based');
  assert.equal(normalized[1].vfo, 'Instinctive (Emosi & Sensorik Visual)');
  assert.equal(normalized[1].hook, 'Rutinitas pagi praktis');
});

test('Locked Structure - validateLockedPlannerStructure passes on valid structure and throws on drift', () => {
  const distribution = buildDistributionPlan(6, ['Pilar A', 'Pilar B'], 0, 'test-seed');
  assert.equal(distribution.length, 6);

  const validRows = distribution.map(d => ({
    ...d,
    hook: 'Test Hook',
    visual_action: 'Test Visual'
  }));

  assert.doesNotThrow(() => {
    validateLockedPlannerStructure(validRows, distribution);
  });

  // Length mismatch
  assert.throws(() => {
    validateLockedPlannerStructure(validRows.slice(0, 5), distribution);
  }, /tidak sesuai dengan locked distribution/);

  // Altered sequence
  const invalidSequence = validRows.map((r, i) => i === 0 ? { ...r, sequence: 99 } : r);
  assert.throws(() => {
    validateLockedPlannerStructure(invalidSequence, distribution);
  }, /Sequence baris/);

  // Altered pillar
  const invalidPillar = validRows.map((r, i) => i === 1 ? { ...r, pillar: 'Altered Pilar' } : r);
  assert.throws(() => {
    validateLockedPlannerStructure(invalidPillar, distribution);
  }, /tidak sesuai dengan locked structure/);
});
