/**
 * Affiliate Content Schedules Repository
 * Data access and Repliz publishing dispatch for Affiliate Studio Content Calendar.
 */

import { getPgPool, pgQuery } from './db-pg.js';
import crypto from 'crypto';

/**
 * List affiliate content schedules with monthly / range / brand filtering.
 */
export async function listAffiliateSchedules({
  tenantId = 'default_tenant',
  brandName,
  month,
  year,
  startDate,
  endDate,
  status,
  limit = 200,
  offset = 0
} = {}) {
  const conditions = ['s.tenant_id = $1'];
  const params = [tenantId];
  let paramIdx = 2;

  if (brandName && brandName !== 'all') {
    conditions.push(`s.brand_name = $${paramIdx++}`);
    params.push(brandName);
  }

  if (status && status !== 'all') {
    conditions.push(`s.status = $${paramIdx++}`);
    params.push(status);
  }

  if (startDate && endDate) {
    conditions.push(`s.scheduled_at >= $${paramIdx++}`);
    params.push(new Date(startDate).toISOString());
    conditions.push(`s.scheduled_at <= $${paramIdx++}`);
    params.push(new Date(endDate).toISOString());
  } else if (month !== undefined && year !== undefined) {
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    conditions.push(`s.scheduled_at >= $${paramIdx++}`);
    params.push(start.toISOString());
    conditions.push(`s.scheduled_at <= $${paramIdx++}`);
    params.push(end.toISOString());
  }

  const whereClause = conditions.join(' AND ');

  const sql = `
    SELECT 
      s.*,
      p.product_name AS db_product_name,
      p.photo_url AS db_product_photo_url,
      p.price AS db_product_price,
      p.commission_rate AS db_product_commission_rate,
      bp.affiliate_link AS brand_affiliate_link
    FROM affiliate_content_schedules s
    LEFT JOIN products p ON (s.product_id = p.id AND (p.tenant_id = s.tenant_id OR p.tenant_id IS NULL))
    LEFT JOIN brand_products bp ON (s.product_id = bp.product_id AND bp.tenant_id = s.tenant_id)
    WHERE ${whereClause}
    ORDER BY s.scheduled_at ASC, s.created_at ASC
    LIMIT $${paramIdx++} OFFSET $${paramIdx++}
  `;

  const res = await pgQuery(sql, [...params, limit, offset]);
  return res.rows;
}

/**
 * Batch create affiliate content schedule rows from plan creation modal.
 */
export async function createAffiliatePlanSchedules({
  tenantId = 'default_tenant',
  planType = 'product_campaign', // 'brand_editorial' | 'product_campaign'
  brandName,
  productId = null,
  productName = null,
  promotionContext = '',
  targetPlatforms = ['instagram', 'tiktok', 'facebook'],
  targetAccountIds = [],
  items = [], // Array of { cep_code, pillar_name, scheduled_at }
  createdBy = null
} = {}) {
  if (!brandName) throw new Error('Brand name wajib diisi.');
  if (!Array.isArray(items) || items.length === 0) throw new Error('Minimal satu baris jadwal harus disediakan.');

  const pool = getPgPool();
  const client = await pool.connect();
  const createdRows = [];

  try {
    await client.query('BEGIN');

    for (const item of items) {
      const scheduleId = `sched_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const scheduledIso = new Date(item.scheduled_at).toISOString();

      const insertRes = await client.query(`
        INSERT INTO affiliate_content_schedules (
          id, tenant_id, plan_type, brand_name, product_id, product_name,
          cep_code, pillar_name, promotion_context, target_platforms, target_account_ids,
          scheduled_at, status, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14
        )
        RETURNING *
      `, [
        scheduleId,
        tenantId,
        planType,
        brandName,
        productId,
        productName || item.product_name || null,
        item.cep_code || null,
        item.pillar_name || null,
        promotionContext || item.promotion_context || null,
        JSON.stringify(targetPlatforms),
        JSON.stringify(targetAccountIds),
        scheduledIso,
        'planned',
        createdBy
      ]);

      createdRows.push(insertRes.rows[0]);
    }

    await client.query('COMMIT');
    return createdRows;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Update an individual schedule item (date, time, status, cep/pillar).
 */
export async function updateAffiliateSchedule(tenantId = 'default_tenant', scheduleId, updateData = {}) {
  const allowed = [
    'scheduled_at', 'cep_code', 'pillar_name', 'promotion_context',
    'product_id', 'product_name', 'target_platforms', 'target_account_ids',
    'status', 'content_flow_id', 'publishing_job_ids'
  ];

  const sets = [];
  const params = [scheduleId, tenantId];
  let paramIdx = 3;

  for (const [key, value] of Object.entries(updateData)) {
    if (allowed.includes(key)) {
      if (['target_platforms', 'target_account_ids', 'publishing_job_ids'].includes(key)) {
        sets.push(`${key} = $${paramIdx++}::jsonb`);
        params.push(JSON.stringify(value));
      } else if (key === 'scheduled_at') {
        sets.push(`${key} = $${paramIdx++}`);
        params.push(new Date(value).toISOString());
      } else {
        sets.push(`${key} = $${paramIdx++}`);
        params.push(value);
      }
    }
  }

  if (sets.length === 0) return null;

  sets.push(`updated_at = CURRENT_TIMESTAMP`);

  const sql = `
    UPDATE affiliate_content_schedules
    SET ${sets.join(', ')}
    WHERE id = $1 AND tenant_id = $2
    RETURNING *
  `;

  const res = await pgQuery(sql, params);
  return res.rows[0] || null;
}

/**
 * Delete a schedule item.
 */
export async function deleteAffiliateSchedule(tenantId = 'default_tenant', scheduleId) {
  const res = await pgQuery(`
    DELETE FROM affiliate_content_schedules
    WHERE id = $1 AND tenant_id = $2
    RETURNING id
  `, [scheduleId, tenantId]);
  return res.rowCount > 0;
}
