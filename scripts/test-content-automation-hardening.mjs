import assert from 'node:assert/strict';
import { redactStructuredValue } from '../lib/structured-logger.js';
import { automationEventKey, CONTENT_AUTOMATION_EVENTS } from '../lib/content-automation-events.js';
import { buildStageIdempotencyKey } from '../lib/pillar-stage-contract.js';

const redacted = redactStructuredValue({
  authorization: 'Bearer secret',
  nested: { api_key: 'very-secret', url: 'https://example.test/callback?token=abc&safe=1' },
  ordinary: 'visible'
});
assert.equal(redacted.authorization, '[REDACTED]');
assert.equal(redacted.nested.api_key, '[REDACTED]');
assert.match(redacted.nested.url, /token=\[REDACTED\]/);
assert.equal(redacted.ordinary, 'visible');

assert.equal(
  buildStageIdempotencyKey({ tenantId: 'tenant-a', itemId: 42, stage: 'tts', revision: 3 }),
  'opc-stage:tenant-a:42:tts:r3'
);
assert.notEqual(
  buildStageIdempotencyKey({ tenantId: 'tenant-a', itemId: 42, stage: 'tts', revision: 3 }),
  buildStageIdempotencyKey({ tenantId: 'tenant-b', itemId: 42, stage: 'tts', revision: 3 })
);
assert.equal(
  automationEventKey({ tenantId: 'tenant-a', runId: 'run-1', itemId: '42', event: CONTENT_AUTOMATION_EVENTS.REVIEW_APPROVED, revision: 'r3' }),
  'tenant-a:run-1:42:review_approved:r3'
);

console.log('Content Automation hardening unit tests passed.');
