import { pgQuery, withPgTransaction } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';
import { computeApprovalRevisionHash } from './contentflow-studio-contract.js';
import crypto from 'crypto';

export async function createStudioBatch({
  tenantId = null,
  title,
  sourceKind,
  sourceId = null,
  configurationJson = {},
  idempotencyKey = null,
  createdBy = 'user'
}) {
  const tId = tenantId || getActiveTenantId() || 'default_tenant';
  const batchId = `stb_${crypto.randomBytes(8).toString('hex')}`;
  const idemp = idempotencyKey || `idemp_${crypto.randomBytes(8).toString('hex')}`;

  const res = await pgQuery(`
    INSERT INTO content_studio_batches (
      id, tenant_id, title, source_kind, source_id, config_version, configuration_json, idempotency_key, status, total_slots, created_by, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, 1, $6::jsonb, $7, 'draft', 0, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT (tenant_id, idempotency_key) DO UPDATE
      SET updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `, [
    batchId,
    tId,
    title || 'Studio Batch',
    sourceKind,
    sourceId,
    JSON.stringify(configurationJson || {}),
    idemp,
    createdBy
  ]);

  return res.rows[0];
}

export async function getStudioBatchById(batchId, tenantId = null) {
  const tId = tenantId || getActiveTenantId() || 'default_tenant';
  const batchRes = await pgQuery(`
    SELECT * FROM content_studio_batches WHERE id = $1 AND tenant_id = $2
  `, [batchId, tId]);

  if (batchRes.rowCount === 0) return null;
  const batch = batchRes.rows[0];

  const slotsRes = await pgQuery(`
    SELECT * FROM content_studio_slots WHERE batch_id = $1 AND tenant_id = $2 ORDER BY slot_number ASC, created_at ASC
  `, [batchId, tId]);

  const slots = slotsRes.rows;
  if (slots.length > 0) {
    const slotIds = slots.map(s => s.id);
    const targetsRes = await pgQuery(`
      SELECT * FROM content_studio_targets WHERE slot_id = ANY($1::text[]) AND tenant_id = $2 ORDER BY created_at ASC
    `, [slotIds, tId]);

    const targetMap = new Map();
    for (const t of targetsRes.rows) {
      if (!targetMap.has(t.slot_id)) targetMap.set(t.slot_id, []);
      targetMap.get(t.slot_id).push(t);
    }

    for (const slot of slots) {
      slot.targets = targetMap.get(slot.id) || [];
    }
  }

  return { ...batch, slots };
}

export async function listStudioBatches(tenantId = null, { status = 'all', limit = 50, offset = 0 } = {}) {
  const tId = tenantId || getActiveTenantId() || 'default_tenant';
  let query = `SELECT * FROM content_studio_batches WHERE tenant_id = $1`;
  const params = [tId];

  if (status && status !== 'all') {
    params.push(status);
    query += ` AND status = $${params.length}`;
  }

  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const res = await pgQuery(query, params);
  return res.rows;
}

/**
 * Atomically consumes a Content Planner into a Studio Batch.
 * Places all selected rows as slots; locks the planner permanently.
 */
