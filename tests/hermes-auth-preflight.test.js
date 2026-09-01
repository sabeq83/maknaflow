import test from 'node:test';
import assert from 'node:assert/strict';
import { performHermesAuthPreflight } from '../lib/hermes-auth-preflight.js';

test('Hermes Auth Preflight: HTTP 200 with valid scopes returns ready', async () => {
  const mockFetch = async () => ({
    status: 200,
    json: async () => ({
      success: true,
      operator: {
        id: 'opcred_hermes_dev',
        tenant_id: 'default_tenant',
        scopes: ['automation:read', 'automation:write']
      }
    })
  });

  const res = await performHermesAuthPreflight({
    token: 'secret-token-123456789012345678901234',
    fetch: mockFetch
  });

  assert.equal(res.status, 'ready');
  assert.equal(res.code, 200);
  assert.equal(res.operator.id, 'opcred_hermes_dev');
  assert.equal(res.operator.tenantId, 'default_tenant');
  assert.deepEqual(res.operator.scopes, ['automation:read', 'automation:write']);
});

test('Hermes Auth Preflight: HTTP 401 returns invalid immediately without retry', async () => {
  let callCount = 0;
  const mockFetch = async () => {
    callCount++;
    return { status: 401, json: async () => ({ error: 'Unauthorized' }) };
  };

  const res = await performHermesAuthPreflight({
    token: 'bad-token-123',
    maxRetries: 3,
    fetch: mockFetch
  });

  assert.equal(res.status, 'invalid');
  assert.equal(res.code, 401);
  assert.equal(callCount, 1, '401 must fail-fast without retries');
});

test('Hermes Auth Preflight: Missing write scope returns 403 invalid', async () => {
  const mockFetch = async () => ({
    status: 200,
    json: async () => ({
      success: true,
      operator: {
        id: 'opcred_read_only',
        tenant_id: 'default_tenant',
        scopes: ['automation:read']
      }
    })
  });

  const res = await performHermesAuthPreflight({
    token: 'read-only-token',
    fetch: mockFetch
  });

  assert.equal(res.status, 'invalid');
  assert.equal(res.code, 403);
});

test('Hermes Auth Preflight: Network errors trigger bounded retry and return unavailable', async () => {
  let attempts = 0;
  const mockFetch = async () => {
    attempts++;
    throw new Error('fetch failed: connection refused');
  };

  const res = await performHermesAuthPreflight({
    token: 'test-token',
    maxRetries: 2,
    fetch: mockFetch
  });

  assert.equal(res.status, 'unavailable');
  assert.equal(res.code, 503);
  assert.equal(attempts, 2);
});

test('Hermes Auth Preflight: Malformed JSON returns 500 invalid', async () => {
  const mockFetch = async () => ({
    status: 200,
    json: async () => { throw new Error('Unexpected token < in JSON at position 0'); }
  });

  const res = await performHermesAuthPreflight({
    token: 'valid-token',
    fetch: mockFetch
  });

  assert.equal(res.status, 'invalid');
  assert.equal(res.code, 500);
});

test('Hermes Auth Preflight: Empty token fails fast with 401', async () => {
  const res = await performHermesAuthPreflight({ token: '' });
  assert.equal(res.status, 'invalid');
  assert.equal(res.code, 401);
});
