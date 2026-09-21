import test from 'node:test';
import assert from 'node:assert/strict';
import { getModelWaterfallChain, GEMINI_CASCADE_ORDER, makeModelResilient } from '../lib/gemini.js';
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
    'gemini-2.5-flash'
  ]);
});

test('getModelWaterfallChain slices properly when starting from mid-tier models', async () => {
  const chain37 = await getModelWaterfallChain('gemini-3.7-flash');
  assert.deepEqual(chain37, [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-2.5-flash'
  ]);

  const chain36 = await getModelWaterfallChain('gemini-3.6-flash');
  assert.deepEqual(chain36, [
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-2.5-flash'
  ]);

  const chain25 = await getModelWaterfallChain('gemini-2.5-flash');
  assert.deepEqual(chain25, [
    'gemini-2.5-flash'
  ]);
});

test('getModelWaterfallChain prepends custom models before the cascade', async () => {
  const customChain = await getModelWaterfallChain('my-custom-fine-tuned-model');
  assert.deepEqual(customChain, [
    'my-custom-fine-tuned-model',
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-2.5-flash'
  ]);
});

test('getModelWaterfallChain uses database setting when startingModel is omitted', async () => {
  await setSetting('gemini_model_primary', 'gemini-3.7-flash');
  const chain = await getModelWaterfallChain();
  assert.deepEqual(chain, [
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-2.5-flash'
  ]);
});
