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
    'gemini-3.5-flash'
  ]);
});

test('getModelWaterfallChain slices properly when starting from mid-tier models', async () => {
  const chain37 = await getModelWaterfallChain('gemini-3.7-flash');
  assert.deepEqual(chain37, [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash'
  ]);

  const chain36 = await getModelWaterfallChain('gemini-3.6-flash');
  assert.deepEqual(chain36, [
    'gemini-3.6-flash',
    'gemini-3.5-flash'
  ]);

  const chain35 = await getModelWaterfallChain('gemini-3.5-flash');
  assert.deepEqual(chain35, [
    'gemini-3.5-flash'
  ]);
});

test('getModelWaterfallChain prepends deprecated or custom models before the cascade', async () => {
  const customChain = await getModelWaterfallChain('gemini-2.5-flash');
  assert.deepEqual(customChain, [
    'gemini-2.5-flash',
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash'
  ]);

  const tunedChain = await getModelWaterfallChain('my-custom-fine-tuned-model');
  assert.deepEqual(tunedChain, [
    'my-custom-fine-tuned-model',
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash'
  ]);
});

test('getModelWaterfallChain uses database setting when startingModel is omitted', async () => {
  await setSetting('gemini_model_primary', 'gemini-3.7-flash');
  const chain = await getModelWaterfallChain();
  assert.deepEqual(chain, [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash'
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

test('getCascadeAction handles 503 (high demand) by retrying on attempt 0 and cascading on attempt 1', () => {
  const err503 = new Error('[GoogleGenerativeAI Error]: Error fetching [503 Service Unavailable] This model is currently experiencing high demand.');
  err503.status = 503;

  const actionAttempt0 = getCascadeAction(err503, 0, true);
  assert.equal(actionAttempt0.action, 'retry');

  const actionAttempt1 = getCascadeAction(err503, 1, true);
  assert.equal(actionAttempt1.action, 'cascade');

  const actionAttempt1NoNext = getCascadeAction(err503, 1, false);
  assert.equal(actionAttempt1NoNext.action, 'throw');
});

test('getCascadeAction handles 429 (rate limit) with retry on attempt 0 and cascade on attempt 1', () => {
  const err429 = new Error('[GoogleGenerativeAI Error]: [429 Quota Exceeded] Resource has been exhausted');
  err429.status = 429;

  const actionAttempt0 = getCascadeAction(err429, 0, true);
  assert.equal(actionAttempt0.action, 'retry');

  const actionAttempt1 = getCascadeAction(err429, 1, true);
  assert.equal(actionAttempt1.action, 'cascade');
});
