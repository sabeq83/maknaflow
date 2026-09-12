import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'path';

test('Workflow V2 Performance & Learning: BrandPerformanceOverview contains commercial metrics and advisory card', () => {
  const perfCompPath = path.resolve(process.cwd(), 'app/affiliate-studio/components/BrandPerformanceOverview.js');
  assert.ok(fs.existsSync(perfCompPath), 'BrandPerformanceOverview.js must exist');

  const content = fs.readFileSync(perfCompPath, 'utf8');

  // Assert commercial metrics
  assert.ok(content.includes('Earnings Per Click (EPC)'), 'Must display EPC metric');
  assert.ok(content.includes('Conversions (CVR)'), 'Must display CVR metric');
  assert.ok(content.includes('Consolidated GMV'), 'Must display GMV / Revenue metric');

  // Assert Learning Loop
  assert.ok(content.includes('AI Editorial Learning Loop'), 'Must include Advisory Learning Loop banner');
  assert.ok(content.includes('Jadwalkan Ulang di Kalender'), 'Must have action button to route advisory to Calendar');
});
