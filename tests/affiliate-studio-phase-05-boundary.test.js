import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

test('runs visibility APIs export correct methods', () => {
  const routes = [
    { file: 'app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/runs/route.js', allowed: ['GET', 'POST'], forbidden: ['PUT', 'DELETE', 'PATCH'] },
    { file: 'app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/runs/reconcile/route.js', allowed: ['POST'], forbidden: ['GET', 'PUT', 'DELETE', 'PATCH'] }
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

test('Fase 5 code does not import prompts or scheduling processors', () => {
  const filesToCheck = [
    'lib/affiliate-studio-production-adapter.js',
    'app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/runs/route.js',
    'app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/runs/reconcile/route.js'
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
        `File ${filename} must not import or reference legacy: "${forbidden}"`
      );
    }
  }
});

test('Fase 5 does not modify legacy engine cores', () => {
  const engineFiles = [
    'lib/content-planner-engine.js'
  ];

  const forbiddenStrings = [
    'affiliate_content_runs',
    'affiliate_content_run_events'
  ];

  for (const engineFile of engineFiles) {
    if (fs.existsSync(path.resolve(process.cwd(), engineFile))) {
      const content = fs.readFileSync(path.resolve(process.cwd(), engineFile), 'utf8');
      for (const str of forbiddenStrings) {
        assert.equal(
          content.includes(str),
          false,
          `Engine core ${engineFile} must remain untouched: "${str}"`
        );
      }
    }
  }
});

test('Fase 5 does not modify frozen modules', () => {
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
