/**
 * test-product-pipeline.js
 * Integration test for Phase 8.
 * Directly connects to the central Node 3 database with schema 'dev' for validation.
 */

import assert from 'node:assert/strict';
import pg from 'pg';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { tenantContext } from '../lib/tenant-context.js';

// Setup environment overrides for central Node 3 DB
process.env.PGHOST = '100.78.186.123';
process.env.PGPORT = '5432';
process.env.PGUSER = 'makna_user';
process.env.PGPASSWORD = 'maknagridpass';
process.env.PGDATABASE = 'maknaflow_db';
process.env.PG_SEARCH_PATH = 'dev'; // Staging/dev schema

// Initialize libraries after setting env
const { createProduct, updateProduct, getProductById, listProducts } = await import('../lib/product-repository.js');
const { validateSingleProductCreate, validateSingleProductUpdate, validateProductImportRow } = await import('../lib/product-validation.js');
const { resolveProductPhotoProvider } = await import('../lib/product-photo-service.js');
const { resolveProductImagePath } = await import('../lib/sheets-autopilot-worker.js');
const { setSetting } = await import('../lib/db.js');

const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const tenantA = `test_tenant_a_${suffix}`;
const tenantB = `test_tenant_b_${suffix}`;
const productId = `test_prod_${suffix}`;

const client = new pg.Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE
});

console.log('Starting Product Pipeline tests...');

