import { pgQuery } from '../lib/db-pg.js';
import { tenantContext } from '../lib/tenant-context.js';
import {
  upsertBrandProduct,
  getBrandProduct
} from '../lib/brand-product-repository.js';
import { resolveAffiliateLink } from '../lib/affiliate-resolver.js';
import assert from 'assert';

async function runTests() {
  const tenantId = 'test_tenant_affiliate_' + Date.now();
  console.log(`Running Affiliate routing tests under tenant: ${tenantId}`);

  await tenantContext.run(tenantId, async () => {
    // 0. Ensure Tenant exists
    await pgQuery(`
      INSERT INTO tenants (id, name, slug, status)
      VALUES ($1, $1, $1, 'active')
      ON CONFLICT (id) DO NOTHING
    `, [tenantId]);

    // 1. Create Brand Profiles
    const brandAId = 'brand_a_' + Date.now();
    const brandBId = 'brand_b_' + Date.now();
    await pgQuery(`
      INSERT INTO brand_profiles (id, tenant_id, brand_name, tone_of_voice, visual_signature, color_palette, forbidden_elements, brand_slogan_or_cta)
      VALUES ($1, $2, 'Brand A', 'casual', 'modern', 'red', 'none', 'CTA A'),
             ($3, $2, 'Brand B', 'casual', 'modern', 'blue', 'none', 'CTA B')
    `, [brandAId, tenantId, brandBId]);

    // 2. Create Product
    const productId = 'prod_test_' + Date.now();
    await pgQuery(`
      INSERT INTO product_extractions (id, tenant_id, product_name, input_source, is_url, affiliate_link)
      VALUES ($1, $2, 'Test Product', 'https://store.com/prod', 1, 'https://legacy.link/prod')
    `, [productId, tenantId]);

    console.log('Setup finished. Testing associations...');

    // 3. Test Brand A Affiliate link (Should resolve to legacy because no association exists yet)
    const resLegacy = await resolveAffiliateLink({
      tenantId,
      brandProfileId: brandAId,
      productId,
      explicitAffiliateOverride: null,
      affiliateRequired: false
    });
    assert.strictEqual(resLegacy.affiliateLink, 'https://legacy.link/prod');
    assert.strictEqual(resLegacy.source, 'legacy_product');
    assert.strictEqual(resLegacy.status, 'legacy');
    console.log('✅ Legacy fallback resolution verified.');

    // 4. Associate Brand A with Product
    await upsertBrandProduct({
      brandProfileId: brandAId,
      productId,
      affiliateLink: 'https://brand-a.link/prod'
    });

    // 5. Test Brand A Affiliate link (Should resolve to Brand A specific link)
    const resBrandA = await resolveAffiliateLink({
      tenantId,
      brandProfileId: brandAId,
      productId,
      explicitAffiliateOverride: null,
      affiliateRequired: false
    });
    assert.strictEqual(resBrandA.affiliateLink, 'https://brand-a.link/prod');
    assert.strictEqual(resBrandA.source, 'brand_product');
    assert.strictEqual(resBrandA.status, 'resolved');
    console.log('✅ Brand-specific association resolution verified.');

    // 6. Test Brand B Affiliate link (Should still fallback to legacy because Brand B has no association)
    const resBrandB = await resolveAffiliateLink({
      tenantId,
      brandProfileId: brandBId,
      productId,
      explicitAffiliateOverride: null,
      affiliateRequired: false
    });
    assert.strictEqual(resBrandB.affiliateLink, 'https://legacy.link/prod');
    assert.strictEqual(resBrandB.source, 'legacy_product');
    console.log('✅ Tenant Brand B fallback resolution verified.');

    // 7. Test Campaign Override precedence (Priority 1)
    const resOverride = await resolveAffiliateLink({
      tenantId,
      brandProfileId: brandAId,
      productId,
      explicitAffiliateOverride: 'https://campaign-override.link/prod',
      affiliateRequired: false
    });
    assert.strictEqual(resOverride.affiliateLink, 'https://campaign-override.link/prod');
    assert.strictEqual(resOverride.source, 'campaign_override');
    console.log('✅ Campaign override precedence verified.');

    // 8. Test invalid schemes
    try {
      await resolveAffiliateLink({
        tenantId,
        brandProfileId: brandAId,
        productId,
        explicitAffiliateOverride: 'javascript:alert(1)',
        affiliateRequired: true
      });
      assert.fail('Should have failed validation for javascript schema');
    } catch (err) {
      assert.ok(err.message.includes('Scheme URL tidak valid'));
      console.log('✅ Invalid scheme validation verified.');
    }

    console.log('All tests passed successfully!');
  });
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
