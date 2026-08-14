import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveActiveProductPhotoPath, resolveActiveProductReference, resolveLocalProductImagePath } from '../lib/product-reference-resolver.js';
import { ProductReferenceUnavailableError, resolveProductReferenceRequirement } from '../lib/opc-start-frame-contract.js';
import { buildOpcStartFrameRequest } from '../lib/opc-start-frame-request.js';
import { inspectBase64ImageReference } from '../lib/base64-image-reference.js';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'opc-ref-'));
const publicDir = path.join(temp, 'public', 'uploads');
fs.mkdirSync(publicDir, { recursive: true });
const generatedJpg = path.join(publicDir, 'generated-legacy.jpg');
const generatedBytes = Buffer.from([0xff,0xd8,0xff,0x01,0x02,0x03]);
fs.writeFileSync(generatedJpg, generatedBytes);
const cleanJpg = path.join(publicDir, 'clean-current.jpg');
const cleanBytes = Buffer.from([0xff,0xd8,0xff,0x09,0x08,0x07]);
fs.writeFileSync(cleanJpg, cleanBytes);
const product = { active_photo:'generated_photo_url', generated_photo_url:'/uploads/generated-legacy.jpg', clean_photo_url:'/uploads/clean-current.jpg', photo_url:'/uploads/clean-current.jpg' };
assert.throws(() => inspectBase64ImageReference('data:image/png;base64,' + cleanBytes.toString('base64')), error => error.code === 'IMAGE_REFERENCE_MIME_MISMATCH');
assert.equal(resolveActiveProductPhotoPath(product), '/uploads/generated-legacy.jpg');
const ref = resolveActiveProductReference({ product, cwd:temp });
assert.equal(ref.sourceField, 'generated_photo_url');
assert.match(ref.base64DataUrl, /^data:image\/jpeg;base64,/);
assert.equal(ref.sha256.length, 64);
assert.notEqual(product.clean_photo_url, resolveActiveProductPhotoPath(product), 'Fixture harus mereproduksi konflik resolver v2.14.35');
assert.equal(resolveLocalProductImagePath('../../etc/passwd', { cwd:temp }), null);
assert.equal(resolveActiveProductReference({ product:{ active_photo:'clean_photo_url',clean_photo_url:'/uploads/missing.png' },cwd:temp }), null);
assert.equal(resolveActiveProductReference({ product:{ active_photo:'clean_photo_url',clean_photo_url:'/uploads/missing.png',generated_photo_url:'/uploads/generated-legacy.jpg' },cwd:temp }).sourceField, 'generated_photo_url');

const campaign = { id:'campaign-1',target_product_id:'product-1',bridge_at_clip:3,bridge_duration_clips:1 };
const item = { id:'item-1',new_video_plan_json:JSON.stringify([{clip_index:2},{clip_index:3}]) };
assert.equal(resolveProductReferenceRequirement({campaign,item,clipIndex:2}).required,false);
assert.equal(resolveProductReferenceRequirement({campaign,item,clipIndex:3}).required,true);
assert.equal(resolveProductReferenceRequirement({campaign,item,clipIndex:1}).required,false);
assert.equal(new ProductReferenceUnavailableError().code,'PRODUCT_REFERENCE_UNAVAILABLE');

const productLoader = async id => {
  assert.equal(id, 'product-1');
  return product;
};
const productReferenceCounts = [];
for (let clipIndex = 1; clipIndex <= 5; clipIndex++) {
  const prompt = clipIndex === 3
    ? `Prompt ${clipIndex} (Product Reference File: 'generated_product-1.jpg', exact high-fidelity visual design match with attached reference photo).`
    : `Prompt ${clipIndex}`;
  const built = await buildOpcStartFrameRequest({ campaign, item, clipIndex, prompt, productLoader, cwd:temp });
  productReferenceCounts.push(built.audit.product_reference_count);
  assert.equal(built.audit.reference_count, clipIndex === 3 ? 1 : 0);
  if (clipIndex === 3) {
    assert.equal(built.audit.reference_source_field, 'clean_photo_url');
    const payloadMetadata = inspectBase64ImageReference(built.providerRequest.reference_images[0]);
    assert.equal(built.audit.reference_sha256, payloadMetadata.sha256);
    assert.equal(payloadMetadata.byteLength, cleanBytes.length);
    assert.notEqual(payloadMetadata.sha256, ref.sha256);
    assert.deepEqual(built.providerRequest.expected_reference_sha256s, [payloadMetadata.sha256]);
    assert.match(built.providerRequest.prompt, /HIGHEST PRIORITY PRODUCT IDENTITY LOCK/);
    assert.doesNotMatch(built.providerRequest.prompt, /generated_product-1\.jpg/);
  } else {
    assert.equal(built.providerRequest.reference_images, undefined);
    assert.equal(built.providerRequest.prompt, prompt);
  }
}
assert.deepEqual(productReferenceCounts, [0,0,1,0,0]);

const initial = await buildOpcStartFrameRequest({ campaign, item, clipIndex:3, prompt:'Parity prompt', origin:'phase_1_initial', productLoader, cwd:temp });
const regen = await buildOpcStartFrameRequest({ campaign, item, clipIndex:3, prompt:'Parity prompt', origin:'manual_regen', productLoader, cwd:temp });
assert.equal(initial.audit.request_fingerprint, regen.audit.request_fingerprint);
assert.equal(initial.audit.reference_sha256, regen.audit.reference_sha256);
assert.deepEqual(initial.providerRequest.reference_images, regen.providerRequest.reference_images);

await assert.rejects(
  () => buildOpcStartFrameRequest({ campaign, item, clipIndex:3, prompt:'Missing photo', productLoader:async () => ({ active_photo:'generated_photo_url',generated_photo_url:'/uploads/missing.jpg' }), cwd:temp }),
  error => error.code === 'PRODUCT_REFERENCE_UNAVAILABLE'
);

const scheduler = fs.readFileSync(new URL('../lib/scheduler-processors.js',import.meta.url),'utf8');
assert.match(scheduler,/buildOpcStartFrameRequest/);
assert.match(scheduler,/!isProductCampaign && !isCartoon/);
assert.doesNotMatch(scheduler.slice(scheduler.indexOf('const submitStartFrame'), scheduler.indexOf('if (t2iPattern ===')), /resolveProductBase64/);
const regenSource = fs.readFileSync(new URL('../app/api/v2/pillar-campaigns/items/[itemId]/regenerate-t2i/route.js',import.meta.url),'utf8');
assert.match(regenSource,/buildOpcStartFrameRequest/);
assert.match(regenSource,/origin: 'manual_regen'/);
assert.doesNotMatch(regenSource,/resolveProductBase64/);
const audit = fs.readFileSync(new URL('../lib/opc-start-frame-audit.js',import.meta.url),'utf8');
assert.doesNotMatch(audit,/base64DataUrl/);
console.log('OPC start-frame product reference parity tests passed.');
