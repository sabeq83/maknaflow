import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CANONICAL_PRODUCT_PHOTO_FIELDS, resolveCampaignProductReference, resolveActiveProductReference, resolveLocalProductImagePath } from '../lib/product-reference-resolver.js';
import { ProductReferenceUnavailableError, resolveProductReferenceRequirement } from '../lib/opc-start-frame-contract.js';
import { buildOpcStartFrameRequest } from '../lib/opc-start-frame-request.js';
import { inspectBase64ImageReference, inspectBase64ImageReferences } from '../lib/base64-image-reference.js';
import { GLABS_IMAGE_POLL_INTERVAL_MS, GLABS_IMAGE_MODEL, normalizeGlabsImageModel } from '../lib/webhook-client.js';

assert.deepEqual(CANONICAL_PRODUCT_PHOTO_FIELDS, ['clean_photo_url', 'raw_photo_url']);
assert.equal(GLABS_IMAGE_POLL_INTERVAL_MS, 4000);
assert.equal(GLABS_IMAGE_MODEL, 'nano_banana_2');
assert.equal(normalizeGlabsImageModel('imagen_3'), 'nano_banana_2');
assert.equal(normalizeGlabsImageModel('nano_banana_pro'), 'nano_banana_pro');
assert.equal(normalizeGlabsImageModel('nano_banana_2'), 'nano_banana_2');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'opc-ref-'));
const publicDir = path.join(temp, 'public', 'uploads');
fs.mkdirSync(publicDir, { recursive: true });

// Create valid dummy images (at least 100 bytes for G-Labs valid image requirement)
const cleanBytes = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(120, 0x05)]);
const cleanJpg = path.join(publicDir, 'clean-current.jpg');
fs.writeFileSync(cleanJpg, cleanBytes);

const rawBytes = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(120, 0x07)]);
const rawJpg = path.join(publicDir, 'raw-current.jpg');
fs.writeFileSync(rawJpg, rawBytes);

const legacyBytes = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(120, 0x09)]);
const legacyJpg = path.join(publicDir, 'legacy.jpg');
fs.writeFileSync(legacyJpg, legacyBytes);

// 1. Active Clean chooses clean_photo_url
const prodClean = { id: 'prod_1', active_photo: 'clean_photo_url', clean_photo_url: '/uploads/clean-current.jpg', raw_photo_url: '/uploads/raw-current.jpg' };
const refClean = resolveCampaignProductReference({ product: prodClean, cwd: temp });
assert.equal(refClean.sourceField, 'clean_photo_url');
assert.equal(refClean.sha256, inspectBase64ImageReference(refClean.base64DataUrl).sha256);

// 2. Active Raw chooses raw_photo_url
const prodRaw = { id: 'prod_1', active_photo: 'raw_photo_url', clean_photo_url: '/uploads/clean-current.jpg', raw_photo_url: '/uploads/raw-current.jpg' };
const refRaw = resolveCampaignProductReference({ product: prodRaw, cwd: temp });
assert.equal(refRaw.sourceField, 'raw_photo_url');

// 3. Active empty chooses clean_photo_url
const prodEmptyActive = { id: 'prod_1', clean_photo_url: '/uploads/clean-current.jpg', raw_photo_url: '/uploads/raw-current.jpg' };
const refEmptyActive = resolveCampaignProductReference({ product: prodEmptyActive, cwd: temp });
assert.equal(refEmptyActive.sourceField, 'clean_photo_url');

// 4. Clean missing/empty chooses raw_photo_url
const prodNoClean = { id: 'prod_1', raw_photo_url: '/uploads/raw-current.jpg' };
const refNoClean = resolveCampaignProductReference({ product: prodNoClean, cwd: temp });
assert.equal(refNoClean.sourceField, 'raw_photo_url');

// 5. Explicit choice missing causes preflight failure (returns null)
const prodMissingClean = { id: 'prod_1', active_photo: 'clean_photo_url', clean_photo_url: '/uploads/not-found.jpg', raw_photo_url: '/uploads/raw-current.jpg' };
assert.equal(resolveCampaignProductReference({ product: prodMissingClean, cwd: temp }), null);

// 6. Legacy fields populated but Clean/Raw empty causes preflight failure
const prodLegacyOnly = { id: 'prod_1', active_photo: 'generated_photo_url', generated_photo_url: '/uploads/legacy.jpg', cleaned_photo_url: '/uploads/legacy.jpg', photo_url: '/uploads/legacy.jpg' };
assert.equal(resolveCampaignProductReference({ product: prodLegacyOnly, cwd: temp }), null);

// 7. Reference string and named object inspection
const strRef = `data:image/jpeg;base64,${cleanBytes.toString('base64')}`;
const inspectedStr = inspectBase64ImageReference(strRef);
assert.equal(inspectedStr.mimeType, 'image/jpeg');
assert.equal(inspectedStr.byteLength, cleanBytes.length);

