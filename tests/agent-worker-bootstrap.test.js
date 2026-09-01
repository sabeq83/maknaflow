import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldStartAgentAutomationWorker } from '../lib/agent-automation-contract.js';

test('Agent Automation Worker Bootstrap: helper evaluates fail-closed logic', () => {
  // 1. Absent / undefined
  assert.equal(shouldStartAgentAutomationWorker({}), false);
  assert.equal(shouldStartAgentAutomationWorker(undefined), false);

  // 2. Empty string
  assert.equal(shouldStartAgentAutomationWorker({ ENABLE_AGENT_AUTOMATION_WORKER: '' }), false);
  assert.equal(shouldStartAgentAutomationWorker({ ENABLE_AGENT_AUTOMATION_WORKER: '   ' }), false);

  // 3. 'false'
  assert.equal(shouldStartAgentAutomationWorker({ ENABLE_AGENT_AUTOMATION_WORKER: 'false' }), false);
  assert.equal(shouldStartAgentAutomationWorker({ ENABLE_AGENT_AUTOMATION_WORKER: 'FALSE' }), false);

  // 4. '1' or other non-'true' values
  assert.equal(shouldStartAgentAutomationWorker({ ENABLE_AGENT_AUTOMATION_WORKER: '1' }), false);
  assert.equal(shouldStartAgentAutomationWorker({ ENABLE_AGENT_AUTOMATION_WORKER: 'yes' }), false);

  // 5. 'true'
  assert.equal(shouldStartAgentAutomationWorker({ ENABLE_AGENT_AUTOMATION_WORKER: 'true' }), true);
  assert.equal(shouldStartAgentAutomationWorker({ ENABLE_AGENT_AUTOMATION_WORKER: ' TRUE ' }), true);
});

test('Agent Automation Worker: idempotent start avoids duplicate intervals', async () => {
  process.env.DISABLE_AUTO_MIGRATIONS = 'true';
  process.env.DISABLE_STARTUP_DB_CACHES = 'true';
  process.env.DISABLE_WORKER_AUTOTICK = 'true';
  process.env.ENABLE_BACKGROUND_SERVICES = 'false';

  const { startAgentAutomationWorker, stopAgentAutomationWorker } = await import('../lib/agent-automation-worker.js');
  const { closePgPool } = await import('../lib/db-pg.js');
  
  // Set a state tracker
  const interval1 = startAgentAutomationWorker();
  const interval2 = startAgentAutomationWorker();

  assert.ok(interval1, 'First start must return an interval handle');
  assert.equal(interval1, interval2, 'Second start must return the exact same interval without creating duplicate');

  stopAgentAutomationWorker();
  await closePgPool();
});
