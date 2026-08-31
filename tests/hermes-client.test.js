import test from 'node:test';
import assert from 'node:assert/strict';
import { createHermesRun } from '../lib/hermes-client.js';

test('Hermes Client: rejects non-allowlisted base URL', async () => {
  const config = { baseUrl: 'https://unallowed-host.com', apiKey: 'configured-test-key' };
  await assert.rejects(async () => {
    await createHermesRun(config, {});
  });
});

test('Hermes Client: sends Runs API input with idempotency and bearer auth', async () => {
  const previousFetch = global.fetch;
  let request;
  global.fetch = async (url, init) => {
    request = { url, init };
    return { ok: true, json: async () => ({ run_id: 'run_1', status: 'started' }) };
  };
  try {
    const result = await createHermesRun(
      { baseUrl: 'http://127.0.0.1:8642', apiKey: 'configured-test-key', timeoutMs: 1000 },
      { input: 'research Nutribake' },
      'stable-key'
    );
    assert.equal(result.run_id, 'run_1');
    assert.equal(request.url, 'http://127.0.0.1:8642/v1/runs');
    assert.equal(request.init.headers.Authorization, 'Bearer configured-test-key');
    assert.equal(request.init.headers['Idempotency-Key'], 'stable-key');
  } finally {
    global.fetch = previousFetch;
  }
});