export async function consumePlannerIntoBatch({
  tenantId = null,
  batchId,
  plannerId,
  selectedRowIds = [],
  slotScheduleMap = {}, // { [plannerRowId]: { scheduledProductionAt, scheduledPublishAt, targets: [{ accountId, platform }] } }
  defaultTargets = [],
  timezone = 'Asia/Jakarta',
  userId = 'user'
}) {
  const tId = tenantId || getActiveTenantId() || 'default_tenant';

  return await withPgTransaction(async (client) => {
    // 1. Lock planner row
    const plannerRes = await client.query(`
      SELECT * FROM content_planners WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL) FOR UPDATE
    `, [plannerId, tId]);

    if (plannerRes.rowCount === 0) {
      const err = new Error('Content Planner tidak ditemukan.');
      err.status = 404;
      err.code = 'PLANNER_NOT_FOUND';
      throw err;
    }

    const planner = plannerRes.rows[0];

    // 2. Lock consumption table to check single-use invariant
    const consRes = await client.query(`
      SELECT * FROM content_planner_consumptions WHERE tenant_id = $1 AND planner_id = $2 FOR UPDATE
    `, [tId, plannerId]);

    if (consRes.rowCount > 0) {
      const cons = consRes.rows[0];
      const err = new Error(`Planner (${plannerId}) sudah digunakan oleh ${cons.owner_type} #${cons.owner_id}.`);
      err.status = 409;
      err.code = 'PLANNER_ALREADY_CONSUMED';
      throw err;
    }

    // 3. Fetch planner rows
    const rowsRes = await client.query(`
      SELECT * FROM content_planner_rows WHERE planner_id = $1 ORDER BY sequence ASC
    `, [plannerId]);

    const allRows = rowsRes.rows;
    if (allRows.length === 0) {
      const err = new Error('Planner belum menghasilkan baris ide konten.');
      err.status = 400;
      err.code = 'PLANNER_NO_ROWS';
      throw err;
    }

    // Filter rows: if selectedRowIds is given, use subset; otherwise all rows
    const targetRows = selectedRowIds.length > 0
      ? allRows.filter(r => selectedRowIds.includes(String(r.id)) || selectedRowIds.includes(Number(r.id)))
      : allRows;

    if (targetRows.length === 0) {
      const err = new Error('Tidak ada baris planner yang dipilih.');
      err.status = 400;
      err.code = 'NO_ROWS_SELECTED';
      throw err;
    }

    // Snapshot of unused rows to record them as frozen
    const unusedRowIds = allRows
      .filter(r => !targetRows.some(tr => tr.id === r.id))
      .map(r => r.id);

    const snapshotSha256 = crypto
      .createHash('sha256')
      .update(JSON.stringify({ plannerId, targetRowIds: targetRows.map(r => r.id), unusedRowIds }))
      .digest('hex');

    // 4. Insert consumption ledger
    const consumptionId = `cpc_${crypto.randomBytes(8).toString('hex')}`;
    await client.query(`
      INSERT INTO content_planner_consumptions (
        id, tenant_id, planner_id, owner_type, owner_id, status, snapshot_sha256, metadata_json, consumed_at, created_at, updated_at
      ) VALUES (
        $1, $2, $3, 'studio_batch', $4, 'consumed', $5, $6::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `, [
      consumptionId,
      tId,
      plannerId,
      batchId,
      snapshotSha256,
      JSON.stringify({
        consumed_by_user: userId,
        total_rows_planner: allRows.length,
        used_rows_count: targetRows.length,
        unused_row_ids: unusedRowIds
      })
    ]);

    // 5. Insert Slots and Targets
    const createdSlots = [];
    let slotNumber = 1;

    for (const row of targetRows) {
      const slotId = `sts_${crypto.randomBytes(8).toString('hex')}`;
      const scheduleConfig = slotScheduleMap[row.id] || slotScheduleMap[String(row.id)] || {};

      const now = new Date();
      const scheduledProd = scheduleConfig.scheduledProductionAt
        ? new Date(scheduleConfig.scheduledProductionAt)
        : new Date(now.getTime() + slotNumber * 3600 * 1000);
      const scheduledPub = scheduleConfig.scheduledPublishAt
        ? new Date(scheduleConfig.scheduledPublishAt)
        : new Date(scheduledProd.getTime() + 24 * 3600 * 1000);

      const slotTitle = row.title || row.hook || `Slot #${slotNumber} - ${planner.title || 'Konten'}`;

      const insertedSlot = await client.query(`
        INSERT INTO content_studio_slots (
          id, tenant_id, batch_id, slot_number, planner_row_id, title, source_kind, scheduled_production_at, scheduled_publish_at,
          timezone, output_media_type, activation_status, stage_status, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'video', 'manual', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        RETURNING *
      `, [
        slotId,
        tId,
        batchId,
        slotNumber,
        row.id,
        slotTitle,
        planner.planner_focus === 'recipe_campaign' ? 'planner_recipe' : 'planner_pillar',
        scheduledProd,
        scheduledPub,
        timezone
      ]);

      const slot = insertedSlot.rows[0];

      // Insert targets
      const targetsToInsert = scheduleConfig.targets?.length > 0 ? scheduleConfig.targets : defaultTargets;
      const createdTargets = [];

      for (const target of targetsToInsert) {
        const targetId = `stt_${crypto.randomBytes(8).toString('hex')}`;
        const targetAccount = target.accountId || target.account_id;
        const targetPlatform = target.platform || 'tiktok';

        const insTarget = await client.query(`
          INSERT INTO content_studio_targets (
            id, tenant_id, slot_id, account_id, platform, scheduled_at, status, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, 'awaiting_approval', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          ON CONFLICT (tenant_id, slot_id, account_id) DO NOTHING
          RETURNING *
        `, [
          targetId,
          tId,
          slotId,
          String(targetAccount),
          targetPlatform,
          scheduledPub
        ]);

        if (insTarget.rows[0]) createdTargets.push(insTarget.rows[0]);
      }

      slot.targets = createdTargets;
      createdSlots.push(slot);
      slotNumber++;
    }

    // 6. Update Batch & Planner
    await client.query(`
      UPDATE content_studio_batches
      SET source_id = $1, status = 'active', total_slots = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND tenant_id = $4
    `, [plannerId, createdSlots.length, batchId, tId]);

    await client.query(`
      UPDATE content_planners
      SET status = 'consumed', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [plannerId]);

    return {
      success: true,
      batch_id: batchId,
      planner_id: plannerId,
      consumption_id: consumptionId,
      slots: createdSlots
    };
  });
}

/**
 * Claims the next due slot for dispatch by Studio Worker.
 * Uses atomic SELECT ... FOR UPDATE SKIP LOCKED to prevent duplicate processing.
 */
export async function claimDueStudioSlot(workerId, tenantId = null) {
  const tId = tenantId || getActiveTenantId() || 'default_tenant';

  return await withPgTransaction(async (client) => {
    const res = await client.query(`
      SELECT s.*, b.source_kind as batch_source_kind, b.engine_kind as batch_engine_kind, b.source_id as batch_source_id, b.configuration_json as batch_config
      FROM content_studio_slots s
      JOIN content_studio_batches b ON s.batch_id = b.id
      WHERE s.tenant_id = $1
        AND (s.stage_status = 'pending' OR (s.stage_status='in_progress' AND s.source_campaign_id IS NULL AND s.lease_until < CURRENT_TIMESTAMP))
        AND s.activation_status='active' AND NOT s.legacy_requires_review AND b.engine_kind IS NOT NULL
        AND s.scheduled_production_at <= CURRENT_TIMESTAMP
        AND b.status = 'active'
      ORDER BY s.scheduled_production_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `, [tId]);

    if (res.rowCount === 0) return null;

    const slot = res.rows[0];
    await client.query(`
      UPDATE content_studio_slots
      SET stage_status = 'in_progress', dispatch_owner=$2, lease_until=CURRENT_TIMESTAMP+INTERVAL '5 minutes', dispatched_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [slot.id, workerId]);

    return slot;
  });
}

