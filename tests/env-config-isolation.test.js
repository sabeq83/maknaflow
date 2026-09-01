import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

test('Ecosystem Config Isolation: Agent Automation Worker is enabled only for Dev', () => {
  const config = require('../ecosystem.macmini.config.cjs');
  assert.ok(Array.isArray(config.apps), 'Apps array must exist in ecosystem config');

  const stagingUi = config.apps.find(a => a.name === 'maknaflow-staging-ui');
  const stagingApi = config.apps.find(a => a.name === 'maknaflow-staging-api');
  const devUi = config.apps.find(a => a.name === 'maknaflow-dev-ui');
  const devApi = config.apps.find(a => a.name === 'maknaflow-dev-api');

  assert.ok(stagingUi, 'Staging UI config must exist');
  assert.ok(devUi, 'Dev UI config must exist');

  // Staging checks
  assert.equal(
    stagingUi.env_staging?.ENABLE_AGENT_AUTOMATION_WORKER,
    'false',
    'Staging UI must have ENABLE_AGENT_AUTOMATION_WORKER set to "false"'
  );

  // Dev checks
  assert.equal(
    devUi.env?.ENABLE_AGENT_AUTOMATION_WORKER,
    'true',
    'Dev UI must have ENABLE_AGENT_AUTOMATION_WORKER set to "true"'
  );
});
