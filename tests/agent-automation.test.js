import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAgentRunTransition } from '../lib/agent-automation-contract.js';
import { normalizePublishingPolicy, normalizeResearchRequest, resolveNextPublishAt } from '../lib/agent-automation-contract.js';
import { createHermesCallbackToken, verifyHermesCallbackToken } from '../lib/hermes-callback-token.js';
import fs from 'node:fs';
import { normalizeContentAutomation } from '../lib/content-automation-contract.js';

test('Orchestration state transition validation', () => {
  const ok = validateAgentRunTransition('scheduled', 'researching');
  assert.ok(ok);

  assert.throws(() => {
    validateAgentRunTransition('scheduled', 'published');
  });
});

test('Research contract supports bounded multi-video production', () => {
  assert.equal(normalizeResearchRequest({ query: 'Tren Nutribake', production_count: 1 }).production_count, 1);
  assert.equal(normalizeResearchRequest({ query: 'Tren Nutribake', production_count: 6 }).production_count, 6);
  assert.throws(() => normalizeResearchRequest({ query: 'Tren Nutribake', production_count: 31 }), /1 sampai 30/);
});

test('Content Automation persists research and forces one selected production row', () => {
  const automation = normalizeContentAutomation({
    name: 'Nutribake Daily Research', status: 'paused', frequency: 'daily',
    schedule: { hour: 7, minute: 0 },
    research: { query: 'Tren relevan untuk Nutribake', production_count: 1 },
    publishing: { mode: 'draft_only', publish_time: '18:30' },
    operator_request: {
      planner: {
        planner_focus: 'brand_editorial', account_name: 'Nutribake',
        brand_context: 'Healthy food education.', content_goal: 'Daily trend content.',
        pillars: ['Healthy Breakfast'], planner_count: 1, platform: 'tiktok'
      },
      production: { enable_social_post: false }
    }
  });
  assert.equal(automation.operator_request.research.query, 'Tren relevan untuk Nutribake');
  assert.equal(automation.operator_request.selection.mode, 'best_one');
  assert.equal(automation.operator_request.production.auto_sync_contentflow, true);
});

test('Publishing policy requires exact account targets outside draft_only', () => {
  assert.equal(normalizePublishingPolicy({ mode: 'draft_only' }).mode, 'draft_only');
  assert.throws(() => normalizePublishingPolicy({ mode: 'approval_required' }), /account_ids/);
  const policy = normalizePublishingPolicy({ mode: 'approval_required', account_ids: ['acc_1'], publish_time: '18:30' });
  assert.deepEqual(policy.account_ids, ['acc_1']);
});

test('Publishing slot resolves to 18:30 Asia/Jakarta, never an arbitrary one-minute delay', () => {
  const result = resolveNextPublishAt({
    publishTime: '18:30', timezone: 'Asia/Jakarta', now: new Date('2026-08-31T00:00:00Z')
  });
  assert.equal(result.toISOString(), '2026-08-31T11:30:00.000Z');
});

test('Hermes callback token is task-bound and expires', () => {
  const previous = process.env.MAKNA_HERMES_CALLBACK_SIGNING_SECRET;
  process.env.MAKNA_HERMES_CALLBACK_SIGNING_SECRET = 'unit-test-secret-that-is-longer-than-32-characters';
  try {
    const token = createHermesCallbackToken({ taskId: 'task_1', runId: 'run_1', tenantId: 'tenant_1' });
    assert.equal(verifyHermesCallbackToken(token, 'task_1').tenant_id, 'tenant_1');
    assert.throws(() => verifyHermesCallbackToken(token, 'task_2'), /tidak sesuai/);
  } finally {
    if (previous === undefined) delete process.env.MAKNA_HERMES_CALLBACK_SIGNING_SECRET;
    else process.env.MAKNA_HERMES_CALLBACK_SIGNING_SECRET = previous;
  }
});

test('Publishing implementation fails closed before creating live jobs', () => {
  const source = fs.readFileSync(new URL('../lib/agent-publishing-service.js', import.meta.url), 'utf8');
  assert.match(source, /intent\.status !== 'approved'/);
  assert.doesNotMatch(source, /Date\.now\(\) \+ 60000/);
  assert.match(source, /approvalStatus: 'approved'/);
});

test('Legacy operator credential cannot bypass new scopes', () => {
  const source = fs.readFileSync(new URL('../lib/operator-auth.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /identity\.actor !== 'operator-api-legacy'/);
});
