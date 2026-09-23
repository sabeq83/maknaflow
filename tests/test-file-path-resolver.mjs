import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { resolvePublicFilePath, findExistingStartFrameFile } from '../lib/file-path-resolver.js';

console.log('--- Starting Unit Tests: file-path-resolver ---');

const testDir = path.join(process.cwd(), 'public', 'uploads', 'start_frames');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// Create dummy start frame files for test
const dummyItem = 999999;
const fileUnrev = path.join(testDir, `test_start_frame_${dummyItem}_clip_1.png`);
const fileRev2 = path.join(testDir, `test_start_frame_${dummyItem}_clip_2_r2_abc123.jpg`);
const fileRev14 = path.join(testDir, `test_start_frame_${dummyItem}_clip_2_r14_def456.jpg`);

fs.writeFileSync(fileUnrev, 'dummy-unrev');
fs.writeFileSync(fileRev2, 'dummy-rev-2');
fs.writeFileSync(fileRev14, 'dummy-rev-14');

try {
  // Test 1: resolvePublicFilePath with leading slash web path
  console.log('Test 1: resolvePublicFilePath web path with leading slash...');
  const res1 = resolvePublicFilePath(`/uploads/start_frames/test_start_frame_${dummyItem}_clip_1.png`);
  assert.strictEqual(res1, fileUnrev);
  console.log('✅ Test 1 passed:', res1);

  // Test 2: resolvePublicFilePath without leading slash
  console.log('Test 2: resolvePublicFilePath without leading slash...');
  const res2 = resolvePublicFilePath(`uploads/start_frames/test_start_frame_${dummyItem}_clip_1.png`);
  assert.strictEqual(res2, fileUnrev);
  console.log('✅ Test 2 passed:', res2);

  // Test 3: resolvePublicFilePath with absolute filesystem path
  console.log('Test 3: resolvePublicFilePath with absolute filesystem path...');
  const res3 = resolvePublicFilePath(fileRev2);
  assert.strictEqual(res3, fileRev2);
  console.log('✅ Test 3 passed:', res3);

  // Test 4: resolvePublicFilePath non-existent path
  console.log('Test 4: resolvePublicFilePath non-existent path returns null...');
  const res4 = resolvePublicFilePath('/uploads/start_frames/non_existent_file_xyz_123.png');
  assert.strictEqual(res4, null);
  console.log('✅ Test 4 passed: null');

  // Test 5: findExistingStartFrameFile picks highest revision
  console.log('Test 5: findExistingStartFrameFile selects highest revision...');
  const matchClip2 = findExistingStartFrameFile({
    itemId: dummyItem,
    clipIndex: 2,
    prefix: 'test_start_frame'
  });
  assert.ok(matchClip2, 'Should find match for clip 2');
  assert.strictEqual(matchClip2.absolutePath, fileRev14, 'Should pick r14 over r2');
  assert.strictEqual(matchClip2.webRelativePath, `/uploads/start_frames/test_start_frame_${dummyItem}_clip_2_r14_def456.jpg`);
  console.log('✅ Test 5 passed (picked r14):', matchClip2);

  // Test 6: findExistingStartFrameFile unrevisioned
  console.log('Test 6: findExistingStartFrameFile unrevisioned...');
  const matchClip1 = findExistingStartFrameFile({
    itemId: dummyItem,
    clipIndex: 1,
    prefix: 'test_start_frame'
  });
  assert.ok(matchClip1, 'Should find match for clip 1');
  assert.strictEqual(matchClip1.absolutePath, fileUnrev);
  console.log('✅ Test 6 passed:', matchClip1);

  console.log('🎉 ALL file-path-resolver TESTS PASSED!');
} finally {
  // Cleanup test files
  if (fs.existsSync(fileUnrev)) fs.unlinkSync(fileUnrev);
  if (fs.existsSync(fileRev2)) fs.unlinkSync(fileRev2);
  if (fs.existsSync(fileRev14)) fs.unlinkSync(fileRev14);
}

process.exit(0);
