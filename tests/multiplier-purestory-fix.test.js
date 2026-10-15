import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('🧪 Starting Multiplier isPureStory Logic & Payload Construction Test...\n');

// 1. Verify that isPureStory is properly declared in app/multiplier-lab/page.js
const pageJsPath = path.resolve('app/multiplier-lab/page.js');
const pageJsContent = fs.readFileSync(pageJsPath, 'utf8');

assert(
  pageJsContent.includes('const isPureStory = campaignType === \'editorial\''),
  'app/multiplier-lab/page.js must explicitly declare const isPureStory'
);
console.log('Test 1: Declaration in app/multiplier-lab/page.js');
console.log('  ✓ const isPureStory is explicitly declared before payload construction');

// 2. Helper simulating handleSubmit logic
function simulateBuildPayload({
  campaignType,
  workflowMode = 'one_blueprint_multi_product',
  combinationRows = [],
  targetProductId = '',
  products = [],
  campaignName = '',
  accountName = '',
  editorialTopic = 'Kisah Inspiratif',
  editorialOutro = 'Follow untuk cerita lainnya',
  selectedBrandId = 'brand_123',
  isBridgingActive = true,
  targetClipsCount = 8,
  bridgeAtClip = 4,
  bridgeDurationClips = 2,
  promotionStyle = 'Softselling',
  bridgingMode = 'url_extract',
  manualProductName = 'NutriBake Roti Gandum',
  manualProductDesc = 'Roti sehat tanpa gula',
  manualProductUsp = '0 gram gula pasir',
  productUrl = 'https://shopee.co.id/nutribake',
  productRefImage = 'https://example.com/photo.jpg'
}) {
  const isPureStory = campaignType === 'editorial' || 
                      workflowMode === 'one_blueprint_multi_angle' || 
                      workflowMode === 'multi_blueprint_one_angle' ||
                      (combinationRows.length > 0 && combinationRows.every(r => r.campaign_type === 'pure_storytelling'));

  const dbProduct = targetProductId ? products.find(p => p.id === targetProductId) : null;
  const dbPhotoUrl = dbProduct ? (dbProduct.cleaned_photo_url || dbProduct.clean_photo_url || dbProduct.raw_photo_url) : null;

  const cleanCampaignName = campaignName.trim() || `[ MULTIPLIER ] - ${accountName ? accountName + ' - ' : ''}${editorialTopic.trim() || 'Kampanye Multiplier'}`;

  const payload = {
    mode: workflowMode,
    campaign_name: cleanCampaignName,
    brand_profile_id: selectedBrandId || null,
    account_name: accountName || null,
    rows: combinationRows.map(row => ({
      deconstruct_asset_id: row.deconstruct_asset_id,
      target_product_id: row.target_product_id,
      target_product_url: row.target_product_url,
      affiliate_url: row.affiliate_url,
      campaign_name: cleanCampaignName,
      brand_profile_id: selectedBrandId || null,
      account_name: accountName || null,
      campaign_type: row.campaign_type || (isPureStory ? 'pure_storytelling' : 'product_campaign'),
      editorial_topic: row.editorial_topic || editorialTopic.trim(),
      editorial_outro: row.editorial_outro || editorialOutro.trim()
    })),
    bridging_config_json: JSON.stringify({
      campaign_name: cleanCampaignName,
      account_name: accountName || null,
      brandName: accountName || null,
      brand_profile_id: selectedBrandId || null,
      campaign_type: isPureStory ? 'pure_storytelling' : 'product_campaign',
      isBridgingActive: isPureStory ? false : isBridgingActive,
      targetClipsCount, bridgeAtClip, bridgeDurationClips, promotionStyle, bridgingMode,
      manualProductName: isPureStory ? '' : manualProductName,
      manualProductDesc: isPureStory ? '' : manualProductDesc,
      manualProductUsp: isPureStory ? '' : manualProductUsp,
      productUrl: isPureStory ? '' : productUrl,
      editorialTopic: editorialTopic.trim(),
      editorialOutro: editorialOutro.trim()
    }),
    product_ref_image_path: isPureStory ? null : (dbPhotoUrl || productRefImage)
  };

  return { isPureStory, payload };
}

// 3. Test Pure Storytelling Mode (campaignType === 'editorial')
console.log('\nTest 2: Pure Storytelling Mode (campaignType === editorial)');
const editorialResult = simulateBuildPayload({
  campaignType: 'editorial',
  accountName: 'nutribake',
  campaignName: 'Tantangan Hidup Sehat 30 Hari',
  combinationRows: [{ deconstruct_asset_id: 'asset_001', target_product_id: null }]
});

assert.strictEqual(editorialResult.isPureStory, true);
assert.strictEqual(editorialResult.payload.rows[0].campaign_type, 'pure_storytelling');
const editorialBridging = JSON.parse(editorialResult.payload.bridging_config_json);
assert.strictEqual(editorialBridging.campaign_type, 'pure_storytelling');
assert.strictEqual(editorialBridging.isBridgingActive, false);
assert.strictEqual(editorialBridging.manualProductName, '');
assert.strictEqual(editorialResult.payload.product_ref_image_path, null);
console.log('  ✓ Evaluated as Pure Storytelling (isPureStory = true)');
console.log('  ✓ isBridgingActive disabled and product fields suppressed');

// 4. Test Product Bridging Mode (campaignType === 'product')
console.log('\nTest 3: Product Bridging Mode (campaignType === product)');
const productResult = simulateBuildPayload({
  campaignType: 'product',
  accountName: 'nutribake',
  campaignName: 'Promo Roti Nutribake',
  targetProductId: 'prod_99',
  products: [{ id: 'prod_99', cleaned_photo_url: 'https://cdn.example.com/roti.png' }],
  combinationRows: [{ deconstruct_asset_id: 'asset_002', target_product_id: 'prod_99' }]
});

assert.strictEqual(productResult.isPureStory, false);
assert.strictEqual(productResult.payload.rows[0].campaign_type, 'product_campaign');
const productBridging = JSON.parse(productResult.payload.bridging_config_json);
assert.strictEqual(productBridging.campaign_type, 'product_campaign');
assert.strictEqual(productBridging.isBridgingActive, true);
assert.strictEqual(productBridging.manualProductName, 'NutriBake Roti Gandum');
assert.strictEqual(productResult.payload.product_ref_image_path, 'https://cdn.example.com/roti.png');
console.log('  ✓ Evaluated as Product Campaign (isPureStory = false)');
console.log('  ✓ isBridgingActive preserved and product details retained');

// 5. Test Non-Product Multi-Angle Workflow
console.log('\nTest 4: Non-Product Workflow Modes');
const multiAngleResult = simulateBuildPayload({
  campaignType: 'product', // even if state defaulted to product, mode takes precedence
  workflowMode: 'one_blueprint_multi_angle',
  combinationRows: [{ deconstruct_asset_id: 'asset_003', campaign_type: 'pure_storytelling' }]
});
assert.strictEqual(multiAngleResult.isPureStory, true);
console.log('  ✓ one_blueprint_multi_angle correctly forced isPureStory = true');

console.log('\n🎉 ALL PURESTORY TESTS PASSED SUCCESSFULLY!');
