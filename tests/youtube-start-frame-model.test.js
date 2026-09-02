import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeGlabsImageModel, GLABS_IMAGE_MODEL } from '../lib/webhook-client.js';

test('YouTube studio start-frame adapter source does not contain imagen_3', () => {
  const adapterSource = fs.readFileSync(
    new URL('../lib/youtube-studio-start-frame-adapter.js', import.meta.url),
    'utf8'
  );
  assert.doesNotMatch(adapterSource, /imagen_3/i, 'Adapter should not contain any reference to imagen_3');
  assert.match(adapterSource, /normalizeGlabsImageModel/);
});

test('normalizeGlabsImageModel falls back to nano_banana_2 for invalid or missing models', () => {
  assert.equal(normalizeGlabsImageModel(undefined), 'nano_banana_2');
  assert.equal(normalizeGlabsImageModel(null), 'nano_banana_2');
  assert.equal(normalizeGlabsImageModel('imagen_3'), 'nano_banana_2');
  assert.equal(normalizeGlabsImageModel('unknown_model'), 'nano_banana_2');
  assert.equal(normalizeGlabsImageModel('nano_banana_pro'), 'nano_banana_pro');
  assert.equal(normalizeGlabsImageModel('nano_banana_2'), 'nano_banana_2');
  assert.equal(normalizeGlabsImageModel('nano_banana_2_lite'), 'nano_banana_2_lite');
});
