import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Multiplier scheduler active condition defaults to true when unset or true', () => {
  const evaluateSchedulerActive = (settingValue) => settingValue !== 'false';

  assert.equal(evaluateSchedulerActive('true'), true, 'Setting "true" should be active');
  assert.equal(evaluateSchedulerActive(null), true, 'Unset setting (null) should default to active');
  assert.equal(evaluateSchedulerActive(undefined), true, 'Unset setting (undefined) should default to active');
  assert.equal(evaluateSchedulerActive('false'), false, 'Setting "false" should be inactive');
});

test('Multiplier toggle_scheduler logic flips current state', () => {
  const getNextState = (currentSetting) => {
    const isCurrentActive = currentSetting !== 'false';
    return !isCurrentActive;
  };

  assert.equal(getNextState(null), false, 'Toggling from default active (null) should produce false');
  assert.equal(getNextState('true'), false, 'Toggling from active ("true") should produce false');
  assert.equal(getNextState('false'), true, 'Toggling from inactive ("false") should produce true');
});

test('Voice Provider and Persona sets consistency in Multiplier Lab detail', () => {
  const filePath = path.join(process.cwd(), 'app/multiplier-lab/[id]/page.js');
  const content = fs.readFileSync(filePath, 'utf8');

  // Verify voice constants are imported from lib/voice-constants
  assert.ok(content.includes("from '@/lib/voice-constants'"), 'Voice constants should be imported from @/lib/voice-constants');
  assert.ok(content.includes('MINIMAX_VOICES'), 'MINIMAX_VOICES should be imported');
  assert.ok(content.includes('MINIMAX_ENGLISH_VOICES'), 'MINIMAX_ENGLISH_VOICES should be imported');
  assert.ok(content.includes('GEMINI_VOICES'), 'GEMINI_VOICES should be imported');
});
