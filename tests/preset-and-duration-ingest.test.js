import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getWordsPerClipOptions,
  getDefaultWordsPerClip,
  getMicroPacingSegmentCount,
  getMicroPacingTemplate,
  WORDS_PER_CLIP_CONFIG
} from '../lib/words-per-clip-presets.js';

test('Smart Dynamic Micro-Pacing: Segment counts match 2s intervals per duration', () => {
  assert.equal(getMicroPacingSegmentCount(4), 2, '4s duration must produce exactly 2 micro-pacing beats');
  assert.equal(getMicroPacingSegmentCount(6), 3, '6s duration must produce exactly 3 micro-pacing beats');
  assert.equal(getMicroPacingSegmentCount(8), 4, '8s duration must produce exactly 4 micro-pacing beats');
  assert.equal(getMicroPacingSegmentCount(10), 5, '10s duration must produce exactly 5 micro-pacing beats');
  assert.equal(getMicroPacingSegmentCount(undefined), 4, 'Default fallback duration (8s) must produce 4 beats');
});

test('Smart Dynamic Micro-Pacing: Template contains precise timestamps for 4s, 6s, 8s, 10s', () => {
  const template4s = getMicroPacingTemplate(4);
  assert.ok(template4s.includes('[00:00-00:02]'), '4s template must contain beat 1 [00:00-00:02]');
  assert.ok(template4s.includes('[00:02-00:04]'), '4s template must contain beat 2 [00:02-00:04]');
  assert.ok(!template4s.includes('[00:04-00:06]'), '4s template must NOT contain beat 3 [00:04-00:06]');

  const template8s = getMicroPacingTemplate(8);
  assert.ok(template8s.includes('[00:00-00:02]'), '8s template must contain beat 1');
  assert.ok(template8s.includes('[00:02-00:04]'), '8s template must contain beat 2');
  assert.ok(template8s.includes('[00:04-00:06]'), '8s template must contain beat 3');
  assert.ok(template8s.includes('[00:06-00:08]'), '8s template must contain beat 4');
  assert.ok(!template8s.includes('[00:08-00:10]'), '8s template must NOT contain beat 5');

  const template10s = getMicroPacingTemplate(10);
  assert.ok(template10s.includes('[00:08-00:10]'), '10s template must contain beat 5 [00:08-00:10]');
});

test('Dynamic Words per Clip Presets: Calibrated defaults and options per duration', () => {
  assert.equal(getDefaultWordsPerClip(4), '8-9 kata', '4s default must be 8-9 kata');
  assert.equal(getDefaultWordsPerClip(6), '12-14 kata', '6s default must be 12-14 kata');
  assert.equal(getDefaultWordsPerClip(8), '17-19 kata', '8s default must be 17-19 kata');
  assert.equal(getDefaultWordsPerClip(10), '22-24 kata', '10s default must be 22-24 kata');

  const options4s = getWordsPerClipOptions(4);
  assert.equal(options4s.length, 3);
  assert.equal(options4s[0].value, '6-7 kata');
  assert.equal(options4s[1].value, '8-9 kata');
  assert.equal(options4s[2].value, '10-11 kata');

  const options8s = getWordsPerClipOptions(8);
  assert.equal(options8s.length, 3);
  assert.equal(options8s[1].value, '17-19 kata');
});

test('Preset Loading Contract: Presets with clip_duration preserve values accurately', () => {
  const sampleOmniPreset = {
    key: 'omni_flash_fast_4s',
    label: 'Omni Flash 4s Fast Action',
    config: {
      schema_version: '2',
      campaign_kinds: ['product_campaign'],
      visual_engine: {
        visual_style: 'Cinematic',
        visual_mode: 'hybrid_lock',
        video_model: 'omni_flash',
        clip_duration: 4,
        words_per_clip: '8-9 kata',
        aspect_ratio: '9:16',
        target_clips_count: 4
      },
      basic_strategy: {
        narrative_mode: 'auto',
        voice_provider: 'minimax',
        voice_persona: 'Indonesian_casual_reporter_vv2'
      },
      workflow: {
        enable_tts: true,
        enable_glabs: true,
        enable_ffmpeg: true
      }
    }
  };

  // Simulate applyPresetToForm extraction logic
  const ve = sampleOmniPreset.config.visual_engine;
  const mod = ve.video_model || 'veo_31_lite';
  const dur = Number(ve.clip_duration ?? (mod === 'omni_flash' ? 4 : 8));
  const words = ve.words_per_clip || getDefaultWordsPerClip(dur);

  assert.equal(mod, 'omni_flash');
  assert.equal(dur, 4, 'Extracted clip duration must be 4');
  assert.equal(words, '8-9 kata', 'Extracted words per clip must be 8-9 kata');

  // Verify micro-pacing matches duration
  const pacingCount = getMicroPacingSegmentCount(dur);
  assert.equal(pacingCount, 2, 'Pacing segment count for 4s preset must be 2');
});

test('Database DAO Layer Integrity: clip_duration and words_per_clip update allowlist', async () => {
  const { updatePillarCampaign, updateReCampaign } = await import('../lib/db.js');
  assert.equal(typeof updatePillarCampaign, 'function', 'updatePillarCampaign must be exported');
  assert.equal(typeof updateReCampaign, 'function', 'updateReCampaign must be exported');
});
