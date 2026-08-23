import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

test('Fase 12 — Assisted Campaign Program Builder boundary constraints', (t) => {
  // 1. Check adapter exports
  const adapterPath = path.resolve(process.cwd(), 'lib/affiliate-studio-builder-adapter.js');
  assert.ok(fs.existsSync(adapterPath), 'builder adapter file should exist');

  const content = fs.readFileSync(adapterPath, 'utf-8');
  assert.ok(content.includes('suggestCampaignProgram'), 'should export suggestCampaignProgram');

  // 2. Frozen modules constraint: ensure they are not edited
  const frozenModules = [
    'lib/strategic-campaign-engine-v2.js',
    'lib/video-multiplier-engine.js'
  ];
  for (const m of frozenModules) {
    const p = path.resolve(process.cwd(), m);
    if (fs.existsSync(p)) {
      const stats = fs.statSync(p);
      const limit = new Date('2026-08-20');
      assert.ok(stats.mtime < limit, `Module ${m} was modified after freeze date`);
    }
  }
});
