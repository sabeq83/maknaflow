import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('ContentFlow Page UI includes Multiplier Lab source option and badge', () => {
  const pagePath = path.join(process.cwd(), 'app', 'content-flow', 'page.js');
  const content = fs.readFileSync(pagePath, 'utf8');

  // Verify dropdown contains multiplier option
  assert.ok(
    content.includes('<option value="multiplier">🔬 Multiplier Lab</option>'),
    'ContentFlow dropdown must include Multiplier Lab option'
  );

  // Verify getSourceBadge includes multiplier
  assert.ok(
    content.includes("multiplier: { label: 'Multiplier Lab'"),
    'getSourceBadge must define multiplier badge'
  );

  // Verify getSourceBadge is rendered on cards
  assert.ok(
    content.includes('{item.source_type && getSourceBadge(item.source_type)}'),
    'Cards must display getSourceBadge'
  );

  // Verify getBrandBadgeStyle includes nutribake
  assert.ok(
    content.includes("acc === 'nutribake'") || content.includes("acc.includes('nutri')"),
    'getBrandBadgeStyle must support nutribake'
  );
});

test('ContentFlow Route allows superadmin to access all accounts', () => {
  const routePath = path.join(process.cwd(), 'app', 'api', 'content-flow', 'route.js');
  const content = fs.readFileSync(routePath, 'utf8');

  assert.ok(
    content.includes("(user.role === 'admin' || user.role === 'superadmin')"),
    'Route must bypass allowedAccounts restriction for both admin and superadmin'
  );
});

test('ContentFlow Ingest maps Multiplier Lab tasks with brand detection, recipe, and YouTube title', () => {
  const ingestPath = path.join(process.cwd(), 'lib', 'contentflow-ingest.js');
  const content = fs.readFileSync(ingestPath, 'utf8');

  // Check brandProfilesList lookup
  assert.ok(
    content.includes('SELECT id, brand_name, nextcloud_parent_folder'),
    'Ingestion must query brand profiles for brand detection'
  );

  // Check nextcloudParentFolder matching
  assert.ok(
    content.includes('targetFolder.includes(bp.brand_name.toLowerCase())'),
    'Ingestion must match nextcloudParentFolder with brand_name'
  );

  // Check YouTube title and recipe mapping
  assert.ok(
    content.includes('social_media_package_json: ytTitle ? JSON.stringify({ title: ytTitle, caption: item.new_caption }) : null'),
    'Ingestion must set social_media_package_json when ytTitle exists'
  );

  assert.ok(
    content.includes("content_kind: isRecipe ? 'recipe' : 'generic'"),
    'Ingestion must assign recipe content_kind when recipe flag is active'
  );
});

test('Database query in lib/db.js checks multiplier source_type for sync status', () => {
  const dbPath = path.join(process.cwd(), 'lib', 'db.js');
  const content = fs.readFileSync(dbPath, 'utf8');

  assert.ok(
    content.includes("cf.source_type = 'multiplier'"),
    'getMultiplierTasks must check cf.source_type = multiplier'
  );
});
