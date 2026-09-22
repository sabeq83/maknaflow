import test from 'node:test';
import assert from 'node:assert/strict';
import { getModelWaterfallChain, GEMINI_CASCADE_ORDER, makeModelResilient, getCascadeAction } from '../lib/gemini.js';
import { setSetting } from '../lib/db.js';
import { closePgPool } from '../lib/db-pg.js';

test.after(async () => {
  await closePgPool();
});

test('getModelWaterfallChain returns full cascade for gemini-3.8-flash', async () => {
  const chain = await getModelWaterfallChain('gemini-3.8-flash');
  assert.deepEqual(chain, [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest'
  ]);
});

test('getModelWaterfallChain slices properly when starting from mid-tier models', async () => {
  const chain37 = await getModelWaterfallChain('gemini-3.7-flash');
  assert.deepEqual(chain37, [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest'
  ]);

  const chain36 = await getModelWaterfallChain('gemini-3.6-flash');
  assert.deepEqual(chain36, [
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest'
  ]);

  const chain35 = await getModelWaterfallChain('gemini-3.5-flash');
  assert.deepEqual(chain35, [
    'gemini-3.5-flash',
    'gemini-flash-latest'
  ]);
});

test('getModelWaterfallChain prepends deprecated or custom models before the cascade', async () => {
  const customChain = await getModelWaterfallChain('gemini-2.5-flash');
  assert.deepEqual(customChain, [
    'gemini-2.5-flash',
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest'
  ]);

  const tunedChain = await getModelWaterfallChain('my-custom-fine-tuned-model');
  assert.deepEqual(tunedChain, [
    'my-custom-fine-tuned-model',
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest'
  ]);
});

test('getModelWaterfallChain uses database setting when startingModel is omitted', async () => {
  await setSetting('gemini_model_primary', 'gemini-3.7-flash');
  const chain = await getModelWaterfallChain();
  assert.deepEqual(chain, [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest'
  ]);
});

test('getCascadeAction handles 404 (model not found / deprecated) by immediately cascading', () => {
  const err404 = new Error('[GoogleGenerativeAI Error]: Error fetching [404 ] This model models/gemini-2.5-flash is no longer available to new users.');
  err404.status = 404;

  const action = getCascadeAction(err404, 0, true);
  assert.equal(action.action, 'cascade');
  assert.match(action.reason, /404/);

  // If no next model, it should throw
  const actionNoNext = getCascadeAction(err404, 0, false);
  assert.equal(actionNoNext.action, 'throw');
});

test('getCascadeAction handles 503 (high demand) with exponential retry on attempt 0..2 and cascade on attempt 3', () => {
  const err503 = new Error('[GoogleGenerativeAI Error]: Error fetching [503 Service Unavailable] This model is currently experiencing high demand.');
  err503.status = 503;

  // Attempt 0: ~4s delay
  const actionAttempt0 = getCascadeAction(err503, 0, true);
  assert.equal(actionAttempt0.action, 'retry');
  assert.ok(actionAttempt0.delayMs >= 4000 && actionAttempt0.delayMs < 5000);

  // Attempt 1: ~8s delay
  const actionAttempt1 = getCascadeAction(err503, 1, true);
  assert.equal(actionAttempt1.action, 'retry');
  assert.ok(actionAttempt1.delayMs >= 8000 && actionAttempt1.delayMs < 9000);

  // Attempt 2: ~16s delay
  const actionAttempt2 = getCascadeAction(err503, 2, true);
  assert.equal(actionAttempt2.action, 'retry');
  assert.ok(actionAttempt2.delayMs >= 16000 && actionAttempt2.delayMs < 17000);

  // Attempt 3: Cascade down to next model
  const actionAttempt3 = getCascadeAction(err503, 3, true);
  assert.equal(actionAttempt3.action, 'cascade');

  const actionAttempt3NoNext = getCascadeAction(err503, 3, false);
  assert.equal(actionAttempt3NoNext.action, 'throw');
});

test('getCascadeAction handles 429 (rate limit) with exponential retry on attempt 0..2 and cascade on attempt 3', () => {
  const err429 = new Error('[GoogleGenerativeAI Error]: [429 Quota Exceeded] Resource has been exhausted');
  err429.status = 429;

  // Attempt 0: ~4s delay
  const actionAttempt0 = getCascadeAction(err429, 0, true);
  assert.equal(actionAttempt0.action, 'retry');
  assert.ok(actionAttempt0.delayMs >= 4000 && actionAttempt0.delayMs < 5000);

  // Attempt 1: ~8s delay
  const actionAttempt1 = getCascadeAction(err429, 1, true);
  assert.equal(actionAttempt1.action, 'retry');
  assert.ok(actionAttempt1.delayMs >= 8000 && actionAttempt1.delayMs < 9000);

  // Attempt 2: ~16s delay
  const actionAttempt2 = getCascadeAction(err429, 2, true);
  assert.equal(actionAttempt2.action, 'retry');
  assert.ok(actionAttempt2.delayMs >= 16000 && actionAttempt2.delayMs < 17000);

  // Attempt 3: Cascade down
  const actionAttempt3 = getCascadeAction(err429, 3, true);
  assert.equal(actionAttempt3.action, 'cascade');
});
