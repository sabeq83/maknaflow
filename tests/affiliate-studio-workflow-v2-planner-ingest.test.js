import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'path';

test('Workflow V2 Planner Ingest: Adapter exports approve and ingest methods', async () => {
  const adapterPath = path.resolve(process.cwd(), 'lib/affiliate-studio-planner-adapter.js');
  assert.ok(fs.existsSync(adapterPath), 'Planner adapter file must exist');

  const content = fs.readFileSync(adapterPath, 'utf8');
  assert.ok(content.includes('export async function approvePlannerRows'), 'Must export approvePlannerRows');
  assert.ok(content.includes('export async function ingestApprovedPlannerRowsToProduction'), 'Must export ingestApprovedPlannerRowsToProduction');
});

test('Workflow V2 Planner Ingest: API routes exist and export POST method', () => {
  const approveRoutePath = path.resolve(process.cwd(), 'app/api/v2/affiliate-studio/brands/[id]/planners/[plannerId]/approve/route.js');
  const ingestRoutePath = path.resolve(process.cwd(), 'app/api/v2/affiliate-studio/brands/[id]/planners/[plannerId]/ingest-production/route.js');

  assert.ok(fs.existsSync(approveRoutePath), 'Approve route must exist');
  assert.ok(fs.existsSync(ingestRoutePath), 'Ingest route must exist');

  const approveContent = fs.readFileSync(approveRoutePath, 'utf8');
  assert.ok(approveContent.includes('export const POST'), 'Approve route must export POST');

  const ingestContent = fs.readFileSync(ingestRoutePath, 'utf8');
  assert.ok(ingestContent.includes('export const POST'), 'Ingest route must export POST');
});

test('Workflow V2 Planner Component: CampaignProgramPlanners.js contains 6 CEP Coverage and Approval actions', () => {
  const plannerCompPath = path.resolve(process.cwd(), 'app/affiliate-studio/components/CampaignProgramPlanners.js');
  assert.ok(fs.existsSync(plannerCompPath), 'CampaignProgramPlanners.js must exist');

  const content = fs.readFileSync(plannerCompPath, 'utf8');

  // Assert 6 CEP Coverage
  assert.ok(content.includes('Siklus 6 CEP Coverage'), 'Must have 6 CEP Coverage card');
  assert.ok(!content.includes('TOFU'), 'Must not have obsolete TOFU funnels in planner UI');

  // Assert Action buttons
  assert.ok(content.includes('Bulk Approve All Rows'), 'Must have Bulk Approve button');
  assert.ok(content.includes('Ingest Approved Rows ke Production'), 'Must have Ingest to Production button');
  assert.ok(content.includes('handleToggleRowApproval'), 'Must have row approval toggle handler');
});
