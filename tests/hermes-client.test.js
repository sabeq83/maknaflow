import test from 'node:test';
import assert from 'node:assert/strict';
import { createHermesRun } from '../lib/hermes-client.js';

test('Hermes Client: rejects non-allowlisted base URL', async () => {
  const config = { baseUrl: 'ftp://unallowed-host.com', apiKey: 'test' };
  await assert.rejects(async () => {
    await createHermesRun(config, {});
  });
});
