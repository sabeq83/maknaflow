import { test } from 'node:test';
import assert from 'node:assert';
import { pgQuery } from '../lib/db-pg.js';
import { 
  createChannelSpeaker, 
  getChannelSpeakers, 
  getChannelSpeaker,
  retireChannelSpeaker,
  saveSpeakerVoiceCasting,
  getSpeakerVoiceCastings,
  createDraftChannelAudioConfig,
  getChannelDraftAudioConfig,
  activateChannelAudioConfig,
  getChannelAudioConfig,
  updateChannelSonicIdentity,
  getChannelSonicIdentity
} from '../lib/youtube-studio-repository.js';

test('YouTube Channel Speaker & Audio Config Repository integration', async () => {
  const channelId = `ytc_test_${Math.random().toString(36).slice(2, 10)}`;
  const tenantId = 'tenant_dev';
  const actor = { username: 'test_runner' };

  // Set tenant context helper override for test isolation
  process.env.ACTIVE_TENANT_ID = tenantId;

  // Insert dummy channel
  await pgQuery(`
    INSERT INTO youtube_channels (id, tenant_id, name, channel_handle, status)
    VALUES ($1, $2, 'Test Registry Channel', '@testregistry', 'active')
  `, [channelId, tenantId]);

  try {
    // 1. Create speaker
    const speakerInput = {
      speaker_id: 'test_narrator',
      display_name: 'Test Narrator',
      speaker_type: 'narrator',
      description: 'Test Description',
      voice_identity_json: { test: true }
    };
    
    const speaker = await createChannelSpeaker(channelId, speakerInput, actor);
    assert.strictEqual(speaker.speaker_id, 'test_narrator');
    assert.strictEqual(speaker.status, 'active');

    // 2. Fetch speakers
    const speakers = await getChannelSpeakers(channelId);
    assert.strictEqual(speakers.length, 1);
    assert.strictEqual(speakers[0].speaker_id, 'test_narrator');

    // 3. Save voice casting
    const castingInput = {
      binding_kind: 'tts',
      provider: 'google_tts',
      persona_key: 'id-ID-Wavenet-B',
      speed: 1.0,
      delivery_json: {},
      pronunciation_json: {}
    };

    const casting = await saveSpeakerVoiceCasting(speaker.id, 'id-ID', castingInput, actor);
    assert.strictEqual(casting.persona_key, 'id-ID-Wavenet-B');

    const castings = await getSpeakerVoiceCastings(speaker.id);
    assert.strictEqual(castings.length, 1);

    // 4. Create draft audio config
    const configInput = {
      locale: 'id-ID',
      audio_production_mode: 'standalone_tts',
      audio_experience: 'narrative_dialogue',
      provider: 'google_tts',
      model_key: 'id-ID-Wavenet-B',
      synthesis_strategy: 'segmented_turns',
      native_voice_capability: 'unavailable',
      sonic_identity_json: {}
    };

    const draft = await createDraftChannelAudioConfig(channelId, configInput, actor);
    assert.strictEqual(draft.status, 'draft');

    const retrievedDraft = await getChannelDraftAudioConfig(channelId, 'id-ID');
    assert.ok(retrievedDraft);
    assert.strictEqual(retrievedDraft.id, draft.id);

    // 5. Activate audio config (should pass because casting binding is complete)
    const activated = await activateChannelAudioConfig(channelId, draft.id, actor);
    assert.strictEqual(activated.status, 'active');

    const activeConfig = await getChannelAudioConfig(channelId, 'id-ID');
    assert.strictEqual(activeConfig.id, draft.id);

    // 6. Update Sonic Identity
    const sonicIdentityInput = {
      microphone_perspective: 'extreme_close_binaural',
      mastering: {
        target_loudness_lufs: -14,
        peak_limit_db: -1.0
      }
    };
    const updatedWithSonic = await updateChannelSonicIdentity(channelId, sonicIdentityInput, actor);
    assert.strictEqual(updatedWithSonic.sonic_identity_json.microphone_perspective, 'extreme_close_binaural');

    const sonic = await getChannelSonicIdentity(channelId);
    assert.strictEqual(sonic.microphone_perspective, 'extreme_close_binaural');

    // 7. Retire speaker
    const retired = await retireChannelSpeaker(channelId, 'test_narrator', actor);
    assert.strictEqual(retired.status, 'retired');

  } finally {
    // Cleanup
    await pgQuery('DELETE FROM youtube_speaker_voice_castings WHERE channel_speaker_id IN (SELECT id FROM youtube_channel_speakers WHERE channel_id = $1)', [channelId]);
    await pgQuery('DELETE FROM youtube_channel_speakers WHERE channel_id = $1', [channelId]);
    await pgQuery('DELETE FROM youtube_channel_audio_configs WHERE channel_id = $1', [channelId]);
    await pgQuery('DELETE FROM youtube_channels WHERE id = $1', [channelId]);
  }
});
