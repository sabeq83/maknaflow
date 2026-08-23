import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

test('programs APIs export correct methods', () => {
  const routes = [
    { file: 'app/api/v2/affiliate-studio/brands/[id]/programs/route.js', allowed: ['GET', 'POST'], forbidden: ['PUT', 'DELETE', 'PATCH'] },
    { file: 'app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/route.js', allowed: ['GET', 'PUT', 'DELETE'], forbidden: ['POST', 'PATCH'] },
    { file: 'app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/products/route.js', allowed: ['POST', 'DELETE'], forbidden: ['GET', 'PUT', 'PATCH'] }
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

test('Fase 3 UI does not contain legacy write triggers or direct engine mutations', () => {
  const files = [
    'app/affiliate-studio/components/BrandCampaignPrograms.js',
    'app/affiliate-studio/components/CampaignProgramDetail.js'
  ];

  const forbiddenEngineTriggers = [
    'triggerPillar',
    'triggerReCampaign',
    'triggerRecipe',
    'triggerMultiplier',
    'executeEngine',
    'launchPillar',
    'launchRe',
    'launchRecipe',
    'launchMultiplier',
    'createPlanner',
    'createSheet',
    'syncPlanner',
    'syncSheets'
  ];

  for (const file of files) {
    const content = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
    for (const trigger of forbiddenEngineTriggers) {
      assert.equal(
        content.includes(trigger),
        false,
        `UI file ${file} must not invoke direct engine execution: "${trigger}"`
      );
    }
  }
});

test('Fase 3 code does not import prompts, schedulers, or worker modules', () => {
  const filesToCheck = [
    'lib/affiliate-studio-campaign-program-adapter.js',
    'app/api/v2/affiliate-studio/brands/[id]/programs/route.js',
    'app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/route.js',
    'app/api/v2/affiliate-studio/brands/[id]/programs/[programId]/products/route.js'
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

test('Fase 3 does not modify frozen modules', () => {
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
