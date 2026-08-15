import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveOpcProductId } from '../lib/opc-product-lineage-contract.js';

assert.equal(resolveOpcProductId({ planner: { product_id: 'product-default', target_product_id: 'product-wrong' } }), 'product-default');
assert.equal(resolveOpcProductId({ planner: { product_id: 'product-default' }, explicitProductId: 'product-explicit' }), 'product-explicit');
assert.equal(resolveOpcProductId({ planner: { target_product_id: 'legacy-wrong' } }), null);

const ingest = fs.readFileSync(new URL('../lib/pillar-campaign-ingest.js', import.meta.url), 'utf8');
assert.match(ingest, /resolveAndValidateOpcProductLineage/);
assert.match(ingest, /planner\.product_id/);
assert.doesNotMatch(ingest, /planner\.target_product_id/);
assert.doesNotMatch(ingest, /LOWER\(product_name\).*LIMIT 1/);

const bulkRoute = fs.readFileSync(new URL('../app/api/v2/pillar-campaigns/items/[itemId]/regenerate-start-frames/route.js', import.meta.url), 'utf8');
assert.match(bulkRoute, /buildOpcStartFrameRequest/);
assert.match(bulkRoute, /carryForwardCompleted: true/);
assert.doesNotMatch(bulkRoute, /generateImage\(/);

const adapter = fs.readFileSync(new URL('../lib/start-frame-provider-adapter.js', import.meta.url), 'utf8');
assert.match(adapter, /START_FRAME_CONTEXT_REQUIRED/);
assert.match(adapter, /buildOpcStartFrameRequest\(context\)/);

console.log('OPC product-lineage and canonical durable request tests passed.');
