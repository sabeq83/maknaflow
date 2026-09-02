import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGlabsImageLaneKey,
  requestImageLane,
  tryAcquireImageLane,
  heartbeatImageLane,
  releaseImageLane,
  recoverExpiredImageLanes
} from '../lib/glabs-image-lane-service.js';

test('buildGlabsImageLaneKey generates deterministic, safe sha256 hash without secrets', () => {
  const key1 = buildGlabsImageLaneKey({ host: '100.64.70.61', port: '8765' });
  const key2 = buildGlabsImageLaneKey({ host: '100.64.70.61', port: '8765' });
  assert.equal(typeof key1, 'string');
  assert.equal(key1.length, 64);
  assert.equal(key1, key2);

  const keyOther = buildGlabsImageLaneKey({ host: '127.0.0.1', port: '8765' });
  assert.notEqual(key1, keyOther);
});

test('glabs image lane concurrency: serialization and FIFO isolation', async () => {
  const laneKey = `test_lane_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const tenantId = 'default_tenant';

  // 1. Exclusive Lease 1 (e.g. Item 215 clip 3 Product Bridge)
  const req1 = await requestImageLane({
    tenantId,
    laneKey,
    mode: 'exclusive',
    ownerKind: 'test_asset',
    ownerId: 'item_215_clip_3',
    leaseSeconds: 30
  });
  assert.equal(req1.acquired, true, 'Exclusive Lease 1 should acquire immediately on empty lane');

  // 2. Exclusive Lease 2 (e.g. Item 216 clip 3 Product Bridge)
  const req2 = await requestImageLane({
    tenantId,
    laneKey,
    mode: 'exclusive',
    ownerKind: 'test_asset',
    ownerId: 'item_216_clip_3',
    leaseSeconds: 30
  });
  assert.equal(req2.acquired, false, 'Exclusive Lease 2 must wait while Lease 1 is active');

  // 3. Shared Lease 3 (e.g. Item 217 clip 2 non-product)
  const req3 = await requestImageLane({
    tenantId,
    laneKey,
    mode: 'shared',
    ownerKind: 'test_asset',
    ownerId: 'item_217_clip_2',
    leaseSeconds: 30
  });
  assert.equal(req3.acquired, false, 'Shared Lease 3 must wait because an older Exclusive Waiter (Lease 2) is in queue');

  // 4. Heartbeat on Lease 1
  const hb = await heartbeatImageLane(req1.lease.id, { extendSeconds: 60 });
  assert.equal(hb, true, 'Heartbeat should successfully extend active lease');

  // 5. Release Lease 1 -> Lease 2 (older exclusive waiter) should now be able to acquire
  await releaseImageLane(req1.lease.id, 'completed');

  const acquire2 = await tryAcquireImageLane(req2.lease.id, { leaseSeconds: 30 });
  assert.equal(acquire2.acquired, true, 'Exclusive Lease 2 acquires after Lease 1 released');

  // Shared Lease 3 should still wait while Lease 2 is active
  const acquire3While2Active = await tryAcquireImageLane(req3.lease.id, { leaseSeconds: 30 });
  assert.equal(acquire3While2Active.acquired, false, 'Shared Lease 3 still waits while Exclusive Lease 2 is active');

  // 6. Release Lease 2 -> Shared Lease 3 should now acquire
  await releaseImageLane(req2.lease.id, 'completed');

  const acquire3 = await tryAcquireImageLane(req3.lease.id, { leaseSeconds: 30 });
  assert.equal(acquire3.acquired, true, 'Shared Lease 3 acquires after Exclusive Lease 2 released');

  // Clean up
  await releaseImageLane(req3.lease.id, 'completed');
});
