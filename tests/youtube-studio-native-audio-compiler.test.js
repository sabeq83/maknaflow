import test from 'node:test';
import assert from 'node:assert/strict';
import { compileNativeSceneAudioPrompt } from '../lib/youtube-studio-native-audio-prompt.js';
import { validateSceneScript } from '../lib/youtube-studio-contract.js';

test('native compiler keeps approved dialogue, voice identity, sonic identity, and silence', () => {
  const prompt = compileNativeSceneAudioPrompt({
    basePrompt: 'A cinematic close-up of Maya brushing a microphone.',
    scene: { audio_blocks: [
      { block_id: 'a1', type: 'whisper', speaker_id: 'maya', text: 'Tarik napas perlahan.' },
      { block_id: 'a2', type: 'sound_event', source: 'soft_brush', action: 'brushes the microphone slowly', spatial_position: 'left_to_right' },
      { block_id: 'a3', type: 'silence', duration_seconds: 2 }
    ] },
    castingSnapshot: [{ speaker_id: 'maya', display_name: 'Maya', flow_binding: { descriptive_voice_prompt: 'a warm, breathy adult Indonesian voice' } }],
    audioSnapshot: { audio_experience: 'mixed_asmr' },
    sonicIdentity: { microphone_perspective: 'extreme_close_binaural', forbidden_sounds: ['music', 'harsh impact'] }
  });
  assert.match(prompt, /Tarik napas perlahan/);
  assert.match(prompt, /warm, breathy/);
  assert.match(prompt, /Intentional silence for 2 seconds/);
  assert.match(prompt, /extreme_close_binaural/);
  assert.match(prompt, /Do not generate: music, harsh impact/);
  assert.match(prompt, /Do not add subtitles/);
});

test('script validator rejects unregistered AI speaker', () => {
  const script = { schema_version: 2, scenes: [{
    scene_index: 1, scene_type: 'generated_visual', estimated_duration_seconds: 8,
    visual_direction: 'Close-up',
    audio_blocks: [{ block_id: 'a1', type: 'dialogue', speaker_id: 'invented_guest', text: 'Hello' }]
  }] };
  assert.throws(() => validateSceneScript(script, null, 8, { allowedSpeakerIds: ['maya'], audioExperience: 'narrative_dialogue' }), /not registered/);
});
