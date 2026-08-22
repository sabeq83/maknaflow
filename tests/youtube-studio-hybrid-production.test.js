process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert/strict';
import { assertProductionMode, validateProductionPlanByMode } from '../lib/youtube-studio-contract.js';

const mockProfile = {
  key: 'google_flow_omni_flash',
  label: 'Google Flow Omni Flash',
  generatedShotDurations: [4, 6, 8, 10]
};

const mockEpisode = {
  title: 'Smoke Test Episode',
  target_duration_seconds: 24
};

test('validateProductionPlanByMode: valid hybrid plan passes', () => {
  const plan = {
    generation_profile_key: 'google_flow_omni_flash',
    scenes: [
      {
        scene_index: 1,
        voiceover: 'Naskah Scene 1',
        narrative_duration_seconds: 16,
        shots: [
          {
            asset_type: 'generated_visual',
            generation_mode: 't2i_i2v',
            generation_duration_seconds: 8,
            t2i_prompt: 'T2I Prompt 1',
            i2v_prompt: 'I2V Prompt 1'
          },
          {
            asset_type: 'generated_visual',
            generation_mode: 't2i_i2v',
            generation_duration_seconds: 8,
            t2i_prompt: 'T2I Prompt 2',
            i2v_prompt: 'I2V Prompt 2'
          }
        ]
      },
      {
        scene_index: 2,
        voiceover: 'Naskah Scene 2',
        narrative_duration_seconds: 8,
        shots: [
          {
            asset_type: 'generated_visual',
            generation_mode: 't2v',
            generation_duration_seconds: 8,
            t2v_prompt: 'T2V Prompt 1'
          }
        ]
      }
    ]
  };

  const validated = validateProductionPlanByMode(plan, {
    profile: mockProfile,
    episode: mockEpisode,
    productionMode: 'hybrid'
  });

  assert.ok(validated);
});

test('validateProductionPlanByMode: rejects invalid shot duration', () => {
  const plan = {
    generation_profile_key: 'google_flow_omni_flash',
    scenes: [
      {
        scene_index: 1,
        voiceover: 'Naskah Scene 1',
        narrative_duration_seconds: 15,
        shots: [
          {
            asset_type: 'generated_visual',
            generation_mode: 't2v',
            generation_duration_seconds: 15, // Not in [4, 6, 8, 10]
            t2v_prompt: 'T2V Prompt 1'
          }
        ]
      }
    ]
  };

  assert.throws(() => {
    validateProductionPlanByMode(plan, {
      profile: mockProfile,
      episode: mockEpisode,
      productionMode: 'hybrid'
    });
  }, /Invalid generated shot duration/);
});

test('validateProductionPlanByMode: rejects t2i_i2v shot missing prompts', () => {
  const plan = {
    generation_profile_key: 'google_flow_omni_flash',
    scenes: [
      {
        scene_index: 1,
        voiceover: 'Naskah Scene 1',
        narrative_duration_seconds: 8,
        shots: [
          {
            asset_type: 'generated_visual',
            generation_mode: 't2i_i2v',
            generation_duration_seconds: 8,
            t2i_prompt: '', // Missing
            i2v_prompt: 'I2V Prompt'
          }
        ]
      }
    ]
  };

  assert.throws(() => {
    validateProductionPlanByMode(plan, {
      profile: mockProfile,
      episode: mockEpisode,
      productionMode: 'hybrid'
    });
  }, /t2i_prompt is required/);
});

test('assertProductionMode: validates correctly', () => {
  assert.doesNotThrow(() => assertProductionMode({ production_mode: 'hybrid' }, 'hybrid'));
  assert.doesNotThrow(() => assertProductionMode({ production_mode: 'legacy_t2v' }, 'legacy_t2v'));
  assert.doesNotThrow(() => assertProductionMode({}, 'legacy_t2v'));

  assert.throws(() => assertProductionMode({ production_mode: 'hybrid' }, 'legacy_t2v'), /Invalid package production mode/);
  assert.throws(() => assertProductionMode({ production_mode: 'legacy_t2v' }, 'hybrid'), /Invalid package production mode/);
});