/**
 * Retrieves calendar projection of slots and target accounts.
 */
export async function getCalendarProjection(tenantId = null, { startDate, endDate, timezone = 'Asia/Jakarta' } = {}) {
  const tId = tenantId || getActiveTenantId() || 'default_tenant';
  let query = `
    SELECT s.*, b.title as batch_title, b.source_kind as batch_source_kind, b.engine_kind as batch_engine_kind, b.configuration_json as batch_config,
           COALESCE(
             json_agg(
               json_build_object(
                 'id', t.id,
                 'account_id', t.account_id,
                 'platform', t.platform,
                 'scheduled_at', t.scheduled_at,
                 'status', t.status,
                 'publishing_job_id', t.publishing_job_id
               )
             ) FILTER (WHERE t.id IS NOT NULL), '[]'
           ) as targets
    FROM content_studio_slots s
    JOIN content_studio_batches b ON s.batch_id = b.id
    LEFT JOIN content_studio_targets t ON s.id = t.slot_id
    WHERE s.tenant_id = $1
  `;
  const params = [tId];

  if (startDate) {
    params.push(new Date(startDate).toISOString());
    query += ` AND s.scheduled_publish_at >= $${params.length}`;
  }
  if (endDate) {
    params.push(new Date(endDate).toISOString());
    query += ` AND s.scheduled_publish_at <= $${params.length}`;
  }

  query += ` GROUP BY s.id, b.title, b.source_kind, b.engine_kind, b.configuration_json ORDER BY s.scheduled_publish_at ASC`;

  const res = await pgQuery(query, params);
  return res.rows.map(slot=>({...slot,publishing_status:slot.targets.length && slot.targets.every(t=>['published','manual_published'].includes(t.status))?'published':slot.targets.some(t=>t.status==='scheduled')?'scheduled':slot.targets.some(t=>t.status==='scheduling')?'scheduling':'not_approved'}));
}

/**
 * Records final human publishing approval immutable record.
 */
export async function recordStudioApproval({
  slotId,
  tenantId = null,
  revisionHash,
  decision = 'approved',
  notes = '',
  actor = 'user'
}) {
  const tId = tenantId || getActiveTenantId() || 'default_tenant';
  const approvalId = `sta_${crypto.randomBytes(8).toString('hex')}`;

  const res = await pgQuery(`
    INSERT INTO content_studio_approvals (
      id, tenant_id, slot_id, revision_hash, decision, notes, actor, created_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP
    )
    RETURNING *
  `, [approvalId, tId, slotId, revisionHash, decision, notes, actor]);

  return res.rows[0];
}

/**
 * Appends an audit/checkpoint event for durable replay and reconciliation.
 */
export async function recordStudioEvent({
  batchId = null,
  slotId = null,
  tenantId = null,
  eventType,
  checkpointState = null,
  correlationId = null,
  payload = {},
  errorMessage = null
}) {
  const tId = tenantId || getActiveTenantId() || 'default_tenant';
  const eventId = `ste_${crypto.randomBytes(8).toString('hex')}`;

  await pgQuery(`
    INSERT INTO content_studio_events (
      id, tenant_id, batch_id, slot_id, event_type, checkpoint_state, correlation_id, payload_json, error_message, created_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, CURRENT_TIMESTAMP
    )
  `, [
    eventId,
    tId,
    batchId,
    slotId,
    eventType,
    checkpointState,
    correlationId,
    JSON.stringify(payload || {}),
    errorMessage
  ]);

  return eventId;
}
