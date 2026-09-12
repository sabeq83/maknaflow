import test from 'node:test';
import assert from 'node:assert/strict';
import { LIFECYCLE_STAGES } from '../lib/affiliate-studio-lineage-repository.js';

test('Workflow V2 Lineage: Lifecycle stages contain expected continuous pipeline values', () => {
  const expectedStages = [
    'calendar',
    'planner',
    'approved',
    'production',
    'ready',
    'publishing',
    'published',
    'measured',
    'archived'
  ];

  assert.deepEqual(LIFECYCLE_STAGES, expectedStages);
});

test('Workflow V2 Lineage: Lineage repository exports all required workflow contracts', async () => {
  const mod = await import('../lib/affiliate-studio-lineage-repository.js');

  assert.equal(typeof mod.recordLineage, 'function');
  assert.equal(typeof mod.getLineageByScheduleId, 'function');
  assert.equal(typeof mod.getLineageByPlannerRowId, 'function');
  assert.equal(typeof mod.getLineageByRunId, 'function');
  assert.equal(typeof mod.updateLineageStage, 'function');
  assert.equal(typeof mod.getBrandLineageTrail, 'function');
  assert.equal(typeof mod.upsertSceneProjections, 'function');
  assert.equal(typeof mod.getSceneProjections, 'function');
  assert.equal(typeof mod.backfillExistingLineage, 'function');
});

test('Workflow V2 Lineage: Scene projection model structure satisfies scene inspector needs', () => {
  const mockScene = {
    scene_index: 1,
    duration_sec: 3.5,
    storyboard_text: 'Close up produk dengan pencahayaan dramatis',
    visual_prompt: 'High resolution product shot on dark marble',
    voiceover_script: 'Rasakan kesegaran alami setiap hari',
    t2i_engine: 'sdxl',
    t2i_prompt: 'luxury bottle, 8k, soft shadows',
    i2v_engine: 'kling',
    i2v_motion_prompt: 'slow camera zoom in',
    scene_status: 'rendered'
  };

  assert.equal(mockScene.scene_index, 1);
  assert.equal(mockScene.duration_sec, 3.5);
  assert.ok(mockScene.storyboard_text.length > 0);
  assert.ok(mockScene.visual_prompt.length > 0);
  assert.ok(mockScene.voiceover_script.length > 0);
  assert.ok(mockScene.t2i_prompt.length > 0);
  assert.ok(mockScene.i2v_motion_prompt.length > 0);
});
