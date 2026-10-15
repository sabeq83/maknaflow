import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeAudioConfig, syncAudioConfigKeyValue } from '../lib/multiplier-audio-config.js';

test('normalizeAudioConfig correctly handles camelCase and snake_case dual-casing', () => {
  // Case 1: Campaign creation input (camelCase)
  const initialCampaignInput = {
    voiceProvider: 'minimax',
    voicePersona: 'Indonesian_professional_anchor_vv2',
    voiceSpeed: 1.1,
    voiceVolume: 1.2,
    enableTts: true,
    enableGlabs: false,
    enableFfmpeg: true,
    ffmpegSyncOption: 'smart_sync',
    ffmpegVideoScale: 1.15
  };

  const normalizedFromCamel = normalizeAudioConfig(initialCampaignInput);
  assert.equal(normalizedFromCamel.voice_persona, 'Indonesian_professional_anchor_vv2');
  assert.equal(normalizedFromCamel.voicePersona, 'Indonesian_professional_anchor_vv2');
  assert.equal(normalizedFromCamel.voice_provider, 'minimax');
  assert.equal(normalizedFromCamel.voiceProvider, 'minimax');
  assert.equal(normalizedFromCamel.ffmpeg_video_scale, 1.15);
  assert.equal(normalizedFromCamel.ffmpegVideoScale, 1.15);
  assert.equal(normalizedFromCamel.enable_glabs, false);
  assert.equal(normalizedFromCamel.enableGlabs, false);

  // Case 2: snake_case input
  const snakeInput = {
    voice_provider: 'gemini',
    voice_persona: 'Fenrir',
    ffmpeg_video_scale: 1.3
  };

  const normalizedFromSnake = normalizeAudioConfig(snakeInput);
  assert.equal(normalizedFromSnake.voice_persona, 'Fenrir');
  assert.equal(normalizedFromSnake.voicePersona, 'Fenrir');
  assert.equal(normalizedFromSnake.voice_provider, 'gemini');
  assert.equal(normalizedFromSnake.voiceProvider, 'gemini');
  assert.equal(normalizedFromSnake.ffmpeg_video_scale, 1.3);
  assert.equal(normalizedFromSnake.ffmpegVideoScale, 1.3);

  // Case 3: JSON string input
  const stringInput = JSON.stringify({ voicePersona: 'Indonesian_expressive_podcaster_vv2' });
  const normalizedFromString = normalizeAudioConfig(stringInput);
  assert.equal(normalizedFromString.voice_persona, 'Indonesian_expressive_podcaster_vv2');
  assert.equal(normalizedFromString.voicePersona, 'Indonesian_expressive_podcaster_vv2');
});

test('syncAudioConfigKeyValue preserves voice_persona when changing ffmpeg_video_scale slider', () => {
  const currentConfig = {
    voiceProvider: 'minimax',
    voicePersona: 'Indonesian_professional_anchor_vv2',
    voice_provider: 'minimax',
    voice_persona: 'Indonesian_professional_anchor_vv2',
    ffmpeg_video_scale: 1.1,
    ffmpegVideoScale: 1.1
  };

  // User drags Video Scale Zoom slider to 1.35x
  const updated = syncAudioConfigKeyValue(currentConfig, 'ffmpeg_video_scale', 1.35);

  // Scale changed
  assert.equal(updated.ffmpeg_video_scale, 1.35);
  assert.equal(updated.ffmpegVideoScale, 1.35);

  // Voice Persona must NOT revert to Casual Reporter!
  assert.equal(updated.voice_persona, 'Indonesian_professional_anchor_vv2');
  assert.equal(updated.voicePersona, 'Indonesian_professional_anchor_vv2');
  assert.notEqual(updated.voice_persona, 'Indonesian_casual_reporter_vv2');
});

test('Multiplier Detail Page and API routes enforce dual-casing normalization', () => {
  const pagePath = path.join(process.cwd(), 'app/multiplier-lab/[id]/page.js');
  const pageContent = fs.readFileSync(pagePath, 'utf8');

  // Verify import in page.js
  assert.match(pageContent, /import \{ normalizeAudioConfig, syncAudioConfigKeyValue \} from '@\/lib\/multiplier-audio-config';/);

  // Verify fetchTasks uses functional updater that protects local edits
  assert.match(pageContent, /setEditedAudioConfigs\(prev => \{/);
  assert.match(pageContent, /if \(prev\[t\.id\]\) return prev;/);

  // Verify Section 5 normalizes config and syncs keys
  assert.match(pageContent, /const cfg = normalizeAudioConfig\(editedAudioConfigs\[task\.id\] \|\| task\.audio_config_json\);/);
  assert.match(pageContent, /const updated = syncAudioConfigKeyValue\(prev\[task\.id\] \|\| task\.audio_config_json, key, value\);/);
  assert.match(pageContent, /value=\{cfg\.voice_persona \|\| cfg\.voicePersona \|\|/);

  // Verify update-creative route normalizes audio
  const updateRoutePath = path.join(process.cwd(), 'app/api/v2/multiplier/[id]/update-creative/route.js');
  const updateRouteContent = fs.readFileSync(updateRoutePath, 'utf8');
  assert.match(updateRouteContent, /const normalizedAudio = normalizeAudioConfig\(audioConfig \|\| \{\}\);/);
  assert.match(updateRouteContent, /JSON\.stringify\(normalizedAudio\)/);

  // Verify approve route normalizes audio
  const approveRoutePath = path.join(process.cwd(), 'app/api/v2/multiplier/[id]/approve/route.js');
  const approveRouteContent = fs.readFileSync(approveRoutePath, 'utf8');
  assert.match(approveRouteContent, /const normalizedAudio = normalizeAudioConfig\(audio_config_json\);/);
  assert.match(approveRouteContent, /JSON\.stringify\(normalizedAudio\)/);
});
