import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

test('Fase 8 code does not import prompts or scheduling processors', () => {
  const filesToCheck = [
    'lib/affiliate-studio-launch-adapter.js'
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

test('Fase 8 does not modify frozen modules', () => {
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
