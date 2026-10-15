import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Multiplier Detail UI implements T2I batch lock and dynamic progress indicator', () => {
  const pagePath = path.join(process.cwd(), 'app/multiplier-lab/[id]/page.js');
  const content = fs.readFileSync(pagePath, 'utf8');

  // Verify batch state exists
  assert.match(content, /const \[batchRegeneratingSF, setBatchRegeneratingSF\] = useState\(\{\}\);/);
  
  // Verify handleGenerateAllT2I sets and resets state
  assert.match(content, /setBatchRegeneratingSF\(prev => \(\{ \.\.\.prev, \[taskId\]: true \}\)\);/);
  assert.match(content, /setBatchRegeneratingSF\(prev => \(\{ \.\.\.prev, \[taskId\]: false \}\)\);/);

  // Verify button uses isBatchRunning and dynamic label
  assert.match(content, /const isBatchRunning = task\.regenerate_start_frames_status === 'running' \|\| !!batchRegeneratingSF\[task\.id\];/);
  assert.match(content, /disabled=\{isBatchRunning\}/);
  assert.match(content, /⏳ Regenerating \(\$\{task\.regenerate_start_frames_progress \|\| '0%'\}\)/);

  // Verify individual clip buttons are disabled when batch is running
  assert.match(content, /disabled=\{isRegening \|\| isBatchRunning\}/);
  assert.match(content, /disabled=\{isReplacing \|\| isBatchRunning\}/);
});

test('Multiplier regenerate-start-frames API enforces idempotency and tracks progress in DB', () => {
  const apiPath = path.join(process.cwd(), 'app/api/v2/multiplier/[id]/regenerate-start-frames/route.js');
  const content = fs.readFileSync(apiPath, 'utf8');

  // Idempotency check
  assert.match(content, /if \(task\.regenerate_start_frames_status === 'running'\)/);

  // Initial running state update
  assert.match(content, /SET regenerate_start_frames_status = 'running',/);
  assert.match(content, /regenerate_start_frames_progress = \?/);

  // Per-clip progress update
  assert.match(content, /SET regenerate_start_frames_progress = \?/);
  assert.match(content, /\`\$\{i \+ 1\}\/\$\{totalCount\}\`/);

  // Completion status reset
  assert.match(content, /SET regenerate_start_frames_status = NULL,/);
  assert.match(content, /regenerate_start_frames_progress = NULL/);
});

test('Database schema in lib/db.js includes start frame tracking columns', () => {
  const dbPath = path.join(process.cwd(), 'lib/db.js');
  const content = fs.readFileSync(dbPath, 'utf8');

  assert.match(content, /ALTER TABLE re_multiplier_tasks ADD COLUMN regenerate_start_frames_status TEXT DEFAULT NULL/);
  assert.match(content, /ALTER TABLE re_multiplier_tasks ADD COLUMN regenerate_start_frames_progress TEXT DEFAULT NULL/);
});

test('Mockup HTML simulates batch T2I locking and progress correctly', () => {
  const mockupPath = path.join(process.cwd(), 'public/mockup_multiplier_lab_pillar_aligned.html');
  const content = fs.readFileSync(mockupPath, 'utf8');

  assert.match(content, /id="mock-generate-all-t2i"/);
  assert.match(content, /function simulateBatchGenerateT2I\(\)/);
  assert.match(content, /btn\.disabled = true;/);
  assert.match(content, /⏳ Regenerating \(\$\{step\}\/\$\{totalSteps\}\)/);
  assert.match(content, /btn\.disabled = false;/);
});
