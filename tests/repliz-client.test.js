import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listReplizAccounts,
  createReplizSchedule,
  getReplizSchedule,
  deleteReplizSchedule,
  extractReplizScheduleState
} from '../lib/repliz-client.js';
import { validateProviderMediaContract, classifyReplizFailure } from '../lib/publishing-contract.js';


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

test('Repliz Client: extractReplizScheduleState parses schedule and redacts credentials', () => {
  const rawFixture = {
    data: {
      id: 'sch_fb_001',
      status: 'failed',
      errorMessage: 'Unsupported get request. Object with ID 2359835624786236 does not exist with secretKey:my-secret-key-456 and token=EAA123',
      errorCode: 'OBJECT_OR_PERMISSION_ERROR',
      logId: 'log_safe_123',
      postId: { type: 'schedule', id: 'temp_sch' },
      account: {
        id: 'acc_fb_1',
        username: 'Dapur Botani',
        generatedId: '1030799026791337',
        isConnected: true
      }
    }
  };

  const state = extractReplizScheduleState(rawFixture);
  assert.equal(state.id, 'sch_fb_001');
  assert.equal(state.status, 'failed');
  assert.equal(state.errorCode, 'OBJECT_OR_PERMISSION_ERROR');
  assert.equal(state.providerLogId, 'log_safe_123');
  assert.equal(state.postId, null, 'Schedule type postId should be normalized to null');
  assert.equal(state.account.username, 'Dapur Botani');
  assert.equal(state.account.isConnected, true);

  // Redaction check
  const jsonStr = JSON.stringify(state);
  assert.ok(!jsonStr.includes('my-secret-key-456'));
  assert.ok(!jsonStr.includes('EAA123'));
  assert.ok(jsonStr.includes('***REDACTED***') || jsonStr.includes('***TOKEN_REDACTED***'));
});

test('Classifier: classifyReplizFailure accurately classifies audit failures', () => {
  // 1. Audit Facebook fixture

  const fbAuditMsg = "Unsupported get request. Object with ID '2359835624786236' does not exist, cannot be loaded due to missing permissions, or does not support this operation.";
  const fbClassified = classifyReplizFailure({
    platform: 'facebook',
    status: 'failed',
    errorMessage: fbAuditMsg,
    errorCode: '100'
  });

  assert.equal(fbClassified.code, 'REPLIZ_FACEBOOK_PERMISSION_REQUIRED');
  assert.equal(fbClassified.class, 'account_action_required');
  assert.equal(fbClassified.retryable, false);
  assert.equal(fbClassified.targetStatus, 'needs_review');
  assert.equal(fbClassified.action, 'reconnect_account');

  // 2. Audit TikTok fixture
  const ttAuditMsg = "internal";
  const ttClassified = classifyReplizFailure({
    platform: 'tiktok',
    status: 'failed',
    errorMessage: ttAuditMsg
  });

  assert.equal(ttClassified.code, 'REPLIZ_TIKTOK_INTERNAL');
  assert.equal(ttClassified.class, 'provider_transient');
  assert.equal(ttClassified.retryable, true);
  assert.equal(ttClassified.targetStatus, 'retry_wait');
  assert.equal(ttClassified.action, 'retry_later');

  // 3. Media Invalid fixture
  const mediaClassified = classifyReplizFailure({
    platform: 'tiktok',
    status: 'failed',
    errorMessage: 'invalid_file_upload: aspect ratio not supported',
    errorCode: 'MEDIA_ERROR'
  });

  assert.equal(mediaClassified.code, 'REPLIZ_MEDIA_INVALID');
  assert.equal(mediaClassified.class, 'media_invalid');
  assert.equal(mediaClassified.retryable, false);
  assert.equal(mediaClassified.targetStatus, 'needs_review');
  assert.equal(mediaClassified.action, 'replace_media');
});

