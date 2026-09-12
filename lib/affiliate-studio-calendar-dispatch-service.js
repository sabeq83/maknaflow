import { pgQuery } from './db-pg.js';
import { getAuthorizedAffiliateBrand } from './affiliate-studio-brand-read-adapter.js';
import { recordLineage } from './affiliate-studio-lineage-repository.js';
import crypto from 'crypto';

/**
 * Dispatch selected content calendar schedules to Content Planner
 */
export async function dispatchCalendarSchedulesToPlanner({
  user,
  brandId,
  scheduleIds = [],
  targetPlannerId = null,
  programId = null
}) {
  if (!user || user.tenantId === '__none__') {
    throw new Error('Unauthorized user or missing tenant');
  }

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) {
    throw new Error('Authorized brand not found');
  }

  const tenantId = user.tenantId;

  if (!Array.isArray(scheduleIds) || scheduleIds.length === 0) {
    throw new Error('No scheduleIds provided for dispatch');
  }

  // 1. Fetch schedules
  const placeholders = scheduleIds.map((_, i) => `$${i + 2}`).join(', ');
  const schedulesRes = await pgQuery(
    `SELECT * FROM affiliate_content_schedules 
     WHERE tenant_id = $1 AND id IN (${placeholders})`,
    [tenantId, ...scheduleIds]
  );

  const schedules = schedulesRes.rows;
  if (schedules.length === 0) {
    throw new Error('No valid content schedules found for the given IDs');
  }

  // 2. Resolve or create target Content Planner
  let plannerId = targetPlannerId;
  if (!plannerId) {
    plannerId = `cp_aff_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const dateStr = new Date().toISOString().slice(0, 10);
    const plannerTitle = `[Affiliate] ${brand.name} — ${dateStr}`;

    await pgQuery(
      `INSERT INTO content_planners (
        id, tenant_id, brand_id, account_name, title, status, metadata_json, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, 'active', $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        plannerId,
        tenantId,
        brand.id,
        brand.name,
        plannerTitle,
        JSON.stringify({
          source: 'affiliate_studio_calendar_dispatch',
          brand_profile_id: brand.id,
          dispatched_count: schedules.length,
          dispatched_at: new Date().toISOString()
        })
      ]
    );
  }

  // If programId provided, link planner to program
  if (programId) {
    const linkId = `appl_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    await pgQuery(
      `INSERT INTO affiliate_program_planners (id, tenant_id, affiliate_program_id, content_planner_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, affiliate_program_id, content_planner_id) DO NOTHING`,
      [linkId, tenantId, programId, plannerId]
    );
  }

  const dispatchId = `dsp_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const createdRows = [];

  // 3. For each schedule, insert a planner row and record lineage
  for (let idx = 0; idx < schedules.length; idx++) {
    const item = schedules[idx];
    const rowId = `cpr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

    // Resolve CEP code / pillar
    const cepCode = item.cep_code || 'CEP-1: Problem-Solution';
    const platforms = Array.isArray(item.target_platforms)
      ? item.target_platforms
      : (typeof item.target_platforms === 'string' ? JSON.parse(item.target_platforms || '[]') : ['instagram', 'tiktok']);

    const rowMetadata = {
      source_schedule_id: item.id,
      dispatch_id: dispatchId,
      product_id: item.product_id,
      product_name: item.product_name,
      cep_code: cepCode,
      pillar_name: item.pillar_name,
      promotion_context: item.promotion_context || null,
      target_platforms: platforms,
      scheduled_at: item.scheduled_at,
      approval_status: 'review'
    };

    // Insert into content_planner_rows
    await pgQuery(
      `INSERT INTO content_planner_rows (
        id, tenant_id, planner_id, title, angle, hook, body, cta, status, metadata_json, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        rowId,
        tenantId,
        plannerId,
        `${item.product_name || 'Brand Content'} — ${cepCode}`,
        cepCode,
        `[Draft AI Hook] Temukan rahasia terbaik untuk ${item.product_name || 'kebutuhan Anda'}!`,
        `[Draft Voice-Over] Menghadirkan solusi praktis dan efisien dalam rutinitas harian.`,
        `Cek link di bio untuk penawaran khusus ${item.promotion_context || 'hari ini'}!`,
        JSON.stringify(rowMetadata)
      ]
    );

    // Record continuous lineage
    await recordLineage({
      tenantId,
      brandProfileId: brand.id,
      affiliateProgramId: programId,
      contentScheduleId: item.id,
      contentPlannerId: plannerId,
      plannerRowId: rowId,
      lifecycleStage: 'planner',
      metadata: {
        dispatch_id: dispatchId,
        product_name: item.product_name,
        cep_code: cepCode,
        target_platforms: platforms,
        scheduled_at: item.scheduled_at
      }
    });

    // Update schedule status to in_production
    await pgQuery(
      `UPDATE affiliate_content_schedules 
       SET status = 'in_production', updated_at = CURRENT_TIMESTAMP 
       WHERE tenant_id = $1 AND id = $2`,
      [tenantId, item.id]
    );

    createdRows.push({
      rowId,
      scheduleId: item.id,
      productName: item.product_name,
      cepCode
    });
  }

  return {
    success: true,
    dispatchId,
    plannerId,
    rowsCreated: createdRows.length,
    schedulesCount: schedules.length,
    rows: createdRows
  };
}

/**
 * Get details of a dispatch by dispatchId
 */
export async function getDispatchDetails(user, brandId, dispatchId) {
  if (!user || user.tenantId === '__none__') return null;

  const brand = await getAuthorizedAffiliateBrand(user, brandId);
  if (!brand) return null;

  const tenantId = user.tenantId;

  const lineageRes = await pgQuery(
    `SELECT * FROM affiliate_content_lineage 
     WHERE tenant_id = $1 AND brand_profile_id = $2 AND metadata->>'dispatch_id' = $3
     ORDER BY created_at ASC`,
    [tenantId, brand.id, dispatchId]
  );

  return {
    dispatchId,
    brandId: brand.id,
    brandName: brand.name,
    itemsCount: lineageRes.rows.length,
    lineageItems: lineageRes.rows
  };
}
