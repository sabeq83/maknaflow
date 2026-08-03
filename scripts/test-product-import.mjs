import assert from 'node:assert/strict';
import pg from 'pg';
import { loadStagingEnv } from './local-staging/env.js';
import { normalizeImportedProductImagePath, validateProductAssetEntryName } from '../lib/product-import-archive.js';

Object.assign(process.env, loadStagingEnv());
const { tenantContext } = await import('../lib/tenant-context.js');
const { importProducts, listProducts } = await import('../lib/product-repository.js');

assert.equal(validateProductAssetEntryName('assets/uploads/products/photo.webp'), 'uploads/products/photo.webp');
assert.throws(() => validateProductAssetEntryName('assets/../secrets.txt'), /tidak aman/);
assert.throws(() => validateProductAssetEntryName('assets/uploads/products/payload.js'), /tidak diizinkan/);
assert.equal(normalizeImportedProductImagePath('uploads/products/photo.webp'), '/uploads/products/photo.webp');
assert.equal(normalizeImportedProductImagePath('https://cdn.example.test/photo.webp'), 'https://cdn.example.test/photo.webp');
assert.throws(() => normalizeImportedProductImagePath('../../private/photo.webp'), /tidak aman/);

const client = new pg.Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE
});

const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const tenantA = `test_product_a_${suffix}`;
const tenantB = `test_product_b_${suffix}`;
const productId = `test_product_${suffix}`;
const sourceUrl = `https://example.test/${suffix}`;

await client.connect();
try {
  const first = await tenantContext.run(tenantA, () => importProducts([{
    id: productId,
    input_source: sourceUrl,
    source_url: sourceUrl,
    product_name: 'Regression Product A'
  }]));
  assert.deepEqual(first, { importedCount: 1, skippedCount: 0 });

  const duplicate = await tenantContext.run(tenantA, () => importProducts([{
    id: productId,
    input_source: sourceUrl,
    source_url: sourceUrl,
    product_name: 'Regression Product A'
  }]));
  assert.deepEqual(duplicate, { importedCount: 0, skippedCount: 1 });

  const crossTenant = await tenantContext.run(tenantB, () => importProducts([{
    id: productId,
    input_source: sourceUrl,
    source_url: sourceUrl,
    product_name: 'Regression Product B'
  }]));
  assert.deepEqual(crossTenant, { importedCount: 1, skippedCount: 0 });

  const rowsA = await tenantContext.run(tenantA, () => listProducts({ search: 'Regression Product' }));
  const rowsB = await tenantContext.run(tenantB, () => listProducts({ search: 'Regression Product' }));
  assert.equal(rowsA.length, 1);
  assert.equal(rowsB.length, 1);
  assert.equal(rowsA[0].tenant_id, tenantA);
  assert.equal(rowsB[0].tenant_id, tenantB);
  assert.notEqual(rowsA[0].id, rowsB[0].id);

  await assert.rejects(
    tenantContext.run(tenantA, () => importProducts([
      { id: `rollback_${suffix}`, product_name: 'Must Roll Back' },
      { id: `invalid_${suffix}`, product_name: '' }
    ])),
    /product_name/
  );
  const rolledBack = await client.query('SELECT COUNT(*)::int AS count FROM product_extractions WHERE id = $1', [`rollback_${suffix}`]);
  assert.equal(rolledBack.rows[0].count, 0);

  console.log('Product import regression test passed: insert, duplicate, rollback, ZIP safety, and tenant isolation.');
} finally {
  await client.query('DELETE FROM product_extractions WHERE tenant_id = ANY($1::text[])', [[tenantA, tenantB]]).catch(() => {});
  await client.end();
}
