import assert from 'node:assert/strict';
import { tenantContext } from '../lib/tenant-context.js';
import { listEligibleAutomationProducts } from '../lib/content-automation-product-snapshot.js';
import { ensureAutomationProductBinding } from '../lib/content-automation-binding-service.js';
import { pgQuery } from '../lib/db-pg.js';

await tenantContext.run('default_tenant', async () => {
  const brand = (await pgQuery("SELECT id FROM brand_profiles WHERE tenant_id=$1 ORDER BY brand_name LIMIT 1", ['default_tenant'])).rows[0];
  assert.ok(brand?.id, 'Dev fixture membutuhkan minimal satu Brand Profile.');
  const result = await listEligibleAutomationProducts({ brandProfileId: brand.id });
  assert.equal(result.summary.total, result.products.length);
  assert.equal(result.summary.linked + result.summary.unlinked, result.summary.total);
  assert.ok(result.products.length > 0, 'Katalog harus memuat Data Produk tenant, termasuk unlinked.');
  const unlinked = result.products.find(product => !product.brand_product_id);
  assert.ok(unlinked, 'Dev fixture harus memiliki minimal satu produk unlinked.');
  await assert.rejects(() => ensureAutomationProductBinding({ brandProfileId: brand.id, productId: unlinked.product_id, bindingInput: { product_id: 'different-product' } }), /tidak konsisten/);
  let created;
  try {
    created = await ensureAutomationProductBinding({ brandProfileId: brand.id, productId: unlinked.product_id, bindingInput: { product_id: unlinked.product_id, notes: 'temporary content automation integration test' } });
    assert.equal(created.action, 'created');
    const reused = await ensureAutomationProductBinding({ brandProfileId: brand.id, productId: unlinked.product_id, bindingInput: { product_id: unlinked.product_id } });
    assert.equal(reused.action, 'reused');
    assert.equal(reused.binding.id, created.binding.id);
  } finally {
    if (created?.binding?.id) await pgQuery('DELETE FROM brand_products WHERE id=$1 AND tenant_id=$2', [created.binding.id, 'default_tenant']);
  }
});
console.log('Content Automation Product catalog/binding integration tests passed.');