try {
  await client.connect();
  // Set schema search path
  await client.query('SET search_path TO dev, public;');

  // ==========================================
  // Test 1: Validation Logic
  // ==========================================
  console.log('Testing Validation...');
  
  // 1a. Invalid create (missing product_name)
  const invalidCreate = validateSingleProductCreate({ product: { product_description: 'Valid description that has at least 10 chars' }, isNewUI: true });
  assert.ok(invalidCreate.errors.product_name, 'Should fail without product name');
  assert.ok(invalidCreate.errors.raw_photo, 'Should fail without raw photo in new UI');
  assert.ok(invalidCreate.errors.packaging_status, 'Should fail without packaging status');

  // 1b. Valid import row
  const importRow = {
    product_name: 'Test Product X',
    product_description: 'Excellent product with high quality features.',
    raw_photo_source_url: 'https://example.com/photo.jpg',
    page: '12',
    source_url: 'https://shopee.co.id/product/123',
    affiliate_link: 'https://shope.ee/xyz'
  };
  const validRowResult = validateProductImportRow(importRow, 2);
  assert.ok(validRowResult.valid, 'Import row should be valid');
  assert.equal(validRowResult.data.product_name, 'Test Product X');

  // ==========================================
  // Test 2: Repository Operations & Single Create
  // ==========================================
  console.log('Testing Single Create...');
  const newProductData = {
    id: productId,
    product_name: 'Test Product A',
    product_description: 'Description that is long enough to pass validation',
    raw_description: 'Description that is long enough to pass validation',
    packaging_status: 'packaged',
    packaging_type: 'Glass Bottle',
    raw_photo_url: '/uploads/products/raw/test.png',
    photo_url: '/uploads/products/raw/test.png',
    enrichment_status: 'pending',
    photo_status: 'pending'
  };

  const created = await tenantContext.run(tenantA, () => createProduct(newProductData));
  assert.equal(created.product_name, 'Test Product A');
  assert.equal(created.tenant_id, tenantA);

  // ==========================================
  // Test 3: Tenant Isolation
  // ==========================================
  console.log('Testing Tenant Isolation...');
  
  // List from Tenant A
  const listA = await tenantContext.run(tenantA, () => listProducts({ search: 'Test Product A' }));
  assert.equal(listA.length, 1, 'Tenant A should see its product');
  assert.equal(listA[0].id, productId);

  // List from Tenant B (should be empty)
  const listB = await tenantContext.run(tenantB, () => listProducts({ search: 'Test Product A' }));
  assert.equal(listB.length, 0, 'Tenant B should not see Tenant A products');

  // ==========================================
  // Test 4: Provider Resolution & Settings fallback
  // ==========================================
  console.log('Testing Provider Resolution...');
  
  // Default fallback without settings is 'glabs'
  const providerDefault = await tenantContext.run(tenantA, () => resolveProductPhotoProvider(created, tenantA));
  assert.equal(providerDefault, 'glabs', 'Should fallback to glabs by default');

  // Set setting and verify resolution
  await tenantContext.run(tenantA, () => setSetting('product_photo_provider', 'gemini'));
  
  const providerGemini = await tenantContext.run(tenantA, () => resolveProductPhotoProvider(created, tenantA));
  assert.equal(providerGemini, 'gemini', 'Should resolve to gemini after settings update');

  // Product level override
  const overrideProduct = { ...created, photo_provider: 'glabs' };
  const providerOverride = await tenantContext.run(tenantA, () => resolveProductPhotoProvider(overrideProduct, tenantA));
  assert.equal(providerOverride, 'glabs', 'Product level override should take precedence');

  // Clean up setting
  await tenantContext.run(tenantA, () => setSetting('product_photo_provider', ''));

  // ==========================================
  // Test 5: Photo Field Semantics (Clean -> Raw)
  // ==========================================
  console.log('Testing Photo Field Semantics...');
  
  // Write dummy files to disk so they exist for fs.existsSync check
  const cleanImgPath = path.join(process.cwd(), 'public', 'uploads', 'products', 'clean', 'image.png');
  const rawImgPath = path.join(process.cwd(), 'public', 'uploads', 'products', 'raw', 'image.png');
  fs.mkdirSync(path.dirname(cleanImgPath), { recursive: true });
  fs.mkdirSync(path.dirname(rawImgPath), { recursive: true });
  fs.writeFileSync(cleanImgPath, 'dummy');
  fs.writeFileSync(rawImgPath, 'dummy');

  const productWithClean = {
    clean_photo_url: '/uploads/products/clean/image.png',
    raw_photo_url: '/uploads/products/raw/image.png',
    generated_photo_url: '/uploads/products/generated/image.png'
  };

  const resolvedPath = resolveProductImagePath(productWithClean);
  assert.equal(resolvedPath, '/uploads/products/clean/image.png', 'Prioritize clean_photo_url over generated/raw');

  const productWithOnlyRaw = {
    raw_photo_url: '/uploads/products/raw/image.png',
    generated_photo_url: '/uploads/products/generated/image.png'
  };
  const resolvedPathRaw = resolveProductImagePath(productWithOnlyRaw);
  assert.equal(resolvedPathRaw, '/uploads/products/raw/image.png', 'Prioritize raw_photo_url when clean is absent');

  // Clean up physical dummy files
  try { fs.unlinkSync(cleanImgPath); } catch (_) {}
  try { fs.unlinkSync(rawImgPath); } catch (_) {}

  // ==========================================
  // Test 6: Retry & Error States
  // ==========================================
  console.log('Testing Retry State Reset...');
  
  // Set failed state
  await tenantContext.run(tenantA, () => updateProduct(productId, {
    photo_status: 'failed',
    photo_error: 'G-Labs timed out'
  }));

  const failedProd = await tenantContext.run(tenantA, () => getProductById(productId));
  assert.equal(failedProd.photo_status, 'failed');
  assert.equal(failedProd.photo_error, 'G-Labs timed out');

  // Trigger retry (reset to pending)
  await tenantContext.run(tenantA, () => updateProduct(productId, {
    photo_status: 'pending',
    photo_error: null
  }));

  const retriedProd = await tenantContext.run(tenantA, () => getProductById(productId));
  assert.equal(retriedProd.photo_status, 'pending');
  assert.equal(retriedProd.photo_error, null, 'Error message should be cleared on retry');

  console.log('\n🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');

} catch (err) {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
} finally {
  // Clean up
  console.log('Cleaning up test data...');
  await client.query('DELETE FROM product_extractions WHERE tenant_id = ANY($1::text[])', [[tenantA, tenantB]]).catch(() => {});
  await client.query('DELETE FROM tenant_settings WHERE tenant_id = ANY($1::text[])', [[tenantA, tenantB]]).catch(() => {});
  await client.end();
}
