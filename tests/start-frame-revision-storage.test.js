import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectImageExtension,
  detectImageMimeType,
  buildRevisionedStartFrameFilename,
  saveRevisionedStartFrame
} from '../lib/start-frame-storage.js';

test('detectImageExtension and detectImageMimeType identify PNG, JPEG, WEBP magic bytes', () => {
  const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  assert.equal(detectImageExtension(pngHeader), 'png');
  assert.equal(detectImageMimeType(pngHeader), 'image/png');

  const jpgHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
  assert.equal(detectImageExtension(jpgHeader), 'jpg');
  assert.equal(detectImageMimeType(jpgHeader), 'image/jpeg');

  const webpHeader = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
  assert.equal(detectImageExtension(webpHeader), 'webp');
  assert.equal(detectImageMimeType(webpHeader), 'image/webp');
});

test('buildRevisionedStartFrameFilename builds sanitized, immutable filenames', () => {
  const filename = buildRevisionedStartFrameFilename({
    itemId: 215,
    clipIndex: 3,
    revision: 2,
    providerTaskId: 'e8aff610',
    extension: 'png'
  });
  assert.equal(filename, 'opc_start_frame_215_clip_3_r2_e8aff610.png');
});

test('saveRevisionedStartFrame saves buffer atomically and computes sha256 checksum', async () => {
  const dummyBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x01]);
  const res = await saveRevisionedStartFrame({
    itemId: 999,
    clipIndex: 1,
    revision: 1,
    providerTaskId: 'testtask123',
    buffer: dummyBuffer
  });

  assert.equal(res.filename, 'opc_start_frame_999_clip_1_r1_testtask123.png');
  assert.equal(res.relativePath, '/uploads/start_frames/opc_start_frame_999_clip_1_r1_testtask123.png');
  assert.equal(res.byteLength, 10);
  assert.equal(typeof res.checksum, 'string');
  assert.equal(res.checksum.length, 64);
});
