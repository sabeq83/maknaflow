import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inspectBase64ImageReference,
  inspectBase64ImageReferences,
  sanitizeReferenceName,
  getReferenceData
} from '../lib/base64-image-reference.js';

test('inspectBase64ImageReference supports string data URI and object references', () => {
  const dummyBuffer = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47]), // PNG magic bytes
    Buffer.alloc(150, 0x20)
  ]);
  const base64Png = `data:image/png;base64,${dummyBuffer.toString('base64')}`;

  // 1. String reference
  const strResult = inspectBase64ImageReference(base64Png);
  assert.equal(strResult.mimeType, 'image/png');
  assert.equal(strResult.byteLength, dummyBuffer.length);
  assert.equal(strResult.isObject, false);
  assert.equal(strResult.name, null);

  // 2. Named Object reference
  const objRef = {
    data: base64Png,
    name: 'test_product.png',
    category: 'subject'
  };
  const objResult = inspectBase64ImageReference(objRef);
  assert.equal(objResult.mimeType, 'image/png');
  assert.equal(objResult.byteLength, dummyBuffer.length);
  assert.equal(objResult.isObject, true);
  assert.equal(objResult.name, 'test_product.png');
  assert.equal(objResult.category, 'subject');
  assert.equal(objResult.sha256, strResult.sha256);
});

test('inspectBase64ImageReference rejects invalid format, MIME mismatch, and undersized data', () => {
  // Not data URI
  assert.throws(() => inspectBase64ImageReference('invalid-string'), { code: 'INVALID_IMAGE_REFERENCE' });

  // Undersized (< 100 bytes)
  const tinyBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x01, 0x02]);
  assert.throws(
    () => inspectBase64ImageReference(`data:image/png;base64,${tinyBuffer.toString('base64')}`),
    { code: 'EMPTY_IMAGE_REFERENCE' }
  );

  // MIME mismatch (declared JPEG, actual PNG)
  const pngBuffer = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(120, 0x10)]);
  assert.throws(
    () => inspectBase64ImageReference(`data:image/jpeg;base64,${pngBuffer.toString('base64')}`),
    { code: 'IMAGE_REFERENCE_MIME_MISMATCH' }
  );
});

test('sanitizeReferenceName strips path traversals and enforces extension', () => {
  assert.equal(sanitizeReferenceName('../../etc/passwd.png', 'image/png'), 'passwd.png');
  assert.equal(sanitizeReferenceName('C:\\secret\\file.jpg', 'image/jpeg'), 'file.jpg');
  assert.equal(sanitizeReferenceName('product#truth!@$', 'image/png'), 'product_truth___.png');
});

test('inspectBase64ImageReferences processes array of mixed valid references', () => {
  const pngBuffer = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(120, 0x10)]);
  const jpegBuffer = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(120, 0x20)]);

  const refs = [
    `data:image/png;base64,${pngBuffer.toString('base64')}`,
    { data: `data:image/jpeg;base64,${jpegBuffer.toString('base64')}`, name: 'hero.jpg', category: 'subject' }
  ];

  const results = inspectBase64ImageReferences(refs);
  assert.equal(results.length, 2);
  assert.equal(results[0].mimeType, 'image/png');
  assert.equal(results[1].mimeType, 'image/jpeg');
  assert.equal(results[1].name, 'hero.jpg');
});
