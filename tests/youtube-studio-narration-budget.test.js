import test from 'node:test';
import assert from 'node:assert/strict';
import { getNarrationProfile, calculateNarrationBudget, allocateSceneBudgets } from '../lib/youtube-studio-narration-profiles.js';

test('getNarrationProfile returns requested profile or general_id fallback', () => {
  const kids = getNarrationProfile('kids_educational_id');
  assert.equal(kids.targetWpm, 102);

  const unknown = getNarrationProfile('non_existent');
  assert.equal(unknown.targetWpm, 130);
});

test('calculateNarrationBudget calculates target word budgets', () => {
  const budget = calculateNarrationBudget({ targetSeconds: 300, profile: 'kids_educational_id' });
  // narratedSeconds = 300 * 0.8 = 240
  // idealWords = 240 * 102 / 60 = 408
  assert.equal(budget.ideal, 408);
  assert.equal(budget.min, 367);
  assert.equal(budget.max, 449);
});

test('allocateSceneBudgets allocates words proportionally', () => {
  const budget = { min: 367, ideal: 408, max: 449 };
  const scenes = [
    { estimated_duration_seconds: 100 },
    { estimated_duration_seconds: 200 }
  ];
  const allocations = allocateSceneBudgets({ scenes, budget, profile: 'kids_educational_id' });
  
  assert.equal(allocations.length, 2);
  assert.equal(allocations[0].ideal, 136); // 100 / 300 * 408 = 136
  assert.equal(allocations[1].ideal, 272); // 200 / 300 * 408 = 272
});
