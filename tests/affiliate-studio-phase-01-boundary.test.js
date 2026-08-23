import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'path';

test('phase-01 APIs expose GET only', () => {
  const routes = [
    'app/api/v2/affiliate-studio/brands/route.js',
    'app/api/v2/affiliate-studio/brands/[id]/overview/route.js'
  ];

  for (const route of routes) {
    const filePath = path.resolve(process.cwd(), route);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf8');
    
    // Should not export POST, PUT, PATCH, DELETE
    assert.equal(content.includes('export const POST'), false, `${route} exposes POST`);
    assert.equal(content.includes('export const PUT'), false, `${route} exposes PUT`);
    assert.equal(content.includes('export const PATCH'), false, `${route} exposes PATCH`);
    assert.equal(content.includes('export const DELETE'), false, `${route} exposes DELETE`);
  }
});

test('phase-01 UI contains no write action labels', () => {
  const uiFiles = [
    'app/affiliate-studio/components/AffiliateStudioWorkspace.js',
    'app/affiliate-studio/components/AffiliateStudioShell.js',
    'app/affiliate-studio/components/BrandOverview.js'
  ];

  const forbiddenLabels = ['Create', 'Generate', 'Run', 'Retry', 'Approve', 'Publish', 'Delete', 'Edit'];

  for (const file of uiFiles) {
    const filePath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf8');
    
    // We should not find button tags or click actions with forbidden labels
    for (const label of forbiddenLabels) {
      const match = new RegExp(`<button[^>]*>[^<]*${label}[^<]*</button>`, 'i');
      assert.equal(match.test(content), false, `File ${file} has forbidden action label: ${label}`);
    }
  }
});

test('phase-01 code does not import legacy workers, prompts, or schedulers', () => {
  const sourceFiles = [
    'lib/affiliate-studio-workspace-state.js',
    'lib/affiliate-studio-brand-read-adapter.js',
    'app/api/v2/affiliate-studio/brands/route.js',
    'app/api/v2/affiliate-studio/brands/[id]/overview/route.js'
  ];

  const illegalImports = [
    'lib/prompts.js',
    'lib/scheduler-processors.js',
    'lib/campaign-scheduler.js',
    'lib/re-multiplier-worker.js',
    'lib/content-planner-engine.js'
  ];

  for (const file of sourceFiles) {
    const filePath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf8');

    for (const illegal of illegalImports) {
      const baseName = path.basename(illegal);
      assert.equal(content.includes(baseName), false, `File ${file} imports illegal module: ${illegal}`);
    }
  }
});
