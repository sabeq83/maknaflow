import test from 'node:test';
import assert from 'node:assert/strict';
import { ingestRecipePlannerToPillarCampaign } from '../lib/recipe-campaign-ingest.js';

test('ingestRecipePlannerToPillarCampaign rejects missing planner ID', async () => {
  await assert.rejects(async () => {
    await ingestRecipePlannerToPillarCampaign({ plannerId: null });
  }, /planner_id wajib diisi/);
});

test('ingestRecipePlannerToPillarCampaign module is correctly defined and exportable', () => {
  assert.equal(typeof ingestRecipePlannerToPillarCampaign, 'function');
});
