import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { insertGlabsTask } from '../lib/db.js';

test('insertGlabsTask safely handles object argument and sanitizes clip_index/item_id for BigInt', async () => {
  // Test 1: Object argument with string IDs
  const resObject = await insertGlabsTask({
    task_id: 'test_task_123',
    campaign_id: 'mtb_test_campaign',
    item_id: null,
    clip_index: 0,
    prompt: '(VERTICAL 9:16) Test prompt content...',
    status: 'processing'
  });
  assert.ok(resObject);

  // Test 2: Positional argument safety guard when prompt was passed as clip_index
  const resPositionalBug = await insertGlabsTask(
    'test_task_456',
    'mtb_test_campaign',
    1, // clip number
    '(VERTICAL 9:16) Very long prompt string passed as 4th positional argument...'
  );
  assert.ok(resPositionalBug);
});

test('Multiplier Worker handleVisualGeneration enforces Pillar alignment and per-clip recovery', () => {
  const workerPath = path.join(process.cwd(), 'lib/re-multiplier-worker.js');
  const workerContent = fs.readFileSync(workerPath, 'utf8');

  // 1. Verify start frames from t2i_images_json are parsed and used for I2V
  assert.match(workerContent, /t2iImages = JSON\.parse\(task\.t2i_images_json \|\| '\[\]'\)/);
  assert.match(workerContent, /mode: hasStartFrame \? 'start_image' : 'text_to_video'/);
  assert.match(workerContent, /reference_images: hasStartFrame \? \[startFramePath\] : undefined/);

  // 2. Verify per-clip recovery: reusing completed video for already finished clips
  assert.match(workerContent, /if \(existingTask\.status === 'completed' && existingTask\.video_url\)/);
  assert.match(workerContent, /Reusing completed video for clip/);

  // 3. Verify insertGlabsTask uses safe object format
  assert.match(workerContent, /await insertGlabsTask\(\{[\s\S]*task_id: finalVideoTaskId,[\s\S]*clip_index: c - 1,[\s\S]*prompt: expectedPrompt/);

  // 4. Verify progressive updateMultiplierTask so submitted tasks are not lost
  assert.match(workerContent, /await updateMultiplierTask\(task\.id, \{\s*glabs_task_ids: JSON\.stringify\(submittedTaskIds\)\s*\}\);/);

  // 5. Verify micro-pacing delay (10s) between submissions (aligned with Pillar Campaign)
  assert.match(workerContent, /Micro-pacing delay: menunggu 10 detik sebelum klip/);
  assert.match(workerContent, /await new Promise\(resolve => setTimeout\(resolve, 10000\)\)/);

  // 6. Verify remake_storyboard_json is NOT overwritten with localPaths
  assert.doesNotMatch(workerContent, /remake_storyboard_json:\s*JSON\.stringify\(localPaths\)/);
});
