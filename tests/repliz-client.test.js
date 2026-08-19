import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listReplizAccounts,
  createReplizSchedule,
  getReplizSchedule,
  deleteReplizSchedule
} from '../lib/repliz-client.js';
import { validateProviderMediaContract } from '../lib/publishing-contract.js';

test('Repliz Client: redacts credentials on API error', async () => {
  const credentials = {
    apiUrl: 'https://api.repliz.com',
    accessKey: 'my-access-key-123',
    secretKey: 'my-secret-key-456'
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    return new Response(JSON.stringify({ error: 'Auth failed for accessKey:my-access-key-123 and secretKey:my-secret-key-456 using Basic bXktYWNjZXNzLWtleS0xMjM6bXktc2VjcmV0LWtleS00NTY=' }), {
      status: 401,
      statusText: 'Unauthorized'
    });
  };

  try {
    await assert.rejects(async () => {
      await listReplizAccounts(credentials);
    }, (err) => {
      assert.ok(!err.message.includes('my-access-key-123'));
      assert.ok(!err.message.includes('my-secret-key-456'));
      assert.ok(err.message.includes('***REDACTED***'));
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Repliz Client: list accounts successfully', async () => {
  const credentials = {
    apiUrl: 'https://api.repliz.com',
    accessKey: 'my-access-key',
    secretKey: 'my-secret-key'
  };

  const mockResponse = [
    { id: 101, name: 'TikTok Staging', platform: 'tiktok' },
    { id: 102, name: 'YouTube Staging', platform: 'youtube' }
  ];

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.ok(url.includes('/public/account'));
    assert.ok(options.headers['Authorization'].startsWith('Basic '));
    return new Response(JSON.stringify(mockResponse), { status: 200 });
  };

  try {
    const res = await listReplizAccounts(credentials);
    assert.equal(res.length, 2);
    assert.equal(res[0].id, 101);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Repliz Client: create schedule successfully', async () => {
  const credentials = {
    apiUrl: 'https://api.repliz.com',
    accessKey: 'my-access-key',
    secretKey: 'my-secret-key'
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.ok(url.includes('/public/schedule'));
    assert.equal(options.method, 'POST');
    return new Response(JSON.stringify({ id: 'sch_999', status: 'scheduled' }), { status: 200 });
  };

  try {
    const payload = { platform: 'tiktok', accountId: 101, caption: 'test', mediaUrl: 'https://x.com/x.mp4' };
    const res = await createReplizSchedule(credentials, payload);
    assert.equal(res.id, 'sch_999');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Validation Contract: validateProviderMediaContract enforces Repliz constraints', () => {
  // TikTok reels mode live is valid
  const valid = validateProviderMediaContract({
    provider: 'repliz',
    platform: 'tiktok',
    mediaType: 'reels',
    publishMode: 'live'
  });
  assert.equal(valid.platform, 'tiktok');

  // Text only should fail for Repliz
  assert.throws(() => {
    validateProviderMediaContract({
      provider: 'repliz',
      platform: 'tiktok',
      mediaType: 'text_only',
      publishMode: 'live'
    });
  }, /Repliz membutuhkan media image, video, atau reels/);
});

test('Repliz Client: parses paginated docs response', async () => {
  const credentials = {
    apiUrl: 'https://api.repliz.com',
    accessKey: 'my-access-key',
    secretKey: 'my-secret-key'
  };

  const mockResponse = {
    docs: [
      { id: 'acc_tiktok_1', type: 'tiktok', name: 'TikTok Channel' }
    ],
    totalDocs: 1
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    return new Response(JSON.stringify(mockResponse), { status: 200 });
  };

  try {
    const res = await listReplizAccounts(credentials);
    assert.equal(res.length, 1);
    assert.equal(res[0].id, 'acc_tiktok_1');
    assert.equal(res[0].type, 'tiktok');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
