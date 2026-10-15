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

  // Verify GEMINI_VOICES contains 14 characters
  assert.ok(content.includes('const GEMINI_VOICES = ['), 'GEMINI_VOICES should be defined');
  const geminiExpected = ['Kore', 'Fenrir', 'Puck', 'Charon', 'Leda', 'Zephyr', 'Orus', 'Aoede', 'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Despina'];
  for (const voice of geminiExpected) {
    assert.ok(content.includes(`id: '${voice}'`), `Gemini voice ${voice} should be in app/multiplier-lab/[id]/page.js`);
  }

  // Verify MINIMAX_VOICES contains 7 characters
  assert.ok(content.includes('const MINIMAX_VOICES = ['), 'MINIMAX_VOICES should be defined');
  const minimaxExpected = [
    'Indonesian_casual_reporter_vv2',
    'Indonesian_compelling_storyteller_vv2',
    'Indonesian_expressive_podcaster_vv2',
    'Indonesian_energetic_streamer_vv2',
    'Indonesian_intellectual_commentator_vv2',
    'Indonesian_professional_anchor_vv2',
    'Indonesian_crisp_reporter_vv2'
  ];
  for (const voice of minimaxExpected) {
    assert.ok(content.includes(`id: '${voice}'`), `MiniMax voice ${voice} should be in app/multiplier-lab/[id]/page.js`);
  }

  // Verify MINIMAX_ENGLISH_VOICES contains 10 characters
  assert.ok(content.includes('const MINIMAX_ENGLISH_VOICES = ['), 'MINIMAX_ENGLISH_VOICES should be defined');
  assert.ok(content.includes("id: 'English_Resonant_Man'"), 'English_Resonant_Man should be present');
});
