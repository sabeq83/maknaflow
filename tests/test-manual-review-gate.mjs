import assert from 'assert';

console.log('--- Testing Pillar Campaign Manual Review Gate ---');

function evaluateT2iExecutionGate(campaign) {
  const isManualReview = Boolean(
    campaign.execution_mode === 'manual_review' ||
    campaign.approval_mode === 'creative' ||
    campaign.approval_mode === 'storyboard' ||
    campaign.scheduler_pause_at === 'tts' ||
    campaign.scheduler_pause_at === 'start_frames'
  );
  const shouldRunT2i = campaign.visual_mode === 'hybrid_lock' && !isManualReview;
  return { isManualReview, shouldRunT2i };
}

// Case 1: Manual Review with hybrid_lock -> must NOT run T2I in Phase 1
const case1 = evaluateT2iExecutionGate({
  execution_mode: 'manual_review',
  approval_mode: 'creative',
  visual_mode: 'hybrid_lock'
});
assert.equal(case1.isManualReview, true);
assert.equal(case1.shouldRunT2i, false, 'Manual review mode must pause before T2I start frame generation');
console.log('✅ Case 1 Passed: Manual Review mode correctly pauses before T2I');

// Case 2: Full Autopilot with hybrid_lock -> MUST run T2I in Phase 1
const case2 = evaluateT2iExecutionGate({
  execution_mode: 'full_autopilot',
  approval_mode: 'none',
  visual_mode: 'hybrid_lock',
  scheduler_pause_at: null
});
assert.equal(case2.isManualReview, false);
assert.equal(case2.shouldRunT2i, true, 'Full autopilot must execute T2I start frames immediately');
console.log('✅ Case 2 Passed: Full Autopilot mode correctly proceeds with T2I');

// Case 3: Default approval_mode = creative -> must NOT run T2I in Phase 1
const case3 = evaluateT2iExecutionGate({
  approval_mode: 'creative',
  visual_mode: 'hybrid_lock'
});
assert.equal(case3.isManualReview, true);
assert.equal(case3.shouldRunT2i, false);
console.log('✅ Case 3 Passed: Creative approval gate correctly halts before T2I');

console.log('🎉 ALL Manual Review Gate Tests Passed!');
process.exit(0);
