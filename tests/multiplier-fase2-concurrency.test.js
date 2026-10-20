import test from 'node:test';
import assert from 'node:assert';
import { 
  getEligibleFase1MultiplierTasks, 
  getEligibleFase2MultiplierTasks,
  getEligibleSequentialMultiplierTasks
} from '../lib/db.js';

test('Multiplier Lab - Fase 1 & Fase 2 Queue Architecture', async (t) => {
  await t.test('Fungsi query antrean Fase 1 dan Fase 2 terdefinisi', () => {
    assert.strictEqual(typeof getEligibleFase1MultiplierTasks, 'function');
    assert.strictEqual(typeof getEligibleFase2MultiplierTasks, 'function');
    assert.strictEqual(typeof getEligibleSequentialMultiplierTasks, 'function');
  });

  await t.test('Worker processSingleMultiplierTask terdefinisi dan siap pakai', async () => {
    const { processSingleMultiplierTask, processNextMultiplierTask } = await import('../lib/re-multiplier-worker.js');
    assert.strictEqual(typeof processSingleMultiplierTask, 'function');
    assert.strictEqual(typeof processNextMultiplierTask, 'function');
  });

  setTimeout(() => process.exit(0), 100);
});
