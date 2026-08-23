import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

test('Fase 11 — Insight & Learning Loop boundary constraints', (t) => {
  // 1. Check adapter exports
  const adapterPath = path.resolve(process.cwd(), 'lib/affiliate-studio-insight-adapter.js');
  assert.ok(fs.existsSync(adapterPath), 'insight adapter file should exist');

  const content = fs.readFileSync(adapterPath, 'utf-8');
  assert.ok(content.includes('getProgramCreativeInsights'), 'should export getProgramCreativeInsights');

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
