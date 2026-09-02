import crypto from 'crypto';
import { pgQuery } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';

function validateSafeAudit(audit) {
  if (JSON.stringify(audit).includes('base64,')) {
    throw new Error('START_FRAME_AUDIT_CONTAINS_BASE64');
  }
  if (audit.requires_product_reference && audit.product_reference_count !== undefined && audit.product_reference_count !== 1) {
    throw new Error('OPC_PRODUCT_REFERENCE_AUDIT_INVARIANT_FAILED');
  }
  if (!audit.requires_product_reference && Number(audit.product_reference_count || 0) > 0) {
    throw new Error('OPC_PRODUCT_REFERENCE_LEAK_AUDIT_INVARIANT_FAILED');
  }
  if (audit.requires_product_reference && audit.reference_sha256 && audit.payload_reference_sha256 && audit.reference_sha256 !== audit.payload_reference_sha256) {
    throw new Error('OPC_PRODUCT_REFERENCE_SHA_MISMATCH');
  }
}

/**
 * Create a new start frame request audit in 'prepared' status.
 */
export async function createStartFrameRequestAudit(audit) {
  validateSafeAudit(audit);
  const auditId = audit.id || `osfra_${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`;
  const tenantId = audit.tenant_id || getActiveTenantId();

  await pgQuery(
    `INSERT INTO opc_start_frame_request_audits (
      id, tenant_id, campaign_id, campaign_item_id, clip_index, origin,
      requires_product_reference, requirement_reason, reference_count,
      reference_source_field, reference_sha256, prompt_sha256, request_fingerprint,
      provider_task_id, reference_name, reference_position, reference_mime_type,
      reference_byte_length, requested_model, effective_model, lane_key, lane_mode,
      lane_wait_started_at, lane_acquired_at, sibling_active_count_at_submit,
      lifecycle_status, provider_submitted_at, provider_completed_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
      $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28
    )
    ON CONFLICT (id) DO UPDATE SET
      provider_task_id = COALESCE(EXCLUDED.provider_task_id, opc_start_frame_request_audits.provider_task_id),
      lane_key = COALESCE(EXCLUDED.lane_key, opc_start_frame_request_audits.lane_key),
      lane_mode = COALESCE(EXCLUDED.lane_mode, opc_start_frame_request_audits.lane_mode),
      lifecycle_status = EXCLUDED.lifecycle_status,
      provider_submitted_at = COALESCE(EXCLUDED.provider_submitted_at, opc_start_frame_request_audits.provider_submitted_at),
      provider_completed_at = COALESCE(EXCLUDED.provider_completed_at, opc_start_frame_request_audits.provider_completed_at)`,
    [
      auditId,
      tenantId,
      String(audit.campaign_id || ''),
      String(audit.campaign_item_id || ''),
      Number(audit.clip_index) || 1,
      audit.origin || 'unknown',
      Boolean(audit.requires_product_reference),
      audit.requirement_reason || null,
      Number(audit.reference_count || 0),
      audit.reference_source_field || null,
      audit.reference_sha256 || null,
      audit.prompt_sha256 || '',
      audit.request_fingerprint || '',
      audit.provider_task_id || null,
      audit.reference_name || null,
      audit.reference_position !== undefined ? audit.reference_position : null,
      audit.reference_mime_type || null,
      audit.reference_byte_length || null,
      audit.requested_model || null,
      audit.effective_model || null,
      audit.lane_key || null,
      audit.lane_mode || null,
      audit.lane_wait_started_at || null,
      audit.lane_acquired_at || null,
      audit.sibling_active_count_at_submit !== undefined ? audit.sibling_active_count_at_submit : null,
      audit.lifecycle_status || 'prepared',
      audit.provider_submitted_at || null,
      audit.provider_completed_at || null
    ]
  );
  return auditId;
}

/**
 * Update an existing audit record with provider task ID or terminal status
 */
export async function updateStartFrameRequestAudit(auditId, updates = {}) {
  if (!auditId) return;
  validateSafeAudit(updates);
  const fields = [];
  const values = [];
  let paramIdx = 1;

  const allowedFields = [
    'provider_task_id', 'lane_key', 'lane_mode', 'lane_wait_started_at',
    'lane_acquired_at', 'sibling_active_count_at_submit', 'lifecycle_status',
    'provider_submitted_at', 'provider_completed_at'
  ];

  for (const key of allowedFields) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = $${paramIdx++}`);
      values.push(updates[key]);
    }
  }

  if (!fields.length) return;
  values.push(auditId);
  await pgQuery(
    `UPDATE opc_start_frame_request_audits SET ${fields.join(', ')} WHERE id = $${paramIdx}`,
    values
  );
}

/**
 * Backward-compatible recorder for initial/legacy calls
 */
export async function recordStartFrameRequestAudit(audit, providerTaskId = null) {
  const payload = {
    ...audit,
    provider_task_id: providerTaskId || audit.provider_task_id,
    lifecycle_status: providerTaskId ? 'submitted' : (audit.lifecycle_status || 'prepared'),
    provider_submitted_at: providerTaskId ? new Date() : null
  };
  return createStartFrameRequestAudit(payload);
}
