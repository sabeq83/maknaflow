import test from 'node:test';
import assert from 'node:assert/strict';

test('active_photo contract allows only clean_photo_url or raw_photo_url', () => {
  const allowed = new Set(['clean_photo_url', 'raw_photo_url']);

  assert.equal(allowed.has('clean_photo_url'), true);
  assert.equal(allowed.has('raw_photo_url'), true);
  assert.equal(allowed.has('generated_photo_url'), false);
  assert.equal(allowed.has('photo_url'), false);
  assert.equal(allowed.has(''), false);
  assert.equal(allowed.has(null), false);
});
