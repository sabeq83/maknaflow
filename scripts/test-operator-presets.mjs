import assert from 'node:assert/strict';
import { resolvePresetCampaignKinds, isOperatorPresetCompatible } from '../lib/operator-presets.js';

const product = { key:'legacy_product_campaign', config:{ product_bridging:{ is_bridging_active:true } } };
assert.deepEqual(resolvePresetCampaignKinds(product).kinds,['product_campaign']);
assert.equal(isOperatorPresetCompatible(product,'product_campaign'),true);
assert.deepEqual(resolvePresetCampaignKinds({key:'editorial_v1',config:{product_bridging:{is_bridging_active:false}}}).kinds,['brand_editorial']);
assert.deepEqual(resolvePresetCampaignKinds({key:'shared',config:{campaign_kinds:['brand_editorial','product_campaign']}}).kinds,['brand_editorial','product_campaign']);
console.log('Operator preset campaign-kind tests passed.');
