import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'path';

test('Workflow V2 Embedded Publishing: PublishingScheduler supports controlled props', () => {
  const schedulerPath = path.resolve(process.cwd(), 'app/content-flow/PublishingScheduler.js');
  assert.ok(fs.existsSync(schedulerPath), 'PublishingScheduler.js must exist');

  const content = fs.readFileSync(schedulerPath, 'utf8');

  // Assert controlled props support
  assert.ok(content.includes('controlledBrandProfileId'), 'Must support controlledBrandProfileId prop');
  assert.ok(content.includes('controlledContentRunIds'), 'Must support controlledContentRunIds prop');
});

test('Workflow V2 Embedded Publishing: BrandPublishingDashboard embeds controlled PublishingScheduler', () => {
  const dashboardPath = path.resolve(process.cwd(), 'app/affiliate-studio/components/BrandPublishingDashboard.js');
  assert.ok(fs.existsSync(dashboardPath), 'BrandPublishingDashboard.js must exist');

  const content = fs.readFileSync(dashboardPath, 'utf8');

  // Assert embedded component
  assert.ok(content.includes('PublishingScheduler'), 'Must embed PublishingScheduler component');
  assert.ok(content.includes('controlledBrandProfileId={brandId}'), 'Must pass brandId to controlledBrandProfileId');
  assert.ok(content.includes('Affiliate Links Verified'), 'Must include preflight verification badge');
});
