import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveActiveProductPhotoPath, resolveActiveProductReference, resolveLocalProductImagePath } from '../lib/product-reference-resolver.js';
import { ProductReferenceUnavailableError, resolveProductReferenceRequirement } from '../lib/opc-start-frame-contract.js';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'opc-ref-'));
const publicDir = path.join(temp, 'public', 'uploads');
fs.mkdirSync(publicDir, { recursive: true });
const jpg = path.join(publicDir, 'active.jpg');
fs.writeFileSync(jpg, Buffer.from([0xff,0xd8,0xff,0x01,0x02,0x03]));
const product = { active_photo:'generated_photo_url', generated_photo_url:'/uploads/active.jpg', clean_photo_url:'/uploads/old.jpg' };
assert.equal(resolveActiveProductPhotoPath(product), '/uploads/active.jpg');
const ref = resolveActiveProductReference({ product, cwd:temp });
assert.equal(ref.sourceField, 'generated_photo_url');
assert.match(ref.base64DataUrl, /^data:image\/jpeg;base64,/);
assert.equal(ref.sha256.length, 64);
assert.equal(resolveLocalProductImagePath('../../etc/passwd', { cwd:temp }), null);
assert.equal(resolveActiveProductReference({ product:{ active_photo:'clean_photo_url',clean_photo_url:'/uploads/missing.png' },cwd:temp }), null);
assert.equal(resolveActiveProductReference({ product:{ active_photo:'clean_photo_url',clean_photo_url:'/uploads/missing.png',generated_photo_url:'/uploads/active.jpg' },cwd:temp }).sourceField, 'generated_photo_url');

const campaign = { target_product_id:'product-1',bridge_at_clip:3,bridge_duration_clips:1 };
const item = { new_video_plan_json:JSON.stringify([{clip_index:2,product_visible:true},{clip_index:3}]) };
assert.equal(resolveProductReferenceRequirement({campaign,item,clipIndex:2}).required,true);
assert.equal(resolveProductReferenceRequirement({campaign,item,clipIndex:3}).required,true);
assert.equal(resolveProductReferenceRequirement({campaign,item,clipIndex:1}).required,false);
assert.equal(new ProductReferenceUnavailableError().code,'PRODUCT_REFERENCE_UNAVAILABLE');

const scheduler = fs.readFileSync(new URL('../lib/scheduler-processors.js',import.meta.url),'utf8');
assert.match(scheduler,/buildOpcStartFrameRequest/);
assert.match(scheduler,/!isProductCampaign && !isCartoon/);
const regen = fs.readFileSync(new URL('../app/api/v2/pillar-campaigns/items/[itemId]/regenerate-t2i/route.js',import.meta.url),'utf8');
assert.match(regen,/buildOpcStartFrameRequest/);
assert.match(regen,/origin: 'manual_regen'/);
const audit = fs.readFileSync(new URL('../lib/opc-start-frame-audit.js',import.meta.url),'utf8');
assert.doesNotMatch(audit,/base64DataUrl/);
console.log('OPC start-frame product reference parity tests passed.');
