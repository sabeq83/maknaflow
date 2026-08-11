import { pgQuery } from '../lib/db-pg.js';
import { tenantContext } from '../lib/tenant-context.js';
import {
  createOrUpdateCampaignProductBinding,
  getCampaignProductBinding
} from '../lib/campaign-product-binding.js';
import assert from 'assert';

async function runTests() {
  const tenantId = 'test_tenant_binding_' + Date.now();
  console.log(`Running Campaign Product Binding snapshot tests under tenant: ${tenantId}`);

  await tenantContext.run(tenantId, async () => {
    // 0. Ensure Tenant exists
    await pgQuery(`
      INSERT INTO tenants (id, name, slug, status)
      VALUES ($1, $1, $1, 'active')
      ON CONFLICT (id) DO NOTHING
    `, [tenantId]);

    // 1. Create Brand Profile
    const brandId = 'brand_bind_' + Date.now();
    await pgQuery(`
      INSERT INTO brand_profiles (id, tenant_id, brand_name, tone_of_voice, visual_signature, color_palette, forbidden_elements, brand_slogan_or_cta)
      VALUES ($1, $2, 'Binding Brand', 'professional', 'minimal', 'gold', 'none', 'CTA')
    `, [brandId, tenantId]);

    // 2. Create Product
    const productId = 'prod_bind_' + Date.now();
    await pgQuery(`
      INSERT INTO product_extractions (id, tenant_id, product_name, input_source, is_url, affiliate_link)
      VALUES ($1, $2, 'Original Product Name', 'https://store.com/original-url', 1, 'https://affiliate.com/original-link')
    `, [productId, tenantId]);

    const campaignId = 'camp_' + Date.now();
    const itemId = 'item_' + Date.now();

    // 3. Create Campaign Binding Snapshot
    const binding = await createOrUpdateCampaignProductBinding({
      tenantId,
      sourceType: 'opc',
      sourceCampaignId: campaignId,
      sourceItemId: itemId,
      brandProfileId: brandId,
      productId,
      explicitAffiliateOverride: null
    });

    assert.ok(binding, 'Binding should be created');
    assert.strictEqual(binding.product_name_snapshot, 'Original Product Name');
    assert.strictEqual(binding.product_url_snapshot, 'https://store.com/original-url');
    assert.strictEqual(binding.affiliate_link_snapshot, 'https://affiliate.com/original-link');
    console.log('✅ Initial snapshot created and verified.');

    // 4. Mutate the original product record
    await pgQuery(`
      UPDATE product_extractions
      SET product_name = 'MUTATED PRODUCT NAME',
          source_url = 'https://store.com/mutated-url',
          affiliate_link = 'https://affiliate.com/mutated-link'
      WHERE id = $1 AND tenant_id = $2
    `, [productId, tenantId]);

    // 5. Query binding snapshot and verify immutability
    const snapshot = await getCampaignProductBinding({
      tenantId,
      sourceType: 'opc',
      sourceCampaignId: campaignId,
      sourceItemId: itemId
    });

    assert.ok(snapshot, 'Snapshot must be retrievable');
    assert.strictEqual(snapshot.product_name_snapshot, 'Original Product Name', 'Product name snapshot must remain immutable');
    assert.strictEqual(snapshot.product_url_snapshot, 'https://store.com/original-url', 'Product URL snapshot must remain immutable');
    assert.strictEqual(snapshot.affiliate_link_snapshot, 'https://affiliate.com/original-link', 'Affiliate link snapshot must remain immutable');
    console.log('✅ Immutability verified: snapshot preserved original values despite source record mutation.');

    console.log('All binding snapshot tests passed successfully!');
    process.exit(0);
  });
}

runTests().catch(err => {
  console.error('❌ Binding test failed:', err);
  process.exit(1);
});