const objRef = {
  data: `data:image/jpeg;base64,${cleanBytes.toString('base64')}`,
  category: 'subject',
  name: 'product_truth_prod_1.jpg'
};
const inspectedObj = inspectBase64ImageReference(objRef);
assert.equal(inspectedObj.name, 'product_truth_prod_1.jpg');
assert.equal(inspectedObj.category, 'subject');
assert.equal(inspectedObj.sha256, inspectedStr.sha256);

// 8. MIME mismatch, malformed name, undersized rejected
assert.throws(() => inspectBase64ImageReference('data:image/png;base64,' + cleanBytes.toString('base64')), error => error.code === 'IMAGE_REFERENCE_MIME_MISMATCH');
assert.throws(() => inspectBase64ImageReference('data:image/png;base64,AAAA'), error => error.code === 'EMPTY_IMAGE_REFERENCE');

// 9. Named product reference at index 0, @tag binding, and model nano_banana_2
const campaign = { id: 'campaign-1', target_product_id: 'prod_1', bridge_at_clip: 3, bridge_duration_clips: 1, aspect_ratio: '9:16' };
const item = { id: 'item-1', new_video_plan_json: JSON.stringify([{ clip_index: 2 }, { clip_index: 3 }]) };

const productLoader = async id => {
  assert.equal(id, 'prod_1');
  return prodClean;
};

// Add a dummy character context reference (at least 100 bytes)
const charBytes = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(120, 0x02)]);
const charRef = `data:image/png;base64,${charBytes.toString('base64')}`;

const builtBridge = await buildOpcStartFrameRequest({
  campaign,
  item,
  clipIndex: 3,
  prompt: 'Hero with product in dynamic scene',
  contextReferences: [charRef],
  productLoader,
  cwd: temp
});

// Product reference must be at index 0 as named object
assert.equal(builtBridge.providerRequest.reference_images.length, 2);
const prodRef = builtBridge.providerRequest.reference_images[0];
assert.equal(prodRef.category, 'subject');
assert.equal(prodRef.name, 'product_truth_prod_1.jpg');
assert.equal(inspectBase64ImageReference(prodRef).sha256, refClean.sha256);

// Context reference follows after index 0
assert.equal(builtBridge.providerRequest.reference_images[1], charRef);

// Prompt binding with exact @tag
assert.match(builtBridge.providerRequest.prompt, /@product_truth_prod_1/);
assert.match(builtBridge.providerRequest.prompt, /HIGHEST PRIORITY PRODUCT IDENTITY LOCK/);

// Model is explicitly nano_banana_2
assert.equal(builtBridge.providerRequest.model, 'nano_banana_2');
assert.equal(builtBridge.audit.requested_model, 'nano_banana_2');
assert.equal(builtBridge.audit.effective_model, 'nano_banana_2');

// 10. Initial vs Manual Regen Parity
const initial = await buildOpcStartFrameRequest({ campaign, item, clipIndex: 3, prompt: 'Parity prompt', origin: 'phase_1_initial', productLoader, cwd: temp });
const regen = await buildOpcStartFrameRequest({ campaign, item, clipIndex: 3, prompt: 'Parity prompt', origin: 'manual_regen', productLoader, cwd: temp });
assert.equal(initial.audit.request_fingerprint, regen.audit.request_fingerprint);
assert.equal(initial.audit.reference_sha256, regen.audit.reference_sha256);
assert.deepEqual(initial.providerRequest.reference_images, regen.providerRequest.reference_images);

// 11. Code source validations
const scheduler = fs.readFileSync(new URL('../lib/scheduler-processors.js', import.meta.url), 'utf8');
assert.match(scheduler, /buildOpcStartFrameRequest/);
assert.match(scheduler, /isBridgeClip/);
assert.match(scheduler, /executeSingleClipIsolated/);
assert.doesNotMatch(scheduler.slice(scheduler.indexOf('const submitStartFrame'), scheduler.indexOf('const downloadAndSaveStartFrame')), /resolveProductBase64/);

const regenSource = fs.readFileSync(new URL('../app/api/v2/pillar-campaigns/items/[itemId]/regenerate-t2i/route.js', import.meta.url), 'utf8');
assert.match(regenSource, /buildOpcStartFrameRequest/);
assert.match(regenSource, /GLABS_IMAGE_POLL_INTERVAL_MS/);
assert.doesNotMatch(regenSource, /resolveProductBase64/);

const youtubeAdapter = fs.readFileSync(new URL('../lib/youtube-studio-start-frame-adapter.js', import.meta.url), 'utf8');
assert.doesNotMatch(youtubeAdapter, /imagen_3/);
assert.match(youtubeAdapter, /normalizeGlabsImageModel/);

const audit = fs.readFileSync(new URL('../lib/opc-start-frame-audit.js', import.meta.url), 'utf8');
assert.doesNotMatch(audit, /base64DataUrl/);

console.log('ALL OPC start-frame reference contract and parity tests passed.');
process.exit(0);

