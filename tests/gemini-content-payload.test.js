import test from 'node:test';
import assert from 'node:assert/strict';
import { generateContentFlexible } from '../lib/gemini.js';
import { setSetting } from '../lib/db.js';
import { closePgPool } from '../lib/db-pg.js';

test.after(async () => {
  await closePgPool();
});

test('generateContentFlexible delivers prompt correctly in standard non-cached / free tier request', async (t) => {
  await setSetting('gemini_api_tier', 'free');
  await setSetting('gemini_context_caching', 'off');

  // Verify that calling with a prompt does not fail due to empty payload parts
  // We can test by intercepting or running with mock key
  const mockKey = 'TEST_MOCK_API_KEY';

  // We can verify generateContentFlexible executes standard path without throw on empty payload
  // If we pass an invalid API key, it should fail with auth/fetch error from Google, NOT "No content is provided for sending chat message"
  try {
    await generateContentFlexible({
      prompt: 'Generate a short creative hook',
      taskType: 'PILLAR_CAMPAIGN',
      apiKey: mockKey,
      timeoutMs: 5000
    });
  } catch (err) {
    // Assert the error is NOT "No content is provided for sending chat message"
    assert.doesNotMatch(
      err.message,
      /No content is provided for sending chat message/i,
      'Standard request must not throw empty content error'
    );
  }
});
