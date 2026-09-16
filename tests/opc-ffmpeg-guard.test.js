import test from 'node:test';
import assert from 'node:assert/strict';
import { processTtsStudioMuxing } from '../lib/video-studio-processor.js';

test('OPC FFmpeg Guard Tests', async (t) => {
  await t.test('processTtsStudioMuxing throws descriptive error when videoPath is null, empty or invalid', async () => {
    // Test with null videoPath
    await assert.rejects(
      async () => {
        await processTtsStudioMuxing({
          id: 'opc_test_1',
          videoPath: null,
          batchId: 'ttsb_test_123'
        });
      },
      /Daftar path klip video kosong atau tidak valid/
    );

    // Test with empty string
    await assert.rejects(
      async () => {
        await processTtsStudioMuxing({
          id: 'opc_test_2',
          videoPath: '',
          batchId: 'ttsb_test_123'
        });
      },
      /Daftar path klip video kosong atau tidak valid/
    );

    // Test with stringified empty array "[]"
    await assert.rejects(
      async () => {
        await processTtsStudioMuxing({
          id: 'opc_test_3',
          videoPath: '[]',
          batchId: 'ttsb_test_123'
        });
      },
      /Daftar path klip video kosong atau tidak valid/
    );

    // Test with array containing only null/falsy values
    await assert.rejects(
      async () => {
        await processTtsStudioMuxing({
          id: 'opc_test_4',
          videoPath: '[null, null]',
          batchId: 'ttsb_test_123'
        });
      },
      /Daftar path klip video kosong atau tidak valid/
    );
  });

  await t.test('scheduler stageMap does not include pillar_glabs for synchronous idempotency', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const schedulerFile = fs.readFileSync(path.join(process.cwd(), 'lib', 'campaign-scheduler.js'), 'utf8');
    
    // stageMap must only have pillar_tts and pillar_ffmpeg
    assert.match(schedulerFile, /const stageMap = \{ pillar_tts: 'tts', pillar_ffmpeg: 'ffmpeg_upload' \};/);
    assert.doesNotMatch(schedulerFile, /pillar_glabs:\s*'video'/);
  });

  await t.test('processPillarFfmpeg contains preflight visual_clip_paths validation', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const processorFile = fs.readFileSync(path.join(process.cwd(), 'lib', 'scheduler-processors.js'), 'utf8');

    assert.ok(processorFile.includes('parsedClips = typeof item.visual_clip_paths === \'string\' ? JSON.parse(item.visual_clip_paths) : (item.visual_clip_paths || []);'));
    assert.ok(processorFile.includes('visual_clip_paths belum tersedia atau kosong'));
  });
});
