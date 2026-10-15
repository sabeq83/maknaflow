import assert from 'assert';

console.log('🧪 Starting Multiplier Sequential Execution, Save as Draft & Dynamic Chips Test...\n');

// -------------------------------------------------------------
// Test 1: Draft vs Running Initial Status Determination
// -------------------------------------------------------------
console.log('Test 1: Initial Status Determination (Draft vs Running)');

function determineInitialStatus(payload) {
  const initial = payload.initial_status || payload.status;
  return (initial === 'draft') ? 'draft' : 'pending_resolution';
}

assert.strictEqual(determineInitialStatus({ initial_status: 'draft' }), 'draft');
assert.strictEqual(determineInitialStatus({ status: 'draft' }), 'draft');
assert.strictEqual(determineInitialStatus({ initial_status: 'pending_resolution' }), 'pending_resolution');
assert.strictEqual(determineInitialStatus({}), 'pending_resolution');
console.log('  ✓ Initial status correctly resolves "draft" or "pending_resolution"');


// -------------------------------------------------------------
// Test 2: Sequential Dependency Query Logic (Simulation of SQL NOT EXISTS)
// -------------------------------------------------------------
console.log('\nTest 2: Sequential Execution Dependency Logic');

function simulateSequentialEligibility(tasks) {
  const ACTIVE_STATUSES = ['pending_resolution', 'resolving_product', 'remaking', 'generating_t2i', 'generating_audio', 'generating_visuals', 'ffmpeg_muxing'];
  const BLOCKING_STATUSES = ['draft', 'pending_resolution', 'resolving_product', 'remaking', 'generating_t2i'];

  return tasks.filter(t => {
    if (!ACTIVE_STATUSES.includes(t.status)) return false;
    // Check if any preceding row in the same batch blocks this task
    const isBlocked = tasks.some(prev => 
      prev.batch_id === t.batch_id &&
      prev.row_index < t.row_index &&
      BLOCKING_STATUSES.includes(prev.status)
    );
    return !isBlocked;
  }).sort((a, b) => a.row_index - b.row_index);
}

// Case 2a: All 3 tasks pending -> Only Row 0 (Task 1) should be eligible
const batchTasksInitial = [
  { id: 'mul_test_01', batch_id: 'mul_test', row_index: 0, status: 'pending_resolution' },
  { id: 'mul_test_02', batch_id: 'mul_test', row_index: 1, status: 'pending_resolution' },
  { id: 'mul_test_03', batch_id: 'mul_test', row_index: 2, status: 'pending_resolution' }
];

const eligible1 = simulateSequentialEligibility(batchTasksInitial);
assert.strictEqual(eligible1.length, 1);
assert.strictEqual(eligible1[0].id, 'mul_test_01');
console.log('  ✓ Case 2a: When all pending, only Row 0 (Task 1) is eligible to execute');

// Case 2b: Row 0 reaches waiting_approval -> Row 1 (Task 2) becomes eligible
const batchTasksStep2 = [
  { id: 'mul_test_01', batch_id: 'mul_test', row_index: 0, status: 'waiting_approval' },
  { id: 'mul_test_02', batch_id: 'mul_test', row_index: 1, status: 'pending_resolution' },
  { id: 'mul_test_03', batch_id: 'mul_test', row_index: 2, status: 'pending_resolution' }
];

const eligible2 = simulateSequentialEligibility(batchTasksStep2);
assert.strictEqual(eligible2.length, 1);
assert.strictEqual(eligible2[0].id, 'mul_test_02');
console.log('  ✓ Case 2b: When Row 0 reaches waiting_approval, Row 1 unlocks and executes next');

// Case 2c: Row 0 failed -> Row 1 still unlocks (does not deadlock the entire batch)
const batchTasksStepFail = [
  { id: 'mul_test_01', batch_id: 'mul_test', row_index: 0, status: 'failed' },
  { id: 'mul_test_02', batch_id: 'mul_test', row_index: 1, status: 'pending_resolution' },
  { id: 'mul_test_03', batch_id: 'mul_test', row_index: 2, status: 'pending_resolution' }
];

const eligibleFail = simulateSequentialEligibility(batchTasksStepFail);
assert.strictEqual(eligibleFail.length, 1);
assert.strictEqual(eligibleFail[0].id, 'mul_test_02');
console.log('  ✓ Case 2c: When Row 0 fails, Row 1 safely continues without deadlocking');

// Case 2d: All rows in Draft -> 0 rows eligible
const batchTasksDraft = [
  { id: 'mul_test_01', batch_id: 'mul_test', row_index: 0, status: 'draft' },
  { id: 'mul_test_02', batch_id: 'mul_test', row_index: 1, status: 'draft' },
  { id: 'mul_test_03', batch_id: 'mul_test', row_index: 2, status: 'draft' }
];

const eligibleDraft = simulateSequentialEligibility(batchTasksDraft);
assert.strictEqual(eligibleDraft.length, 0);
console.log('  ✓ Case 2d: When all rows in Draft, 0 tasks are eligible until explicitly started');


// -------------------------------------------------------------
// Test 3: Accurate Dynamic Chips Calculation (No Fake TTS 100%)
// -------------------------------------------------------------
console.log('\nTest 3: Accurate Dynamic Progress Chips (Storyboard, TTS, Visual)');

