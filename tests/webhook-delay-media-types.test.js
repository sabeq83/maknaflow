import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveWebhookDelayRange, applyRandomDelay } from '../lib/webhook-client.js';

test('resolveWebhookDelayRange returns correct defaults for image and video media types', () => {
  const imageRange = resolveWebhookDelayRange('image');
  assert.equal(imageRange.min, 3, 'Default min delay for image should be 3s');
  assert.equal(imageRange.max, 7, 'Default max delay for image should be 7s');

  const videoRange = resolveWebhookDelayRange('video');
  assert.equal(videoRange.min, 10, 'Default min delay for video should be 10s');
  assert.equal(videoRange.max, 20, 'Default max delay for video should be 20s');
});

test('resolveWebhookDelayRange falls back gracefully when invalid mediaType is passed', () => {
  const defaultRange = resolveWebhookDelayRange(undefined);
  assert.equal(defaultRange.min, 3);
  assert.equal(defaultRange.max, 7);
});
