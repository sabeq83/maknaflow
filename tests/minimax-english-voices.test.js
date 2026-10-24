import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OFFICIAL_MINIMAX_ENGLISH_VOICES,
  MINIMAX_ENGLISH_VOICES,
  MINIMAX_VOICES,
  GEMINI_VOICES,
  LEGACY_MINIMAX_ENGLISH_VOICE_ALIASES,
  getAvailableVoices
} from '../lib/voice-constants.js';
import {
  AVAILABLE_MINIMAX_VOICES_EN,
  FRIENDLY_TO_MINIMAX_MAP,
  resolveMinimaxVoice
} from '../lib/minimax-tts.js';

test('OFFICIAL_MINIMAX_ENGLISH_VOICES has exactly 38 official voices without duplicates', () => {
  assert.equal(OFFICIAL_MINIMAX_ENGLISH_VOICES.length, 38, 'Should have 38 official English voices');

  const ids = new Set();
  const femaleVoices = [];
  const maleVoices = [];

  for (const voice of OFFICIAL_MINIMAX_ENGLISH_VOICES) {
    assert.ok(voice.id, 'Voice must have an id');
    assert.ok(voice.name, `Voice ${voice.id} must have a name`);
    assert.ok(voice.gender === 'Female' || voice.gender === 'Male', `Voice ${voice.id} must be Female or Male`);
    assert.ok(!ids.has(voice.id), `Voice id ${voice.id} must not be duplicated`);
    ids.add(voice.id);

    if (voice.gender === 'Female') femaleVoices.push(voice);
    if (voice.gender === 'Male') maleVoices.push(voice);
  }

  assert.equal(femaleVoices.length, 19, 'Should have exactly 19 female voices');
  assert.equal(maleVoices.length, 19, 'Should have exactly 19 male voices');
});

test('MINIMAX_ENGLISH_VOICES contains 38 official voices plus 6 legacy fallback entries', () => {
  assert.equal(MINIMAX_ENGLISH_VOICES.length, 44, 'Should have 38 official + 6 legacy = 44 total voices for UI dropdown');
});

test('All 38 official voices are registered in AVAILABLE_MINIMAX_VOICES_EN', () => {
  const availableSet = new Set(AVAILABLE_MINIMAX_VOICES_EN);
  for (const voice of OFFICIAL_MINIMAX_ENGLISH_VOICES) {
    assert.ok(
      availableSet.has(voice.id),
      `Voice ID ${voice.id} must be present in AVAILABLE_MINIMAX_VOICES_EN`
    );
  }
});

test('All 38 voices and legacy aliases are resolved via resolveMinimaxVoice', () => {
  // Test direct lookup of voice ID
  for (const voice of OFFICIAL_MINIMAX_ENGLISH_VOICES) {
    const resolved = resolveMinimaxVoice(voice.id, 'en-US');
    assert.equal(resolved, voice.id, `Voice ID ${voice.id} should resolve to itself`);
  }

  // Test friendly name lookup (lowercase)
  for (const voice of OFFICIAL_MINIMAX_ENGLISH_VOICES) {
    const friendlyKey = voice.name.toLowerCase();
    const resolved = resolveMinimaxVoice(friendlyKey, 'en-US');
    assert.ok(resolved, `Friendly name "${friendlyKey}" should resolve to a valid voice ID`);
  }

  // Test legacy aliases resolve
  for (const [legacyId, expectedTarget] of Object.entries(LEGACY_MINIMAX_ENGLISH_VOICE_ALIASES)) {
    const resolved = resolveMinimaxVoice(legacyId, 'en-US');
    assert.equal(
      resolved,
      expectedTarget,
      `Legacy voice ${legacyId} should resolve to ${expectedTarget}`
    );
  }
});

test('MINIMAX_VOICES (Indonesian) and GEMINI_VOICES are valid', () => {
  assert.ok(Array.isArray(MINIMAX_VOICES) && MINIMAX_VOICES.length >= 7, 'MINIMAX_VOICES should have at least 7 voices');
  assert.ok(Array.isArray(GEMINI_VOICES) && GEMINI_VOICES.length >= 10, 'GEMINI_VOICES should have at least 10 voices');
});

test('getAvailableVoices utility returns correct voice set', () => {
  const enVoices = getAvailableVoices('minimax', 'en-US');
  assert.equal(enVoices.length, 44, 'getAvailableVoices should return 44 voices for en-US');

  const idVoices = getAvailableVoices('minimax', 'id-ID');
  assert.equal(idVoices.length, MINIMAX_VOICES.length, 'getAvailableVoices should return Indonesian voices for id-ID');

  const geminiVoices = getAvailableVoices('gemini', 'en-US');
  assert.equal(geminiVoices.length, GEMINI_VOICES.length, 'getAvailableVoices should return GEMINI_VOICES for gemini provider');
});

test.after(() => {
  setTimeout(() => process.exit(0), 100);
});
