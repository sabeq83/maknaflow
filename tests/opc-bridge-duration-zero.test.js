import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveProductReferenceRequirement } from '../lib/opc-start-frame-contract.js';
import { buildOpcStartFrameRequest } from '../lib/opc-start-frame-request.js';

test('OPC Bridge Duration Zero (Remaining Clips) Tests', async (t) => {
  await t.test('bridge_duration_clips = 0 covers from bridge_at_clip up to target_clips_count', () => {
    const campaign = {
      id: 'camp_test_zero',
      target_product_id: 'prod_123',
      target_clips_count: 7,
      bridge_at_clip: 5,
      bridge_duration_clips: 0
    };
    const item = { id: 'item_1' };

    // Clips 1 to 4 should NOT require product reference
    for (let c = 1; c <= 4; c++) {
      const res = resolveProductReferenceRequirement({ campaign, item, clipIndex: c });
      assert.equal(res.required, false, `Clip ${c} should not require product reference`);
      assert.equal(res.bridge, false, `Clip ${c} should not be in bridge range`);
      assert.equal(res.bridgeStart, 5);
      assert.equal(res.bridgeEnd, 7);
      assert.equal(res.reason, 'not_required');
    }

    // Clips 5, 6, 7 MUST require product reference
    for (let c = 5; c <= 7; c++) {
      const res = resolveProductReferenceRequirement({ campaign, item, clipIndex: c });
      assert.equal(res.required, true, `Clip ${c} MUST require product reference`);
      assert.equal(res.bridge, true, `Clip ${c} MUST be in bridge range`);
      assert.equal(res.bridgeStart, 5);
      assert.equal(res.bridgeEnd, 7);
      assert.equal(res.reason, 'bridge_range');
    }

    // Clip 8 (beyond target) should NOT be in bridge range
    const res8 = resolveProductReferenceRequirement({ campaign, item, clipIndex: 8 });
    assert.equal(res8.required, false);
    assert.equal(res8.bridge, false);
  });

  await t.test('stringified bridge_duration_clips = "0" also works correctly', () => {
    const campaign = {
      id: 'camp_test_zero_str',
      target_product_id: 'prod_123',
      target_clips_count: 7,
      bridge_at_clip: 5,
      bridge_duration_clips: '0'
    };
    const item = { id: 'item_1' };

    const res5 = resolveProductReferenceRequirement({ campaign, item, clipIndex: 5 });
    const res6 = resolveProductReferenceRequirement({ campaign, item, clipIndex: 6 });
    const res7 = resolveProductReferenceRequirement({ campaign, item, clipIndex: 7 });

    assert.equal(res5.required, true);
    assert.equal(res6.required, true);
    assert.equal(res7.required, true);
    assert.equal(res6.bridgeEnd, 7);
  });

  await t.test('explicit positive bridge_duration_clips (e.g. 1 and 2) behave as bounded windows', () => {
    // 1 clip bridge
    const camp1 = {
      id: 'camp_test_1',
      target_product_id: 'prod_123',
      target_clips_count: 7,
      bridge_at_clip: 5,
      bridge_duration_clips: 1
    };
    assert.equal(resolveProductReferenceRequirement({ campaign: camp1, item: {}, clipIndex: 5 }).required, true);
    assert.equal(resolveProductReferenceRequirement({ campaign: camp1, item: {}, clipIndex: 6 }).required, false);
    assert.equal(resolveProductReferenceRequirement({ campaign: camp1, item: {}, clipIndex: 7 }).required, false);

    // 2 clips bridge
    const camp2 = {
      id: 'camp_test_2',
      target_product_id: 'prod_123',
      target_clips_count: 7,
      bridge_at_clip: 5,
      bridge_duration_clips: 2
    };
    assert.equal(resolveProductReferenceRequirement({ campaign: camp2, item: {}, clipIndex: 5 }).required, true);
    assert.equal(resolveProductReferenceRequirement({ campaign: camp2, item: {}, clipIndex: 6 }).required, true);
    assert.equal(resolveProductReferenceRequirement({ campaign: camp2, item: {}, clipIndex: 7 }).required, false);
  });

  await t.test('buildOpcStartFrameRequest attaches product image for clips 6 and 7 when bridge_duration_clips = 0', async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'opc-test-zero-'));
    const publicDir = path.join(temp, 'public', 'uploads');
    fs.mkdirSync(publicDir, { recursive: true });

    const cleanBytes = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(120, 0x05)]);
    const cleanJpg = path.join(publicDir, 'clean-current.jpg');
    fs.writeFileSync(cleanJpg, cleanBytes);

    const prodClean = { id: 'prod_test', active_photo: 'clean_photo_url', clean_photo_url: '/uploads/clean-current.jpg' };
    const productLoader = async () => prodClean;

    const campaign = {
      id: 'camp_build_zero',
      target_product_id: 'prod_test',
      target_clips_count: 7,
      bridge_at_clip: 5,
      bridge_duration_clips: 0,
      aspect_ratio: '9:16'
    };
    const item = { id: 'item_1', new_video_plan_json: JSON.stringify([]) };

    // Clip 4 should not have product reference
    const req4 = await buildOpcStartFrameRequest({
      campaign,
      item,
      clipIndex: 4,
      prompt: 'Scene 4 prompt',
      productLoader,
      cwd: temp
    });
    assert.equal(req4.providerRequest.reference_images, undefined);
    assert.equal(req4.audit.requires_product_reference, false);

    // Clip 6 MUST have product reference
    const req6 = await buildOpcStartFrameRequest({
      campaign,
      item,
      clipIndex: 6,
      prompt: 'Scene 6 product prompt',
      productLoader,
      cwd: temp
    });
    assert.ok(Array.isArray(req6.providerRequest.reference_images));
    assert.equal(req6.providerRequest.reference_images.length, 1);
    assert.equal(req6.providerRequest.reference_images[0].name, 'product_truth_prod_test.jpg');
    assert.equal(req6.audit.requires_product_reference, true);
    assert.equal(req6.audit.bridge_end, 7);

    // Clip 7 MUST have product reference
    const req7 = await buildOpcStartFrameRequest({
      campaign,
      item,
      clipIndex: 7,
      prompt: 'Scene 7 product prompt',
      productLoader,
      cwd: temp
    });
    assert.ok(Array.isArray(req7.providerRequest.reference_images));
    assert.equal(req7.providerRequest.reference_images.length, 1);
    assert.equal(req7.audit.requires_product_reference, true);
    assert.equal(req7.audit.bridge_end, 7);

    fs.rmSync(temp, { recursive: true, force: true });
  });
});
