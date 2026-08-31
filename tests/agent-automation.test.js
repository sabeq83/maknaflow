import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAgentRunTransition } from '../lib/agent-automation-contract.js';

test('Orchestration state transition validation', () => {
  const ok = validateAgentRunTransition('scheduled', 'researching');
  assert.ok(ok);

  assert.throws(() => {
    validateAgentRunTransition('scheduled', 'published');
  });
});
