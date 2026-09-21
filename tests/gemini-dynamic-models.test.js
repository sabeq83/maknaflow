import test from 'node:test';
import assert from 'node:assert/strict';
import { getResolvedGeminiModels, GEMINI_MODELS } from '../lib/gemini.js';
import { setSetting } from '../lib/db.js';

test('getResolvedGeminiModels resolves custom and default settings properly', async () => {
  // 1. Initial default
  const defaultModels = await getResolvedGeminiModels();
  assert.ok(defaultModels.PRIMARY);
  assert.ok(defaultModels.FALLBACK_1);

  // 2. Set custom settings
  await setSetting('gemini_model_primary', 'gemini-3.7-flash');
  await setSetting('gemini_model_fallback', 'gemini-3.6-flash');

  const resolved = await getResolvedGeminiModels();
  assert.equal(resolved.PRIMARY, 'gemini-3.7-flash');
  assert.equal(resolved.FALLBACK_1, 'gemini-3.6-flash');
  assert.equal(resolved.FALLBACK_2, 'gemini-flash-latest');
  assert.equal(resolved.TTS, 'gemini-2.5-flash-preview-tts');
});
