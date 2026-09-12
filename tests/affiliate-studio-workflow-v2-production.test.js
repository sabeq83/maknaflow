import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'path';

test('Workflow V2 Production: Adapter exports required methods and action constants', async () => {
  const adapterPath = path.resolve(process.cwd(), 'lib/affiliate-studio-production-workspace-adapter.js');
  assert.ok(fs.existsSync(adapterPath), 'Adapter file must exist');

  const content = fs.readFileSync(adapterPath, 'utf8');
  assert.ok(content.includes('ALLOWED_RUN_ACTIONS'), 'Must export ALLOWED_RUN_ACTIONS');
  assert.ok(content.includes('export async function getProductionRunScenes'), 'Must export getProductionRunScenes');
  assert.ok(content.includes('export async function updateSceneProjectionDetails'), 'Must export updateSceneProjectionDetails');
  assert.ok(content.includes('export async function forwardRunAction'), 'Must export forwardRunAction');
});

test('Workflow V2 Production: API routes exist and export correct HTTP methods', () => {
  const scenesRoutePath = path.resolve(process.cwd(), 'app/api/v2/affiliate-studio/brands/[id]/production/runs/[runId]/scenes/route.js');
  const actionRoutePath = path.resolve(process.cwd(), 'app/api/v2/affiliate-studio/brands/[id]/production/runs/[runId]/actions/[action]/route.js');

  assert.ok(fs.existsSync(scenesRoutePath), 'Scenes route must exist');
  assert.ok(fs.existsSync(actionRoutePath), 'Action route must exist');

  const scenesContent = fs.readFileSync(scenesRoutePath, 'utf8');
  assert.ok(scenesContent.includes('export const GET'), 'Scenes route must export GET');
  assert.ok(scenesContent.includes('export const PUT'), 'Scenes route must export PUT');

  const actionContent = fs.readFileSync(actionRoutePath, 'utf8');
  assert.ok(actionContent.includes('export const POST'), 'Action route must export POST');
});

test('Workflow V2 Production Components: AffiliateProductionWorkspace & SceneInspector exist', () => {
  const wsPath = path.resolve(process.cwd(), 'app/affiliate-studio/components/AffiliateProductionWorkspace.js');
  const inspectorPath = path.resolve(process.cwd(), 'app/affiliate-studio/components/AffiliateSceneInspector.js');

  assert.ok(fs.existsSync(wsPath), 'AffiliateProductionWorkspace.js must exist');
  assert.ok(fs.existsSync(inspectorPath), 'AffiliateSceneInspector.js must exist');

  const wsContent = fs.readFileSync(wsPath, 'utf8');
  assert.ok(wsContent.includes('AffiliateSceneInspector'), 'Workspace must embed Scene Inspector');
  assert.ok(wsContent.includes('Reconcile Engine'), 'Workspace must have Reconcile Engine button');

  const inspectorContent = fs.readFileSync(inspectorPath, 'utf8');
  assert.ok(inspectorContent.includes('Storyboard'), 'Inspector must have Storyboard tab');
  assert.ok(inspectorContent.includes('Visual Plan'), 'Inspector must have Visual Plan tab');
  assert.ok(inspectorContent.includes('Voice-Over'), 'Inspector must have Voice-Over tab');
  assert.ok(inspectorContent.includes('T2I Prompt'), 'Inspector must have T2I tab');
  assert.ok(inspectorContent.includes('I2V Motion'), 'Inspector must have I2V tab');
});
