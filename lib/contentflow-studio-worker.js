import { pgQuery } from './db-pg.js';
import { claimDueStudioSlot, recordStudioEvent } from './contentflow-studio-repository.js';
import { dispatchSlotProduction, reconcileSlotProgress } from './contentflow-studio-adapters.js';

/**
 * Executes a single tick of the ContentFlow Studio Worker.
 * Guaranteed idempotent and atomic:
 * - Only claims slots where `scheduled_production_at <= CURRENT_TIMESTAMP`.
 * - Future slots are strictly NEVER dispatched ahead of their schedule.
 * - Reconciles in-progress slots and syncs final media to ContentFlow.
 *
 * @param {string} workerId
 * @param {string} [tenantId]
 * @returns {Promise<{ claimed: boolean, slotId: string|null, reconciledCount: number }>}
 */
export async function runStudioWorkerTick(workerId = 'studio-worker-1', tenantId = 'default_tenant') {
  let claimedSlot = null;
  try {
    // 1. Claim due slot with atomic SKIP LOCKED
    claimedSlot = await claimDueStudioSlot(workerId, tenantId);

    if (claimedSlot) {
      console.log(`[Studio Worker] Claimed due slot #${claimedSlot.slot_number} (${claimedSlot.id}) for batch ${claimedSlot.batch_id}`);

      await recordStudioEvent({
        batchId: claimedSlot.batch_id,
        slotId: claimedSlot.id,
        tenantId,
        eventType: 'production_dispatched',
        eventPayloadJson: { workerId, scheduledProductionAt: claimedSlot.scheduled_production_at },
        actor: workerId
      });

      // 2. Dispatch to domain engine
      const dispatchRes = await dispatchSlotProduction(claimedSlot);
      console.log(`[Studio Worker] Slot ${claimedSlot.id} dispatched to campaign ${dispatchRes.campaignId}`);
    }
  } catch (claimErr) {
    console.error('[Studio Worker Claim Error]:', claimErr);
    if (claimedSlot) {
      await recordStudioEvent({
        batchId: claimedSlot.batch_id,
        slotId: claimedSlot.id,
        tenantId,
        eventType: 'production_dispatch_failed',
        eventPayloadJson: { error: claimErr.message },
        actor: workerId
      });
    }
  }

  // 3. Reconcile in-progress slots
  let reconciledCount = 0;
  try {
    const inProgressRes = await pgQuery(`
      SELECT s.*, b.source_kind
      FROM content_studio_slots s
      JOIN content_studio_batches b ON s.batch_id = b.id
      WHERE s.tenant_id = $1
        AND s.stage_status = 'in_progress'
        AND s.source_campaign_id IS NOT NULL
      LIMIT 10
    `, [tenantId]);

    for (const slot of inProgressRes.rows) {
      const rec = await reconcileSlotProgress(slot);
      if (rec && rec.status !== 'in_progress') {
        reconciledCount++;
        await recordStudioEvent({
          batchId: slot.batch_id,
          slotId: slot.id,
          tenantId,
          eventType: rec.status === 'completed' ? 'production_completed' : 'production_failed',
          eventPayloadJson: rec,
          actor: workerId
        });
      }
    }
  } catch (recErr) {
    console.error('[Studio Worker Reconcile Error]:', recErr);
  }

  return {
    claimed: Boolean(claimedSlot),
    slotId: claimedSlot?.id || null,
    reconciledCount
  };
}
