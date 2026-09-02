import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveProductReferenceRequirement } from '../lib/opc-start-frame-contract.js';

test('resolveProductReferenceRequirement identifies bridge clips as reference_critical', () => {
  const campaign = {
    target_product_id: 'prod_123',
    is_bridging_active: '1',
    bridge_at_clip: 2,
    bridge_duration_clips: 2
  };
  const item = {
    new_video_plan_json: JSON.stringify([
      { clip_index: 1 },
      { clip_index: 2 },
      { clip_index: 3 },
      { clip_index: 4 }
    ])
  };

  const clip1 = resolveProductReferenceRequirement({ campaign, item, clipIndex: 1 });
  const clip2 = resolveProductReferenceRequirement({ campaign, item, clipIndex: 2 });
  const clip3 = resolveProductReferenceRequirement({ campaign, item, clipIndex: 3 });
  const clip4 = resolveProductReferenceRequirement({ campaign, item, clipIndex: 4 });

  assert.equal(clip1.required, false, 'Clip 1 (before bridge) should not require product reference');
  assert.equal(clip2.required, true, 'Clip 2 (bridge start) must be reference_critical');
  assert.equal(clip3.required, true, 'Clip 3 (bridge duration) must be reference_critical');
  assert.equal(clip4.required, false, 'Clip 4 (after bridge) should not require product reference');
});

test('partitioning logic isolates bridge clips from sibling clips', () => {
  const isBridging = true;
  const isProductCampaign = true;
  const bridgeStart = 3;
  const bridgeDuration = 1;
  const bridgeEnd = bridgeStart + bridgeDuration - 1;
  const targetClips = 5;

  const beforeBridge = [];
  const bridgeClips = [];
  const afterBridge = [];

  for (let c = 1; c <= targetClips; c++) {
    const isBridgeClip = isBridging && isProductCampaign && c >= bridgeStart && c <= bridgeEnd;
    if (isBridgeClip) {
      bridgeClips.push(c);
    } else if (isBridging && isProductCampaign && c < bridgeStart) {
      beforeBridge.push(c);
    } else {
      afterBridge.push(c);
    }
  }

  assert.deepEqual(beforeBridge, [1, 2]);
  assert.deepEqual(bridgeClips, [3]);
  assert.deepEqual(afterBridge, [4, 5]);
});
