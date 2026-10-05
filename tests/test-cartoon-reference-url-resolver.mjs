import http from 'http';
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileToBase64, fetchUrlBase64, resolveImageToBase64, resolveClipReferenceImagesAsync } from '../lib/cartoon-reference-resolver.js';
import { buildOpcStartFrameRequest } from '../lib/opc-start-frame-request.js';

console.log('🧪 RUNNING CARTOON REFERENCE URL RESOLVER TESTS\n');

// 1. Setup local mock HTTP server
const sample1x1PngBuffer = Buffer.concat([
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
  Buffer.alloc(100, 0)
]);

// Valid JPEG buffer >= 100 bytes
const sample1x1Jpg = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xfe, 0x00, 0x20,
  0x54, 0x65, 0x73, 0x74, 0x20, 0x43, 0x6f, 0x6d, 0x6d, 0x65, 0x6e, 0x74,
  0x20, 0x46, 0x6f, 0x72, 0x20, 0x50, 0x61, 0x64, 0x64, 0x69, 0x6e, 0x67,
  0x20, 0x4a, 0x50, 0x45, 0x47, 0x20, 0x4c, 0x65, 0xff, 0xdb, 0x00, 0x43,
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
  0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
  0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
  0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
  0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
  0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
  0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
  0x00, 0xbf, 0x80, 0xff, 0xd9
]);

const server = http.createServer((req, res) => {
  if (req.url === '/test-kio.png') {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(sample1x1PngBuffer);
  } else if (req.url === '/test-bimo.jpg') {
    res.writeHead(200, { 'Content-Type': 'image/jpeg' });
    res.end(sample1x1Jpg);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const kioUrl = `http://127.0.0.1:${port}/test-kio.png`;
const bimoUrl = `http://127.0.0.1:${port}/test-bimo.jpg`;

console.log(`📡 Mock HTTP Server running on port ${port}`);

try {
  // Test 1: fetchUrlBase64
  console.log('--- Test 1: fetchUrlBase64 ---');
  const b64Kio = await fetchUrlBase64(kioUrl);
  assert(b64Kio && b64Kio.startsWith('data:image/png;base64,'), 'fetchUrlBase64 should return PNG data url');
  console.log('✅ fetchUrlBase64 PNG successfully converted to base64');

  const b64Bimo = await fetchUrlBase64(bimoUrl);
  assert(b64Bimo && b64Bimo.startsWith('data:image/jpeg;base64,'), 'fetchUrlBase64 should return JPEG data url');
  console.log('✅ fetchUrlBase64 JPEG successfully converted to base64');

  // Test 2: resolveClipReferenceImagesAsync with remote manifest
  console.log('\n--- Test 2: resolveClipReferenceImagesAsync with Remote URLs ---');
  const mockSnapshot = {
    manifest: {
      universe_profile: 'kio-wonders',
      characters: {
        kio: {
          identity_reference_path: kioUrl,
          canonical_description: 'A cheerful 8-year-old boy named Kio'
        },
        bimo: {
          identity_reference_path: bimoUrl,
          canonical_description: 'Cute 3D animated companion hover-bot named BIMO'
        }
      }
    }
  };

  const resolved = await resolveClipReferenceImagesAsync({
    contentWorld: 'cartoon_universe',
    universeProfile: 'kio-wonders',
    universeSnapshot: mockSnapshot,
    clip: 1,
    clipCharacters: ['kio', 'bimo']
  });

  assert.strictEqual(resolved.characterReferences.length, 2, 'Should resolve 2 character references');
  assert.strictEqual(resolved.allReferences.length, 2, 'allReferences should have 2 items');
  console.log('✅ resolveClipReferenceImagesAsync resolved 2 remote characters properly');

  // Test 3: buildOpcStartFrameRequest auto-resolution
  console.log('\n--- Test 3: buildOpcStartFrameRequest Auto-Resolution ---');
  const mockCampaign = {
    id: 'camp_test_123',
    content_world: 'cartoon_universe',
    universe_profile: 'kio-wonders',
    universe_snapshot_json: JSON.stringify(mockSnapshot),
    aspect_ratio: '9:16'
  };

  const mockItem = {
    id: 'item_test_123',
    new_video_plan_json: JSON.stringify([
      { clip_index: 1, characters: ['kio', 'bimo'], t2i_prompt: 'Kio and BIMO in laboratory' },
      { clip_index: 2, characters: [], t2i_prompt: 'Exterior empty landscape' }
    ])
  };

  const reqClip1 = await buildOpcStartFrameRequest({
    campaign: mockCampaign,
    item: mockItem,
    clipIndex: 1,
    prompt: 'Kio and BIMO in laboratory'
  });

  assert(reqClip1.providerRequest.reference_images !== undefined, 'Clip 1 should have reference_images');
  assert.strictEqual(reqClip1.providerRequest.reference_images.length, 2, 'Clip 1 should have 2 reference images');
  console.log('✅ buildOpcStartFrameRequest auto-resolved reference images for Clip 1');

  const reqClip2 = await buildOpcStartFrameRequest({
    campaign: mockCampaign,
    item: mockItem,
    clipIndex: 2,
    prompt: 'Exterior empty landscape'
  });

  assert(reqClip2.providerRequest.reference_images === undefined, 'Clip 2 without characters should have undefined reference_images');
  console.log('✅ buildOpcStartFrameRequest left reference_images undefined for Clip 2 without characters');

  console.log('\n🎉 ALL CARTOON REFERENCE URL RESOLVER TESTS PASSED!');
} finally {
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 500).unref();
}
