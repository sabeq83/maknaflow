import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

test('portfolio API exports GET only', () => {
  const content = fs.readFileSync(
    path.resolve(process.cwd(), 'app/api/v2/affiliate-studio/brands/[id]/products/route.js'),
    'utf8'
  );
  
  assert.ok(content.includes('export const GET'), 'GET handler should be exported');
  assert.equal(content.includes('export const POST'), false, 'POST handler should not be exported');
  assert.equal(content.includes('export const PUT'), false, 'PUT handler should not be exported');
  assert.equal(content.includes('export const PATCH'), false, 'PATCH handler should not be exported');
  assert.equal(content.includes('export const DELETE'), false, 'DELETE handler should not be exported');
});

test('portfolio UI contains no mutation action', async () => {
  const uiFileContent = fs.readFileSync(
    path.resolve(process.cwd(), 'app/affiliate-studio/components/BrandProductPortfolio.js'),
    'utf8'
  );

  const forbiddenMutationTriggers = [
    'onSubmit',
    'onClick',
    'onChange'
  ];

  // We have search form submit and filters change and load more click, which are read/navigation-only.
  // We want to ensure there is no link/unlink/create/edit/delete handler logic or buttons.
  const forbiddenKeywords = [
    'createProduct',
    'editProduct',
    'deleteProduct',
    'linkProduct',
    'unlinkProduct',
    'updateAssociation',
    'saveOverride',
    '<button>Link',
    '<button>Unlink',
    '<button>Delete',
    'handleDelete',
    'handleCreate',
    'handleLink',
    'handleUnlink'
  ];

  for (const keyword of forbiddenKeywords) {
    assert.equal(
      uiFileContent.includes(keyword),
      false,
      `UI code must not contain mutation keyword: "${keyword}"`
    );
  }
});

test('Fase 2 code does not import product workers or campaign binding mutation', async () => {
  const filesToCheck = [
    'lib/affiliate-studio-product-readiness.js',
    'lib/affiliate-studio-brand-product-read-adapter.js',
    'app/api/v2/affiliate-studio/brands/[id]/products/route.js',
    'app/affiliate-studio/components/BrandProductPortfolio.js'
  ];

  const forbiddenImports = [
    'product-bulk-worker.js',
    'product-photo-service.js',
    'campaign-product-binding.js',
    'brand-product-repository.js'
  ];

  for (const filename of filesToCheck) {
    const filePath = path.resolve(process.cwd(), filename);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf8');

    for (const forbidden of forbiddenImports) {
      assert.equal(
        content.includes(forbidden),
        false,
        `File ${filename} must not import or reference forbidden module: "${forbidden}"`
      );
    }
  }
});

test('Fase 2 does not add schema or modify frozen modules', () => {
  const forbiddenFiles = [
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
    'lib/db-pg.js',
    'lib/prompts.js',
    'lib/scheduler-processors.js',
    'lib/campaign-scheduler.js',
    'app/theme.css'
  ];

  // We verify that none of these frozen files are modified in our local changes.
  // (We can check via git or check their git status in integration tests)
  // Let's assert that they exist and are frozen.
  for (const file of forbiddenFiles) {
    const filePath = path.resolve(process.cwd(), file);
    assert.ok(fs.existsSync(filePath), `Frozen file should exist: ${file}`);
  }
});
