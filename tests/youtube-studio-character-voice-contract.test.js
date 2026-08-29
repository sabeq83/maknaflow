import { test } from 'node:test';
import assert from 'node:assert';
import { 
  validateChannelAudioConfig, 
  validateSpeakerInput, 
  validateVoiceCasting, 
  validateAllowedSpeakers, 
  validateAudioExperience, 
  validateSonicIdentity 
} from '../lib/youtube-studio-character-voice-contract.js';

test('validateChannelAudioConfig compatibility rules', () => {
  // Standalone TTS matches minimax or google_tts
  const c1 = validateChannelAudioConfig({
    audio_production_mode: 'standalone_tts',
    audio_experience: 'narrative_dialogue',
    provider: 'minimax'
  });
  assert.strictEqual(c1.audio_production_mode, 'standalone_tts');
  assert.strictEqual(c1.provider, 'minimax');

  // Native scene audio must use glabs_google_flow
  const c2 = validateChannelAudioConfig({
    audio_production_mode: 'native_scene_audio',
    audio_experience: 'spoken_asmr',
    provider: 'glabs_google_flow'
  });
  assert.strictEqual(c2.audio_production_mode, 'native_scene_audio');
  assert.strictEqual(c2.provider, 'glabs_google_flow');

  // standlone_tts with glabs_google_flow should throw
  assert.throws(() => {
    validateChannelAudioConfig({
      audio_production_mode: 'standalone_tts',
      provider: 'glabs_google_flow'
    });
  }, /standalone_tts mode does not support provider glabs_google_flow/);

  // native_scene_audio with minimax should throw
  assert.throws(() => {
    validateChannelAudioConfig({
      audio_production_mode: 'native_scene_audio',
      provider: 'minimax'
    });
  }, /native_scene_audio mode must use glabs_google_flow provider/);

  // ASMR no_talking rules
  assert.throws(() => {
    validateChannelAudioConfig({
      audio_production_mode: 'standalone_tts',
      audio_experience: 'no_talking_asmr',
      provider: 'google_tts'
    });
  }, /no_talking_asmr is only supported in native_scene_audio mode/);
});

test('validateSpeakerInput rules', () => {
  const s1 = validateSpeakerInput({
    speaker_id: 'john_doe',
    display_name: 'John Doe',
    speaker_type: 'character'
  });
  assert.strictEqual(s1.speaker_id, 'john_doe');
  assert.strictEqual(s1.speaker_type, 'character');

  assert.throws(() => {
    validateSpeakerInput({
      speaker_id: 'Invalid Speaker Id',
      display_name: 'John',
      speaker_type: 'character'
    });
  }, /Invalid speaker ID format/);
});

test('validateVoiceCasting rules', () => {
  const casting = validateVoiceCasting({
    binding_kind: 'tts',
    provider: 'google_tts',
    persona_key: 'id-ID-Wavenet-B',
    speed: 1.1
  });
  assert.strictEqual(casting.binding_kind, 'tts');
  assert.strictEqual(casting.persona_key, 'id-ID-Wavenet-B');
  assert.strictEqual(casting.speed, 1.1);

  assert.throws(() => {
    validateVoiceCasting({
      binding_kind: 'tts',
      provider: 'google_tts'
    });
  }, /persona_key is required/);
});

test('validateAudioExperience constraints on script blocks', () => {
  const dummyScript = {
    scenes: [
      {
        scene_index: 1,
        audio_blocks: [
          { type: 'narration', speaker_id: 'narrator', text: 'Tulis naskah' }
        ]
      }
    ]
  };

  // no_talking_asmr should block narration blocks
  assert.throws(() => {
    validateAudioExperience(dummyScript, 'no_talking_asmr');
  }, /no_talking_asmr experience strictly forbids narration, dialogue, or whisper blocks/);

  const silentScript = {
    scenes: [
      {
        scene_index: 1,
        audio_blocks: [
          { type: 'sound_event', speaker_id: 'system', text: 'water flowing' }
        ]
      }
    ]
  };
  // Should pass for no_talking_asmr
  assert.doesNotThrow(() => {
    validateAudioExperience(silentScript, 'no_talking_asmr');
  });

  // spoken_asmr requires whisper
  assert.throws(() => {
    validateAudioExperience(dummyScript, 'spoken_asmr');
  }, /spoken_asmr experience requires at least one whisper audio block/);
});

test('validateSonicIdentity loudness and peak boundaries', () => {
  const valid = validateSonicIdentity({
    microphone_perspective: 'close_mono',
    mastering: {
      target_loudness_lufs: -14,
      peak_limit_db: -1.5
    }
  });
  assert.strictEqual(valid.microphone_perspective, 'close_mono');
  assert.strictEqual(valid.mastering.target_loudness_lufs, -14);

  assert.throws(() => {
    validateSonicIdentity({
      mastering: {
        target_loudness_lufs: -2
      }
    });
  }, /Mastering target loudness out of safe bounds/);
});
