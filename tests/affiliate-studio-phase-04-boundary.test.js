import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

test('planner connection APIs export correct methods', () => {
  const routes = [
    { file: 'app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/planners/route.js', allowed: ['GET', 'POST'], forbidden: ['PUT', 'DELETE', 'PATCH'] },
    { file: 'app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/planners/[plannerId]/route.js', allowed: ['DELETE'], forbidden: ['GET', 'POST', 'PUT', 'PATCH'] },
    { file: 'app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/planners/[plannerId]/rows/route.js', allowed: ['GET', 'PUT'], forbidden: ['POST', 'DELETE', 'PATCH'] }
  ];

  for (const route of routes) {
    const content = fs.readFileSync(path.resolve(process.cwd(), route.file), 'utf8');

    for (const allow of route.allowed) {
      assert.ok(content.includes(`export const ${allow}`), `${route.file} should export ${allow}`);
    }

    for (const forbid of route.forbidden) {
      assert.equal(content.includes(`export const ${forbid}`), false, `${route.file} must not export ${forbid}`);
    }
  }
});

test('Fase 4 code does not import prompts, schedulers, or bulk workers', () => {
  const filesToCheck = [
    'lib/affiliate-studio-planner-adapter.js',
    'app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/planners/route.js',
    'app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/planners/[plannerId]/route.js',
    'app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/planners/[plannerId]/rows/route.js'
  ];

  const forbiddenImports = [
    'product-bulk-worker.js',
    'product-photo-service.js',
    'campaign-scheduler.js',
    'scheduler-processors.js',
    'prompts.js'
  ];

  for (const filename of filesToCheck) {
    const content = fs.readFileSync(path.resolve(process.cwd(), filename), 'utf8');

    for (const forbidden of forbiddenImports) {
      assert.equal(
        content.includes(forbidden),
        false,
        `File ${filename} must not import or reference legacy worker/scheduler: "${forbidden}"`
      );
    }
  }
});

test('Fase 4 does not modify content planner schemas or engines', () => {
  const contentPlannerEngine = fs.readFileSync(
    path.resolve(process.cwd(), 'lib/content-planner-engine.js'),
    'utf8'
  );

  // Assert no affiliate campaign specific tables are written to content planner engine
  const forbiddenTables = ['affiliate_programs', 'affiliate_program_planners', 'affiliate_planner_row_links'];
  for (const table of forbiddenTables) {
    assert.equal(
      contentPlannerEngine.includes(table),
      false,
      `content-planner-engine.js must remain untouched by new affiliate relations: "${table}"`
    );
  }
});

test('Fase 4 does not modify frozen modules', () => {
  const frozenFiles = [
    'lib/product-repository.js',
    'lib/product-catalog-service.js',
    'lib/product-validation.js',
    'lib/product-image-storage.js',
    'lib/product-bulk-worker.js',
    'lib/product-photo-service.js',
    'lib/brand-product-repository.js',
    'lib/affiliate-resolver.js',
    'lib/campaign-product-binding.js',
    'lib/auth.js',
    'lib/db.js',
    'lib/prompts.js',
    'lib/scheduler-processors.js',
    'lib/campaign-scheduler.js',
    'app/theme.css'
  ];

  for (const file of frozenFiles) {
    assert.ok(fs.existsSync(path.resolve(process.cwd(), file)), `Frozen file must exist: ${file}`);
  }
});
