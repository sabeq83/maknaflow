import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeNarrationDuration, assertNarrationApprovable } from '../lib/youtube-studio-contract.js';

test('analyzeNarrationDuration handles correct scripts', () => {
  const script = {
    scenes: [
      { scene_index: 1, estimated_duration_seconds: 30, voiceover: 'Hello world. Let us learn how to clean up the room. Put toys away.' }, // 14 words -> ~8.2s -> 27% coverage
      { scene_index: 2, estimated_duration_seconds: 30, voiceover: 'It is fun and easy. Yes it is.' } // 8 words -> ~4.7s -> 15% coverage
    ]
  };

  const analysis = analyzeNarrationDuration({ script, targetSeconds: 60, profileKey: 'kids_educational_id' });
  assert.equal(analysis.total_words, 22);
  assert.equal(analysis.status, 'revision_required'); // severe underfill (22 words / 102 WPM = 12.9s out of 60s target -> ~21% coverage)
});

test('assertNarrationApprovable blocks severe underfills without override', () => {
  const analysis = { status: 'revision_required', coverage_ratio: 0.2 };
  
  assert.throws(() => {
    assertNarrationApprovable(analysis, { allowOverride: false });
  }, /Severe duration underfill\/overfill detected/);

  assert.doesNotThrow(() => {
    assertNarrationApprovable(analysis, { allowOverride: true });
  });
});
