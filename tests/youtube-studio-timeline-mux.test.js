import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { processYouTubeTimelineMux, getMediaDuration } from '../lib/video-studio-processor.js';

const tempDir = path.join(process.cwd(), 'public', 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

async function createDummyVideo(outputPath, durationSeconds) {
  execSync(`ffmpeg -y -f lavfi -i color=c=black:s=640x360:r=30 -t ${durationSeconds} "${outputPath}" 2>/dev/null`);
  return outputPath;
}

async function createDummyAudio(outputPath, durationSeconds) {
  execSync(`ffmpeg -y -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -t ${durationSeconds} "${outputPath}" 2>/dev/null`);
  return outputPath;
}

test('timeline-preserving mux: pads silence when audio is shorter', async () => {
  const videoPath = path.join(tempDir, 'test_dummy_v_40.mp4');
  const audioPath = path.join(tempDir, 'test_dummy_a_20.wav');
  const outputPath = path.join(tempDir, 'test_out_padded.mp4');

  await createDummyVideo(videoPath, 40);
  await createDummyAudio(audioPath, 20);

  await processYouTubeTimelineMux({
    videoPaths: ['public/temp/test_dummy_v_40.mp4'],
    audioPath: 'public/temp/test_dummy_a_20.wav',
    plannedDurationSeconds: 40,
    durationPolicy: 'preserve_timeline',
    outputPath: 'public/temp/test_out_padded.mp4',
    narrationProfileKey: 'general_id'
  });

  const duration = await getMediaDuration(outputPath);
  assert.ok(Math.abs(duration - 40) < 0.5, `Expected ~40s, got ${duration}s`);

  // Clean up
  try {
    fs.unlinkSync(videoPath);
    fs.unlinkSync(audioPath);
    fs.unlinkSync(outputPath);
  } catch (_) {}
});

test('timeline-preserving mux: scales tempo when audio is slightly longer', async () => {
  const videoPath = path.join(tempDir, 'test_dummy_v_40.mp4');
  const audioPath = path.join(tempDir, 'test_dummy_a_42.wav');
  const outputPath = path.join(tempDir, 'test_out_tempo.mp4');

  await createDummyVideo(videoPath, 40);
  await createDummyAudio(audioPath, 42); // 4.2% longer -> within 8% limits

  await processYouTubeTimelineMux({
    videoPaths: ['public/temp/test_dummy_v_40.mp4'],
    audioPath: 'public/temp/test_dummy_a_42.wav',
    plannedDurationSeconds: 40,
    durationPolicy: 'preserve_timeline',
    outputPath: 'public/temp/test_out_tempo.mp4',
    narrationProfileKey: 'general_id'
  });

  const duration = await getMediaDuration(outputPath);
  assert.ok(Math.abs(duration - 40) < 0.5, `Expected ~40s, got ${duration}s`);

  // Clean up
  try {
    fs.unlinkSync(videoPath);
    fs.unlinkSync(audioPath);
    fs.unlinkSync(outputPath);
  } catch (_) {}
});

test('timeline-preserving mux: throws error when audio is too long', async () => {
  const videoPath = path.join(tempDir, 'test_dummy_v_40.mp4');
  const audioPath = path.join(tempDir, 'test_dummy_a_70.wav');
  const outputPath = path.join(tempDir, 'test_out_fail.mp4');

  await createDummyVideo(videoPath, 40);
  await createDummyAudio(audioPath, 70); // 75% longer -> exceeds limits

  await assert.rejects(async () => {
    await processYouTubeTimelineMux({
      videoPaths: ['public/temp/test_dummy_v_40.mp4'],
      audioPath: 'public/temp/test_dummy_a_70.wav',
      plannedDurationSeconds: 40,
      durationPolicy: 'preserve_timeline',
      outputPath: 'public/temp/test_out_fail.mp4',
      narrationProfileKey: 'general_id'
    });
  }, /DurationMismatchError/);

  // Clean up
  try {
    fs.unlinkSync(videoPath);
    fs.unlinkSync(audioPath);
  } catch (_) {}
});