function computeBatchChips(tasks) {
  let storyboard_done = 0;
  let tts_done = 0;
  let visuals_done = 0;

  for (const t of tasks) {
    // 1. Storyboard Done: Valid parsed storyboard JSON
    let hasSb = false;
    try {
      const sb = JSON.parse(t.remake_storyboard_json || '[]');
      if (Array.isArray(sb) && sb.length > 0) hasSb = true;
    } catch (_) {}
    if (hasSb) storyboard_done++;

    // 2. TTS Done: Actual TTS clips or audio URL exists
    const hasTtsClips = Array.isArray(t.tts_clips) && t.tts_clips.length > 0 && t.tts_clips.some(c => c.audio_url || c.file_url);
    const hasTaskAudio = Boolean(t.audio_url || t.voiceover_url);
    if (hasTtsClips || hasTaskAudio) tts_done++;

    // 3. Visuals Done: Completed video or full glabs clips
    if (t.status === 'completed' || t.final_video_url || t.visual_video_url) {
      visuals_done++;
    }
  }

  const total = tasks.length;
  return {
    storyboard: { done: storyboard_done, total, label: `${storyboard_done === total && total > 0 ? '✓' : '⏳'} Storyboard (${storyboard_done}/${total})` },
    tts: { done: tts_done, total, label: `${tts_done === total && total > 0 ? '✓' : '⏳'} TTS Audio (${tts_done}/${total})` },
    visual: { done: visuals_done, total, label: `${visuals_done === total && total > 0 ? '✓' : '⏳'} Visual (${visuals_done}/${total})` }
  };
}

// Scenario: 3 tasks reached waiting_approval with Storyboard generated, but TTS has NOT been run yet
const tasksWaitingReview = [
  { id: 'm1', remake_storyboard_json: '[{"narration":"A"}]', tts_clips: [], status: 'waiting_approval' },
  { id: 'm2', remake_storyboard_json: '[{"narration":"B"}]', tts_clips: [], status: 'waiting_approval' },
  { id: 'm3', remake_storyboard_json: '[{"narration":"C"}]', tts_clips: [], status: 'waiting_approval' }
];

const chipsWaiting = computeBatchChips(tasksWaitingReview);
assert.strictEqual(chipsWaiting.storyboard.done, 3);
assert.strictEqual(chipsWaiting.storyboard.label, '✓ Storyboard (3/3)');

// MANDATORY RULE: TTS must NOT show fake 100% or checkmark when 0
assert.strictEqual(chipsWaiting.tts.done, 0);
assert.strictEqual(chipsWaiting.tts.label, '⏳ TTS Audio (0/3)');

assert.strictEqual(chipsWaiting.visual.done, 0);
assert.strictEqual(chipsWaiting.visual.label, '⏳ Visual (0/3)');
console.log('  ✓ Storyboard correctly shows 3/3 with checkmark');
console.log('  ✓ TTS correctly shows "⏳ TTS Audio (0/3)" instead of fake 100%');
console.log('  ✓ Visual correctly replaces "Video Render" and shows "⏳ Visual (0/3)"');


// -------------------------------------------------------------
// Test 4: Action Handlers: start_campaign & retry_task
// -------------------------------------------------------------
console.log('\nTest 4: Action Handlers (start_campaign & retry_task)');

// Simulate start_campaign
let mockCampaignTasks = [
  { id: 'mul_test_01', batch_id: 'mul_test', status: 'draft', error_message: null },
  { id: 'mul_test_02', batch_id: 'mul_test', status: 'draft', error_message: null }
];

function handleStartCampaignAction(tasks, batchId) {
  return tasks.map(t => {
    if (t.batch_id === batchId && t.status === 'draft') {
      return { ...t, status: 'pending_resolution', error_message: null };
    }
    return t;
  });
}

mockCampaignTasks = handleStartCampaignAction(mockCampaignTasks, 'mul_test');
assert(mockCampaignTasks.every(t => t.status === 'pending_resolution'));
console.log('  ✓ start_campaign successfully moves all draft rows to pending_resolution');

// Simulate retry_task
let mockFailedTasks = [
  { id: 'mul_test_01', status: 'completed', error_message: null },
  { id: 'mul_test_02', status: 'failed', error_message: 'Generative AI request timed out after 180s' },
  { id: 'mul_test_03', status: 'waiting_approval', error_message: null }
];

function handleRetryTaskAction(tasks, taskId) {
  return tasks.map(t => {
    if (t.id === taskId && t.status === 'failed') {
      return { ...t, status: 'pending_resolution', error_message: null };
    }
    return t;
  });
}

mockFailedTasks = handleRetryTaskAction(mockFailedTasks, 'mul_test_02');
assert.strictEqual(mockFailedTasks[1].status, 'pending_resolution');
assert.strictEqual(mockFailedTasks[1].error_message, null);
assert.strictEqual(mockFailedTasks[0].status, 'completed');
assert.strictEqual(mockFailedTasks[2].status, 'waiting_approval');
console.log('  ✓ retry_task successfully resets failed task to pending_resolution and clears error_message');


console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
