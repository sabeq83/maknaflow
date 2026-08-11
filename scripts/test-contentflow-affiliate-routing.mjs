import { pgQuery } from '../lib/db-pg.js';
import { tenantContext } from '../lib/tenant-context.js';
import { createOrUpdateCampaignProductBinding } from '../lib/campaign-product-binding.js';
import { upsertContentFlowItem, listContentFlowItems } from '../lib/contentflow-repository.js';
import assert from 'assert';

async function runTests() {
  const tenantId = 'test_tenant_cf_' + Date.now();
  console.log(`Running Content Flow Lineage tests under tenant: ${tenantId}`);

  await tenantContext.run(tenantId, async () => {
    // 0. Ensure Tenant exists
    await pgQuery(`
      INSERT INTO tenants (id, name, slug, status)
      VALUES ($1, $1, $1, 'active')
      ON CONFLICT (id) DO NOTHING
    `, [tenantId]);

    // 1. Create Brand Profile
    const brandId = 'brand_cf_' + Date.now();
    await pgQuery(`
      INSERT INTO brand_profiles (id, tenant_id, brand_name, tone_of_voice, visual_signature, color_palette, forbidden_elements, brand_slogan_or_cta)
      VALUES ($1, $2, 'Content Flow Brand', 'casual', 'vibrant', 'green', 'none', 'CTA')
    `, [brandId, tenantId]);

    // 2. Create Product
    const productId = 'prod_cf_' + Date.now();
    await pgQuery(`
      INSERT INTO product_extractions (id, tenant_id, product_name, input_source, is_url, affiliate_link)
      VALUES ($1, $2, 'Content Flow Test Product', 'https://store.com/cf-product', 1, 'https://affiliate.com/cf-link')
    `, [productId, tenantId]);

    const campaignId = 'camp_cf_' + Date.now();
    const itemId = 'item_cf_' + Date.now();

    // 3. Create Binding Snapshot
    const binding = await createOrUpdateCampaignProductBinding({
      tenantId,
      sourceType: 'opc',
      sourceCampaignId: campaignId,
      sourceItemId: itemId,
      brandProfileId: brandId,
      productId,
      explicitAffiliateOverride: null
    });

    assert.ok(binding, 'Binding snapshot should be created');

    // 4. Ingest into Content Flow with Lineage
    const cfId = `cf_test_${Date.now()}`;
    await upsertContentFlowItem({
      id: cfId,
      source_type: 'opc',
      source_campaign_id: campaignId,
      source_item_id: itemId,
      account_name: 'Content Flow Brand',
      video_id: 'CF-VID-001',
      campaign_title: 'Test Campaign Flow',
      hook: 'Test Hook Lineage',
      nama_produk: binding.product_name_snapshot,
      link_affiliate: binding.affiliate_link_snapshot,
      link_produk: binding.product_url_snapshot,
      caption: 'Lineage test caption',
      production_date: new Date().toISOString(),
      url_asset: 'https://storage.com/asset.mp4',
      drive_link: '',
      nextcloud_url: '',
      pipeline_status: 'Completed',
      brand_profile_id: binding.brand_profile_id,
      brand_product_id: binding.brand_product_id,
      product_id: binding.product_id,
      affiliate_source: binding.affiliate_source,
      affiliate_status: binding.affiliate_status,
      affiliate_resolved_at: binding.resolved_at
    });

    console.log('✅ Content Flow item inserted with complete lineage.');

    // 5. Query and verify lineage
    const result = await listContentFlowItems({
      sourceType: 'opc',
      accountName: 'all',
      productName: 'all',
      pipelineStatus: 'all',
      q: 'CF-VID-001',
      page: 1,
      limit: 10
    });

    assert.ok(result.items && result.items.length > 0, 'Should find inserted content flow item');
    const item = result.items[0];

    assert.strictEqual(item.video_id, 'CF-VID-001');
    assert.strictEqual(item.product_id, productId);
    assert.strictEqual(item.brand_profile_id, brandId);
    assert.strictEqual(item.affiliate_source, 'legacy_product');
    assert.strictEqual(item.affiliate_status, 'legacy');
    assert.strictEqual(item.link_affiliate, 'https://affiliate.com/cf-link');

    console.log('✅ Lineage query and data integrity verified successfully.');
    console.log('All Content Flow tests passed!');
    process.exit(0);
  });
}

runTests().catch(err => {
  console.error('❌ Content Flow test failed:', err);
  process.exit(1);
});
