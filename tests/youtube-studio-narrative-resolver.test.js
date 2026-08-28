import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveNarrativeConfiguration } from '../lib/youtube-studio-narrative-resolver.js';

test('resolveNarrativeConfiguration resolves mode inheritance correctly', () => {
  const channelStrategy = {
    id: 'yts_chan_1',
    config_json: {
      narrative_defaults: {
        mode: 'narration_only',
        narrator_usage: 'full',
        point_of_view: 'third_person_limited',
        max_speakers_per_scene: 3
      }
    }
  };

  const series = {
    id: 'ytsr_ser_1',
    config_json: {
      narrative_format: {
        mode: 'hybrid_narration_dialogue',
        narrator_usage: 'chapter_open_close',
        point_of_view: 'inherit'
      }
    }
  };

  const episode = {
    id: 'ytep_ep_1',
    narrative_config_json: {
      narrative_override: {
        mode: 'inherit',
        point_of_view: 'first_person'
      }
    }
  };

  const resolved = resolveNarrativeConfiguration({ channelStrategy, series, episode });

  assert.equal(resolved.resolved_mode, 'hybrid_narration_dialogue'); // series mode overrides channel mode
  assert.equal(resolved.narrator_usage, 'chapter_open_close'); // series narrator_usage overrides channel
  assert.equal(resolved.point_of_view, 'first_person'); // episode point_of_view overrides series/channel
  assert.equal(resolved.max_speakers_per_scene, 3); // inherits channel max_speakers_per_scene
});

test('resolveNarrativeConfiguration merges cast lists correctly with default narrator', () => {
  const channelStrategy = {};
  const series = {
    config_json: {
      recurring_cast: [
        { speaker_id: 'detective_arya', display_name: 'Arya', speaker_role: 'protagonist', speaker_type: 'character' }
      ]
    }
  };
  const episode = {
    narrative_config_json: {
      episode_cast: [
        { speaker_id: 'detective_arya', display_name: 'Arya (Special)', speaker_role: 'detective', speaker_type: 'character' },
        { speaker_id: 'witness_mira', display_name: 'Mira', speaker_role: 'witness', speaker_type: 'character' }
      ]
    }
  };

  const resolved = resolveNarrativeConfiguration({ channelStrategy, series, episode });

  // Narrator should be automatically added
  assert.equal(resolved.speakers[0].speaker_id, 'narrator');
  
  // detective_arya display_name should be overridden by episode cast
  const arya = resolved.speakers.find(s => s.speaker_id === 'detective_arya');
  assert.ok(arya);
  assert.equal(arya.display_name, 'Arya (Special)');

  // witness_mira should be added
  const mira = resolved.speakers.find(s => s.speaker_id === 'witness_mira');
  assert.ok(mira);
  assert.equal(mira.display_name, 'Mira');
});
