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
        payload: { workerId, scheduledProductionAt: claimedSlot.scheduled_production_at },
        actor: workerId
      });

      // 2. Dispatch to domain engine
      const dispatchRes = await dispatchSlotProduction(claimedSlot);
      console.log(`[Studio Worker] Slot ${claimedSlot.id} dispatched to campaign ${dispatchRes.campaignId}`);
    }
  } catch (claimErr) {
    console.error('[Studio Worker Claim Error]:', claimErr);
    if (claimedSlot) {
      await pgQuery("UPDATE content_studio_slots SET stage_status='failed',lease_until=NULL,error_message=$3 WHERE id=$1 AND tenant_id=$2 AND source_campaign_id IS NULL", [claimedSlot.id, tenantId, claimErr.message]);
      await recordStudioEvent({
        batchId: claimedSlot.batch_id,
        slotId: claimedSlot.id,
        tenantId,
        eventType: 'production_dispatch_failed',
        payload: { error: claimErr.message },
        actor: workerId
      });
    }
  }

  try {
    const { resumeApprovedStudioPublishing } = await import('./contentflow-studio-publishing.js');
    await resumeApprovedStudioPublishing(tenantId);
  } catch(error) { console.error('[Studio Publishing Intent]', error.message); }
  await pgQuery(`UPDATE content_studio_targets t SET status=CASE WHEN j.status='processing' THEN 'scheduling' ELSE j.status END,
    published_at=j.published_at,updated_at=CURRENT_TIMESTAMP
    FROM publishing_jobs j WHERE t.publishing_job_id=j.id AND t.tenant_id=$1 AND j.tenant_id=t.tenant_id
    AND j.status IN ('scheduled','processing','published','failed','retry_wait','verifying','cancelled') AND t.status<>'manual_published'`,[tenantId]);
  // 3. Reconcile in-progress slots
  let reconciledCount = 0;
  try {
    const inProgressRes = await pgQuery(`
      SELECT s.*, b.engine_kind as batch_engine_kind
      FROM content_studio_slots s
      JOIN content_studio_batches b ON s.batch_id = b.id
      WHERE s.tenant_id = $1
        AND s.stage_status IN ('in_progress','needs_review')
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
          eventType: rec.status === 'ready' ? 'production_completed' : 'production_failed',
          payload: rec,
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

const studioState = globalThis.__campaignFirstStudioWorker || { timer: null, busy: false };
globalThis.__campaignFirstStudioWorker = studioState;
export function startStudioWorker() {
  if (studioState.timer) return;
  const tick = async () => {
    if (studioState.busy) return;
    studioState.busy = true;
    try {
      const tenants = await pgQuery("SELECT DISTINCT tenant_id FROM content_studio_batches WHERE engine_kind IS NOT NULL AND status='active'");
      for (const { tenant_id } of tenants.rows) await runStudioWorkerTick(`studio:${process.pid}`, tenant_id);
    } catch (error) { console.error('[Studio Tick]', error.message); }
    finally { studioState.busy = false; }
  };
  studioState.timer = setInterval(tick, 15000);
  studioState.timer.unref?.();
}
