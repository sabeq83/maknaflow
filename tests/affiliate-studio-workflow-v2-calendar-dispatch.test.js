import { mock } from 'node:test';
try {
  mock.module('server-only', { default: {} });
} catch (_) {}

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'path';

test('Workflow V2 Calendar Dispatch: Service file exists and exports required methods', async () => {
  const servicePath = path.resolve(process.cwd(), 'lib/affiliate-studio-calendar-dispatch-service.js');
  assert.ok(fs.existsSync(servicePath), 'Service file must exist');

  const content = fs.readFileSync(servicePath, 'utf8');
  assert.ok(content.includes('export async function dispatchCalendarSchedulesToPlanner'), 'Must export dispatchCalendarSchedulesToPlanner');
  assert.ok(content.includes('export async function getDispatchDetails'), 'Must export getDispatchDetails');
});

test('Workflow V2 Calendar Dispatch: API route files exist and export expected methods', () => {
  const dispatchRoutePath = path.resolve(process.cwd(), 'app/api/v2/affiliate-studio/brands/[id]/calendar/dispatch/route.js');
  const detailsRoutePath = path.resolve(process.cwd(), 'app/api/v2/affiliate-studio/brands/[id]/calendar/dispatches/[dispatchId]/route.js');

  assert.ok(fs.existsSync(dispatchRoutePath), 'Dispatch route must exist');
  assert.ok(fs.existsSync(detailsRoutePath), 'Dispatch details route must exist');

  const dispatchContent = fs.readFileSync(dispatchRoutePath, 'utf8');
  assert.ok(dispatchContent.includes('export const POST'), 'Dispatch route must export POST');

  const detailsContent = fs.readFileSync(detailsRoutePath, 'utf8');
  assert.ok(detailsContent.includes('export const GET'), 'Dispatch details route must export GET');
});

test('Workflow V2 Calendar Component: AffiliateContentCalendar.js contains Dual-View and Inline Dispatch without floating bar', () => {
  const calendarCompPath = path.resolve(process.cwd(), 'app/affiliate-studio/components/AffiliateContentCalendar.js');
  assert.ok(fs.existsSync(calendarCompPath), 'AffiliateContentCalendar.js must exist');

  const content = fs.readFileSync(calendarCompPath, 'utf8');

  // Assert Dual-View
  assert.ok(content.includes('btnViewCalendar'), 'Must have btnViewCalendar');
  assert.ok(content.includes('btnViewList'), 'Must have btnViewList');
  assert.ok(content.includes('viewMode'), 'Must manage viewMode state');

  // Assert Inline Toolbar Dispatch
  assert.ok(content.includes('btnDispatchPlanner'), 'Must have btnDispatchPlanner');
  assert.ok(content.includes('handleDispatchToPlanner'), 'Must have handleDispatchToPlanner');

  // Assert NO bottom floating bar
  assert.ok(!content.includes('className="batch-bar"'), 'Must not have batch-bar floating element');
  assert.ok(!content.includes('floating-bar'), 'Must not have floating bar class');

  // Assert existing modal is preserved
  assert.ok(content.includes('showPlanModal'), 'Existing showPlanModal state must be preserved');
  assert.ok(content.includes('planType'), 'Plan type selection must be preserved');
});
