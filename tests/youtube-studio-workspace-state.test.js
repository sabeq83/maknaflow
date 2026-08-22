import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveEpisodeStages } from '../lib/youtube-studio-workspace-state.js';

test('resolveEpisodeStages: empty inputs', () => {
  const stages = resolveEpisodeStages({ episode: null });
  assert.deepEqual(stages, []);
});

test('resolveEpisodeStages: planned state without research', () => {
  const episode = { status: 'Planned' };
  const stages = resolveEpisodeStages({ episode, research: null, blueprint: null, script: null, productionPackage: null });
  
  assert.equal(stages.find(s => s.key === 'research').status, 'active');
  assert.equal(stages.find(s => s.key === 'blueprint').status, 'blocked');
  assert.equal(stages.find(s => s.key === 'blueprint').enabled, false);
});

test('resolveEpisodeStages: research completed, blueprint active', () => {
  const episode = { status: 'Researching' };
  const research = { id: 'r1', status: 'completed' };
  const stages = resolveEpisodeStages({ episode, research, blueprint: null, script: null, productionPackage: null });

  assert.equal(stages.find(s => s.key === 'research').status, 'complete');
  assert.equal(stages.find(s => s.key === 'blueprint').status, 'active');
  assert.equal(stages.find(s => s.key === 'blueprint').enabled, true);
  assert.equal(stages.find(s => s.key === 'script').status, 'blocked');
});

test('resolveEpisodeStages: blueprint approved, script active', () => {
  const episode = { status: 'Blueprint Approved' };
  const research = { id: 'r1', status: 'completed' };
  const blueprint = { id: 'b1', status: 'approved' };
  const stages = resolveEpisodeStages({ episode, research, blueprint, script: null, productionPackage: null });

  assert.equal(stages.find(s => s.key === 'blueprint').status, 'complete');
  assert.equal(stages.find(s => s.key === 'script').status, 'active');
  assert.equal(stages.find(s => s.key === 'script').enabled, true);
  assert.equal(stages.find(s => s.key === 'scene-plan').status, 'blocked');
});

test('resolveEpisodeStages: script approved, scene plan active', () => {
  const episode = { status: 'Script Approved' };
  const research = { id: 'r1', status: 'completed' };
  const blueprint = { id: 'b1', status: 'approved' };
  const script = { id: 's1', status: 'approved' };
  const stages = resolveEpisodeStages({ episode, research, blueprint, script, productionPackage: null });

  assert.equal(stages.find(s => s.key === 'script').status, 'complete');
  assert.equal(stages.find(s => s.key === 'scene-plan').status, 'active');
  assert.equal(stages.find(s => s.key === 'scene-plan').enabled, true);
  assert.equal(stages.find(s => s.key === 'video-production').status, 'blocked');
});

test('resolveEpisodeStages: generation profile set, video production active', () => {
  const episode = { status: 'Script Approved', generation_profile_key: 'profile-a' };
  const research = { id: 'r1', status: 'completed' };
  const blueprint = { id: 'b1', status: 'approved' };
  const script = { id: 's1', status: 'approved' };
  const stages = resolveEpisodeStages({ episode, research, blueprint, script, productionPackage: null });

  assert.equal(stages.find(s => s.key === 'scene-plan').status, 'complete');
  assert.equal(stages.find(s => s.key === 'start-frames').status, 'coming_next');
  assert.equal(stages.find(s => s.key === 'video-production').status, 'active');
  assert.equal(stages.find(s => s.key === 'video-production').enabled, true);
});

test('resolveEpisodeStages: production completed, review complete', () => {
  const episode = { status: 'In Production', generation_profile_key: 'profile-a' };
  const research = { id: 'r1', status: 'completed' };
  const blueprint = { id: 'b1', status: 'approved' };
  const script = { id: 's1', status: 'approved' };
  const productionPackage = { id: 'p1', status: 'completed' };
  const stages = resolveEpisodeStages({ episode, research, blueprint, script, productionPackage });

  assert.equal(stages.find(s => s.key === 'video-production').status, 'complete');
  assert.equal(stages.find(s => s.key === 'assemble-review').status, 'complete');
  assert.equal(stages.find(s => s.key === 'packaging').status, 'coming_next');
});
