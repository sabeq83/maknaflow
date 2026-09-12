import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Workflow V2 Navigation: AffiliatePipelineTabs contains Setup area and numbered stages 1-5', () => {
  const tabsFile = path.join(process.cwd(), 'app/affiliate-studio/components/AffiliatePipelineTabs.js');
  assert.ok(fs.existsSync(tabsFile), 'AffiliatePipelineTabs.js must exist');

  const content = fs.readFileSync(tabsFile, 'utf8');

  // Verify setup tabs
  assert.ok(content.includes('Overview'), 'Must contain Overview tab');
  assert.ok(content.includes('Products'), 'Must contain Products tab');

  // Verify numbered stages 1-5
  assert.ok(content.includes('Content Calendar'), 'Must contain stage 1: Content Calendar');
  assert.ok(content.includes('Content Planner'), 'Must contain stage 2: Content Planner');
  assert.ok(content.includes('Production Workspace'), 'Must contain stage 3: Production Workspace');
  assert.ok(content.includes('Publishing'), 'Must contain stage 4: Publishing');
  assert.ok(content.includes('Performance & Advisory'), 'Must contain stage 5: Performance & Advisory');

  // Verify semantic CSS variables
  assert.ok(content.includes('var(--surface)'), 'Must use semantic CSS token var(--surface)');
  assert.ok(content.includes('var(--action-primary'), 'Must use semantic CSS token var(--action-primary)');
});

test('Workflow V2 Shell & Workspace: Uses AffiliatePipelineTabs and connects stages', () => {
  const shellFile = path.join(process.cwd(), 'app/affiliate-studio/components/AffiliateStudioShell.js');
  const wsFile = path.join(process.cwd(), 'app/affiliate-studio/components/AffiliateStudioWorkspace.js');

  const shellContent = fs.readFileSync(shellFile, 'utf8');
  const wsContent = fs.readFileSync(wsFile, 'utf8');

  assert.ok(shellContent.includes('AffiliatePipelineTabs'), 'AffiliateStudioShell must use AffiliatePipelineTabs');
  assert.ok(wsContent.includes('AffiliateProductionWorkspace'), 'Workspace must import AffiliateProductionWorkspace');
  assert.ok(wsContent.includes('CampaignProgramPlanners'), 'Workspace must import CampaignProgramPlanners');
  assert.ok(wsContent.includes("activeView === 'calendar'"), 'Workspace must route calendar');
  assert.ok(wsContent.includes("activeView === 'planner'"), 'Workspace must route planner');
  assert.ok(wsContent.includes("activeView === 'production'"), 'Workspace must route production');
  assert.ok(wsContent.includes("activeView === 'publishing'"), 'Workspace must route publishing');
  assert.ok(wsContent.includes("activeView === 'performance'"), 'Workspace must route performance');
});
